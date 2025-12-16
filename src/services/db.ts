import {
    collection,
    addDoc,
    serverTimestamp,
    doc,
    runTransaction,
    onSnapshot,
    query,
    where,
    orderBy,
    Timestamp,
    getDocs,
    limit,
    deleteDoc,
    getDoc,
    setDoc,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { Debt, DebtStatus, PaymentLog, User, Contact, Installment } from '../types';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';

export const createDebt = async (
    currentUserId: string,
    currentUserName: string,
    targetUserId: string, // This can be a UID or a Phone Number
    targetUserName: string,
    amount: number,
    type: 'LENDING' | 'BORROWING',
    currency: string = 'TRY',
    note?: string,
    dueDate?: Date,
    installments?: Installment[],
    canBorrowerAddPayment?: boolean,
    requestApproval?: boolean,
    initialPayment: number = 0
) => {
    try {
        const isLending = type === 'LENDING';

        // ... (existing logic for target determination) ...
        // Determine if targetUserId is a phone number or UID
        // If it's a phone number (length <= 15 and digits), try to find a user
        let finalTargetId = targetUserId;
        const cleanTarget = cleanPhoneNumber(targetUserId);

        // If targetUserId looks like a phone number (not a long UID)
        // Adjust check: UIDs are usually 28 chars. Standard E.164 is 13 chars max usually.
        // cleanTarget will be E.164 if it's a phone.
        if (targetUserId.length <= 15 || targetUserId.startsWith('+')) {
            const existingUser = await searchUserByPhone(cleanTarget);
            if (existingUser) {
                finalTargetId = existingUser.uid;
            } else {
                finalTargetId = cleanTarget; // Use cleaned phone as ID if no user found
            }
        }

        const lenderId = isLending ? currentUserId : finalTargetId;
        const lenderName = isLending ? currentUserName : targetUserName;
        const borrowerId = isLending ? finalTargetId : currentUserId;
        const borrowerName = isLending ? targetUserName : currentUserName;

        // CHECK PREFERENCES: Check if the counterparty has auto-approve enabled
        const counterpartyId = isLending ? borrowerId : lenderId;

        let initialStatus: DebtStatus = 'PENDING';

        if (counterpartyId.length > 20) { // Simple check for UID vs Phone
            const counterpartyUser = await getDoc(doc(db, 'users', counterpartyId));
            if (counterpartyUser.exists()) {
                const userData = counterpartyUser.data() as User;
                if (userData.preferences?.autoApproveDebt) {
                    initialStatus = 'ACTIVE'; // active = approved
                }
            }
        }

        // If explicitly requesting approval, force PENDING
        if (requestApproval) {
            initialStatus = 'PENDING';
        }

        // Calculate amounts
        const remainingAmount = amount - initialPayment;
        // If initial payment covers everything (unlikely but possible), status might need to be PAID if auto-approved?
        // But usually down payment is partial. 

        // If remaining is 0 and status was ACTIVE, it becomes PAID immediately.
        if (remainingAmount <= 0 && initialStatus === 'ACTIVE') {
            initialStatus = 'PAID';
        } else if (amount > remainingAmount && remainingAmount > 0 && initialStatus === 'ACTIVE') {
            initialStatus = 'PARTIALLY_PAID';
        }


        const debtData = {
            lenderId,
            lenderName,
            borrowerId,
            borrowerName,
            originalAmount: amount,
            remainingAmount: remainingAmount,
            currency,
            status: initialStatus,
            participants: [lenderId, borrowerId],
            createdAt: serverTimestamp(),
            createdBy: currentUserId,
            ...(dueDate && { dueDate: Timestamp.fromDate(dueDate) }),
            ...(note && { note }),
            ...(installments && { installments }),
            ...(canBorrowerAddPayment && { canBorrowerAddPayment }),
        };

        // Use batch or transaction? 
        // Simple addDoc is fine, but we need logs.
        // Let's use runTransaction or just batch to be safe, but since createDebt was simple, 
        // we can just stick to addDoc + subcollection adds. Atomic is better but for MVP...
        // Actually, let's keep it simple as implemented before.

        const docRef = await addDoc(collection(db, 'debts'), debtData);

        const batch = writeBatch(db); // Firestore batch for logs

        // Log 1: Creation
        const log1Ref = doc(collection(db, `debts/${docRef.id}/logs`));
        batch.set(log1Ref, { // Using setDoc for specific ID if generated, or just addDoc. Batch needs ref.
            type: 'INITIAL_CREATION',
            previousRemaining: amount,
            newRemaining: amount,
            performedBy: currentUserId,
            timestamp: serverTimestamp(),
            note: 'Borç oluşturuldu',
        });

        // Log 2: Initial Payment (if any)
        if (initialPayment > 0) {
            const log2Ref = doc(collection(db, `debts/${docRef.id}/logs`));
            batch.set(log2Ref, {
                type: 'PAYMENT',
                amountPaid: initialPayment,
                previousRemaining: amount,
                newRemaining: remainingAmount,
                performedBy: currentUserId,
                timestamp: serverTimestamp(), // Ideally slightly after, but serverTimestamp is resolution
                note: 'Peşinat / İlk Ödeme'
            });
        }

        await batch.commit();

        // Auto-Contact Creation Logic
        // If I am the Creator (always true here as currentUserId), and the counterparty is NOT me
        if (currentUserId) {
            const counterpartyId = isLending ? borrowerId : lenderId;
            const counterpartyName = isLending ? borrowerName : lenderName;

            // If counterparty is a phone number or a user that might not be in my contacts
            // We blindly try to add/update contact. addContact handles duplicates nicely.
            // We use the cleaned phone for the ID check if possible.
            let contactPhone = '';
            if (counterpartyId.length <= 15) {
                contactPhone = counterpartyId;
            } else {
                // If it's a UID, we might need the phone. 
                // In this flow, check if we started with a phone target.
                if (cleanTarget && cleanTarget.length <= 15) {
                    contactPhone = cleanTarget;
                }
            }

            if (contactPhone) {
                // Fire and forget contact addition to ensure names show up in Dashboard
                addContact(currentUserId, counterpartyName, contactPhone, counterpartyId.length > 20 ? counterpartyId : undefined)
                    .catch(err => console.error("Auto-add contact failed", err));
            }
        }

        return docRef.id;
    } catch (error) {
        throw error;
    }
};

export const makePayment = async (debtId: string, amount: number, performedBy: string, note?: string) => {
    try {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists()) {
                throw new Error("Debt document does not exist!");
            }

            const debtData = debtDoc.data() as Debt;
            const newRemaining = debtData.remainingAmount - amount;

            if (newRemaining < 0) {
                throw new Error("Payment amount exceeds remaining debt!");
            }

            let newStatus: DebtStatus = debtData.status;
            if (newRemaining === 0) {
                newStatus = 'PAID';
            } else {
                newStatus = 'PARTIALLY_PAID';
            }

            // Update debt document
            transaction.update(debtRef, {
                remainingAmount: newRemaining,
                status: newStatus
            });

            // Add payment log
            const logRef = doc(collection(db, `debts/${debtId}/logs`));
            transaction.set(logRef, {
                type: 'PAYMENT',
                amountPaid: amount,
                previousRemaining: debtData.remainingAmount,
                newRemaining: newRemaining,
                performedBy,
                timestamp: serverTimestamp(),
                note: note || 'Ödeme yapıldı'
            });
        });
    } catch (error) {
        throw error;
    }
};

export const subscribeToUserDebts = (userId: string, callback: (debts: Debt[]) => void) => {
    const q = query(
        collection(db, 'debts'),
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
        callback(debts);
    });
};

export const subscribeToDebtDetails = (debtId: string, callback: (debt: Debt) => void) => {
    return onSnapshot(doc(db, 'debts', debtId), (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() } as Debt);
        }
    });
};

export const subscribeToPaymentLogs = (debtId: string, callback: (logs: PaymentLog[]) => void) => {
    const q = query(collection(db, `debts/${debtId}/logs`), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentLog));
        callback(logs);
    });
};

export const respondToDebtRequest = async (debtId: string, status: 'ACTIVE' | 'REJECTED', performedBy: string) => {
    try {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists()) {
                throw new Error("Debt document does not exist!");
            }

            // Update debt status
            transaction.update(debtRef, { status });

            // Add log
            const logRef = doc(collection(db, `debts/${debtId}/logs`));
            transaction.set(logRef, {
                type: 'NOTE_ADDED', // Using NOTE_ADDED as a generic type for status change for now, or could add STATUS_CHANGE type
                previousRemaining: debtDoc.data().remainingAmount,
                newRemaining: debtDoc.data().remainingAmount,
                performedBy,
                timestamp: serverTimestamp(),
                note: status === 'ACTIVE' ? 'Borç isteği onaylandı' : 'Borç isteği reddedildi'
            });
        });
    } catch (error) {
        throw error;
    }
};

export const searchUserByPhone = async (phoneNumber: string): Promise<User | null> => {
    const cleanPhone = cleanPhoneNumber(phoneNumber);

    const q = query(
        collection(db, 'users'),
        where('phoneNumber', '==', cleanPhone),
        limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }

    const doc = querySnapshot.docs[0];
    return { uid: doc.id, ...doc.data() } as User;
};
// --- Contacts Services ---

export const addContact = async (currentUserId: string, name: string, phoneNumber: string, linkedUserId?: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');

        // Check if phone number already exists (Try strict clean first)
        let q = query(contactsRef, where('phoneNumber', '==', cleanPhone));
        let querySnapshot = await getDocs(q);

        // Double check: If strict failed, maybe stored as non-standard? 
        // Example: DB has "0555..." but clean is "+90555..."
        // Or DB has "+90 555" (spaces).
        if (querySnapshot.empty && phoneNumber !== cleanPhone) {
            const q2 = query(contactsRef, where('phoneNumber', '==', phoneNumber));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
                querySnapshot = snap2;
            }
        }

        // Also check if stripped version matches (e.g. DB has 5551234567, clean is +905551234567)
        if (querySnapshot.empty) {
            const simple = phoneNumber.replace(/\D/g, '');
            if (simple.length > 5 && simple !== cleanPhone && simple !== phoneNumber) {
                const q3 = query(contactsRef, where('phoneNumber', '==', simple));
                const snap3 = await getDocs(q3);
                if (!snap3.empty) querySnapshot = snap3;
            }
        }

        if (!querySnapshot.empty) {
            // Update existing contact if name changed, or just return ID
            const existingDoc = querySnapshot.docs[0];
            if (existingDoc.data().name !== name) {
                await updateDoc(doc(contactsRef, existingDoc.id), { name });
            }
            return existingDoc.id;
        }

        // Check if this phone corresponds to a system user
        let finalLinkedUserId = linkedUserId || null;
        if (!finalLinkedUserId) {
            const systemUser = await searchUserByPhone(cleanPhone);
            if (systemUser) {
                finalLinkedUserId = systemUser.uid;
            }
        }

        const docRef = await addDoc(contactsRef, {
            name,
            phoneNumber: cleanPhone,
            linkedUserId: finalLinkedUserId,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding contact:", error);
        throw error;
    }
};

export const getContacts = async (userId: string) => {
    try {
        const contactsRef = collection(db, 'users', userId, 'contacts');
        const q = query(contactsRef, orderBy('name'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[];
    } catch (error) {
        console.error("Error getting contacts:", error);
        return [];
    }
};

export const deleteContact = async (userId: string, contactId: string) => {
    try {
        await deleteDoc(doc(db, 'users', userId, 'contacts', contactId));
    } catch (error) {
        console.error("Error deleting contact:", error);
        throw error;
    }
};

export const updateContact = async (userId: string, contactId: string, data: Partial<Contact>) => {
    try {
        // If updating phone, make sure to clean it
        const updateData = { ...data };
        if (updateData.phoneNumber) {
            updateData.phoneNumber = cleanPhoneNumber(updateData.phoneNumber);
        }

        const contactRef = doc(db, 'users', userId, 'contacts', contactId);
        await updateDoc(contactRef, updateData);
    } catch (error) {
        console.error("Error updating contact:", error);
        throw error;
    }
};

export const searchContacts = async (userId: string, searchQuery: string) => {
    try {
        const contacts = await getContacts(userId);
        const lowerQuery = searchQuery.toLowerCase();
        // search logic should probably be smarter with phone cleaning too if possible,
        // but simple includes check works for names. For phones, we might want to check against dirty & clean.
        return contacts.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.phoneNumber.includes(searchQuery)
        );
    } catch (error) {
        console.error("Error searching contacts:", error);
        return [];
    }
};



// Redefined logic below for claimDebts to include Contact Linking
// Enhanced Claiming Logic for Data Integrity
export const claimLegacyDebts = async (userId: string, phoneNumber: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const affectedUserIds = new Set<string>();

        // We need to check both Lender and Borrower fields for the Phone Number
        // And replace it with the UID.

        // 1. Where I am the LENDER (as Phone)
        const qLender = query(collection(db, 'debts'), where('lenderId', '==', cleanPhone));
        const lenderSnapshot = await getDocs(qLender);

        const lenderUpdates = lenderSnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.borrowerId && data.borrowerId.length > 20) affectedUserIds.add(data.borrowerId);

            return runTransaction(db, async (transaction) => {
                const debtRef = doc.ref;
                const debtDoc = await transaction.get(debtRef);
                if (!debtDoc.exists()) return;

                const currentData = debtDoc.data();
                // Security Check: If already claimed by another UID, skip?
                // Assuming phone uniqueness, this is safe.

                const participants = currentData.participants || [];
                // Remove phone, Add UID
                const phoneIndex = participants.indexOf(cleanPhone);
                if (phoneIndex > -1) participants.splice(phoneIndex, 1);
                if (!participants.includes(userId)) participants.push(userId);

                transaction.update(debtRef, {
                    lenderId: userId,
                    participants
                });
            });
        });

        // 2. Where I am the BORROWER (as Phone)
        const qBorrower = query(collection(db, 'debts'), where('borrowerId', '==', cleanPhone));
        const borrowerSnapshot = await getDocs(qBorrower);

        const borrowerUpdates = borrowerSnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.lenderId && data.lenderId.length > 20) affectedUserIds.add(data.lenderId);

            return runTransaction(db, async (transaction) => {
                const debtRef = doc.ref;
                const debtDoc = await transaction.get(debtRef);
                if (!debtDoc.exists()) return;

                const currentData = debtDoc.data();
                const participants = currentData.participants || [];

                // Remove phone, Add UID
                const phoneIndex = participants.indexOf(cleanPhone);
                if (phoneIndex > -1) participants.splice(phoneIndex, 1);
                if (!participants.includes(userId)) participants.push(userId);

                transaction.update(debtRef, {
                    borrowerId: userId,
                    participants
                });
            });
        });

        await Promise.all([...lenderUpdates, ...borrowerUpdates]);

        // 3. Link Contacts for Affected Users (Previous Logic)
        // For each user who had a debt with me (as phone), find their contact for me and update link
        for (const otherUserId of affectedUserIds) {
            const contactsRef = collection(db, 'users', otherUserId, 'contacts');
            const q = query(contactsRef, where('phoneNumber', '==', cleanPhone));
            const snaps = await getDocs(q);

            if (!snaps.empty) {
                const batch = writeBatch(db);
                snaps.docs.forEach(d => {
                    batch.update(d.ref, { linkedUserId: userId });
                });
                await batch.commit();
            }
        }

        console.log(`Successfully claimed legacy debts for ${userId} (${cleanPhone})`);

    } catch (error) {
        console.error("Error claiming legacy debts:", error);
        throw error;
    }
};

// Alias for backward compatibility if needed, though we should update calls.
export const claimDebts = claimLegacyDebts;

export const subscribeToContacts = (userId: string, callback: (contacts: Contact[]) => void) => {
    const contactsRef = collection(db, 'users', userId, 'contacts');
    const q = query(contactsRef, orderBy('name'));

    return onSnapshot(q, (snapshot) => {
        const contacts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[];
        callback(contacts);
    });
};



export const updateUserPreferences = async (userId: string, preferences: User['preferences']) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { preferences });
    } catch (error) {
        console.error("Error updating user preferences:", error);
        throw error;
    }
};

export const declarePayment = async (debtId: string, amount: number, note: string, userId: string, installmentId?: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        const debtSnap = await getDoc(debtRef);

        if (!debtSnap.exists()) throw new Error('Debt not found');
        const debtData = debtSnap.data() as Debt;

        // Create a log entry for the declaration
        const logRef = doc(collection(db, 'debts', debtId, 'logs'));
        await setDoc(logRef, {
            type: 'PAYMENT_DECLARATION',
            amountPaid: amount,
            previousRemaining: debtData.remainingAmount,
            newRemaining: debtData.remainingAmount, // Doesn't change yet
            performedBy: userId,
            timestamp: serverTimestamp(),
            note: note,
            status: 'PENDING',
            ...(installmentId && { installmentId })
        });
    } catch (error) {
        console.error("Error declaring payment:", error);
        throw error;
    }
};

export const confirmPayment = async (debtId: string, paymentId: string, currentUserId: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        const logRef = doc(db, 'debts', debtId, 'logs', paymentId);

        await runTransaction(db, async (transaction) => {
            const debtDoc = await transaction.get(debtRef);
            const logDoc = await transaction.get(logRef);

            if (!debtDoc.exists() || !logDoc.exists()) {
                throw new Error("Document does not exist!");
            }

            const debtData = debtDoc.data() as Debt;
            const logData = logDoc.data() as PaymentLog;

            // Security Check: Only Lender can confirm payments
            if (debtData.lenderId !== currentUserId) {
                throw new Error("Only the lender can confirm payments.");
            }

            if (logData.status !== 'PENDING') {
                throw new Error("Payment is not pending!");
            }

            const amountPaid = logData.amountPaid || 0;
            const newRemaining = debtData.remainingAmount - amountPaid;
            let newStatus = debtData.status;

            if (newRemaining <= 0) {
                newStatus = 'PAID';
            } else if (newRemaining < debtData.originalAmount) {
                newStatus = 'PARTIALLY_PAID';
            }

            // Update Installments Logic
            let updatedInstallments = debtData.installments;
            if (debtData.installments && debtData.installments.length > 0) {
                updatedInstallments = [...debtData.installments];
                let remainingPayment = amountPaid;

                // If specific installment targeted
                if (logData.installmentId) {
                    const targetIndex = updatedInstallments.findIndex(i => i.id === logData.installmentId);
                    if (targetIndex !== -1) {
                        const targetInst = updatedInstallments[targetIndex];

                        // Mark target as paid
                        updatedInstallments[targetIndex] = {
                            ...targetInst,
                            isPaid: true,
                            paidAt: Timestamp.now()
                        };
                        remainingPayment -= targetInst.amount;
                    }
                }

                // Distribute remaining payment (overpayment or general payment)
                if (remainingPayment > 0) {
                    for (let i = 0; i < updatedInstallments.length; i++) {
                        if (remainingPayment <= 0) break;

                        if (!updatedInstallments[i].isPaid) {
                            if (remainingPayment >= updatedInstallments[i].amount) {
                                updatedInstallments[i] = {
                                    ...updatedInstallments[i],
                                    isPaid: true,
                                    paidAt: Timestamp.now()
                                };
                                remainingPayment -= updatedInstallments[i].amount;
                            } else {
                                // Partial payment of an installment - logic can be complex
                                // For now, we only mark full payments or reduce amount?
                                // Let's keep it simple: Only mark as paid if fully covered.
                                // Or we could update the installment amount? 
                                // Let's just leave it as unpaid but debt remaining decreases.
                                // Ideally, we should split the installment or track partial.
                                // For this MVP, we won't split installments.
                            }
                        }
                    }
                }
            }

            // Update Debt
            transaction.update(debtRef, {
                remainingAmount: newRemaining,
                status: newStatus,
                ...(updatedInstallments && { installments: updatedInstallments })
            });

            // Update Log
            transaction.update(logRef, {
                status: 'APPROVED',
                newRemaining: newRemaining,
                type: 'PAYMENT'
            });
        });
    } catch (error) {
        console.error("Error confirming payment:", error);
        throw error;
    }
};

export const rejectPayment = async (debtId: string, paymentId: string) => {
    try {
        const logRef = doc(db, 'debts', debtId, 'logs', paymentId);
        await updateDoc(logRef, {
            status: 'REJECTED'
        });
    } catch (error) {
        console.error("Error rejecting payment:", error);
        throw error;
    }
};

// --- Debt Management (Phase 8) ---

export const softDeleteDebt = async (debtId: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        await updateDoc(debtRef, {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error soft deleting debt:", error);
        throw error;
    }
};

export const restoreDebt = async (debtId: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        await updateDoc(debtRef, {
            isDeleted: false,
            deletedAt: null
        });
    } catch (error) {
        console.error("Error restoring debt:", error);
        throw error;
    }
};

export const permanentlyDeleteDebt = async (debtId: string, currentUserId: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        const debtDoc = await getDoc(debtRef);

        if (!debtDoc.exists()) return;

        const data = debtDoc.data();
        if (!data.participants.includes(currentUserId)) {
            throw new Error("Unauthorized to delete this debt.");
        }

        await deleteDoc(debtRef);
    } catch (error) {
        console.error("Error permanently deleting debt:", error);
        throw error;
    }
};

export const updateDebt = async (debtId: string, data: Partial<Debt>) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        await updateDoc(debtRef, data);
    } catch (error) {
        console.error("Error updating debt:", error);
        throw error;
    }
};
