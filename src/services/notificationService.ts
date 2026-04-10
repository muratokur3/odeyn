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
    serverTimestamp,
    deleteDoc
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
        // Validation: Must have recipient and sender, and they must be different
        if (!params.userId || !params.actorId) {
            console.warn("Skipping notification: Missing recipient or sender ID", params);
            return;
        }

        if (params.userId === params.actorId) {
            // Silently skip self-notifications (not an error but common scenario)
            return;
        }

        try {
            const notificationsRef = collection(db, 'notifications');

            // De-duplication: Check for recent identical notification (within 30 seconds)
            if (params.debtId) {
                const thirtySecondsAgo = Timestamp.fromMillis(Date.now() - 30_000);
                const dupeQuery = query(
                    notificationsRef,
                    where('userId', '==', params.userId),
                    where('type', '==', params.type),
                    where('debtId', '==', params.debtId),
                    where('createdAt', '>', thirtySecondsAgo)
                );
                const dupeSnap = await getDocs(dupeQuery);
                if (!dupeSnap.empty) {
                    console.log(`[NotificationService] Duplicate notification skipped for ${params.userId}`);
                    return true;
                }
            }

            const data = {
                userId: params.userId,
                actorId: params.actorId,
                type: params.type,
                message: params.message,
                amount: params.amount ?? null,
                currency: params.currency ?? null,
                debtId: params.debtId ?? null,
                isRead: false,
                isShown: false,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(notificationsRef, data);
            console.log(`[NotificationService] Notification added: ${docRef.id}`);
            return true;
        } catch (error) {
            console.error('[NotificationService] Failed to add notification to Firestore:', error);
            return false;
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
            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.forEach(docSnap => {
                batch.update(docSnap.ref, { isRead: true });
            });
            await batch.commit();
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    },

    async clearAll(userId: string) {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    },

    async deleteNotification(notificationId: string) {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await deleteDoc(notifRef);
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    }
};
