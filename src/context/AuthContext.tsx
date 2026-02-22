import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ensureUserDocument } from '../services/auth';
import { registerSession, monitorSession, signOutUser } from '../services/session';
import { subscribeToBlockedUsers } from '../services/blockService';
import type { BlockRecord } from '../services/blockService';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    blockedUsers: BlockRecord[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);

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
                unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUser({
                            ...data,
                            uid: firebaseUser.uid,
                            displayName: data.displayName || firebaseUser.displayName || 'Kullanıcı'
                        } as User);
                    } else {
                        // Doc might not exist yet, but we have the Firebase User
                        setUser({
                            uid: firebaseUser.uid,
                            displayName: firebaseUser.displayName || 'Kullanıcı',
                            phoneNumbers: firebaseUser.phoneNumber ? [firebaseUser.phoneNumber] : [],
                            primaryPhoneNumber: firebaseUser.phoneNumber || ''
                        } as User);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("User snapshot error:", error);
                    setLoading(false);
                });

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
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            if (unsubscribeSession) unsubscribeSession();
            if (unsubscribeBlocked) unsubscribeBlocked();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, blockedUsers }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};
