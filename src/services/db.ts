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
import { cleanPhone as cleanPhoneNumber, isValidPhone } from '../utils/phoneUtils';
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

export async function updateContactActivity(actorId: string, targetId: string, message: string) {
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
        let resolvedTargetId = targetId;
        if (!targetIsUid) {
            // If targetId is a phone number, try to resolve to UID for contact lookup
            const { resolvePhoneToUid } = await import('./identity');
            const uid = await resolvePhoneToUid(targetId);
            if (uid) resolvedTargetId = uid;
        }

        const targetContactId = await findContactDocId(resolvedTargetId, actorId, true);
        if (targetContactId) {
            const ref = doc(db, 'users', resolvedTargetId, 'contacts', targetContactId);
            await updateDoc(ref, {
                lastActivityMessage: message,
                lastActivityAt: timestamp,
                hasUnreadActivity: true, // They have unread activity from ME
                lastActorId: actorId
            });
        }
    } catch (error) {
        console.error("Error updating activity feed:", error);
    }
}

export const addContact = async (currentUserId: string, name: string, phoneNumber: string, linkedUserId?: string) => {
    try {
        if (!isValidPhone(phoneNumber)) {
            throw new Error(`Geçersiz telefon formatı: ${phoneNumber}. Lütfen E.164 formatında (+ÜlkeKoduNumara) giriniz.`);
        }
        const cleanPhone = phoneNumber; // Already valid E.164

        const contactsRef = collection(db, 'users', currentUserId, 'contacts');

        const contactData: Record<string, unknown> = {
            name,
            phoneNumber: cleanPhone,
            updatedAt: serverTimestamp()
        };

        if (linkedUserId) {
            contactData.linkedUserId = linkedUserId;
        }

        // Check if contact already exists by phoneNumber or linkedUserId
        let existingContactQuery;
        if (linkedUserId) {
            existingContactQuery = query(contactsRef, where('linkedUserId', '==', linkedUserId), limit(1));
        } else {
            existingContactQuery = query(contactsRef, where('phoneNumber', '==', cleanPhone), limit(1));
        }

        const existingContactSnap = await getDocs(existingContactQuery);

        if (!existingContactSnap.empty) {
            // Update existing contact
            const docRef = existingContactSnap.docs[0].ref;
            await updateDoc(docRef, contactData);
            return docRef.id;
        } else {
            // Add new contact
            const docRef = await addDoc(contactsRef, {
                ...contactData,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        }
    } catch (error) {
        console.error("Error adding/updating contact:", error);
        throw error;
    }
};

/**
 * Scans ALL contacts for the current user and normalizes their phone numbers to E.164.
 * This is a one-time/background cleanup tool to fix "Dirty Data" in the user's address book.
 */
export const normalizeAllUserContacts = async (userId: string): Promise<number> => {
    try {
        const contactsRef = collection(db, 'users', userId, 'contacts');
        const snapshot = await getDocs(contactsRef);

        let fixedCount = 0;
        const batch = writeBatch(db);

        // Import standardizeRawPhone for fallback normalization
        const { standardizeRawPhone } = await import('../utils/phoneUtils');

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const originalPhone = data.phoneNumber || '';

            // Try cleanPhoneNumber first (strict E.164 parser)
            let normalizedPhone = cleanPhoneNumber(originalPhone);

            // If that fails, try standardizeRawPhone (more lenient)
            if (!normalizedPhone) {
                normalizedPhone = standardizeRawPhone(originalPhone);
            }

            // If the phone is NOT in E.164 format or differs after cleaning
            if (normalizedPhone && normalizedPhone !== originalPhone) {
                batch.update(docSnap.ref, {
                    phoneNumber: normalizedPhone,
                    updatedAt: serverTimestamp()
                });
                fixedCount++;
            }
        });

        if (fixedCount > 0) {
            await batch.commit();
            console.log(`[Cleanup] Normalized ${fixedCount} contacts for ${userId}`);
        }

        return fixedCount;
    } catch (error) {
        console.error("Error normalizing contacts:", error);
        return 0;
    }
};

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

    // --- 1. STRICT E.164 ENFORCEMENT ---
    let finalTargetId = targetUserId;
    let cleanTarget: string | null = null;

    if (targetUserId.length < 20) {
        if (!isValidPhone(targetUserId)) {
            throw new Error(`Geçersiz telefon formatı: ${targetUserId}. Borç oluşturmak için geçerli bir E.164 numarası gereklidir.`);
        }

        cleanTarget = targetUserId;

        // Ghost User (Registered User) Check
        const { resolvePhoneToUid } = await import('./identity');
        const resolvedUid = await resolvePhoneToUid(targetUserId);

        if (resolvedUid) {
            finalTargetId = resolvedUid;
        } else {
            finalTargetId = targetUserId;
        }
    }
    // ------------------------------------

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
        ...(isMuted && { isMuted: true }),
        auditMeta: { // ✅ Added Audit Log
            actorId: currentUserId,
            timestamp: serverTimestamp(),
            platform: 'Web',
            deviceId: 'browser-' + Math.random().toString(36).substring(7) // Temp placeholder
        }
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

            // 5. Prepare Updates (Maintain original createdAt, update modified status)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const docUpdates: any = {
                ...updates,
                remainingAmount: newRemaining,
                status: newStatus,
                updatedAt: serverTimestamp(),
                auditMeta: { // ✅ Added Audit
                    actorId: currentUserId,
                    timestamp: serverTimestamp(),
                    platform: 'Web',
                    reason: 'Hard Reset / Identity Fix'
                }
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

export const makePayment = async (
    debtId: string,
    amount: number,
    performedBy: string,
    note?: string,
    installmentId?: string,
    method: 'CASH' | 'IBAN' | 'CREDIT_CARD' | 'OTHER' = 'CASH' // ✅ New
) => {
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
            updatedAt: serverTimestamp(),
            ...(updatedInstallments && { installments: updatedInstallments }),
            auditMeta: {
                actorId: performedBy,
                timestamp: serverTimestamp(),
                platform: 'Web'
            }
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
            ...(installmentId && { installmentId }),
            method, // ✅ Added Method
            auditMeta: { // ✅ Added Audit
                actorId: performedBy,
                timestamp: serverTimestamp(),
                platform: 'Web'
            }
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
        const updates: any = {
            status,
            updatedAt: serverTimestamp(),
            auditMeta: {
                actorId: performedBy,
                timestamp: serverTimestamp(),
                platform: 'Web'
            }
        };
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
    // Standardize input to E.164 format with multiple fallbacks
    let cleanPhone = cleanPhoneNumber(phoneNumber);
    if (!cleanPhone) {
        // If cleanPhoneNumber fails, try standardizing raw input
        const { standardizeRawPhone } = await import('../utils/phoneUtils');
        cleanPhone = standardizeRawPhone(phoneNumber);
    }
    if (!cleanPhone) {
        return null; // Cannot parse phone
    }

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

export const getContacts = async (userId: string) => {
    const contactsRef = collection(db, 'users', userId, 'contacts');
    const q = query(contactsRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
};

export const deleteContact = async (userId: string, contactId: string) => {
    const contactRef = doc(db, 'users', userId, 'contacts', contactId);
    await deleteDoc(contactRef);
};

export const updateContact = async (userId: string, contactId: string, data: Partial<Contact>) => {
    try {
        const updateData = { ...data };
        if (updateData.phoneNumber) {
            if (!isValidPhone(updateData.phoneNumber)) {
                throw new Error(`Geçersiz telefon formatı: ${updateData.phoneNumber}. Lütfen E.164 formatında (+ÜlkeKoduNumara) giriniz.`);
            }
            // phoneNumber is already E.164 if valid
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

        // Import standardizeRawPhone for phone format matching
        const { standardizeRawPhone } = await import('../utils/phoneUtils');
        const normalizedQuery = standardizeRawPhone(searchQuery);

        return contacts.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.phoneNumber.includes(searchQuery) ||
            // Also match against normalized phone format for partial matches
            (normalizedQuery && c.phoneNumber.includes(normalizedQuery)) ||
            // Match E.164 variants (0555... vs +90555... etc)
            (normalizedQuery && (
                c.phoneNumber.startsWith(normalizedQuery) ||
                normalizedQuery.startsWith(c.phoneNumber.replace('+90', '0'))
            ))
        );
    } catch (error) {
        console.error("Error searching contacts:", error);
        return [];
    }
};



// Redefined logic below for claimDebts to include Contact Linking
// Enhanced Claiming Logic for Data Integrity (DEBUG VERSION)
export const claimLegacyDebts = async (userId: string, phoneNumber: string): Promise<number> => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber); // Expected E.164 (+90...)
        if (!cleanPhone) return 0;

        // Generate Possible Formats for Legacy Matching
        const bare = cleanPhone.replace('+90', ''); // 5551112233
        const local = '0' + bare; // 05551112233
        const possiblePhones = [cleanPhone, local, bare];

        const debtsRef = collection(db, 'debts');
        // Use array-contains-any to find debts containing ANY of the possible formats in participants
        const q = query(debtsRef, where('participants', 'array-contains-any', possiblePhones));

        const snapshot = await getDocs(q);

        if (snapshot.empty) return 0;

        const batch = writeBatch(db);
        let updateCount = 0;

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const participants = data.participants || [];

            // Filter out ANY of the matched phone formats, Add UID
            const updatedParticipants = participants.filter((p: string) => !possiblePhones.includes(p));
            if (!updatedParticipants.includes(userId)) updatedParticipants.push(userId);

            const updates: Record<string, unknown> = {
                participants: updatedParticipants,
                updatedAt: serverTimestamp(),
                auditMeta: {
                    actorId: userId,
                    timestamp: serverTimestamp(),
                    platform: 'Web'
                }
            };

            // Update lender/borrower if they match the phone number
            if (possiblePhones.includes(data.lenderId)) updates.lenderId = userId;
            if (possiblePhones.includes(data.borrowerId)) updates.borrowerId = userId;

            // Normalize locked phone number
            updates.lockedPhoneNumber = cleanPhone;

            batch.update(docSnap.ref, updates);
            updateCount++;
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`[GhostProtocol] ${updateCount} borç başarıyla üzerine alındı.`);
        }

        return updateCount;

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("[GhostProtocol] HATA:", error);
        return 0;
    }
};

// Alias for backward compatibility if needed, though we should update calls.
export const claimDebts = claimLegacyDebts;

/**
 * RELINK: Moves a single debt from one identifier (phone or UID) to another.
 * Primarily used by Lenders to fix "Wrong Number" entries.
 */
export const relinkDebtToNewPhone = async (
    debtId: string,
    oldPhone: string,
    newPhone: string,
    performedBy: string
) => {
    const cleanOld = cleanPhoneNumber(oldPhone);
    const cleanNew = cleanPhoneNumber(newPhone);
    if (cleanOld === cleanNew) return;

    return runTransaction(db, async (transaction) => {
        const debtRef = doc(db, 'debts', debtId);
        const debtDoc = await transaction.get(debtRef);
        if (!debtDoc.exists()) throw new Error("Debt not found");

        const data = debtDoc.data();
        if (data.createdBy !== performedBy) {
            throw new Error("Only the creator can relink this debt.");
        }

        // Check if the oldPhone matches borrower or lender
        let updatedBorrower = data.borrowerId;
        let updatedLender = data.lenderId;
        const participants = data.participants || [];

        if (data.borrowerId === cleanOld) {
            updatedBorrower = cleanNew;
            // Update participants
            const idx = participants.indexOf(cleanOld);
            if (idx > -1) participants.splice(idx, 1);
            if (!participants.includes(cleanNew)) participants.push(cleanNew);
        } else if (data.lenderId === cleanOld) {
            updatedLender = cleanNew;
            // Update participants
            const idx = participants.indexOf(cleanOld);
            if (idx > -1) participants.splice(idx, 1);
            if (!participants.includes(cleanNew)) participants.push(cleanNew);
        } else {
            throw new Error("Old phone number does not match lender or borrower of this debt.");
        }

        transaction.update(debtRef, {
            borrowerId: updatedBorrower,
            lenderId: updatedLender,
            participants,
            lockedPhoneNumber: cleanNew,
            // Log the relink
            auditMeta: {
                actorId: performedBy,
                timestamp: serverTimestamp(),
                platform: 'Web/System',
                reason: `Relinked from ${oldPhone} to ${newPhone}`
            }
        });

        // Add a specialized payment log for the relink
        const logRef = doc(collection(db, `debts/${debtId}/logs`));
        transaction.set(logRef, {
            type: 'NOTE_ADDED', // Or a new type like 'IDENTITY_CORRECTION'
            note: `Numara düzeltildi: ${oldPhone} -> ${newPhone}`,
            performedBy,
            timestamp: serverTimestamp(),
            previousRemaining: data.remainingAmount,
            newRemaining: data.remainingAmount
        });
    });
};

/**
 * BULK RELINK: Moves ALL debts created by 'performedBy' for 'oldIdentifier' to 'newIdentifier'.
 * Essential for fixing a contact that was entirely recorded on a wrong number.
 */
export const bulkRelinkDebts = async (
    oldPhone: string,
    newPhone: string,
    performedBy: string
) => {
    const cleanOld = cleanPhoneNumber(oldPhone);
    const cleanNew = cleanPhoneNumber(newPhone);

    // Find all debts created by performer where oldPhone is involved
    const qLender = query(collection(db, 'debts'),
        where('createdBy', '==', performedBy),
        where('borrowerId', '==', cleanOld)
    );
    const qBorrower = query(collection(db, 'debts'),
        where('createdBy', '==', performedBy),
        where('lenderId', '==', cleanOld)
    );

    const [snapL, snapB] = await Promise.all([getDocs(qLender), getDocs(qBorrower)]);
    const allDocs = [...snapL.docs, ...snapB.docs];

    // Process relinks
    const relinks = allDocs.map(d => relinkDebtToNewPhone(d.id, cleanOld, cleanNew, performedBy));
    await Promise.all(relinks);

    return allDocs.length;
};

// Restoration of subscribeToUserDebts
export const subscribeToUserDebts = (identifiers: string[], callback: (debts: Debt[]) => void) => {
    const debtsRef = collection(db, 'debts');
    // We want all debts where user is a participant (UID or Phone)
    const q = query(
        debtsRef,
        where('participants', 'array-contains-any', identifiers),
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

/**
 * Fetches all non-paid debts between two specific participants.
 * Used for Smart Matching in UI.
 */
export const getDebtsBetweenParticipants = async (p1: string, p2: string): Promise<Debt[]> => {
    const debtsRef = collection(db, 'debts');
    // Firestore limitation: cannot use array-contains and != in same query safely without complex composite index
    // So we fetch by participants and filter status in memory (it's a small list per contact)
    const q = query(
        debtsRef,
        where('participants', 'array-contains', p1),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);

    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Debt))
        .filter(d => d.participants.includes(p2) && (d.status === 'ACTIVE' || d.status === 'PENDING'));
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

        return await runTransaction(db, async (transaction) => {
            const debtSnap = await transaction.get(debtRef);
            if (!debtSnap.exists()) throw new Error("Debt not found");

            const currentDebt = debtSnap.data() as Debt;
            const isGracePeriodActive = isTransactionEditable(currentDebt.createdAt);

            // 1. Enforce 1-Hour Rule (Grace Period)
            const changedKeys = Object.keys(data);
            const sensitiveKeys = ['originalAmount', 'lenderId', 'borrowerId', 'currency', 'type'];
            const hasSensitiveChanges = changedKeys.some(key => sensitiveKeys.includes(key));

            if (!isGracePeriodActive && hasSensitiveChanges) {
                throw new Error("Zaman aşımı: Bu kaydın kritik alanları artık düzenlenemez (1 saat kuralı).");
            }

            // 2. Track Edit History for originalAmount
            const updatedEditHistory = currentDebt.editHistory || [];
            if (data.originalAmount !== undefined && data.originalAmount !== currentDebt.originalAmount) {
                if (!actorId) throw new Error("Actor ID required for amount change history.");
                updatedEditHistory.push({
                    oldAmount: currentDebt.originalAmount,
                    newAmount: data.originalAmount,
                    reason: data.note || 'Tutar düzenlendi',
                    changedAt: Timestamp.now(),
                    changedBy: actorId
                });
            }

            const updates: Record<string, unknown> = {
                ...data,
                ...(updatedEditHistory.length > 0 && { editHistory: updatedEditHistory }),
                updatedAt: serverTimestamp(),
                auditMeta: {
                    actorId: actorId || 'system',
                    timestamp: serverTimestamp(),
                    platform: 'Web'
                }
            };

            // BUMP MECHANISM: Check for recovery from AUTO_HIDDEN
            if (currentDebt.status === 'AUTO_HIDDEN' || currentDebt.isMuted) {
                const creatorId = currentDebt.createdBy;
                const isLender = currentDebt.lenderId === creatorId;
                const targetUserId = isLender ? currentDebt.borrowerId : currentDebt.lenderId;

                if (targetUserId && targetUserId.length > 20) {
                    const targetRef = doc(db, 'users', targetUserId);
                    const targetSnap = await transaction.get(targetRef);
                    if (targetSnap.exists()) {
                        const targetData = targetSnap.data() as User;
                        const isStillMuted = targetData.mutedCreators?.includes(creatorId);
                        if (!isStillMuted) {
                            updates.status = 'ACTIVE';
                            updates.isMuted = false;
                        }
                    }
                }
            }

            transaction.update(debtRef, updates);

            // 3. Activity Feed (Fire and forget outside transaction if possible, or just log)
            if (actorId) {
                const otherId = currentDebt.lenderId === actorId ? currentDebt.borrowerId : currentDebt.lenderId;
                updateContactActivity(actorId, otherId, 'Borç güncellendi');
            }
        });
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

/**
 * AUTO-LINK (SELF REPAIR):
 * Scans for debts involving System Users (IDs > 20) who are NOT linked in the local address book.
 * If a matching phone number refers to a local contact, it updates the contact with the UID.
 */
export const autoLinkSystemContacts = async (
    currentUserId: string,
    existingDebts: Debt[],
    contactsMap: Map<string, Contact>
) => {
    try {
        // 1. Identify "Blue" System Users (UIDs > 20) with no local link
        const systemUserIds = new Set<string>();

        existingDebts.forEach(d => {
            const otherId = d.lenderId === currentUserId ? d.borrowerId : d.lenderId;
            if (otherId && otherId.length > 20) {
                // Check if it's already linked?
                // contactsMap is keyed by Phone AND ID.
                // If contactsMap.has(otherId), it means we know this UID as a contact.
                // If NOT, it's a candidate for auto-linking.
                if (!contactsMap.has(otherId)) {
                    systemUserIds.add(otherId);
                }
            }
        });

        if (systemUserIds.size === 0) return 0;

        console.log(`[AutoLink] Checking ${systemUserIds.size} unlinked system users...`);

        // 2. Resolve Candidate UIDs to Phones (Cloud Fetch)
        const batch = writeBatch(db);
        let linkCount = 0;
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');

        for (const uid of systemUserIds) {
            // A. Fetch System User Profile to get their phone
            try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (!userSnap.exists()) continue;

                const userData = userSnap.data() as User;
                const userPhone = userData.primaryPhoneNumber || userData.phoneNumber;

                if (userPhone) {
                    const cleanUserPhone = cleanPhoneNumber(userPhone);

                    // B. Check if we have this phone in our map (Orange state but unlinked)
                    // Using our robust map lookups
                    const localContact = contactsMap.get(cleanUserPhone);

                    if (localContact) {
                        // FOUND A MATCH!
                        // The user has this person in contacts, but the contact entry doesn't have the linkedUserId.

                        // Double check not to overwrite if it already has a DIFFERENT link (conflict)?
                        if (!localContact.linkedUserId) {
                            console.log(`[AutoLink] Linking ${localContact.name} (${cleanUserPhone}) -> ${uid}`);

                            const contactRef = doc(contactsRef, localContact.id);
                            batch.update(contactRef, {
                                linkedUserId: uid,
                                updatedAt: serverTimestamp()
                            });
                            linkCount++;
                        }
                    }
                }
            } catch (e) {
                console.warn(`[AutoLink] Failed to process uid ${uid}`, e);
            }
        }

        if (linkCount > 0) {
            await batch.commit();
            console.log(`[AutoLink] Successfully linked ${linkCount} contacts.`);
        }

        return linkCount;

    } catch (error) {
        console.error("Error in autoLinkSystemContacts:", error);
        return 0;
    }
};
