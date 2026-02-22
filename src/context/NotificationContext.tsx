import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications, type Notification } from '../hooks/useNotifications';
import { type ToastNotification } from '../components/NotificationToast';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    isModalOpen: boolean;
    currentToast: ToastNotification | null;
    openModal: () => void;
    closeModal: () => void;
    markAsRead: (id: string) => void;
    deleteNotification: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    closeToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const titles: Record<string, string> = {
    'DEBT_CREATED': 'Yeni Borç Kaydı',
    'PAYMENT_MADE': 'Ödeme Alındı',
    'DEBT_REJECTED': 'İşlem Reddedildi',
    'DEBT_EDITED': 'Kayıt Güncellendi',
    'DUE_SOON': 'Ödeme Hatırlatması',
    'INSTALLMENT_DUE': 'Taksit Hatırlatması'
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        notifications,
        markAsRead: hookMarkAsRead,
        deleteNotification: hookDeleteNotification,
        markAllAsRead: hookMarkAllAsRead,
        clearAllNotifications
    } = useNotifications();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null);
    const toastTimerRef = useRef<any>(null);

    // Auto-dismiss toast
    useEffect(() => {
        if (currentToast) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
                setCurrentToast(null);
            }, currentToast.duration || 5000);
        }
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, [currentToast]);

    // Persistent tracking of toasted IDs to avoid repeats
    const [toastedIds, setToastedIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('toasted_notif_ids');
        try {
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    // Monitor for new unread notifications to show toast
    useEffect(() => {
        if (notifications.length === 0) return;

        const unread = notifications.filter(n => !n.read);
        const newlyUnread = unread.filter(n => !toastedIds.has(n.id));

        if (newlyUnread.length > 0) {
            const newest = newlyUnread[0];

            // Only toast if it's very recent (last 5 minutes)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            const isRecent = newest.date.getTime() > fiveMinutesAgo;

            if (isRecent) {
                setCurrentToast({
                    id: newest.id,
                    title: titles[newest.type] || 'Bildirim',
                    message: newest.message,
                    type: newest.type === 'DEBT_REJECTED' ? 'error' :
                          newest.type === 'DUE_SOON' || newest.type === 'INSTALLMENT_DUE' ? 'warning' : 'info',
                    duration: 5000
                });
            }

            // Update toastedIds state and localStorage
            const nextSet = new Set(toastedIds);
            newlyUnread.forEach(n => nextSet.add(n.id));

            // Keep last 100
            const nextList = Array.from(nextSet).slice(-100);
            setToastedIds(new Set(nextList));
            localStorage.setItem('toasted_notif_ids', JSON.stringify(nextList));
        }
    }, [notifications, toastedIds]);

    const openModal = useCallback(() => setIsModalOpen(true), []);
    const closeModal = useCallback(() => setIsModalOpen(false), []);
    const closeToast = useCallback(() => setCurrentToast(null), []);

    const markAsRead = useCallback((id: string) => {
        hookMarkAsRead(id);
    }, [hookMarkAsRead]);

    const deleteNotification = useCallback((id: string) => {
        hookDeleteNotification(id);
    }, [hookDeleteNotification]);

    const markAllAsRead = useCallback(() => {
        hookMarkAllAsRead();
    }, [hookMarkAllAsRead]);

    const clearAll = useCallback(() => {
        clearAllNotifications();
    }, [clearAllNotifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            isModalOpen,
            currentToast,
            openModal,
            closeModal,
            markAsRead,
            deleteNotification,
            markAllAsRead,
            clearAll,
            closeToast
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotificationContext = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
};
