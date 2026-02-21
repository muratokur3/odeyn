import { useMemo, useState, useEffect } from 'react';
import { useDebts } from './useDebts';
import { useAuth } from './useAuth';
import { differenceInDays } from 'date-fns';
import { collection, setDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface Notification {
    id: string;
    type: 'DUE_SOON' | 'INSTALLMENT_DUE' | 'DEBT_CREATED' | 'PAYMENT_MADE' | 'DEBT_REJECTED' | 'DEBT_EDITED';
    message: string;
    date: Date;
    debtId: string;
    read: boolean;
    actorId?: string;  // Who triggered this notification
    amount?: number;   // For payment notifications
}

interface NotificationReadState {
    [key: string]: boolean;
}

interface DeletedNotifications {
    [key: string]: boolean;
}

export const useNotifications = () => {
    const { allDebts: debts } = useDebts();
    const { user } = useAuth();
    const [readNotifications, setReadNotifications] = useState<NotificationReadState>({});
    const [deletedNotifications, setDeletedNotifications] = useState<DeletedNotifications>({});

    // Real-time listener for notification read/deleted status
    useEffect(() => {
        if (!user) return;
        const notificationsRef = collection(db, 'users', user.uid, 'notificationReadStatus');
        const unsubscribe = onSnapshot(notificationsRef, (snapshot) => {
            const readMap: NotificationReadState = {};
            const deletedMap: DeletedNotifications = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                readMap[id] = data.isRead || false;
                if (data.isDeleted === true) {
                    deletedMap[id] = true;
                }
            });
            setReadNotifications(readMap);
            setDeletedNotifications(deletedMap);
        }, (error) => {
            console.error('Failed to listen notification read status:', error);
        });
        return () => unsubscribe();
    }, [user]);

    const notifications = useMemo(() => {
        if (!user || !debts) return [];
        const notifs: Notification[] = [];
        const now = new Date();
        const nowTime = now.getTime();

        debts.forEach(debt => {
            const isBorrower = debt.borrowerId === user.uid;
            const isLender = debt.lenderId === user.uid;

            // 1. NEW DEBT CREATED - Show for 24 hours after creation
            if ((isBorrower || isLender) && debt.createdAt) {
                const debtCreatedTime = debt.createdAt.toDate().getTime();
                const hoursSinceCreation = (nowTime - debtCreatedTime) / (60 * 60 * 1000);

                // Show notification if debt created in last 24 hours
                if (hoursSinceCreation >= 0 && hoursSinceCreation < 24) {
                    const notifId = `created-${debt.id}`;

                    if (isLender) {
                        notifs.push({
                            id: notifId,
                            type: 'DEBT_CREATED',
                            message: `${debt.borrowerName} ile ${debt.originalAmount} ${debt.currency} borç kaydedildi.`,
                            date: debt.createdAt.toDate(),
                            debtId: debt.id,
                            read: readNotifications[notifId] || false,
                            actorId: debt.createdBy,
                            amount: debt.originalAmount
                        });
                    } else if (isBorrower) {
                        notifs.push({
                            id: notifId,
                            type: 'DEBT_CREATED',
                            message: `${debt.lenderName} tarafından ${debt.originalAmount} ${debt.currency} borç kaydı oluşturuldu.`,
                            date: debt.createdAt.toDate(),
                            debtId: debt.id,
                            read: readNotifications[notifId] || false,
                            actorId: debt.createdBy,
                            amount: debt.originalAmount
                        });
                    }
                }
            }

            // 2. Due Date Approaching (for whole debt)
            if (isBorrower && debt.status === 'ACTIVE' && debt.dueDate) {
                const dueDate = debt.dueDate.toDate();
                const diff = differenceInDays(dueDate, now);
                const isOverdue = diff < 0;
                const notifId = `due-${debt.id}`; // Unified ID for both due and overdue

                if (diff >= 0 && diff <= 3) {
                    notifs.push({
                        id: notifId,
                        type: 'DUE_SOON',
                        message: `${debt.lenderName} kişisine olan borcunuzun vadesi yaklaşıyor (${diff === 0 ? 'Bugün' : diff + ' gün kaldı'}).`,
                        date: dueDate,
                        debtId: debt.id,
                        read: readNotifications[notifId] || false
                    });
                } else if (isOverdue) {
                    notifs.push({
                        id: notifId,
                        type: 'DUE_SOON',
                        message: `${debt.lenderName} kişisine olan borcunuzun vadesi geçti!`,
                        date: dueDate,
                        debtId: debt.id,
                        read: readNotifications[notifId] || false
                    });
                }
            }

            // 3. Installments Due
            if (isBorrower && debt.installments) {
                debt.installments.forEach(inst => {
                    if (!inst.isPaid) {
                        const dueDate = inst.dueDate.toDate();
                        const diff = differenceInDays(dueDate, now);
                        const isOverdue = diff < 0;
                        const notifId = `inst-${inst.id}`; // Unified ID for installments

                        if (diff >= 0 && diff <= 3) {
                            notifs.push({
                                id: notifId,
                                type: 'INSTALLMENT_DUE',
                                message: `${debt.lenderName} kişisine olan taksit ödemeniz yaklaşıyor (${diff === 0 ? 'Bugün' : diff + ' gün kaldı'}).`,
                                date: dueDate,
                                debtId: debt.id,
                                read: readNotifications[notifId] || false
                            });
                        } else if (isOverdue) {
                            notifs.push({
                                id: notifId,
                                type: 'INSTALLMENT_DUE',
                                message: `${debt.lenderName} kişisine olan taksit ödemeniz gecikti!`,
                                date: dueDate,
                                debtId: debt.id,
                                read: readNotifications[notifId] || false
                            });
                        }
                    }
                });
            }
        });

        // Sort by date desc (newest first)
        const filtered = notifs.filter(n => {
            // Never show if explicitly deleted
            const isDeleted = deletedNotifications[n.id] === true;
            if (isDeleted) return false;
            return true;
        });

        return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [debts, user, readNotifications, deletedNotifications]);

    const markAsRead = (notificationId: string) => {
        if (!user) return;

        // Optimistic update - immediate UI change
        setReadNotifications(prev => ({
            ...prev,
            [notificationId]: true
        }));

        // Background save to Firestore (no need to await)
        try {
            const notifRef = doc(db, 'users', user.uid, 'notificationReadStatus', notificationId);
            setDoc(notifRef, { isRead: true, markedAt: new Date() }, { merge: true }).catch(error => {
                console.error('Failed to mark notification as read in Firestore:', error);
                // Revert on error
                setReadNotifications(prev => ({
                    ...prev,
                    [notificationId]: false
                }));
            });
        } catch (error) {
            console.error('Failed to prepare notification read:', error);
        }
    };

    const deleteNotification = (notificationId: string) => {
        // Optimistic delete
        setDeletedNotifications(prev => ({
            ...prev,
            [notificationId]: true
        }));

        // Mark as permanently deleted in Firestore
        try {
            if (!user) return;
            const notifRef = doc(db, 'users', user.uid, 'notificationReadStatus', notificationId);
            // Only update with isDeleted flag, keeping isRead if it exists
            setDoc(notifRef, {
                isDeleted: true,
                deletedAt: new Date(),
                isRead: true  // Also mark as read when deleted
            }, { merge: true }).catch(error => {
                console.error('Failed to delete notification in Firestore:', error);
                // Revert on error
                setDeletedNotifications(prev => ({
                    ...prev,
                    [notificationId]: false
                }));
            });
        } catch (error) {
            console.error('Failed to prepare notification delete:', error);
        }
    };

    const clearAllNotifications = () => {
        // Mark all current notifications as deleted
        notifications.forEach(notif => {
            deleteNotification(notif.id);
        });
    };

    return { notifications, markAsRead, deleteNotification, clearAllNotifications };
};
