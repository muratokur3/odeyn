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
        const rawPhone = user.phoneNumber || '';
        if (!rawPhone) throw new Error("User has no phone number");
        
        // CRITICAL FIX: Actually clean the phone number with cleanPhoneNumber()
        // This was the bug - variable was named cleanPhone but function was never called!
        const cleanPhone = cleanPhoneNumber(rawPhone);

        const pseudoEmail = formatPseudoEmail(cleanPhone);

        // Check if already linked (Idempotency for retries)
        const isPasswordLinked = user.providerData.some(p => p.providerId === EmailAuthProvider.PROVIDER_ID);
        
        let linkedUser = user;

        if (!isPasswordLinked) {
            const credential = EmailAuthProvider.credential(pseudoEmail, password);
             // Link the credential
            const userCred = await linkWithCredential(user, credential);
            linkedUser = userCred.user;
        } else {
            // Already linked? We should actually verify if we need to sign in with password to re-auth?
            // But since we are logged in (via phone), we are fine.
            // Just proceed to update DB.
            console.log("User already has password linked. Skipping link step.");
        }


        // Force strict token refresh to ensure Firestore sees the new state
        await linkedUser.getIdToken(true);
        // Small buffer for claim propagation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("[DEBUG_AUTH] Token refreshed. UID:", linkedUser.uid);
        console.log("[DEBUG_AUTH] Target UID for Write:", linkedUser.uid);

        // Update Profile
        await updateProfile(linkedUser, { displayName });

        // Save/Update User Document in Firestore
        try {
            const userDocRef = doc(db, 'users', linkedUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                // UPDATE existing doc
                const userData = userDocSnap.data() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
                const currentPhones = userData.phoneNumbers || [];
                
                // Add phone to phoneNumbers array if not already present
                const updatedPhones = currentPhones.includes(cleanPhone) 
                    ? currentPhones 
                    : [...currentPhones, cleanPhone];

                await updateDoc(userDocRef, {
                    displayName: displayName,
                    authEmail: pseudoEmail,
                    recoveryEmail: recoveryEmail || null,
                    phoneNumber: cleanPhone,
                    phoneNumbers: updatedPhones,
                    primaryPhoneNumber: cleanPhone || userData.primaryPhoneNumber
                    // Do NOT update createdAt
                });
                console.log("[DEBUG_AUTH] User doc UPDATED successfully.");
            } else {
                // CREATE new doc
                await setDoc(userDocRef, {
                    uid: linkedUser.uid,
                    phoneNumber: cleanPhone,
                    displayName: displayName,
                    authEmail: pseudoEmail,
                    recoveryEmail: recoveryEmail || null,
                    createdAt: serverTimestamp(),
                    phoneNumbers: cleanPhone ? [cleanPhone] : [], // Initialize array
                    primaryPhoneNumber: cleanPhone
                });
                console.log("[DEBUG_AUTH] User doc CREATED successfully.");
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (dbError: any) {
            console.error("[DEBUG_AUTH] Firestore write failed:", dbError);
            throw new Error(`DB Write Failed: ${dbError.code || dbError.message}`);
        }

        // Register phone in phone_registry (CRITICAL for resolvePhoneToUid to work)
        try {
            const regRef = doc(db, 'phone_registry', cleanPhone);
            await setDoc(regRef, {
                uid: linkedUser.uid,
                verifiedAt: serverTimestamp()
            }, { merge: true });
            console.log("[DEBUG_AUTH] Phone registered in registry:", cleanPhone);
        } catch (regError) {
            console.warn("Registry write failed (non-fatal):", regError);
        }

        // Claim existing debts related to this phone number
        try {
            await claimLegacyDebts(linkedUser.uid, cleanPhone);
        } catch (claimError) {
             console.warn("Legacy debt claim failed (non-fatal):", claimError);
        }

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

        // Ensure fresh claims - CRITICAL: clean phone to E.164 format!
        let cleanedPhone = '';
        if (userCredential.user.phoneNumber) {
            cleanedPhone = cleanPhoneNumber(userCredential.user.phoneNumber);
        } else {
            // If phone number is somehow missing from auth object (rare for this flow), try to get from email
            const extractedPhone = pseudoEmail.replace(EMAIL_DOMAIN, '');
            cleanedPhone = cleanPhoneNumber(extractedPhone);
        }

        // Register phone in phone_registry (CRITICAL for resolvePhoneToUid to work)
        if (cleanedPhone) {
            try {
                const regRef = doc(db, 'phone_registry', cleanedPhone);
                await setDoc(regRef, {
                    uid: userCredential.user.uid,
                    verifiedAt: serverTimestamp()
                }, { merge: true });
                console.log("[DEBUG_AUTH] Phone registered in registry on login:", cleanedPhone);
            } catch (regError) {
                console.warn("Registry write failed on login (non-fatal):", regError);
            }
        }

        await claimLegacyDebts(userCredential.user.uid, cleanedPhone);

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
        // If we can't check (permission denied), assume true to let them try login.
        // Better to fail at OTP stage than block valid users here.
        return true;
    }
};
