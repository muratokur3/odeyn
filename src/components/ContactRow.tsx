import React, { useCallback } from 'react';
import { UserAvatarItem } from './UserAvatarItem';
import { formatCurrency } from '../utils/format';
import clsx from 'clsx';
import type { DisplayProfile } from '../types';

interface ContactRowProps {
    id: string; // Added id for memoization
    name: string;
    lastActivityDate?: Date;
    lastActionSnippet: string;
    netBalance: number; // Positive = Receivable, Negative = Payable
    currency: string;
    onClick: (id: string, contact: { name: string, linkedUserId?: string }) => void;
    status?: 'none' | 'system' | 'contact';
    photoURL?: string;
    linkedUserId?: string;
}

export const ContactRow: React.FC<ContactRowProps> = React.memo(({
    id,
    name,
    lastActionSnippet,
    netBalance,
    currency,
    onClick,
    status = 'none',
    photoURL,
    linkedUserId
}) => {
    const isReceivable = netBalance > 0;
    const isPayable = netBalance < 0;
    const isSettled = netBalance === 0;

    const getInitials = (n: string) => n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

    const profile: DisplayProfile = {
        displayName: name,
        secondaryText: lastActionSnippet,
        photoURL: photoURL,
        initials: getInitials(name),
        isSystemUser: status === 'system',
        isContact: status === 'contact',
        phoneNumber: '', // Not visually used here
        uid: linkedUserId
    };

    const handleClick = useCallback(() => {
        onClick(id, { name, linkedUserId });
    }, [id, name, linkedUserId, onClick]);

    const BalanceInfo = React.useMemo(() => (
        <div className="flex flex-col items-end">
            <span className={clsx(
                "text-lg font-bold tracking-tight",
                isReceivable && "text-emerald-600 dark:text-emerald-400",
                isPayable && "text-rose-600 dark:text-rose-400",
                isSettled && "text-gray-400"
            )}>
                {formatCurrency(Math.abs(netBalance), currency)}
            </span>

            <span className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded-full mt-1",
                isReceivable && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
                isPayable && "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
                isSettled && "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400"
            )}>
                {isReceivable ? "Alacaklısın" : isPayable ? "Borçlusun" : "Ödeşildi"}
            </span>
        </div>
    ), [netBalance, currency, isReceivable, isPayable, isSettled]);

    return (
        <UserAvatarItem
            profile={profile}
            onClick={handleClick}
            actionButton={BalanceInfo}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-[0.99] hover:bg-gray-50 dark:hover:bg-slate-750"
        />
    );
});

ContactRow.displayName = 'ContactRow';
