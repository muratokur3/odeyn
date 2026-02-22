import { db, auth } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

export interface ProfileUpdateData {
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    photoURL?: string;
    // Business Mode Fields
    userType?: 'INDIVIDUAL' | 'BUSINESS';
    businessName?: string;
    taxNumber?: string;
    taxOffice?: string;
    address?: string;
    customExchangeRates?: Record<string, number>;
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


        // 3. Update Firestore User Document
        const userRef = doc(db, 'users', userId);
        const firestoreData: any = {
            updatedAt: serverTimestamp(),
            ...(data.displayName && { displayName: data.displayName }),
            ...(data.email && { email: data.email, recoveryEmail: data.email }),
            ...(data.phoneNumber && { phoneNumber: data.phoneNumber }), // Phone updated in DB only
            ...(data.photoURL && { photoURL: data.photoURL }),
            // Business Fields
            ...(data.userType && { userType: data.userType }),
            ...(data.businessName && { businessName: data.businessName }),
            ...(data.taxNumber && { taxNumber: data.taxNumber }),
            ...(data.taxOffice && { taxOffice: data.taxOffice }),
            ...(data.address && { address: data.address }),
            ...(data.customExchangeRates && { customExchangeRates: data.customExchangeRates })
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


