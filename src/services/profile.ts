import { db, storage, auth } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
        const firestoreData: any = {
            updatedAt: serverTimestamp(),
            ...(data.displayName && { displayName: data.displayName }),
            ...(data.email && { email: data.email }),
            ...(data.phoneNumber && { phoneNumber: data.phoneNumber }), // Phone updated in DB only
            ...(data.photoURL && { photoURL: data.photoURL })
        };

        await updateDoc(userRef, firestoreData);

    } catch (error: any) {
        console.error("Error updating profile:", error);
        // Rethrow specific auth errors for UI handling
        if (error.code === 'auth/requires-recent-login' || error.code === 'auth/email-already-in-use') {
            throw error;
        }
        throw new Error("Profil güncellenirken bir hata oluştu.");
    }
};

import { compressImage } from '../utils/imageOptimizer';

export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    try {
        // Compress image before upload (max 500px, 0.7 quality)
        const compressedBlob = await compressImage(file, 500, 0.7);

        const storageRef = ref(storage, `profile_images/${userId}`);
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};
