import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ensureUserDocument } from '../services/auth';
import { registerSession, monitorSession, signOutUser } from '../services/session';
import { subscribeToBlockedUsers } from '../services/blockService';
import type { BlockRecord } from '../services/blockService';
import type { User } from '../types';

export const useAuthLogic = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;
        let unsubscribeSession: (() => void) | null = null;
        let unsubscribeBlocked: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            // Clean up previous listeners
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            if (unsubscribeSession) {
                unsubscribeSession();
                unsubscribeSession = null;
            }
            if (unsubscribeBlocked) {
                unsubscribeBlocked();
                unsubscribeBlocked = null;
            }

            if (firebaseUser) {
                try {
                    await ensureUserDocument(firebaseUser);
                    // Register session (non-blocking)
                    registerSession(firebaseUser.uid);

                    // Monitor session for revocation
                    unsubscribeSession = monitorSession(firebaseUser.uid, () => {
                        console.warn("Session revoked from server. Logging out.");
                        signOutUser();
                    });

                } catch (e) {
                    console.error("Auth ensure doc error", e);
                }

                // Subscribe to User Data
                const userRef = doc(db, 'users', firebaseUser.uid);
                unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUser(docSnap.data() as User);
                    } else {
                        setUser(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("User snapshot error:", error);
                    setLoading(false);
                });

                // Subscribe to Blocked Users
                unsubscribeBlocked = subscribeToBlockedUsers(firebaseUser.uid, (blocked) => {
                    setBlockedUsers(blocked);
                });

            } else {
                setUser(null);
                setBlockedUsers([]);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
            }
            if (unsubscribeSession) {
                unsubscribeSession();
            }
            if (unsubscribeBlocked) {
                unsubscribeBlocked();
            }
        };
    }, []);

    return { user, loading, blockedUsers };
};
