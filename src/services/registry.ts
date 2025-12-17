import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { cleanPhone } from '../utils/phoneUtils';

const REGISTRY_COLLECTION = 'phone_registry';

interface RegistryEntry {
    uid: string;
    verifiedAt: any; // Timestamp
}

/**
 * Checks if a phone number is already registered to ANY user.
 */
export const isPhoneRegistered = async (phoneNumber: string): Promise<boolean> => {
    const clean = cleanPhone(phoneNumber);
    const docRef = doc(db, REGISTRY_COLLECTION, clean);
    const snapshot = await getDoc(docRef);
    return snapshot.exists();
};

/**
 * Resolves a phone number to a User UID using the Registry.
 * Returns null if not found.
 */
export const resolvePhoneToUid = async (phoneNumber: string): Promise<string | null> => {
    const clean = cleanPhone(phoneNumber);
    const docRef = doc(db, REGISTRY_COLLECTION, clean);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        const data = snapshot.data() as RegistryEntry;
        return data.uid;
    }
    return null;
};
