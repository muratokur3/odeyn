import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const VERIFICATION_CODES_COLLECTION = 'verificationCodes';
const USERS_COLLECTION = 'users';
const REGISTRY_COLLECTION = 'phone_registry';
const DEBTS_COLLECTION = 'debts';

// Helper to clean phone number
const cleanPhone = (phone: string) => {
    return phone.replace(/\s/g, '');
};

export const initiatePhoneVerification = functions.https.onCall(async (data, context) => {
    const phoneNumber = data.phoneNumber;
    if (!phoneNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'Phone number is required');
    }

    const clean = cleanPhone(phoneNumber);
    const uid = context.auth?.uid;

    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    // 1. Check if taken by another user
    const registryRef = db.collection(REGISTRY_COLLECTION).doc(clean);
    const registryDoc = await registryRef.get();

    if (registryDoc.exists) {
        const registryData = registryDoc.data();
        if (registryData?.uid !== uid) {
            throw new functions.https.HttpsError('already-exists', 'Bu numara zaten başka bir hesaba kayıtlı.');
        }
    }

    // 2. Check for rate limit (e.g., 60 seconds)
    const verificationRef = db.collection(VERIFICATION_CODES_COLLECTION).doc(clean);
    const existingDoc = await verificationRef.get();

    if (existingDoc.exists) {
        const existingData = existingDoc.data();
        const lastSent = existingData?.createdAt?.toDate();
        if (lastSent && (Date.now() - lastSent.getTime() < 60000)) {
            throw new functions.https.HttpsError('resource-exhausted', 'Lütfen tekrar denemeden önce 60 saniye bekleyin.');
        }
    }

    // 3. Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)); // 5 mins

    // 4. Save Code
    await db.collection(VERIFICATION_CODES_COLLECTION).doc(clean).set({
        code,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: clean,
        uid // Limit verification to the user who initiated
    });

    // 4. Mock SMS (In real world, send SMS here via Twilio/MessageBird)
    console.log(`[SMS MOCK] Code for ${clean}: ${code}`);

    return { success: true, message: 'Verification code sent.' };
});

export const confirmPhoneVerification = functions.https.onCall(async (data, context) => {
    const { phoneNumber, code } = data;
    const uid = context.auth?.uid;

    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const clean = cleanPhone(phoneNumber);

    // 1. Validate Code
    const verificationRef = db.collection(VERIFICATION_CODES_COLLECTION).doc(clean);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Verification code not found or expired.');
    }

    const verifyData = verificationDoc.data();
    if (!verifyData) throw new functions.https.HttpsError('internal', 'Error reading verification data');

    if (verifyData.code !== code) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid code.');
    }

    if (verifyData.expiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError('deadline-exceeded', 'Code expired.');
    }

    if (verifyData.uid !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Verification initiated by another user.');
    }

    // 2. Update User & Registry
    await db.runTransaction(async (transaction) => {
        const userRef = db.collection(USERS_COLLECTION).doc(uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User profile not found');
        }

        const userData = userDoc.data();
        const currentPhones: string[] = userData?.phoneNumbers || [];

        if (!currentPhones.includes(clean)) {
            transaction.update(userRef, {
                phoneNumbers: admin.firestore.FieldValue.arrayUnion(clean)
            });
        }

        const regRef = db.collection(REGISTRY_COLLECTION).doc(clean);
        transaction.set(regRef, {
            uid,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.delete(verificationRef);
    });

    // 3. Trigger Debt Claiming (Background Task)
    // We can do this async or await it. For reliability, awaiting is better here unless we use a trigger.
    await claimLegacyDebtsAdmin(uid, clean);

    return { success: true };
});


// Helper: Claim Debts (Admin SDK version)
// Logic mirrors the client-side claimLegacyDebts but using Admin SDK
const claimLegacyDebtsAdmin = async (userId: string, phoneNumber: string) => {
    const clean = cleanPhone(phoneNumber);

    // Query debts where lenderId OR borrowerId matches phone
    const debtsRef = db.collection(DEBTS_COLLECTION);

    const lenderQuery = debtsRef.where('lenderId', '==', clean);
    const borrowerQuery = debtsRef.where('borrowerId', '==', clean);

    const [lenderSnaps, borrowerSnaps] = await Promise.all([
        lenderQuery.get(),
        borrowerQuery.get()
    ]);

    const batch = db.batch();
    let count = 0;

    lenderSnaps.forEach(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        const newParticipants = participants.filter((p: string) => p !== clean);
        if (!newParticipants.includes(userId)) newParticipants.push(userId);

        batch.update(doc.ref, {
            lenderId: userId,
            participants: newParticipants,
            // Ensure lockedPhoneNumber if missing
            ...(!data.lockedPhoneNumber ? { lockedPhoneNumber: clean } : {})
        });
        count++;
    });

    borrowerSnaps.forEach(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        const newParticipants = participants.filter((p: string) => p !== clean);
        if (!newParticipants.includes(userId)) newParticipants.push(userId);

        batch.update(doc.ref, {
            borrowerId: userId,
            participants: newParticipants,
            // Ensure lockedPhoneNumber if missing
            ...(!data.lockedPhoneNumber ? { lockedPhoneNumber: clean } : {})
        });
        count++;
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Claimed ${count} debts for user ${userId} phone ${phoneNumber}`);
    }

    // Link contacts logic can also be added here if needed, but debts are the priority.
};

// ============= PUSH NOTIFICATION TRIGGER =============

/**
 * Firestore'da yeni bildirim oluşturulduğunda FCM push notification gönder.
 * Kullanıcının fcmTokens alanından token'ları alır.
 */
export const sendPushOnNotification = functions.firestore
    .document('notifications/{notifId}')
    .onCreate(async (snap) => {
        const data = snap.data();
        if (!data || !data.userId) return;

        try {
            // Alıcının FCM token'larını al
            const userDoc = await db.collection(USERS_COLLECTION).doc(data.userId).get();
            if (!userDoc.exists) return;

            const userData = userDoc.data();
            const tokens: string[] = userData?.fcmTokens || [];

            if (tokens.length === 0) return;

            // Push notification gönder
            const message = {
                tokens,
                notification: {
                    title: 'Odeyn',
                    body: data.message || 'Yeni bildiriminiz var.'
                },
                data: {
                    debtId: data.debtId || '',
                    type: data.type || '',
                    actorId: data.actorId || ''
                },
                android: {
                    priority: 'high' as const,
                    notification: {
                        sound: 'default',
                        channelId: 'odeyn_notifications'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            };

            const response = await admin.messaging().sendEachForMulticast(message);

            // Geçersiz token'ları temizle
            const invalidTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(tokens[idx]);
                }
            });

            if (invalidTokens.length > 0) {
                await db.collection(USERS_COLLECTION).doc(data.userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                });
                console.log(`[Push] ${invalidTokens.length} geçersiz token temizlendi.`);
            }

            console.log(`[Push] ${response.successCount}/${tokens.length} başarılı gönderim.`);
        } catch (error) {
            console.error('[Push] Gönderim hatası:', error);
        }
    });
