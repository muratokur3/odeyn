import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
    collection,
    query,
    where,
    orderBy,
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
        if (!user) {
            const timer = setTimeout(() => {
                setNotifications([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        // Real-time listener for user's notifications
        const notificationsRef = collection(db, 'notifications');
        // Note: Removed orderBy to avoid index requirement, sorting in memory
        const q = query(
            notificationsRef,
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs: Notification[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    notifs.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt as Timestamp
                    } as Notification);
                }
            });

            // Sort in memory: newest first
            notifs.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });

            setNotifications(notifs);
            setLoading(false);
        }, (error) => {
            console.error('Failed to fetch notifications:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Backward compatibility for methods - these are mostly handled via Service/Context now
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
