import React, { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { notificationService, type Notification } from '../services/notificationService';
import { NotificationToast } from '../components/NotificationToast';
import { NotificationsModal } from '../components/NotificationsModal';
import { NotificationContext } from '../hooks/useNotificationContext';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { notifications } = useNotifications();
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [activeToast, setActiveToast] = useState<Notification | null>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Toast logic: Show toast for new, unshown notifications
    useEffect(() => {
        if (notifications.length > 0) {
            console.log(`[NotificationContext] received ${notifications.length} notifications`);
            // Get already toasted IDs from current session to prevent double toast
            const toastedIds = JSON.parse(sessionStorage.getItem('toasted_notif_ids') || '[]');

            // Find unread and unshown notifications that haven't been toasted in this session
            const unshown = notifications.filter(n => !n.isShown && !n.isRead && !toastedIds.includes(n.id));
            if (unshown.length > 0) {
                console.log(`[NotificationContext] ${unshown.length} unshown notifications found. Newest:`, unshown[0]);
                
                // Show the most recent one
                const newest = unshown[0];

                if (!activeToast || (newest && activeToast.id !== newest.id)) {
                    // Start of safe side effects inside useEffect.
                    setActiveToast(newest);

                    // Mark as toasted in session
                    sessionStorage.setItem('toasted_notif_ids', JSON.stringify([...toastedIds, newest.id]));

                    // Mark as shown in DB
                    notificationService.markAsShown(newest.id).catch(err => {
                        console.error("Failed to mark notification as shown:", err);
                    });
                }
            }
        }
    }, [notifications, activeToast]);

    const markAsRead = async (id: string) => {
        await notificationService.markAsRead(id);
    };

    const markAllAsRead = async () => {
        if (user) {
            await notificationService.markAllAsRead(user.uid);
        }
    };

    const deleteNotification = async (id: string) => {
        await notificationService.deleteNotification(id);
    };

    const clearAll = async () => {
        if (user) {
            await notificationService.clearAll(user.uid);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            showModal,
            setShowModal,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAll
        }}>
            {children}
            <NotificationToast
                notification={activeToast}
                onClose={() => setActiveToast(null)}
            />
            <NotificationsModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onMarkAllAsRead={markAllAsRead}
                onClearAll={clearAll}
            />
        </NotificationContext.Provider>
    );
};
