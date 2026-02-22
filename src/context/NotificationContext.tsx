import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { notificationService, type Notification } from '../services/notificationService';
import { NotificationToast } from '../components/NotificationToast';
import { NotificationsModal } from '../components/NotificationsModal';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { notifications } = useNotifications();
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [activeToast, setActiveToast] = useState<Notification | null>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Toast logic: Show toast for new, unshown notifications
    useEffect(() => {
        if (notifications.length > 0) {
            // Find the first unread and unshown notification
            const unshown = notifications.find(n => !n.isShown && !n.isRead);
            if (unshown && (!activeToast || activeToast.id !== unshown.id)) {
                setActiveToast(unshown);
                // Mark as shown in DB after a short delay to allow toast to appear
                notificationService.markAsShown(unshown.id);
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

export const useNotificationContext = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
};
