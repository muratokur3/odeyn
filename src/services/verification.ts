import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    runTransaction
} from 'firebase/firestore';
import { db, auth, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { cleanPhone } from '../utils/phoneUtils';
import { claimLegacyDebts } from './db';

const VERIFICATION_CODES_COLLECTION = 'verificationCodes';
const USERS_COLLECTION = 'users';
const REGISTRY_COLLECTION = 'phone_registry';

interface VerificationCode {
    code: string;
    expiresAt: any; // Timestamp
    phoneNumber: string;
}

// Mock flag for development
const USE_MOCK_FUNCTIONS = false;

/**
 * Initiates phone verification by generating a code and "sending" it (mocked).
 */
export const initiatePhoneVerification = async (phoneNumber: string) => {
    const clean = cleanPhone(phoneNumber);

    if (USE_MOCK_FUNCTIONS) {
        return initiatePhoneVerificationMock(clean);
    } else {
        const initiateFn = httpsCallable(functions, 'initiatePhoneVerification');
        return initiateFn({ phoneNumber: clean });
    }
};

/**
 * Confirms the verification code and links the phone number.
 */
export const confirmPhoneVerification = async (phoneNumber: string, code: string) => {
    const clean = cleanPhone(phoneNumber);

    if (USE_MOCK_FUNCTIONS) {
        return confirmPhoneVerificationMock(clean, code);
    } else {
        const confirmFn = httpsCallable(functions, 'confirmPhoneVerification');
        const result = await confirmFn({ phoneNumber: clean, code });
        // The backend handles the claiming logic in the real function,
        // but for safety/sync in frontend state, we might trigger re-fetch if needed.
        return result.data;
    }
};


// --- MOCK IMPLEMENTATIONS (Simulating Backend Logic) ---

const initiatePhoneVerificationMock = async (phoneNumber: string) => {
    console.log(`[MOCK] Initiating verification for ${phoneNumber}`);

    // 1. Check if taken
    const registryRef = doc(db, REGISTRY_COLLECTION, phoneNumber);
    const registryDoc = await getDoc(registryRef);
    if (registryDoc.exists()) {
         // Allow if it's the current user (re-verifying?) or throw error
         const currentUid = auth.currentUser?.uid;
         if (registryDoc.data().uid !== currentUid) {
             throw new Error("Bu numara zaten başka bir hesaba kayıtlı.");
         }
    }

    // 2. Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // 3. Save to verificationCodes
    // Note: This requires client-side write access to this collection which might be restricted in prod.
    // For sandbox, we assume we can write or we just simulate.
    // Let's try to write to a temp collection or just local storage if strict rules apply.
    // But user asked to "Save code temporarily in a verificationCodes collection".
    const verificationRef = doc(db, VERIFICATION_CODES_COLLECTION, phoneNumber);
    await setDoc(verificationRef, {
        code,
        expiresAt,
        phoneNumber
    });

    console.log(`[MOCK] Code generated: ${code}`); // Visible in console for testing
    // Simulate SMS delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, message: "Code sent" };
};

const confirmPhoneVerificationMock = async (phoneNumber: string, code: string) => {
    console.log(`[MOCK] Confirming verification for ${phoneNumber} with code ${code}`);

    const verificationRef = doc(db, VERIFICATION_CODES_COLLECTION, phoneNumber);
    const verificationDoc = await getDoc(verificationRef);

    if (!verificationDoc.exists()) {
        throw new Error("Doğrulama kodu bulunamadı veya süresi dolmuş.");
    }

    const data = verificationDoc.data() as VerificationCode;

    // Check code
    if (data.code !== code) {
        throw new Error("Hatalı kod.");
    }

    // Check expiration (converting Firestore Timestamp to Date if needed)
    // In mock, it might be a Date object or Timestamp depending on how setDoc handled it.
    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (new Date() > expiresAt) {
        throw new Error("Kodun süresi dolmuş.");
    }

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Kullanıcı oturumu açık değil.");

    // Update User & Registry
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, USERS_COLLECTION, uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");

        const userData = userDoc.data();
        const currentPhones = userData.phoneNumbers || [];

        if (!currentPhones.includes(phoneNumber)) {
            transaction.update(userRef, {
                phoneNumbers: [...currentPhones, phoneNumber]
            });
        }

        const regRef = doc(db, REGISTRY_COLLECTION, phoneNumber);
        transaction.set(regRef, {
            uid,
            verifiedAt: serverTimestamp()
        });

        // Delete used code
        transaction.delete(verificationRef);
    });

    // Trigger Debt Claiming (Background Task simulation)
    await claimLegacyDebts(uid, phoneNumber);

    return { success: true };
};
