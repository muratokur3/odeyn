import { respondToDebtRequest } from '../services/db';
import type { Debt } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CheckCheck, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
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

    if (otherPartyName.replace(/\D/g, '').length >= 10 && !otherPartyName.includes(' ')) {
        otherPartyName = formatPhoneNumber(otherPartyName);
    }

    const isPaid = debt.status === 'PAID';
    const isPending = debt.status === 'PENDING';


    const totalInstallments = debt.installments?.length || 0;
    const paidInstallments = debt.installments?.filter(i => i.isPaid).length || 0;
    const hasInstallments = totalInstallments > 0;

    const handleResponse = async (e: React.MouseEvent, status: 'ACTIVE' | 'REJECTED') => {
        e.stopPropagation();
        try {
            await respondToDebtRequest(debt.id, status, currentUserId);
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    // Kartın Rengi: Alacaksa Yeşilimsi, Borçsa Kırmızımsı
    const cardBgColor = isPaid
        ? "bg-gray-50 border-gray-200 opacity-70"
        : isLender
            ? "bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800"
            : "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800";

    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 rounded-2xl border active:scale-[0.98] transition-all cursor-pointer relative",
                cardBgColor
            )}
        >
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar
                    name={otherPartyName}
                    size="md"
                    className="shadow-sm bg-white"
                    status={otherPartyStatus}
                />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                            {otherPartyName}
                        </h3>
                        {/* Tutar - KOCAMAN */}
                        <div className={clsx(
                            "text-lg font-bold tracking-tight",
                            isPaid ? "text-gray-400 line-through" : (isLender ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")
                        )}>
                            {formatCurrency(debt.remainingAmount, debt.currency)}
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                            {/* İnsan Diliyle Açıklama */}
                            <p className={clsx("text-sm font-medium", isLender ? "text-green-600" : "text-red-600")}>
                                {isPaid ? "Hesap Kapandı" : (isLender ? "Alacaklısın" : "Borçlusun")}
                            </p>

                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{debt.createdAt ? format(debt.createdAt.toDate(), 'd MMM', { locale: tr }) : '-'}</span>
                                {hasInstallments && (
                                    <span className="bg-white px-2 py-0.5 rounded-md border text-gray-600 font-medium shadow-sm">
                                        {paidInstallments}/{totalInstallments} Taksit
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Durum İkonları */}
                        <div>
                            {isPending ? (
                                <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-bold">
                                    <Clock size={14} />
                                    <span>Onay Bekliyor</span>
                                </div>
                            ) : isPaid ? (
                                <div className="text-green-500">
                                    <CheckCheck size={20} />
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Pending Actions */}
                    {isPending && debt.createdBy !== currentUserId && (
                        <div className="mt-3 flex gap-2 pt-3 border-t border-black/5">
                            <button
                                onClick={(e) => handleResponse(e, 'REJECTED')}
                                className="flex-1 py-2 rounded-xl bg-white border border-red-200 text-red-600 font-medium text-sm shadow-sm"
                            >
                                Reddet
                            </button>
                            <button
                                onClick={(e) => handleResponse(e, 'ACTIVE')}
                                className="flex-1 py-2 rounded-xl bg-green-600 text-white font-medium text-sm shadow-sm"
                            >
                                Onayla
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};