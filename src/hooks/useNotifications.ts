import { useMemo } from 'react';
import { useDebts } from './useDebts';
import { useAuth } from './useAuth';
import { differenceInDays } from 'date-fns';

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

export const useNotifications = () => {
    const { allDebts: debts } = useDebts();
    const { user } = useAuth();

    const notifications = useMemo(() => {
        if (!user || !debts) return [];
        const notifs: Notification[] = [];
        const now = new Date();

        debts.forEach(debt => {
            const isBorrower = debt.borrowerId === user.uid;


            // 2. Due Date Approaching (for whole debt)
            if (isBorrower && debt.status === 'ACTIVE' && debt.dueDate) {
                const dueDate = debt.dueDate.toDate();
                const diff = differenceInDays(dueDate, now);

                if (diff >= 0 && diff <= 3) {
                    notifs.push({
                        id: `due-${debt.id}`,
                        type: 'DUE_SOON',
                        message: `${debt.lenderName} kişisine olan borcunuzun vadesi yaklaşıyor (${diff === 0 ? 'Bugün' : diff + ' gün kaldı'}).`,
                        date: dueDate,
                        debtId: debt.id,
                        read: false
                    });
                } else if (diff < 0) {
                    notifs.push({
                        id: `overdue-${debt.id}`,
                        type: 'DUE_SOON',
                        message: `${debt.lenderName} kişisine olan borcunuzun vadesi geçti!`,
                        date: dueDate,
                        debtId: debt.id,
                        read: false
                    });
                }
            }

            // 3. Installments Due
            if (isBorrower && debt.installments) {
                debt.installments.forEach(inst => {
                    if (!inst.isPaid) {
                        const dueDate = inst.dueDate.toDate();
                        const diff = differenceInDays(dueDate, now);

                        if (diff >= 0 && diff <= 3) {
                            notifs.push({
                                id: `inst-${inst.id}`,
                                type: 'INSTALLMENT_DUE',
                                message: `${debt.lenderName} kişisine olan taksit ödemeniz yaklaşıyor (${diff === 0 ? 'Bugün' : diff + ' gün kaldı'}).`,
                                date: dueDate,
                                debtId: debt.id,
                                read: false
                            });
                        } else if (diff < 0) {
                            notifs.push({
                                id: `inst-overdue-${inst.id}`,
                                type: 'INSTALLMENT_DUE',
                                message: `${debt.lenderName} kişisine olan taksit ödemeniz gecikti!`,
                                date: dueDate,
                                debtId: debt.id,
                                read: false
                            });
                        }
                    }
                });
            }
        });

        // Sort by date desc
        return notifs.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [debts, user]);

    return { notifications };
};
