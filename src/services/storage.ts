
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageOptimizer';

/**
 * Uploads an attachment (Image/PDF) for a debt or payment.
 */
export const uploadDebtAttachment = async (
    file: File, 
    debtId: string, 
    userId: string
): Promise<{ url: string, type: 'IMAGE' | 'PDF', fileName: string }> => {
    try {
        console.log("Starting debt attachment upload...");
        
        const isPdf = file.type === 'application/pdf';
        let uploadBlob: Blob | File = file;

        // Compress if it's an image
        if (!isPdf && file.type.startsWith('image/')) {
            uploadBlob = await compressImage(file, 1200, 0.8);
        }

        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `debts/${debtId}/${fileName}`);

        const snapshot = await uploadBytes(storageRef, uploadBlob);
        const url = await getDownloadURL(snapshot.ref);

        return {
            url,
            type: isPdf ? 'PDF' : 'IMAGE',
            fileName: file.name
        };
    } catch (error) {
        console.error("Error in uploadDebtAttachment:", error);
        throw error;
    }
};

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
