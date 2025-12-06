import { db, storage, auth } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';

export const updateUserProfile = async (userId: string, displayName: string, photoURL?: string) => {
    try {
        // 1. Update Auth Profile
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, {
                displayName,
                ...(photoURL && { photoURL })
            });
        }

        // 2. Update Firestore User Document
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            displayName,
            ...(photoURL && { photoURL })
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
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
