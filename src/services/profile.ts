import { db, auth } from './firebase';
import { doc, updateDoc, serverTimestamp, FieldValue } from 'firebase/firestore';
import { updateProfile, updateEmail } from 'firebase/auth';

export interface ProfileUpdateData {
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    photoURL?: string;
}

export const updateUserProfile = async (userId: string, data: ProfileUpdateData) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No authenticated user");

        // 1. Update Auth Profile (Display Name & Photo)
        if (data.displayName || data.photoURL) {
            await updateProfile(user, {
                ...(data.displayName && { displayName: data.displayName }),
                ...(data.photoURL && { photoURL: data.photoURL })
            });
        }

        // 2. Update Auth Email (if changed)
        if (data.email && data.email !== user.email) {
            await updateEmail(user, data.email);
        }

        // 3. Update Firestore User Document
        const userRef = doc(db, 'users', userId);

        // Use a more specific type instead of any, or Record<string, unknown>
        const firestoreData: Record<string, string | FieldValue> = {
            updatedAt: serverTimestamp(),
        };

        if (data.displayName) firestoreData.displayName = data.displayName;
        if (data.email) {
            firestoreData.email = data.email;
            firestoreData.recoveryEmail = data.email;
        }
        if (data.phoneNumber) firestoreData.phoneNumber = data.phoneNumber;
        if (data.photoURL) firestoreData.photoURL = data.photoURL;

        await updateDoc(userRef, firestoreData);

    } catch (error) {
        console.error("Error updating profile:", error);

        // Type check error
        const err = error as { code?: string };

        // Rethrow specific auth errors for UI handling
        if (err.code === 'auth/requires-recent-login' || err.code === 'auth/email-already-in-use') {
            throw error;
        }
        throw new Error("Profil güncellenirken bir hata oluştu.");
    }
};
