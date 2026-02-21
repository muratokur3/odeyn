
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
        
        const timestamp = Date.now();
        const fileName = `profile_${timestamp}.jpg`;
        const storageRef = ref(storage, `profiles/${userId}/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        const url = await getDownloadURL(snapshot.ref);
        
        return url;
    } catch (error) {
        console.error("Error in uploadProfileImage:", error);
        throw error;
    }
};
