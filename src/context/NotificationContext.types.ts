import type { Notification } from '../services/notificationService';

export interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}
