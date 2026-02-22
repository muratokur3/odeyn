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

import { useUserIdentifiers } from './useUserIdentifiers';

export const useNotifications = () => {
    const { allDebts: debts } = useDebts();
    const { user } = useAuth();
    const { isMe } = useUserIdentifiers();
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
            const isBorrower = isMe(debt.borrowerId);
            const isLender = isMe(debt.lenderId);


            // 1. NEW DEBT CREATED
            if ((isBorrower || isLender) && debt.createdAt && !isMe(debt.createdBy)) {
                const debtCreatedTime = debt.createdAt.toDate().getTime();
                const hoursSinceCreation = (nowTime - debtCreatedTime) / (60 * 60 * 1000);
                const notifId = `created-${debt.id}`;
                const isRead = readNotifications[notifId] === true;

                // Show if unread OR if created in last 24 hours
                if (!isRead || (hoursSinceCreation >= 0 && hoursSinceCreation < 24)) {
                    const isLedger = debt.type === 'LEDGER';
                    if (isLender) {
                        notifs.push({
                            id: notifId,
                            type: 'DEBT_CREATED',
                            message: isLedger
                                ? `${debt.borrowerName} ile cari hesap oluşturuldu.`
                                : `${debt.borrowerName} ile ${debt.originalAmount} ${debt.currency} borç kaydedildi.`,
                            date: debt.createdAt.toDate(),
                            debtId: debt.id,
                            read: isRead,
                            actorId: debt.createdBy,
                            amount: isLedger ? undefined : debt.originalAmount
                        });
                    } else if (isBorrower) {
                        notifs.push({
                            id: notifId,
                            type: 'DEBT_CREATED',
                            message: isLedger
                                ? `${debt.lenderName} sizinle cari hesap oluşturdu.`
                                : `${debt.lenderName} tarafından ${debt.originalAmount} ${debt.currency} borç kaydı oluşturuldu.`,
                            date: debt.createdAt.toDate(),
                            debtId: debt.id,
                            read: isRead,
                            actorId: debt.createdBy,
                            amount: isLedger ? undefined : debt.originalAmount
                        });
                    }
                }
            }

            // 2. EXTERNAL UPDATES (Payments, Edits, Rejections)
            if (debt.updatedAt && debt.auditMeta && !isMe(debt.auditMeta.actorId)) {
                // Round update time to nearest second for stability
                const updateTime = Math.floor(debt.updatedAt.toDate().getTime() / 1000) * 1000;
                const creationTime = debt.createdAt ? debt.createdAt.toDate().getTime() : 0;

                // Only show if updatedAt is NEWER than createdAt (avoid double notif on creation)
                if (updateTime > creationTime + 2000) {
                    const hoursSinceUpdate = (nowTime - updateTime) / (60 * 60 * 1000);
                    // Use a sturdy ID that changes ONLY when updatedAt changes
                    const notifId = `update-${debt.id}-${updateTime}`;
                    const isRead = readNotifications[notifId] === true;

                    if (!isRead || (hoursSinceUpdate >= 0 && hoursSinceUpdate < 24)) {
                        let type: Notification['type'] = 'DEBT_EDITED';
                        let message = '';
                        const otherPartyName = isLender ? debt.borrowerName : debt.lenderName;

                        if (debt.type === 'LEDGER') {
                            const amt = debt.lastTransactionAmount;
                            const curr = debt.currency || 'TRY';
                            message = amt
                                ? `${otherPartyName} cari hesaba ${amt} ${curr} işlem ekledi.`
                                : `${otherPartyName} cari hesaba işlem ekledi.`;
                            type = 'PAYMENT_MADE';
                        } else if (debt.status === 'REJECTED' || debt.status === 'REJECTED_BY_RECEIVER' || debt.status === 'DISPUTED') {
                            type = 'DEBT_REJECTED';
                            message = `${otherPartyName} borç kaydını reddetti.`;
                        } else if (debt.status === 'PAID' || (debt.remainingAmount < debt.originalAmount)) {
                            type = 'PAYMENT_MADE';
                            message = `${otherPartyName} ödeme yaptı.`;
                        } else {
                            message = `${otherPartyName} kaydı güncelledi.`;
                        }

                        notifs.push({
                            id: notifId,
                            type: type,
                            message: message,
                            date: debt.updatedAt.toDate(),
                            debtId: debt.id,
                            read: isRead,
                            actorId: debt.auditMeta.actorId
                        });
                    }
                }
            }

            // 3. Due Date Approaching
            if (isBorrower && debt.status === 'ACTIVE' && debt.dueDate) {
                const dueDate = debt.dueDate.toDate();
                const diff = differenceInDays(dueDate, now);
                const isOverdue = diff < 0;
                const notifId = `due-${debt.id}`; // Unified ID

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

            // 4. Installments Due
            if (isBorrower && debt.installments) {
                debt.installments.forEach(inst => {
                    if (!inst.isPaid) {
                        const dueDate = inst.dueDate.toDate();
                        const diff = differenceInDays(dueDate, now);
                        const isOverdue = diff < 0;
                        const notifId = `inst-${inst.id}`;

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
    }, [debts, user, readNotifications, deletedNotifications, isMe]);

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

    const markAllAsRead = () => {
        // Mark all current unread notifications as read
        notifications.forEach(notif => {
            if (!notif.read) {
                markAsRead(notif.id);
            }
        });
    };

    const clearAllNotifications = () => {
        // Mark all current notifications as deleted
        notifications.forEach(notif => {
            deleteNotification(notif.id);
        });
    };

    return { notifications, markAsRead, deleteNotification, markAllAsRead, clearAllNotifications };
};
