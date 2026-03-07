
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageOptimizer';

/**
 * Uploads a profile image for a user.
 */
export const uploadProfileImage = async (
    file: File,
    userId: string
): Promise<string> => {
    try {
        // Compress image before upload
        const compressedBlob = await compressImage(file, 800, 0.8);
        
        // Upload exactly to profile_images/{userId} to match strict Firebase Storage rules
        const storageRef = ref(storage, `profile_images/${userId}`);
        const metadata = { contentType: 'image/jpeg' };
        
        const snapshot = await uploadBytes(storageRef, compressedBlob, metadata);
        const url = await getDownloadURL(snapshot.ref);
        
        // Append timestamp to bypass browser cache since we are overwriting the same path
        return `${url}&t=${Date.now()}`;
    } catch (error) {
        console.error("Error in uploadProfileImage:", error);
        throw error;
    }
};
