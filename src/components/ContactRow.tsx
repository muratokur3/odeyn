import React from 'react';
import { Avatar } from './Avatar';
import { formatCurrency } from '../utils/format';
import clsx from 'clsx';

interface ContactRowProps {
    name: string;
    lastActivityDate?: Date;
    lastActionSnippet: string;
    netBalance: number; // Positive = Receivable, Negative = Payable
    currency: string;
    onClick: () => void;
    status?: 'none' | 'system' | 'contact';
    photoURL?: string;
}

export const ContactRow: React.FC<ContactRowProps> = ({
    name,
    lastActionSnippet,
    netBalance,
    currency,
    onClick,
    status = 'none',
    photoURL
}) => {
    const isReceivable = netBalance > 0;
    const isPayable = netBalance < 0;
    const isSettled = netBalance === 0;

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-[0.99] transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-750"
        >
            {/* Left: Avatar */}
            <Avatar
                name={name}
                size="md"
                className="shadow-sm bg-gray-100 dark:bg-slate-700"
                status={status}
                photoURL={photoURL}
            />

            {/* Center: Identity & Context */}
            <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 dark:text-white truncate leading-tight">
                    {name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {lastActionSnippet}
                </p>
            </div>

            {/* Right: The Bottom Line */}
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
        </div>
    );
};
