import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
    collection,
    query,
    where,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Notification } from '../services/notificationService';

export const useNotifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) {
            const timer = setTimeout(() => {
                setNotifications([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        // Real-time listener for user's notifications
        try {
            const notificationsRef = collection(db, 'notifications');
            // No orderBy to avoid index requirement, sorting in memory
            const q = query(
                notificationsRef,
                where('userId', '==', user.uid)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const notifs: Notification[] = [];

                snapshot.forEach(docSnap => {
                    const data = docSnap.data();

                    // Handle null createdAt (local snapshot) - use current time as placeholder
                    const createdAt = data.createdAt || Timestamp.now();

                    notifs.push({
                        id: docSnap.id,
                        userId: data.userId,
                        actorId: data.actorId,
                        type: data.type,
                        message: data.message,
                        amount: data.amount,
                        currency: data.currency,
                        debtId: data.debtId,
                        isRead: data.isRead,
                        isShown: data.isShown,
                        createdAt: createdAt as Timestamp
                    } as Notification);
                });

                // Sort in memory: newest first
                notifs.sort((a, b) => {
                    const timeA = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : Date.now();
                    const timeB = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : Date.now();
                    return timeB - timeA;
                });

                setNotifications(notifs);
                setLoading(false);
            }, (error) => {
                console.error('Failed to subscribe to notifications (Firestore Error):', error);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err) {
            console.error('Failed to initialize notification subscription:', err);
            setLoading(false);
        }
    }, [user?.uid]); // Only re-run if UID changes

    // Methods are now handled via Service/Context, these are for backward compat if any
    const markAsRead = () => {};
    const deleteNotification = () => {};
    const markAllAsRead = () => {};
    const clearAllNotifications = () => {};

    return {
        notifications,
        loading,
        markAsRead,
        deleteNotification,
        markAllAsRead,
        clearAllNotifications
    };
};
