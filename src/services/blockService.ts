import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

export interface BlockRecord {
    blockedUid: string;
    blockedAt: Timestamp;
    name: string; // Added name field
    reason?: string;
}

/**
 * Blocks a user.
 * @param currentUid The user performing the block.
 * @param targetUid The user to be blocked.
 * @param name The name of the user being blocked (for display).
 * @param reason Optional reason.
 */
export const blockUser = async (currentUid: string, targetUid: string, name: string, reason?: string) => {
    try {
        if (currentUid === targetUid) throw new Error("Cannot block yourself.");

        // Using 'blockedUsers' collection as per requirements
        const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUid);
        await setDoc(blockRef, {
            blockedUid: targetUid,
            blockedAt: serverTimestamp(),
            name,
            ...(reason && { reason })
        });
    } catch (error) {
        console.error("Error blocking user:", error);
        throw error;
    }
};

/**
 * Unblocks a user.
 */
export const unblockUser = async (currentUid: string, targetUid: string) => {
    try {
        const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUid);
        await deleteDoc(blockRef);
    } catch (error) {
        console.error("Error unblocking user:", error);
        throw error;
    }
};

/**
 * Checks if targetUid is blocked by currentUid.
 */
export const isUserBlocked = async (currentUid: string, targetUid: string): Promise<boolean> => {
    try {
        const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUid);
        const docSnap = await getDoc(blockRef);
        return docSnap.exists();
    } catch (error) {
        // Silently fail - permissions errors are expected if user document doesn't exist yet
        return false;
    }
};

/**
 * Checks if there is a mutual block or single block between two users.
 * Returns true if ANY party blocked the other.
 */
export const checkBlockStatus = async (uid1: string, uid2: string): Promise<boolean> => {
    // Check if uid1 blocked uid2
    const block1 = await isUserBlocked(uid1, uid2);
    if (block1) return true;

    // Check if uid2 blocked uid1
    const block2 = await isUserBlocked(uid2, uid1);
    return block2;
};

/**
 * Fetches the list of blocked users for a given user.
 */
export const getBlockedUsers = async (currentUid: string): Promise<BlockRecord[]> => {
    try {
        const q = query(collection(db, 'users', currentUid, 'blockedUsers'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as BlockRecord);
    } catch (error) {
        console.error("Error getting blocked users:", error);
        return [];
    }
};

/**
 * Subscribes to the list of blocked users for real-time updates.
 */
export const subscribeToBlockedUsers = (currentUid: string, callback: (blockedUsers: BlockRecord[]) => void) => {
    const q = query(collection(db, 'users', currentUid, 'blockedUsers'));
    return onSnapshot(q, (snapshot) => {
        const blocked = snapshot.docs.map(doc => doc.data() as BlockRecord);
        callback(blocked);
    });
};
