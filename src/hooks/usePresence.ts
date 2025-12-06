import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export const usePresence = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);

        // Initial update
        updateDoc(userRef, {
            isOnline: true,
            lastSeen: serverTimestamp()
        }).catch(console.error);

        // Heartbeat every minute
        const interval = setInterval(() => {
            updateDoc(userRef, {
                lastSeen: serverTimestamp()
            }).catch(console.error);
        }, 60000);

        // Cleanup on unmount (e.g. logout)
        return () => {
            clearInterval(interval);
            // We can try to set isOnline to false, but this might not fire if tab closes
            // For reliable "offline" status, we usually need Realtime Database or Cloud Functions
            // But this is a good best-effort for now.
            updateDoc(userRef, {
                isOnline: false,
                lastSeen: serverTimestamp()
            }).catch(console.error);
        };
    }, [user]);
};
