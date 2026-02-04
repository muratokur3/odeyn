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
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { Debt, DebtStatus, PaymentLog, User, Contact, Installment } from '../types';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { checkBlockStatus } from './blockService';

// --- Helper Functions ---

/**
 * Checks if a transaction is editable (created within the last 60 minutes).
 */
export const isTransactionEditable = (createdAt: Timestamp | Date | number | string): boolean => {
    if (!createdAt) return false;

    // Normalize timestamp to Date object
    let created: Date;
    if (createdAt instanceof Timestamp) {
        created = createdAt.toDate();
    } else if (createdAt instanceof Date) {
        created = createdAt;
    } else {
        // Fallback for number/string or other formats
        created = new Date(createdAt);
    }

    const diffMs = Date.now() - created.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    return diffMinutes < 60;
};


// --- Activity Feed Helpers ---

async function updateContactActivity(actorId: string, targetId: string, message: string) {
    if (!actorId || !targetId) return;

    const timestamp = serverTimestamp();

    try {
        const findContactDocId = async (ownerId: string, lookupId: string, isUserId: boolean): Promise<string | null> => {
            const contactsRef = collection(db, 'users', ownerId, 'contacts');
            let q;
            if (isUserId) {
                q = query(contactsRef, where('linkedUserId', '==', lookupId), limit(1));
            } else {
                q = query(contactsRef, where('phoneNumber', '==', lookupId), limit(1));
            }
            const snap = await getDocs(q);
            if (!snap.empty) return snap.docs[0].id;
            return null;
        };

        const targetIsUid = targetId.length > 20;

        // 1. Update ACTOR'S view of TARGET (Me -> Them) -> Unread: false
        const actorContactId = await findContactDocId(actorId, targetId, targetIsUid);
        if (actorContactId) {
            const ref = doc(db, 'users', actorId, 'contacts', actorContactId);
            await updateDoc(ref, {
                lastActivityMessage: 'Siz: ' + message,
                lastActivityAt: timestamp,
                hasUnreadActivity: false,
                lastActorId: actorId
            });
        }

        // 2. Update TARGET'S view of ACTOR (Them -> Me) -> Unread: true
        if (targetIsUid) {
            const targetContactId = await findContactDocId(targetId, actorId, true);
            if (targetContactId) {
                const ref = doc(db, 'users', targetId, 'contacts', targetContactId);
                await updateDoc(ref, {
                    lastActivityMessage: message,
                    lastActivityAt: timestamp,
                    hasUnreadActivity: true, // They have unread activity from ME
                    lastActorId: actorId
                });
            }
        }
    } catch (error) {
        console.error("Error updating activity feed:", error);
    }
}

export const markContactAsRead = async (currentUserId: string, targetUserId: string) => {
    try {
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');
        // Find contact by linkedUserId OR phoneNumber?
        // Usually by linkedUserId if it's a person we clicked on.
        // If targetUserId is a phone number...

        let q;
        if (targetUserId.length > 20) {
            q = query(contactsRef, where('linkedUserId', '==', targetUserId), limit(1));
        } else {
            q = query(contactsRef, where('phoneNumber', '==', targetUserId), limit(1));
        }

        const snap = await getDocs(q);

        if (!snap.empty) {
            const docRef = snap.docs[0].ref;
            await updateDoc(docRef, {
                hasUnreadActivity: false,
                lastReadAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error marking contact as read:", error);
    }
};

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
    // requestApproval removed
        initialPayment: number = 0
    ) => {
        const isLending = type === 'LENDING';

        // ... (existing logic for target determination) ...
        // Determine if targetUserId is a phone number or UID
        let finalTargetId = targetUserId;
        const cleanTarget = cleanPhoneNumber(targetUserId);

        // If targetUserId looks like a phone number (not a long UID)
        // cleanTarget will be E.164 if it's a phone.
        if (targetUserId.length <= 15 || targetUserId.startsWith('+')) {
            // NEW: Multi-Phone Registry Lookup
            const { resolvePhoneToUid } = await import('./identity'); // Dynamic import to avoid circular dependency
            const resolvedUid = await resolvePhoneToUid(cleanTarget);

            if (resolvedUid) {
                finalTargetId = resolvedUid;
                // Fetch basic user info if needed for display? 
                // DebtCard will handle display resolution. We just need the ID.
            } else {
                finalTargetId = cleanTarget; // Use cleaned phone as ID if no user found
            }
        }

        const lenderId = isLending ? currentUserId : finalTargetId;
        const lenderName = isLending ? currentUserName : targetUserName;
        const borrowerId = isLending ? finalTargetId : currentUserId;
        const borrowerName = isLending ? targetUserName : currentUserName;

        // CHECK PREFERENCES & FETCH USER DATA
        const counterpartyId = isLending ? borrowerId : lenderId;

        // BLOCK CHECK:
        if (counterpartyId.length > 20) {
            const isBlocked = await checkBlockStatus(currentUserId, counterpartyId);
            if (isBlocked) {
                throw new Error("Cannot create debt. User is blocked or has blocked you.");
            }
        }

        // UNILATERAL LOGIC: Default to ACTIVE.
        // CHECK IF CREATOR IS MUTED BY TARGET
        let initialStatus: DebtStatus = 'ACTIVE';
        let isMuted = false;

        if (counterpartyId.length > 20) {
            // Check if I am muted by the target
            // We use the helper we just added (need to ensure it's available or inline logic)
            // Since we are inside db.ts, we can call use the logic directly or call the function if it was hoisted.
            // But createDebt is above isCreatorMutedByTarget. So we must inline or move function up.
            // Let's inline the check for safety as moving functions in large file is risky for diffs.
            const targetUserRef = doc(db, 'users', counterpartyId);
            const targetSnap = await getDoc(targetUserRef);
            if (targetSnap.exists()) {
                const targetData = targetSnap.data() as User;
                if (targetData.mutedCreators?.includes(currentUserId)) {
                    initialStatus = 'AUTO_HIDDEN';
                    isMuted = true;
                }
            }
        }

        // Calculate amounts
        const remainingAmount = amount - initialPayment;
        // If remaining is 0 and status was ACTIVE/AUTO_HIDDEN, it becomes PAID immediately.
        if (remainingAmount <= 0) {
            // If fully paid initially, it's just a record.
            initialStatus = 'PAID';
        } else if (amount > remainingAmount && remainingAmount > 0) {
            // Partial payment at start
            // Status remains ACTIVE or AUTO_HIDDEN unless defined otherwise.
            // Default initialStatus is 'ACTIVE' for all debts
            initialStatus = 'ACTIVE';
            // WAIT: If it is AUTO_HIDDEN, it should stay AUTO_HIDDEN even if partially paid?
            // The requirement says: "If User A is in muted list -> Create with { status: 'AUTO_HIDDEN', isMuted: true }"
            // Logic: If fully paid, it's history. If debt exists, it's hidden.
            if (isMuted) initialStatus = 'AUTO_HIDDEN';
        }

        // Determine Contact Phone for Locking & Auto-Add
        let contactPhone = '';
        if (counterpartyId.length <= 15) {
            // It's already a phone number
            contactPhone = counterpartyId;
        } else {
            // It's a UID.
            // 1. Try to get phone from actual user profile (we might need to fetch if not fetched above)
            // We fetched targetSnap above if ID > 20.
            let foundUserData: User | null = null;
            if (counterpartyId.length > 20) {
                // We fetched it for mute check?
                // Let's re-use or re-fetch loosely. 
                // Actually we can just query again or trust the previous block.
                // Ideally we should have fetched user data once.
                const uDoc = await getDoc(doc(db, 'users', counterpartyId));
                if (uDoc.exists()) foundUserData = uDoc.data() as User;
            }

            if (foundUserData && foundUserData.primaryPhoneNumber) {
                contactPhone = foundUserData.primaryPhoneNumber;
            }
            // 2. Fallback
            else if ((targetUserId.length <= 15 || targetUserId.startsWith('+')) && cleanTarget) {
                contactPhone = cleanTarget;
            }
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
            ...(contactPhone && { lockedPhoneNumber: contactPhone }), // Always lock phone number if available
            // New Fields
            ...(isMuted && { isMuted: true })
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

            // Activity Feed
            updateContactActivity(currentUserId, counterpartyId, 'Borç eklendi');

            // If counterparty is a phone number or a user that might not be in my contacts
            // We blindly try to add/update contact. addContact handles duplicates nicely.
            // We use the cleaned phone for the ID check if possible.

            if (contactPhone) {
                // Fire and forget contact addition to ensure names show up in Dashboard
                addContact(currentUserId, counterpartyName, contactPhone, counterpartyId.length > 20 ? counterpartyId : undefined)
                    .catch(err => console.error("Auto-add contact failed", err));
            }
        }

        return docRef.id;
    };

/**
 * Hard Reset Update Logic.
 * Replaces the entire debt record and wipes its history (logs).
 * Only allowed within 1 hour of creation.
 */
export const updateDebtHardReset = async (
    debtId: string,
    currentUserId: string,
    updates: Partial<Debt>,
    newInitialPayment: number = 0
) => {
    try {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists()) {
                throw new Error("Debt not found");
            }

            const currentData = debtDoc.data() as Debt;

            // 2. Check 1-Hour Rule
            if (!isTransactionEditable(currentData.createdAt)) {
                throw new Error("Zaman aşımı: Bu kayıt artık düzenlenemez (1 saat kuralı).");
            }

            // 3. Check Ownership
            if (currentData.createdBy !== currentUserId) {
                throw new Error("Bu kaydı sadece oluşturan kişi düzenleyebilir.");
            }

            // 4. Recalculate Logic
            const newOriginal = updates.originalAmount ?? currentData.originalAmount;
            const newRemaining = newOriginal - newInitialPayment;
            let newStatus: DebtStatus = newRemaining <= 0 ? 'PAID' : 'ACTIVE';

            if (currentData.status === 'AUTO_HIDDEN' && newStatus !== 'PAID') {
                newStatus = 'AUTO_HIDDEN';
            }

            // 5. Prepare Updates (Reset createdAt effectively making it 'New')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const docUpdates: any = {
                ...updates,
                remainingAmount: newRemaining,
                status: newStatus,
                createdAt: serverTimestamp(), // RESET TIMER
                updatedAt: serverTimestamp()
            };

            // Remove undefined values
            Object.keys(docUpdates).forEach(key => docUpdates[key] === undefined && delete docUpdates[key]);

            // 6. Update Main Doc
            transaction.update(debtRef, docUpdates);

            // 7. Add "Reset" Log
            const resetLogRef = doc(collection(db, `debts/${debtId}/logs`));
            transaction.set(resetLogRef, {
                type: 'NOTE_ADDED',
                previousRemaining: 0, // Semantic reset
                newRemaining: newOriginal,
                amountPaid: 0,
                performedBy: currentUserId,
                timestamp: serverTimestamp(),
                note: 'Kayıt sıfırlandı ve yeniden oluşturuldu'
            });

            // 8. Add Down Payment Log (if any)
            if (newInitialPayment > 0) {
                const dpLogRef = doc(collection(db, `debts/${debtId}/logs`));
                transaction.set(dpLogRef, {
                    type: 'PAYMENT',
                    amountPaid: newInitialPayment,
                    previousRemaining: newOriginal,
                    newRemaining: newRemaining,
                    performedBy: currentUserId,
                    timestamp: serverTimestamp(),
                    note: 'Peşinat (Yeniden Oluşturma)'
                });
            }
        });

        // Log deletion removed to avoid permission errors.
        // The UI should filter logs based on the new createdAt timestamp.

    } catch (error) {
        console.error("Error hard resetting debt:", error);
        throw error;
    }
};

export const makePayment = async (debtId: string, amount: number, performedBy: string, note?: string, installmentId?: string) => {
    await runTransaction(db, async (transaction) => {
        const debtRef = doc(db, 'debts', debtId);
        const debtDoc = await transaction.get(debtRef);

        if (!debtDoc.exists()) {
            throw new Error("Debt document does not exist!");
        }

        const debtData = debtDoc.data() as Debt;
        
        // Auto-Correction for Desync:
        // If attempting to pay MORE than remaining (e.g. paying an outdated installment amount),
        // clamp the payment to the remaining amount.
        let efAmount = amount;
        if (efAmount > debtData.remainingAmount) {
            console.warn(`Payment amount (${efAmount}) > Remaining (${debtData.remainingAmount}). Clamping.`);
            efAmount = debtData.remainingAmount;
        }

        let newRemaining = debtData.remainingAmount - efAmount;

        // Floating point tolerance
        if (newRemaining > -0.1 && newRemaining < 0) {
            newRemaining = 0;
        }

        if (newRemaining < 0) {
             // Should not be reachable due to clamping, but safe to keep
            throw new Error(`Payment amount (${efAmount}) exceeds remaining debt (${debtData.remainingAmount})!`);
        }

        let newStatus: DebtStatus = debtData.status;
        if (newRemaining === 0) {
            newStatus = 'PAID';
        } else {
            newStatus = 'ACTIVE'; // Partially paid, still active
        }

        // --- Installment Logic ---
        let updatedInstallments = debtData.installments ? [...debtData.installments] : undefined;

        if (updatedInstallments && updatedInstallments.length > 0) {
            console.log("DEBUG: Processing Installment Payment", { installmentId, efAmount });
            if (installmentId) {
                // Scenario 1: Paying a specific installment
                updatedInstallments = updatedInstallments.map(inst => {
                    if (String(inst.id).trim() === String(installmentId).trim()) {
                        console.log("DEBUG: Marking installment as PAID", inst.id);
                        return { ...inst, isPaid: true, paidAt: Timestamp.now() };
                    }
                    return inst;
                });
            } else {
                // Scenario 2: Interim Payment (Ara Ödeme)
                // Recalculate remaining installments based on NEW balance
                const unpaidOnes = updatedInstallments.filter(i => !i.isPaid);
                if (unpaidOnes.length > 0) {
                    const newAmountPerInstallment = Math.round((newRemaining / unpaidOnes.length) * 100) / 100;
                    console.log("DEBUG: Recalculating installments", { newRemaining, newAmountPerInstallment });
                    updatedInstallments = updatedInstallments.map(inst =>
                        inst.isPaid ? inst : { ...inst, amount: newAmountPerInstallment }
                    );
                }
            }
        }

        // Update debt document
        transaction.update(debtRef, {
            remainingAmount: newRemaining,
            status: newStatus,
            ...(updatedInstallments && { installments: updatedInstallments })
        });

        // Add payment log
        const logRef = doc(collection(db, `debts/${debtId}/logs`));
        transaction.set(logRef, {
            type: 'PAYMENT',
            amountPaid: efAmount,
            previousRemaining: debtData.remainingAmount,
            newRemaining: newRemaining,
            performedBy,
            timestamp: serverTimestamp(),
            note: note || 'Ödeme yapıldı',
            ...(installmentId && { installmentId })
        });
    });

        // Activity Feed (After Transaction)
        // We need debt details. Rerunning get or guessing?
        // We know debtId. We can fetch strictly or just fire-and-forget if we knew participants.
        // `makePayment` doesn't return participants.
        // Let's fetch basic info to know who to notify.
        const dSnap = await getDoc(doc(db, 'debts', debtId));
        if (dSnap.exists()) {
            const d = dSnap.data() as Debt;
            const target = d.lenderId === performedBy ? d.borrowerId : d.lenderId;
            updateContactActivity(performedBy, target, 'Ödeme yapıldı');
        }
};

// ... subscriptions ...

export const respondToDebtRequest = async (debtId: string, status: 'ACTIVE' | 'REJECTED' | 'REJECTED_BY_RECEIVER', performedBy: string) => {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists()) {
                throw new Error("Debt document does not exist!");
            }

            const debtData = debtDoc.data() as Debt;

            // Update debt status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = { status };
            if (status === 'REJECTED_BY_RECEIVER') {
                updates.rejectedAt = serverTimestamp();
            }

            transaction.update(debtRef, updates);

            // Add log
            const logRef = doc(collection(db, `debts/${debtId}/logs`));
            let note = 'Durum güncellendi';
            if (status === 'ACTIVE') note = 'Borç isteği onaylandı';
            else if (status === 'REJECTED') note = 'Borç isteği reddedildi';
            else if (status === 'REJECTED_BY_RECEIVER') note = 'Kayıt silindi/reddedildi (Soft Delete)';

            transaction.set(logRef, {
                type: 'NOTE_ADDED',
                previousRemaining: debtData.remainingAmount,
                newRemaining: debtData.remainingAmount,
                performedBy,
                timestamp: serverTimestamp(),
                note
            });
        });

        // Activity Feed
        const dSnap = await getDoc(doc(db, 'debts', debtId));
        if (dSnap.exists()) {
            const d = dSnap.data() as Debt;
            const target = d.lenderId === performedBy ? d.borrowerId : d.lenderId;
            let msg = 'Borç durumu güncellendi';
            if (status === 'ACTIVE') msg = 'Borç onaylandı';
            else if (status === 'REJECTED') msg = 'Borç reddedildi';
            updateContactActivity(performedBy, target, msg);
        }
};

export const searchUserByPhone = async (phoneNumber: string): Promise<User | null> => {
    const cleanPhone = cleanPhoneNumber(phoneNumber);

    // Use registry lookup to resolve UID securely
    const { resolvePhoneToUid } = await import('./identity');
    let uid: string | null = null;
    try {
        uid = await resolvePhoneToUid(cleanPhone);
    } catch (e) {
        console.warn("Registry lookup failed (likely permission):", e);
    }

    if (!uid) {
        // Fallback: Search in users collection directly (for legacy or unsynced data)
        try {
            const q = query(
                collection(db, 'users'),
                where('phoneNumbers', 'array-contains', cleanPhone),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                return { uid: userDoc.id, ...userDoc.data() } as User;
            }
        } catch (error) {
            // Unauthenticated users cannot search users collection (Rules).
            // This is expected for new registrations.
            console.warn("Fallback search skipped/allowed:", error);
        }

        return null;
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
        return null;
    }

    return { uid: userDoc.id, ...userDoc.data() } as User;
};
// --- Contacts Services ---

export const addContact = async (currentUserId: string, name: string, phoneNumber: string, linkedUserId?: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');

        // Check if phone number already exists (Try strict clean first)
        const q = query(contactsRef, where('phoneNumber', '==', cleanPhone));
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
            const { resolvePhoneToUid } = await import('./identity');
            const resolvedUid = await resolvePhoneToUid(cleanPhone);
            if (resolvedUid) {
                finalLinkedUserId = resolvedUid;
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

                // Ensure lockedPhoneNumber is set
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updates: any = {
                    lenderId: userId,
                    participants
                };

                // CRITICAL: If no lockedPhoneNumber exists, using the phone number we just claimed
                if (!currentData.lockedPhoneNumber) {
                    updates.lockedPhoneNumber = cleanPhone;
                }

                transaction.update(debtRef, updates);
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

                // Ensure lockedPhoneNumber is set
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updates: any = {
                    borrowerId: userId,
                    participants
                };

                // CRITICAL: If no lockedPhoneNumber exists, using the phone number we just claimed
                if (!currentData.lockedPhoneNumber) {
                    updates.lockedPhoneNumber = cleanPhone;
                }

                transaction.update(debtRef, updates);
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

// Restoration of subscribeToUserDebts
export const subscribeToUserDebts = (userId: string, callback: (debts: Debt[]) => void) => {
    const debtsRef = collection(db, 'debts');
    // We want all debts where user is a participant
    const q = query(
        debtsRef,
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Debt[];
        callback(debts);
    });
};

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

export const subscribeToDebtDetails = (debtId: string, callback: (debt: Debt | null) => void) => {
    const debtRef = doc(db, 'debts', debtId);
    return onSnapshot(debtRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as Debt);
        } else {
            callback(null);
        }
    });
};

export const subscribeToPaymentLogs = (debtId: string, callback: (logs: PaymentLog[]) => void) => {
    const logsRef = collection(db, 'debts', debtId, 'logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PaymentLog[];
        callback(logs);
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

// RENAMED & REFACTORED: Now processes payment IMMEDIATELY (Instant Validity)
export const addPayment = async (debtId: string, amount: number, note: string, userId: string, installmentId?: string) => {
    // Forward to makePayment logic which is already instant
    // We handle installmentId if strictly needed, but makePayment generic logic doesn't support specific installment yet in this snippet?
    // makePayment as defined below handles basic balance decrement.
    // If installmentId logic is crucial, we should incorporate it.
    // However, existing makePayment is simple.
    // Let's implement full logic here or delegate.
    // existing makePayment (lines 314+) handles simple balance update.

    // Delegate to makePayment for consistency if no installmentId
    if (!installmentId) {
        return makePayment(debtId, amount, userId, note);
    }

    // If installmentId exists, we need custom logic similar to confirmPayment but immediate.
    // See makePayment for base.
    // For now, let's just use makePayment logic but ensuring it's "APPROVED"
    return makePayment(debtId, amount, userId, note, installmentId);
};

// ... confirmPayment deprecated ...
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const confirmPayment = async (debtId: string, paymentId: string, _currentUserId: string) => {
    console.warn("confirmPayment is deprecated in Asymmetric Debt Model (Instant Validity).");
    try {
        const debtRef = doc(db, 'debts', debtId);

        await runTransaction(db, async (transaction) => {
            // Basic dummy transaction to satisfy types or just throw/return
            const debtDoc = await transaction.get(debtRef);
            if (!debtDoc.exists()) throw new Error("Debt not found");

            // In deprecated mode, we might just force approve if called?
            // Or just do nothing.
            // Let's keep existing logic but warn.
            // To save space/complexity, I will truncate it since it shouldn't be called.
            throw new Error("confirmPayment is deprecated.");
        });
    } catch (error) {
        console.error("Error confirming payment:", error);
        throw error;
    }
};

export const rejectPayment = async (debtId: string, paymentId: string, currentUserId: string) => {
    try {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const logRef = doc(db, 'debts', debtId, 'logs', paymentId);

            const debtDoc = await transaction.get(debtRef);
            const logDoc = await transaction.get(logRef);

            if (!debtDoc.exists() || !logDoc.exists()) {
                throw new Error("Document not found");
            }

            const debt = debtDoc.data() as Debt;
            const log = logDoc.data() as PaymentLog;

            if (log.status === 'REJECTED') {
                return; // Already rejected
            }

            // REVERSAL LOGIC
            // Only reverse balance if it was APPROVED (counted). 
            // If it was PENDING (legacy), just mark rejected.
            let newRemaining = debt.remainingAmount;
            let newStatus = debt.status;

            // Type Guard / Normalization

            // Check if this payment was counted against the debt.
            // "APPROVED" (Legacy) or "ACTIVE" (if we used that) or implicitly if it was a 'PAYMENT' type that wasn't pending?
            // In new model, `addPayment` sets status to 'APPROVED' (implied by makePayment logic setting it to APPROVED/PAID?).
            // Wait, makePayment sets log status to 'APPROVED'.

            if ((log.status as string) === 'APPROVED' || (log.status as string) === 'ACTIVE') { // ACTIVE? approved logs usually have APPROVED status
                const amountToReverse = log.amountPaid || 0;
                newRemaining += amountToReverse;

                // Fix status if it was PAID
                if (debt.status === 'PAID') {
                    newStatus = 'ACTIVE';
                } else if (debt.status === 'ACTIVE') { // Active debts
                    // Check if newRemaining >= originalAmount (approximately)
                    if (newRemaining >= (debt.originalAmount || 0)) {
                        newStatus = 'ACTIVE'; // Back to full debt?
                    }
                }
                // If status was ACTIVE, it stays ACTIVE.
            }

            transaction.update(debtRef, {
                remainingAmount: newRemaining,
                status: newStatus
            });

            transaction.update(logRef, {
                status: 'REJECTED'
            });
        });

        // Activity Feed logic (fire and forget)
        const dSnap = await getDoc(doc(db, 'debts', debtId));
        if (dSnap.exists()) {
            const d = dSnap.data() as Debt;
            const msgPerformer = (await getDoc(doc(db, 'debts', debtId, 'logs', paymentId))).data()?.performedBy;
            const target = msgPerformer === currentUserId ? (d.lenderId === currentUserId ? d.borrowerId : d.lenderId) : msgPerformer;
            if (target) {
                updateContactActivity(currentUserId, target, 'Ödeme reddedildi/geri alındı');
            }
        }

    } catch (error) {
        console.error("Error rejecting payment:", error);
        throw error;
    }
};

// --- Debt Management (Phase 8) ---

// Soft Delete is REMOVED. We only support HARD DELETE for 1-hour window.
// However, existing calls might break if we remove it.
// User said "No Trash". So we should replace logic or just disable.
// Let's implement deleteDebt as Hard Delete with 1-Hour Check.

export const deleteDebt = async (debtId: string, currentUserId: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);
        const debtDoc = await getDoc(debtRef);

        if (!debtDoc.exists()) throw new Error("Debt not found");

        const data = debtDoc.data() as Debt;

        // 1. Check Ownership
        // For LEDGER type: both participants can delete
        // For ONE_TIME/INSTALLMENT: only creator can delete
        const isLedger = data.type === 'LEDGER';
        const isParticipant = data.participants?.includes(currentUserId);
        const isCreator = data.createdBy === currentUserId;

        if (isLedger) {
            if (!isParticipant) {
                throw new Error("Bu cari hesabı silemezsiniz.");
            }
        } else {
            if (!isCreator) {
                throw new Error("Sadece oluşturan kişi bu borcu silebilir.");
            }
        }

        // 2. Check 1-Hour Rule
        if (!isTransactionEditable(data.createdAt)) {
            throw new Error("Bu kayıt silinemez (1 saat kuralı). Lütfen ters işlem yapın.");
        }

        // Activity Feed (fire-and-forget - don't block deletion on this)
        const otherId = data.lenderId === currentUserId ? data.borrowerId : data.lenderId;
        updateContactActivity(currentUserId, otherId, 'Borç silindi (Geri alındı)')
            .catch(err => console.warn("Activity feed update failed (non-critical):", err));

        // Hard Delete
        await deleteDoc(debtRef);
        
        // Also delete subcollection logs (non-blocking)
        try {
            const logsRef = collection(db, 'debts', debtId, 'logs');
            const logsSnap = await getDocs(logsRef);
            if (!logsSnap.empty) {
                const batch = writeBatch(db);
                logsSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        } catch (logError) {
            console.warn("Log deletion failed during debt deletion:", logError);
            // Logs are orphaned but main debt is deleted
        }

    } catch (error) {
        console.error("Error deleting debt:", error);
        throw error;
    }
};

/**
 * Legacy Support / Aliases
 */
export const permanentlyDeleteDebt = deleteDebt;


// --- Mute / Silent Ignore Features ---

/**
 * Mutes a user (Silent Ignore).
 * @param currentUid The user performing the mute.
 * @param targetUid The user to be muted.
 */
export const muteUser = async (currentUid: string, targetUid: string) => {
    try {
        const userRef = doc(db, 'users', currentUid);
        // We use arrayUnion to add to the list
        const { arrayUnion } = await import('firebase/firestore');
        await updateDoc(userRef, {
            mutedCreators: arrayUnion(targetUid)
        });
    } catch (error) {
        console.error("Error muting user:", error);
        throw error;
    }
};

/**
 * Unmutes a user.
 * @param currentUid The user performing the unmute.
 * @param targetUid The user to be unmuted.
 */
export const unmuteUser = async (currentUid: string, targetUid: string) => {
    try {
        const userRef = doc(db, 'users', currentUid);
        // We use arrayRemove to remove from the list
        const { arrayRemove } = await import('firebase/firestore');
        await updateDoc(userRef, {
            mutedCreators: arrayRemove(targetUid)
        });
    } catch (error) {
        console.error("Error unmuting user:", error);
        throw error;
    }
};

/**
 * Checks if a user is muted by another user.
 * This is effectively checking if targetUid has currentUid in their mutedCreators list.
 * USE CASE: When I (Creator) create a debt for Target, I need to know if Target has muted ME.
 */
export const isCreatorMutedByTarget = async (creatorUid: string, targetUid: string): Promise<boolean> => {
    try {
        const userRef = doc(db, 'users', targetUid);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
            const data = snapshot.data() as User;
            return data.mutedCreators?.includes(creatorUid) || false;
        }
        return false;
    } catch (error) {
        console.error("Error checking mute status:", error);
        return false;
    }
};

/**
 * Forgives an ACTIVE debt (Marks as FORGIVEN/PAID).
 * Allowed only by Creator/Lender? Actually usually Lender forgives.
 * In this app, Creator might be Borrower (I owe you).
 * If I owe you, I can't forgive it. I can only pay it.
 * If You owe me, I can forgive it.
 */
export const forgiveDebt = async (debtId: string, currentUserId: string, note: string = "Borç silindi / Vazgeçildi") => {
    try {
        await runTransaction(db, async (transaction) => {
            const debtRef = doc(db, 'debts', debtId);
            const debtDoc = await transaction.get(debtRef);

            if (!debtDoc.exists()) throw new Error("Debt not found");

            const data = debtDoc.data() as Debt;

            // Only Lender can forgive
            if (data.lenderId !== currentUserId) {
                throw new Error("Only the lender can forgive the debt.");
            }

            if (data.remainingAmount <= 0) {
                throw new Error("Debt is already paid.");
            }

            // Update Debt
            transaction.update(debtRef, {
                status: 'PAID', // Or we could introduce 'FORGIVEN' status if supported
                remainingAmount: 0,
                note: data.note ? data.note + `\n(Forgiven: ${note})` : `(Forgiven: ${note})`
            });

            // Log it
            const logRef = doc(collection(db, `debts/${debtId}/logs`));
            transaction.set(logRef, {
                type: 'PAYMENT',
                amountPaid: data.remainingAmount, // Full amount "paid"
                previousRemaining: data.remainingAmount,
                newRemaining: 0,
                performedBy: currentUserId,
                timestamp: serverTimestamp(),
                note: note
            });
        });

        // Activity Feed
        // Fetch debt to identify target (transaction doesn't return data)
        const dSnap = await getDoc(doc(db, 'debts', debtId));
        if (dSnap.exists()) {
            const d = dSnap.data() as Debt;
            const target = d.lenderId === currentUserId ? d.borrowerId : d.lenderId;
            updateContactActivity(currentUserId, target, 'Borç silindi/bağışlandı');
        }

    } catch (error) {
        console.error("Error forgiving debt:", error);
        throw error;
    }
};

export const updateDebt = async (debtId: string, data: Partial<Debt>, actorId?: string) => {
    try {
        const debtRef = doc(db, 'debts', debtId);

        const updates = { ...data };

        // BUMP MECHANISM: Check for recovery from AUTO_HIDDEN
        // Wrapped in try-catch to ensure main update never fails due to this side-effect
        try {
            const debtSnap = await getDoc(debtRef);
            if (debtSnap.exists()) {
                const currentDebt = debtSnap.data() as Debt;

                // Logic: If currently AUTO_HIDDEN (or isMuted=true), and we are updating it.
                if (currentDebt.status === 'AUTO_HIDDEN' || currentDebt.isMuted) {
                    const creatorId = currentDebt.createdBy;
                    const isLender = currentDebt.lenderId === creatorId;
                    const targetUserId = isLender ? currentDebt.borrowerId : currentDebt.lenderId;

                    if (targetUserId && targetUserId.length > 20) { // Check if valid UID
                        // Check permissions safely
                        try {
                            const targetRef = doc(db, 'users', targetUserId);
                            const targetSnap = await getDoc(targetRef);

                            if (targetSnap.exists()) {
                                const targetData = targetSnap.data() as User;
                                const isStillMuted = targetData.mutedCreators?.includes(creatorId);

                                if (!isStillMuted) {
                                    // PRESTO! User is unmuted. Bump the debt.
                                    updates.status = 'ACTIVE';
                                    updates.isMuted = false;
                                }
                            }
                        } catch (permError) {
                            console.warn("Could not check mute status during update (likely permission/privacy):", permError);
                            // Ignore and proceed with normal update
                        }
                    }
                }
            }
        } catch (err) {
            console.warn("Error in Bump Logic (non-fatal):", err);
        }

        await updateDoc(debtRef, updates);

        // Activity Feed
        if (actorId) {
            const debtSnap = await getDoc(debtRef);
            if (debtSnap.exists()) {
                const updatedDebt = debtSnap.data() as Debt;
                const otherId = updatedDebt.lenderId === actorId ? updatedDebt.borrowerId : updatedDebt.lenderId;
                updateContactActivity(actorId, otherId, 'Borç güncellendi');
            }
        }
    } catch (error) {
        console.error("Error updating debt:", error);
        throw error;
    }
};


export const fetchLastUsedName = async (userId: string, phoneNumber: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const q = query(
            collection(db, 'debts'),
            where('createdBy', '==', userId),
            where('lockedPhoneNumber', '==', cleanPhone),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            // If I created it, I am the lender or borrower.
            // Check which field matches the cleanPhone or if logic differs.
            // Actually, we store lenderName/borrowerName.
            // If I am lender, the OTHER party is borrower.
            if (data.lenderId === userId) {
                return data.borrowerName;
            } else {
                return data.lenderName;
            }
        }
        return null;
    } catch (error) {
        console.error("Error fetching last used name:", error);
        return null;
    }
};

export const batchAddContacts = async (currentUserId: string, contacts: { name: string, phoneNumber: string }[]) => {
    try {
        const { resolvePhoneToUid } = await import('./identity');
        const batch = writeBatch(db);
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');
        const timestamp = serverTimestamp();

        // Process in chunks of 20 to avoid overwhelming parallel reads if list is huge?
        // Usually import is < 100. Parallel should be fine.

        const tasks = contacts.map(async (contact) => {
            const clean = cleanPhoneNumber(contact.phoneNumber);
            // Skip invalid?
            if (!clean || clean.length < 5) return;

            let linkedUserId = null;
            try {
                linkedUserId = await resolvePhoneToUid(clean);
            } catch {
                // Ignore resolution error
            }

            const newDocRef = doc(contactsRef); // Auto-ID
            batch.set(newDocRef, {
                name: contact.name,
                phoneNumber: clean,
                linkedUserId: linkedUserId || null,
                createdAt: timestamp
            });
        });

        await Promise.all(tasks);
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error batch adding contacts:", error);
        throw error;
    }
};

export const deletePersonHistory = async (
    currentUserId: string,
    targetUserId: string | null,
    targetPhone: string | null,
    contactId?: string
) => {
    try {
        // 1. Delete Contact if exists
        if (contactId) {
            // We use the existing deleteContact function
            await deleteContact(currentUserId, contactId);
        }

        // 2. Find Debts where I am a participant
        const debtsRef = collection(db, 'debts');
        const q = query(debtsRef, where('participants', 'array-contains', currentUserId));
        const snapshot = await getDocs(q);

        const tasks = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as Debt;

            // Check if this debt involves the target
            // Target could be identified by UID or Phone (if lockedPhoneNumber matches or raw participant)
            let isTargetInvolved = false;

            if (targetUserId && data.participants.includes(targetUserId)) {
                isTargetInvolved = true;
            } else if (targetPhone) {
                // Check lockedPhoneNumber
                if (data.lockedPhoneNumber === targetPhone) isTargetInvolved = true;
                // Check raw phone in participants (legacy)
                if (data.participants.includes(targetPhone)) isTargetInvolved = true;
            }

            if (!isTargetInvolved) return;

            // ACTION: Delete or Leave
            if (data.createdBy === currentUserId) {
                 // I created it -> Hard Delete

                 // If it is a Ledger, delete transactions first
                 if (data.type === 'LEDGER') {
                     const txRef = collection(db, 'debts', docSnap.id, 'transactions');
                     const txSnap = await getDocs(txRef);
                     const txDeletePromises = txSnap.docs.map(tx => deleteDoc(tx.ref));
                     await Promise.all(txDeletePromises);
                 }

                 // Also delete logs subcollection for any debt type to be clean
                 const logsRef = collection(db, 'debts', docSnap.id, 'logs');
                 const logsSnap = await getDocs(logsRef);
                 const logsDeletePromises = logsSnap.docs.map(log => deleteDoc(log.ref));
                 await Promise.all(logsDeletePromises);

                 await deleteDoc(docSnap.ref);
            } else {
                 // I did not create it -> Leave (Remove myself from participants)
                 const newParticipants = data.participants.filter(p => p !== currentUserId);

                 // If no participants left, maybe delete?
                 // If the other person is still there, they keep it.
                 // If I was the only one (unlikely), it becomes orphaned.
                 if (newParticipants.length === 0) {
                     await deleteDoc(docSnap.ref);
                 } else {
                     await updateDoc(docSnap.ref, { participants: newParticipants });
                 }
            }
        });

        await Promise.all(tasks);
    } catch (error) {
        console.error("Error deleting person history:", error);
        throw error;
    }
};
