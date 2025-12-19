import { respondToDebtRequest } from '../services/db';
import { useContactName } from '../hooks/useContactName';
import type { Debt } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CheckCheck, Clock, Ban } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { Avatar } from './Avatar';
import clsx from 'clsx';

interface DebtCardProps {
    debt: Debt;
    currentUserId: string;
    onClick: () => void;
    otherPartyStatus?: 'none' | 'system' | 'contact';
    disabled?: boolean; // New prop for blocked state
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, currentUserId, onClick, otherPartyStatus = 'none', disabled = false }) => {
    // Live Name Resolution (Scenario 4: Update Propagation)
    // We prioritize the Contact Book name over the Debt Snapshot name.
    const { resolveName } = useContactName();

    const isLender = debt.lenderId === currentUserId;
    const rawOtherName = isLender ? debt.borrowerName : debt.lenderName;
    const otherId = isLender ? debt.borrowerId : debt.lenderId; // Can be UID or Phone
    const lockedPhone = debt.lockedPhoneNumber;

    // Resolve the name using the ID (which might be phone) and fallback to snapshot name
    // Priority: 
    // 1. Contact Match (via ID)
    // 2. Contact Match (via lockedPhoneNumber)
    // 3. Snapshot Name (if standard)
    // 4. Formatted lockedPhoneNumber
    // 5. Formatted ID (if phone)
    let { displayName: otherPartyName, source, linkedUserId } = resolveName(otherId, rawOtherName);

    // If initial resolution failed to find a contact or useful name, try lockedPhoneNumber
    if (source !== 'contact' && lockedPhone) {
        // Try resolving name using the locked phone number
        const lockedResolution = resolveName(lockedPhone, rawOtherName);
        if (lockedResolution.source === 'contact') {
            otherPartyName = lockedResolution.displayName;
            source = 'contact';
        } else if (source === 'user' && otherPartyName === otherId) {
            // If primary resolution returned ID (bad), use locked phone resolution
            otherPartyName = lockedResolution.displayName;
            source = lockedResolution.source;
        }
    }

    // If still just a raw phone number (and source is not contact), format it nicely
    let finalDisplayName = otherPartyName;

    // Check if the current name looks like a phone number
    const isPhoneLike = (str: string) => str.replace(/\D/g, '').length >= 10 && !str.includes(' ');

    if (source !== 'contact') {
        if (isPhoneLike(finalDisplayName)) {
            finalDisplayName = formatPhoneNumber(finalDisplayName);
        } else if (finalDisplayName.length > 20 && lockedPhone) {
            // If it looks like a UID and we have a locked phone, show formatted phone
            finalDisplayName = formatPhoneNumber(lockedPhone);
        }
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

    // Override color if disabled/blocked? Maybe just opacity or grayscale
    const finalBgColor = disabled ? "bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 opacity-80" : cardBgColor;

    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 rounded-2xl border active:scale-[0.98] transition-all cursor-pointer relative",
                finalBgColor
            )}
        >
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar
                    name={finalDisplayName}
                    size="md"
                    className={clsx("shadow-sm bg-white", disabled && "grayscale")}
                    status={otherPartyStatus}
                    uid={linkedUserId || (otherId.length > 20 ? otherId : undefined)}
                />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className={clsx("text-lg font-bold text-gray-900 dark:text-white truncate", disabled && "line-through text-gray-500")}>
                            {finalDisplayName}
                        </h3>
                        {/* Tutar - KOCAMAN */}
                        <div className={clsx(
                            "text-lg font-bold tracking-tight",
                            isPaid ? "text-gray-400 line-through" : (isLender ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"),
                            disabled && "opacity-50"
                        )}>
                            {formatCurrency(debt.remainingAmount, debt.currency)}
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                            {/* İnsan Diliyle Açıklama */}
                            <p className={clsx("text-sm font-medium", isLender ? "text-green-600" : "text-red-600", disabled && "text-gray-500")}>
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
                            {disabled ? (
                                <div className="text-gray-400" title="Engellendi">
                                    <Ban size={20} />
                                </div>
                            ) : isPending ? (
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
                    {isPending && debt.createdBy !== currentUserId && !disabled && (
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
