import { respondToDebtRequest } from '../services/db';
import type { Debt } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownLeft, Check, CheckCheck, Clock, X } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { formatPhoneNumber } from '../utils/phone';
import { Avatar } from './Avatar';
import clsx from 'clsx';

interface DebtCardProps {
    debt: Debt;
    currentUserId: string;
    onClick: () => void;
    otherPartyStatus?: 'none' | 'system' | 'contact';
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, currentUserId, onClick, otherPartyStatus = 'none' }) => {
    const isLender = debt.lenderId === currentUserId;
    let otherPartyName = isLender ? debt.borrowerName : debt.lenderName;

    // If name looks like a raw phone number (digits only or >10 digits), format it
    if (otherPartyName.replace(/\D/g, '').length >= 10 && !otherPartyName.includes(' ')) {
        otherPartyName = formatPhoneNumber(otherPartyName);
    }

    const isPaid = debt.status === 'PAID';
    const isPending = debt.status === 'PENDING';
    const isRejected = debt.status === 'REJECTED';

    // Installment Info
    const totalInstallments = debt.installments?.length || 0;
    const paidInstallments = debt.installments?.filter(i => i.isPaid).length || 0;
    const hasInstallments = totalInstallments > 0;

    const handleResponse = async (e: React.MouseEvent, status: 'ACTIVE' | 'REJECTED') => {
        e.stopPropagation();
        try {
            await respondToDebtRequest(debt.id, status, currentUserId);
        } catch (error) {
            console.error(error);
            alert("İşlem sırasında bir hata oluştu.");
        }
    };

    return (
        <div
            onClick={onClick}
            className={clsx(
                "bg-surface p-4 rounded-2xl shadow-sm border border-border active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group",
                isPaid && "opacity-70 grayscale-[0.5]"
            )}
        >
            {/* Background Status Indicator (Subtle) */}
            <div className={clsx(
                "absolute left-0 top-0 bottom-0 w-1",
                isLender ? "bg-green-500" : "bg-red-500"
            )} />

            <div className="flex items-center gap-4 pl-2">
                {/* Avatar */}
                <div onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to person detail
                    // We need to know the ID of the other person.
                    // If isLender, other is borrowerId. If borrower, other is lenderId.
                    const otherId = isLender ? debt.borrowerId : debt.lenderId;
                    window.location.href = `/person/${otherId}`; // Using href for simplicity or need to pass navigate prop
                }}>
                    <Avatar
                        name={otherPartyName}
                        size="md"
                        className="shadow-sm border border-white dark:border-slate-700 hover:scale-105 transition-transform"
                        status={otherPartyStatus}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const otherId = isLender ? debt.borrowerId : debt.lenderId;
                                    window.location.href = `/person/${otherId}`;
                                }}
                                className="font-semibold text-text-primary truncate pr-2 text-base hover:underline decoration-slate-300 underline-offset-2"
                            >
                                {otherPartyName}
                            </h3>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                    <span className="opacity-70">Kayıt:</span>
                                    <span>{debt.createdAt ? format(debt.createdAt.toDate(), 'd MMM yyyy', { locale: tr }) : '-'}</span>
                                </div>
                                {debt.dueDate && (
                                    <div className={clsx(
                                        "flex items-center gap-1.5 text-xs font-medium",
                                        debt.dueDate.toDate() < new Date() && debt.status !== 'PAID' ? "text-red-500" : "text-blue-600"
                                    )}>
                                        <span>Vade:</span>
                                        <span>{format(debt.dueDate.toDate(), 'd MMM yyyy', { locale: tr })}</span>
                                    </div>
                                )}
                                <div className="text-[10px] text-text-secondary mt-0.5 opacity-70">
                                    Ekleyen: {debt.createdBy === currentUserId ? 'Siz' : otherPartyName}
                                </div>
                            </div>
                        </div>

                        {/* Amount & Status */}
                        <div className="text-right">
                            <div className={clsx(
                                "font-bold text-lg tracking-tight flex items-center justify-end gap-1",
                                isLender ? "text-green-600" : "text-red-600"
                            )}>
                                {isLender ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                {formatCurrency(debt.remainingAmount, debt.currency)}
                            </div>
                            {debt.originalAmount !== debt.remainingAmount && (
                                <div className="text-[10px] text-text-secondary opacity-70 mt-0.5 font-medium">
                                    Ana: {formatCurrency(debt.originalAmount, debt.currency)}
                                </div>
                            )}

                            {/* Status Icons (WhatsApp Style) */}
                            <div className="flex justify-end mt-1">
                                {isPending ? (
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <Clock size={14} />
                                        <span>Bekliyor</span>
                                    </div>
                                ) : isRejected ? (
                                    <div className="flex items-center gap-1 text-xs text-red-500">
                                        <X size={14} />
                                        <span>Red</span>
                                    </div>
                                ) : isPaid ? (
                                    <div className="flex items-center gap-0.5 text-green-500">
                                        <CheckCheck size={16} />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-0.5 text-blue-500">
                                        <CheckCheck size={16} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer / Details */}
                    <div className="mt-3 flex items-center justify-between">
                        {/* Installment Progress */}
                        {hasInstallments ? (
                            <div className="flex items-center gap-2 text-xs text-text-secondary bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                <div className="flex gap-0.5">
                                    {Array.from({ length: Math.min(totalInstallments, 5) }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={clsx(
                                                "w-1.5 h-1.5 rounded-full",
                                                i < paidInstallments ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                                            )}
                                        />
                                    ))}
                                    {totalInstallments > 5 && <span className="text-[10px] leading-none ml-0.5 text-slate-400">+</span>}
                                </div>
                                <span className="font-medium">{paidInstallments}/{totalInstallments} Taksit</span>
                            </div>
                        ) : (
                            <div /> // Spacer
                        )}

                        {/* Approval Actions (Only if Pending & Not Created By Current User) */}
                        {isPending && debt.createdBy !== currentUserId && (
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => handleResponse(e, 'REJECTED')}
                                    className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                                <button
                                    onClick={(e) => handleResponse(e, 'ACTIVE')}
                                    className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
