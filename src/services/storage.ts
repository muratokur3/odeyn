
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageOptimizer';

/**
 * Uploads a profile image for a specific user to Firebase Storage.
 * Applies client-side compression before uploading.
 * 
 * @param file The file object from the input.
 * @param userId The UID of the user.
 * @returns Promise resolving to the download URL of the uploaded image.
 */
export const uploadProfileImage = async (file: File, userId: string): Promise<string> => {
    try {
        console.log("Starting profile image upload...");

        // 1. Compress Image (Max 500px, 0.7 Quality)
        // Using existing utility
        const compressedBlob = await compressImage(file, 500, 0.7);
        console.log("Image compressed successfully.");

        // 2. Create Storage Reference
        // Path: profile_images/{userId}
        const storageRef = ref(storage, `profile_images/${userId}`);

        // 3. Upload File
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        console.log("Upload completed, fetching URL...");

        // 4. Get Download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log("Download URL obtained:", downloadURL);

        return downloadURL;
    } catch (error) {
        console.error("Error in uploadProfileImage:", error);
        throw error;
    }
};
