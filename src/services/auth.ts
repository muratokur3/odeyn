import {
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    EmailAuthProvider,
    linkWithCredential,
    type ConfirmationResult,
    type User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { claimLegacyDebts } from './db';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { hashPhone } from '../utils/hash';

const EMAIL_DOMAIN = '@debtdert.local';

/**
 * Formats a phone number into a pseudo-email for password authentication.
 */
const formatPseudoEmail = (phoneNumber: string) => {
    const cleanPhone = cleanPhoneNumber(phoneNumber);
    return `${cleanPhone}${EMAIL_DOMAIN}`;
};

/**
 * Starts the Phone Login/Registration flow by sending an SMS OTP.
 */
export const startPhoneLogin = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const confirmationResult = await signInWithPhoneNumber(auth, cleanPhone, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error("Error sending SMS:", error);
        throw error;
    }
};

/**
 * Links a password (via pseudo-email) to the currently signed-in Phone User.
 * This is Step 3 of the Registration flow.
 */
export const linkPasswordToPhone = async (user: User, password: string, displayName: string, recoveryEmail?: string) => {
    try {
        const cleanPhone = user.phoneNumber || ''; // Should be present for phone users
        if (!cleanPhone) throw new Error("User has no phone number");

        const pseudoEmail = formatPseudoEmail(cleanPhone);
        const credential = EmailAuthProvider.credential(pseudoEmail, password);

        // Link the credential
        const userCred = await linkWithCredential(user, credential);
        const linkedUser = userCred.user;

        // Update Profile
        await updateProfile(linkedUser, { displayName });

        // Save/Update User Document in Firestore
        await setDoc(doc(db, 'users', linkedUser.uid), {
            uid: linkedUser.uid,
            phoneNumber: cleanPhone,
            displayName: displayName,
            authEmail: pseudoEmail, // Read-only internal email
            recoveryEmail: recoveryEmail || null, // Real user email
            createdAt: serverTimestamp()
        }, { merge: true });

        // Claim existing debts related to this phone number
        await claimLegacyDebts(linkedUser.uid, cleanPhone);

        return linkedUser;
    } catch (error) {
        console.error("Error linking password:", error);
        throw error;
    }
};

/**
 * Logs in a user using their Phone Number and Password (convenience method).
 */
export const loginWithPhoneAndPassword = async (phoneNumber: string, password: string) => {
    try {
        const pseudoEmail = formatPseudoEmail(phoneNumber);
        const userCredential = await signInWithEmailAndPassword(auth, pseudoEmail, password);

        // Ensure fresh claims
        if (userCredential.user.phoneNumber) {
            await claimLegacyDebts(userCredential.user.uid, userCredential.user.phoneNumber);
        } else {
            // If phone number is somehow missing from auth object (rare for this flow), try to get from email
            const extractedPhone = pseudoEmail.replace(EMAIL_DOMAIN, '');
            await claimLegacyDebts(userCredential.user.uid, extractedPhone);
        }

        return userCredential.user;
    } catch (error) {
        console.error("Error logging in with password:", error);
        throw error;
    }
};

/**
 * Checks and ensures the user document exists in Firestore after a login.
 * Especially useful for SMS-only logins where `linkPasswordToPhone` wasn't called.
 */
export const ensureUserDocument = async (user: User) => {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const phone = user.phoneNumber || '';
        const clean = cleanPhoneNumber(phone);

        if (!userDoc.exists()) {
            // New User Initialization
            await setDoc(userDocRef, {
                uid: user.uid,
                phoneNumbers: clean ? [clean] : [],
                primaryPhoneNumber: clean,
                displayName: user.displayName || 'Kullanıcı',
                authEmail: user.email || null,
                createdAt: serverTimestamp()
            });

            // Register in Registry
            if (clean) {
                const regRef = doc(db, 'phone_registry', clean);
                await setDoc(regRef, {
                    uid: user.uid,
                    verifiedAt: serverTimestamp()
                });

                await claimLegacyDebts(user.uid, clean);
            }
        } else {
            // Existing User Maintenance
            // Ensure they are in Registry (Self-Healing)
            const userData = userDoc.data();
            const phones = userData.phoneNumbers || (userData.phoneNumber ? [userData.phoneNumber] : []);

            // If schema migration needed
            if (!userData.phoneNumbers && phones.length > 0) {
                await updateDoc(userDocRef, {
                    phoneNumbers: phones,
                    primaryPhoneNumber: phones[0]
                });
            }

            // Register all owned phones
            for (const p of phones) {
                const regRef = doc(db, 'phone_registry', p);
                const regDoc = await getDoc(regRef);
                if (!regDoc.exists()) {
                    await setDoc(regRef, {
                        uid: user.uid,
                        verifiedAt: serverTimestamp()
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error ensuring user document:", error);
    }
};

export const logoutUser = async () => {
    await signOut(auth);
};

/**
 * Helper to check if a user document exists (for recovery flow).
 */
export const checkUserExists = async (_phoneNumber: string): Promise<boolean> => {
    try {
        const clean = cleanPhoneNumber(_phoneNumber);
        if (!clean) return false;

        const registryRef = doc(db, 'phone_registry', clean);
        const docSnap = await getDoc(registryRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking user existence:", error);
        return false;
    }
};
