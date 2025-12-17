import {
    doc,
    runTransaction,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { RecaptchaVerifier, linkWithPhoneNumber } from 'firebase/auth';
import { cleanPhone } from '../utils/phoneUtils';
import { claimLegacyDebts } from './db';
import { isPhoneRegistered } from './registry';
import type { User } from '../types';

const REGISTRY_COLLECTION = 'phone_registry';
const USERS_COLLECTION = 'users';

export { isPhoneRegistered, resolvePhoneToUid } from './registry';

/**
 * Adds a secondary phone number to the current user.
 * Requires SMS verification to prove ownership.
 */
export const startAddPhoneVerification = async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
    const clean = cleanPhone(phoneNumber);

    // 1. Check Registry
    const isTaken = await isPhoneRegistered(clean);
    if (isTaken) {
        throw new Error("Bu numara zaten başka bir hesaba kayıtlı.");
    }

    // 2. Send SMS
    if (!auth.currentUser) throw new Error("Kullanıcı oturumu açık değil.");

    try {
        const confirmationResult = await linkWithPhoneNumber(auth.currentUser, clean, appVerifier);
        return confirmationResult;
    } catch (error: any) {
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error("Bu numara zaten başka bir hesaba bağlı (Auth).");
        }
        throw error;
    }
};

/**
 * Confirms OTP and finalizes adding the phone number.
 */
export const confirmAddPhone = async (confirmationResult: any, verificationCode: string) => {
    if (!auth.currentUser) throw new Error("No user");

    // 1. Verify OTP via Firebase Auth Link
    await confirmationResult.confirm(verificationCode);

    // We assume if it succeeds, the number is verified.
    return true;
};

/**
 * Simplified Wrapper: Takes the verified phone number (after UI handles confirm) and updates DB.
 */
export const finalizeAddPhone = async (phoneNumber: string) => {
    const clean = cleanPhone(phoneNumber);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user");

    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, USERS_COLLECTION, uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User profile not found");

        const userData = userDoc.data() as User;
        const currentPhones = userData.phoneNumbers || [];

        if (currentPhones.includes(clean)) return; // Already added

        // Update Registry
        const regRef = doc(db, REGISTRY_COLLECTION, clean);
        const regDoc = await transaction.get(regRef);
        if (regDoc.exists() && regDoc.data().uid !== uid) {
            throw new Error("Number claim conflict.");
        }

        transaction.set(regRef, {
            uid,
            verifiedAt: serverTimestamp()
        });

        // Update User Profile
        transaction.update(userRef, {
            phoneNumbers: [...currentPhones, clean],
            ...(currentPhones.length === 0 ? { primaryPhoneNumber: clean } : {})
        });
    });

    // Post-Transaction: Claim Debts
    await claimLegacyDebts(uid, clean);
};

export const removePhone = async (phoneNumber: string) => {
    const clean = cleanPhone(phoneNumber);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user");

    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, USERS_COLLECTION, uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User profile not found");

        const userData = userDoc.data() as User;
        const currentPhones = userData.phoneNumbers || [];

        if (!currentPhones.includes(clean)) throw new Error("Number not linked to this account.");
        if (currentPhones.length <= 1) throw new Error("En az bir telefon numarası kalmalıdır.");

        const newPhones = currentPhones.filter(p => p !== clean);

        let newPrimary = userData.primaryPhoneNumber;
        if (userData.primaryPhoneNumber === clean) {
            newPrimary = newPhones[0];
        }

        // Update User
        transaction.update(userRef, {
            phoneNumbers: newPhones,
            primaryPhoneNumber: newPrimary
        });

        // Remove from Registry
        const regRef = doc(db, REGISTRY_COLLECTION, clean);
        transaction.delete(regRef);
    });
};

export const setPrimaryPhone = async (phoneNumber: string) => {
    const clean = cleanPhone(phoneNumber);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user");

    await updateDoc(doc(db, USERS_COLLECTION, uid), {
        primaryPhoneNumber: clean
    });
};
