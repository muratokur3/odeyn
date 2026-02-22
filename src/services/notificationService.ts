import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    writeBatch,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType =
    | 'DEBT_CREATED'
    | 'PAYMENT_MADE'
    | 'DEBT_REJECTED'
    | 'DEBT_EDITED'
    | 'DUE_SOON'
    | 'INSTALLMENT_DUE';

export interface Notification {
    id: string;
    userId: string;      // The recipient
    actorId: string;     // The one who performed the action
    type: NotificationType;
    message: string;
    amount?: number;
    currency?: string;
    debtId?: string;
    isRead: boolean;
    isShown: boolean;    // Whether the toast was shown
    createdAt: Timestamp;
}

export const notificationService = {
    async addNotification(params: {
        userId: string;
        actorId: string;
        type: NotificationType;
        message: string;
        amount?: number;
        currency?: string;
        debtId?: string;
    }) {
        if (!params.userId || params.userId === params.actorId) return;

        try {
            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                ...params,
                isRead: false,
                isShown: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to add notification:', error);
        }
    },

    async markAsRead(notificationId: string) {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, { isRead: true });
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },

    async markAsShown(notificationId: string) {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, { isShown: true });
        } catch (error) {
            console.error('Failed to mark notification as shown:', error);
        }
    },

    async markAllAsRead(userId: string) {
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                where('isRead', '==', false)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
                batch.update(doc.ref, { isRead: true });
            });
            await batch.commit();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    },

    async clearAll(userId: string) {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    },

    async deleteNotification(notificationId: string) {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            // We'll do a hard delete as requested for clear data
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(notifRef);
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    }
};
