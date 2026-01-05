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
    variant?: 'default' | 'chat'; // New prop for Chat Layout
    isNew?: boolean; // New prop for highlighting
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, currentUserId, onClick, otherPartyStatus = 'none', disabled = false, variant = 'default', isNew = false }) => {
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
    const isRejectedByReceiver = debt.status === 'REJECTED_BY_RECEIVER';
    const isAutoHidden = debt.status === 'AUTO_HIDDEN';
    const isActive = debt.status === 'ACTIVE';

    const totalInstallments = debt.installments?.length || 0;
    const paidInstallments = debt.installments?.filter(i => i.isPaid).length || 0;
    const hasInstallments = totalInstallments > 0;

    const handleResponse = async (e: React.MouseEvent, status: 'ACTIVE' | 'REJECTED' | 'REJECTED_BY_RECEIVER') => {
        e.stopPropagation();
        try {
            await respondToDebtRequest(debt.id, status, currentUserId);
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    // Variant Logic
    const isChat = variant === 'chat';
    const isCreator = debt.createdBy === currentUserId; // True if I created it (Right side in Chat)

    // Background Colors
    // Chat Mode:
    // Me (Creator) -> Very light tint of status color (Greenish/Reddish/Grayish) or just distinct Gray.
    // They (Other) -> White/Gray.

    let baseBg = "";
    if (isChat) {
        if (isCreator) {
            // My Bubble
            // If I created it, and I am Lender -> Green Tint.
            // If I created it, and I am Borrower -> Red Tint.
            // Or simple: I said it -> Color it lightly.
            baseBg = isLender
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 rounded-tr-none"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 rounded-tr-none";
        } else {
            // Their Bubble
            baseBg = isNew
                ? "bg-green-50/80 dark:bg-green-900/10 border-green-200 dark:border-green-800 rounded-tl-none shadow-[0_0_10px_rgba(22,163,74,0.1)] ring-1 ring-green-200 dark:ring-green-800"
                : "bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 rounded-tl-none";
        }

        // Overrides for special statuses
        if (isPaid) baseBg = "bg-gray-100 dark:bg-slate-800 border-slate-200 opacity-80";
        if (isRejectedByReceiver) baseBg = "bg-red-50 border-red-200 opacity-80";
        if (disabled) baseBg = "bg-gray-100 dark:bg-slate-800 border-slate-200 opacity-60";
    } else {
        // Default Mode
        baseBg = isPaid
            ? "bg-gray-50 border-slate-200 opacity-70"
            : isRejectedByReceiver
                ? "bg-red-50 border-red-200 opacity-80 decoration-slice"
                : isLender
                    ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                    : "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800";
        if (disabled) baseBg = "bg-gray-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-80";
    }

    // Chat Title Logic
    const chatTitle = debt.note || "Borç Kaydı";

    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 border active:scale-[0.98] transition-all cursor-pointer relative shadow-md hover:shadow-lg",
                isChat ? "rounded-2xl mb-1" : "rounded-2xl",
                baseBg,
                isNew && !isChat && "ring-2 ring-green-500/20"
            )}
        >
            <div className="flex items-start gap-4">
                {/* Avatar - Hide in Chat Mode */}
                {!isChat && (
                    <Avatar
                        name={finalDisplayName}
                        size="md"
                        className={clsx("shadow-sm bg-white", (disabled || isRejectedByReceiver) && "grayscale")}
                        status={otherPartyStatus}
                        uid={linkedUserId || (otherId.length > 20 ? otherId : undefined)}
                    />
                )}

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-3">
                        {/* Title Section */}
                        <div className="min-w-0 flex-1">
                            <h3 className={clsx(
                                "font-bold text-gray-900 dark:text-white truncate",
                                isChat ? "text-base" : "text-lg",
                                (disabled || isRejectedByReceiver) && "line-through text-gray-500"
                            )}>
                                {isChat ? chatTitle : finalDisplayName}
                            </h3>
                            {/* Chat Mode Subtitles / Badges */}
                            {isChat && (
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {isNew && <span className="text-[10px] font-bold text-white bg-green-500 px-1.5 py-0.5 rounded shadow-sm animate-pulse">YENİ</span>}
                                    <span className={clsx(
                                        "text-xs font-medium px-1.5 py-0.5 rounded",
                                        isLender ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                    )}>
                                        {isLender ? "Alacaklısın" : "Borçlusun"}
                                    </span>
                                    {isPaid && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Kapandı</span>}
                                    {isRejectedByReceiver && <span className="text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">Silindi</span>}
                                </div>
                            )}
                        </div>

                        {/* Tutar */}
                        <div className="flex flex-col items-end shrink-0">
                            <div className={clsx(
                                "font-bold tracking-tight",
                                isChat ? "text-base" : "text-lg",
                                isPaid || isRejectedByReceiver ? "text-gray-400 line-through" : (isLender ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"),
                                disabled && "opacity-50"
                            )}>
                                {formatCurrency(debt.remainingAmount, debt.currency)}
                            </div>
                            {/* Original Amount - Only show if different or explicitly requested. User requested it for PersonDetail (Chat) */}
                            <div className="text-[10px] text-text-secondary opacity-70">
                                Ana: {formatCurrency(debt.originalAmount, debt.currency)}
                            </div>
                        </div>
                    </div>

                    {!isChat && (
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col gap-1">
                                {/* İnsan Diliyle Açıklama - Default Mode */}
                                <p className={clsx("text-sm font-medium",
                                    isRejectedByReceiver ? "text-red-500" : (isLender ? "text-green-600" : "text-red-600"),
                                    (disabled) && "text-gray-500"
                                )}>
                                    {isPaid ? "Hesap Kapandı" :
                                        isRejectedByReceiver ? "Karşı taraf sildi" :
                                            (isLender ? "Alacaklısın" : "Borçlusun")}
                                </p>

                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>{debt.createdAt?.toDate?.() ? format(debt.createdAt.toDate(), 'd MMM', { locale: tr }) : '-'}</span>
                                    {hasInstallments && (
                                        <span className="bg-white px-2 py-0.5 rounded-md border text-gray-600 font-medium shadow-sm">
                                            {paidInstallments}/{totalInstallments} Taksit
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Durum İkonları - Default Mode */}
                            <div>
                                {disabled ? (
                                    <div className="text-gray-400" title="Engellendi">
                                        <Ban size={20} />
                                    </div>
                                ) : isRejectedByReceiver ? (
                                    <div className="text-red-500 font-bold text-xs bg-red-100 px-2 py-1 rounded-lg border border-red-200">
                                        ❌ Reddedildi
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
                    )}

                    {/* Chat Mode Timestamp */}
                    {isChat && (
                        <div className="mt-2 flex justify-end">
                            <span className="text-[10px] text-text-secondary opacity-70">
                                {debt.createdAt?.toDate?.() ? format(debt.createdAt.toDate(), 'HH:mm • d MMM', { locale: tr }) : ''}
                            </span>
                        </div>
                    )}

                    {/* ACTIONS */}
                    {/* 1. Legacy Pending Response (Only if I am receiver and Pending) */}
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

                    {/* 2. New Opt-Out (Soft Delete) for Active Debts (Only if I am receiver and Active) */}
                    {isActive && debt.borrowerId === currentUserId && isLender && !disabled && (
                        debt.createdBy !== currentUserId && (
                            <div className="mt-3 flex gap-2 pt-3 border-t border-black/5">
                                <button
                                    onClick={(e) => handleResponse(e, 'REJECTED_BY_RECEIVER')}
                                    className="w-full py-2 rounded-xl bg-white border border-red-200 text-red-600 font-medium text-sm shadow-sm hover:bg-red-50 transition-colors"
                                >
                                    Sil / Reddet
                                </button>
                            </div>
                        )
                    )}
                    {/* Also handle case where I am lender but borrower created it (I am receiver of the record) */}
                    {isActive && debt.lenderId === currentUserId && debt.createdBy !== currentUserId && !disabled && (
                        <div className="mt-3 flex gap-2 pt-3 border-t border-black/5">
                            <button
                                onClick={(e) => handleResponse(e, 'REJECTED_BY_RECEIVER')}
                                className="w-full py-2 rounded-xl bg-white border border-red-200 text-red-600 font-medium text-sm shadow-sm hover:bg-red-50 transition-colors"
                            >
                                Sil / Reddet
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
