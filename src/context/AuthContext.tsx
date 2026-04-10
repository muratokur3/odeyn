import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ensureUserDocument } from '../services/auth';
import { registerSession, monitorSession, signOutUser } from '../services/session';
import { subscribeToBlockedUsers } from '../services/blockService';
import type { BlockRecord } from '../services/blockService';
import type { User } from '../types';
import { initPushNotifications, removePushListeners } from '../services/pushNotification';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    blockedUsers: BlockRecord[];
    blockedUsersLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);
    const [blockedUsersLoading, setBlockedUsersLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;
        let unsubscribeSession: (() => void) | null = null;
        let unsubscribeBlocked: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
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
                    registerSession(firebaseUser.uid);

                    unsubscribeSession = monitorSession(firebaseUser.uid, () => {
                        console.warn("Session revoked. Logging out.");
                        signOutUser();
                    });

                } catch (e) {
                    console.error("Auth initialization error:", e);
                }

                const userRef = doc(db, 'users', firebaseUser.uid);
                unsubscribeSnapshot = onSnapshot(userRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const phoneNumber = data.phoneNumber || firebaseUser.phoneNumber || '';

                        setUser({
                            ...data,
                            uid: firebaseUser.uid,
                            displayName: data.displayName || firebaseUser.displayName || 'Kullanıcı',
                            phoneNumber
                        } as User);

                        if (phoneNumber) {
                            try {
                                const { claimLegacyDebts } = await import('../services/db');
                                const claimName = data.displayName || firebaseUser.displayName || 'Kullanıcı';
                                await claimLegacyDebts(firebaseUser.uid, phoneNumber, claimName);
                            } catch (err) {
                                console.warn('claimLegacyDebts failed on login:', err);
                            }
                        }
                    } else {
                        // Doc might not exist yet, but we have the Firebase User
                        const phoneNumber = firebaseUser.phoneNumber || '';
                        const displayName = firebaseUser.displayName || 'Kullanıcı';
                        setUser({
                            uid: firebaseUser.uid,
                            displayName,
                            phoneNumber
                        } as User);

                        if (phoneNumber) {
                            try {
                                const { claimLegacyDebts } = await import('../services/db');
                                await claimLegacyDebts(firebaseUser.uid, phoneNumber, displayName);
                            } catch (err) {
                                console.warn('claimLegacyDebts failed on login:', err);
                            }
                        }
                    }

                    // Push notification init (native only)
                    initPushNotifications(firebaseUser.uid).catch(err =>
                        console.warn('Push notification init failed:', err)
                    );

                    setLoading(false);
                }, (error) => {
                    console.error("User snapshot error:", error);
                    setLoading(false);
                });

                unsubscribeBlocked = subscribeToBlockedUsers(firebaseUser.uid, (blocked) => {
                    setBlockedUsers(blocked);
                    setBlockedUsersLoading(false);
                });

            } else {
                setUser(null);
                setBlockedUsers([]);
                setBlockedUsersLoading(false);
                setLoading(false);
                removePushListeners().catch(() => {}); // Cleanup push listeners
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSession) unsubscribeSession();
            if (unsubscribeBlocked) unsubscribeBlocked();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, blockedUsers, blockedUsersLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};
