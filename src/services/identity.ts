/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { cleanPhone, formatPhoneForDisplay } from '../utils/phoneUtils';
import type { Debt, DisplayProfile, Contact, User } from '../types';

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
    if (!clean) return false;
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
    if (!clean) return null;
    const docRef = doc(db, REGISTRY_COLLECTION, clean);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        const data = snapshot.data() as RegistryEntry;
        return data.uid;
    }
    return null;
};

/**
 * Resolves the display profile for a user based on the "Golden Rule":
 * 1. Contact (Nickname)
 * 2. System User (Real Name)
 * 3. Debt Snapshot (Ghost Name)
 * 4. Phone Number (Fallback)
 */
export const resolveUserDisplay = async (
    currentUserId: string,
    targetIdentifier: string, // uid OR phoneNumber
    debtContext?: Debt
): Promise<DisplayProfile> => {
    let targetUid: string | null = null;
    let targetPhone: string | null = null;

    // 1. Normalize Inputs
    if (targetIdentifier.startsWith('+') || targetIdentifier.length < 20) {
        // It's a phone number
        targetPhone = cleanPhone(targetIdentifier);
        // Try to find UID if not known
        targetUid = await resolvePhoneToUid(targetPhone || '');
    } else if (targetIdentifier.startsWith('phone:')) {
        // Shadow User UID "phone:+90555..."
        targetPhone = cleanPhone(targetIdentifier.replace('phone:', ''));
        targetUid = null;
    } else {
        // It's a standard UID
        targetUid = targetIdentifier;
    }

    // Fallback Phone from Debt Context if we still don't have it and it's relevant
    if (!targetPhone && debtContext && debtContext.lockedPhoneNumber) {
        const isTargetBorrower = debtContext.borrowerId === targetIdentifier || (debtContext.borrowerId.startsWith('phone:') && debtContext.borrowerId.includes(String(targetIdentifier)));
        const isTargetLender = debtContext.lenderId === targetIdentifier || (debtContext.lenderId.startsWith('phone:') && debtContext.lenderId.includes(String(targetIdentifier)));

        if (isTargetBorrower || isTargetLender) {
            targetPhone = debtContext.lockedPhoneNumber;
        }
    }

    // --- PRIORITY 1: PRIVATE CONTACT ---
    let contact: Contact | null = null;

    if (currentUserId) {
        const contactsRef = collection(db, 'users', currentUserId, 'contacts');

        if (targetUid) {
            const q = query(contactsRef, where('linkedUserId', '==', targetUid));
            const snap = await getDocs(q);
            if (!snap.empty) contact = snap.docs[0].data() as Contact;
        }

        if (!contact && targetPhone) {
            const q = query(contactsRef, where('phoneNumber', '==', targetPhone));
            const snap = await getDocs(q);
            if (!snap.empty) contact = snap.docs[0].data() as Contact;
        }
    }

    // --- PRIORITY 2: SYSTEM PROFILE ---
    let systemUser: User | null = null;
    if (targetUid) {
        const userDoc = await getDoc(doc(db, 'users', targetUid));
        if (userDoc.exists()) {
            systemUser = userDoc.data() as User;
            if (!targetPhone) targetPhone = systemUser.phoneNumber;
        }
    }

    // DECISION LOGIC
    if (contact) {
        const realName = systemUser?.displayName || '';
        const displayPhone = contact.phoneNumber || targetPhone || '';

        return {
            displayName: contact.name,
            secondaryText: systemUser ? `Uygulama Kullanıcısı: ${realName}` : formatPhoneForDisplay(displayPhone),
            photoURL: systemUser?.photoURL,
            initials: getInitials(contact.name),
            isSystemUser: !!systemUser,
            isContact: true,
            phoneNumber: displayPhone,
            uid: systemUser?.uid
        };
    }

    if (systemUser) {
        return {
            displayName: systemUser.displayName,
            secondaryText: formatPhoneForDisplay(systemUser.phoneNumber),
            photoURL: systemUser.photoURL,
            initials: getInitials(systemUser.displayName),
            isSystemUser: true,
            isContact: false,
            phoneNumber: systemUser.phoneNumber,
            uid: systemUser.uid
        };
    }

    if (debtContext) {
        let snapshotName = '';
        if (debtContext.borrowerId === targetIdentifier || (targetPhone && debtContext.borrowerId === `phone:${targetPhone}`)) {
            snapshotName = debtContext.borrowerName;
        }
        else if (debtContext.lenderId === targetIdentifier || (targetPhone && debtContext.lenderId === `phone:${targetPhone}`)) {
            snapshotName = debtContext.lenderName;
        }

        if (snapshotName) {
            const finalPhone = targetPhone || debtContext.lockedPhoneNumber || '';
            return {
                displayName: snapshotName,
                secondaryText: formatPhoneForDisplay(finalPhone),
                photoURL: undefined,
                initials: getInitials(snapshotName),
                isSystemUser: false,
                isContact: false,
                phoneNumber: finalPhone
            };
        }
    }

    const finalFallback = targetPhone || targetIdentifier || "Bilinmeyen";
    return {
        displayName: formatPhoneForDisplay(finalFallback),
        secondaryText: "Bilinmeyen Kullanıcı",
        photoURL: undefined,
        initials: "?",
        isSystemUser: false,
        isContact: false,
        phoneNumber: finalFallback
    };
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
};
