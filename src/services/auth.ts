import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { claimDebts } from './db';
import { cleanPhoneNumber } from '../utils/phone';

const EMAIL_DOMAIN = '@debtapp.local';

const formatPseudoEmail = (phoneNumber: string) => {
    const cleanPhone = cleanPhoneNumber(phoneNumber);
    return `${cleanPhone}${EMAIL_DOMAIN}`;
};

export const registerUser = async (phoneNumber: string, password: string, displayName: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const email = formatPseudoEmail(cleanPhone);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            phoneNumber: cleanPhone,
            displayName,
            email: user.email, // Optional, storing pseudo email
            createdAt: serverTimestamp(),
            savedContacts: []
        });

        // Claim debts on registration
        await claimDebts(user.uid, cleanPhone);

        return user;
    } catch (error) {
        throw error;
    }
};

export const ensureUserDocument = async (user: any) => {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        // Extract phone from email if not present
        const phoneNumber = user.email?.replace(EMAIL_DOMAIN, '') || '';

        if (!userDoc.exists()) {
            // Recreate user document from Auth data
            await setDoc(userDocRef, {
                uid: user.uid,
                phoneNumber: phoneNumber, // Already cleaned in email
                displayName: user.displayName || 'Kullanıcı',
                email: user.email,
                createdAt: serverTimestamp(),
                savedContacts: []
            });
            console.log("User document recreated.");

            // If we had to recreate the doc, maybe we should claim debts too?
            if (phoneNumber) {
                await claimDebts(user.uid, phoneNumber);
            }
        }

        // REMOVED: Automatic claimDebts on every ensureUserDocument (every page load)
        // This was causing excessive reads. It is now handled in login/register.

    } catch (error) {
        console.error("Error ensuring user document:", error);
    }
};

export const loginUser = async (phoneNumber: string, password: string) => {
    try {
        const cleanPhone = cleanPhoneNumber(phoneNumber);
        const email = formatPseudoEmail(cleanPhone);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Claim debts on explicit login
        if (userCredential.user) {
            await claimDebts(userCredential.user.uid, cleanPhone);
        }

        return userCredential.user;
    } catch (error) {
        throw error;
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        throw error;
    }
};
