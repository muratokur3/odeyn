import {
    signOut,
    updateProfile,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    type ConfirmationResult,
    type User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { claimLegacyDebts } from './db';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';


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
 * Updates a user's display name and ensures their document exists.
 * Used during the final step of registration.
 */
export const finalizeUserRegistration = async (user: User, displayName: string) => {
    try {
        // Update Firebase Profile
        await updateProfile(user, { displayName });
        
        // Refresh token
        await user.getIdToken(true);
        
        // Ensure/Update Firestore Document
        await ensureUserDocument(user, displayName);
        
        return user;
    } catch (error) {
        console.error("Error finalizing registration:", error);
        throw error;
    }
};


/**
 * Checks and ensures the user document exists in Firestore after a login.
 * Especially useful for SMS-only logins where `linkPasswordToPhone` wasn't called.
 */
export const ensureUserDocument = async (user: User, customDisplayName?: string) => {
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
                displayName: customDisplayName || user.displayName || 'Kullanıcı',
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
            if (customDisplayName || (!userData.phoneNumbers && phones.length > 0)) {
                await updateDoc(userDocRef, {
                    displayName: customDisplayName || userData.displayName,
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
        // If we can't check (permission denied), assume true to let them try login.
        // Better to fail at OTP stage than block valid users here.
        return true;
    }
};
