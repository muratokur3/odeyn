import { permanentlyDeleteDebt } from '../services/db';
import { useContactName } from '../hooks/useContactName';
import type { Debt, User, Contact } from '../types';
import { format, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { MoreVertical, Trash2, Edit2, CheckCircle, EyeOff } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { Avatar } from './Avatar';
import clsx from 'clsx';
import { useState } from 'react';
import { useModal } from '../context/ModalContext';
import { CreateDebtModal } from './CreateDebtModal';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface DebtCardProps {
    debt: Debt;
    currentUserId: string;
    onClick: () => void;
    otherPartyStatus?: 'none' | 'system' | 'contact';
    disabled?: boolean;
    variant?: 'default' | 'chat';
    isNew?: boolean;
    className?: string; // NEW: Accept className override
    hideMenu?: boolean;
    hideAvatar?: boolean; // NEW: Option to hide avatar
}

export const DebtCard: React.FC<DebtCardProps> = ({
    debt,
    currentUserId,
    onClick,
    otherPartyStatus = 'none',
    disabled = false,
    variant = 'default',
    isNew = false,
    className,
    hideMenu = false,
    hideAvatar = false
}) => {
    const { resolveName } = useContactName();
    const { showConfirm, showAlert } = useModal();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [showMenu, setShowMenu] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const isLender = debt.lenderId === currentUserId;
    const rawOtherName = isLender ? debt.borrowerName : debt.lenderName;
    const otherId = isLender ? debt.borrowerId : debt.lenderId;
    const lockedPhone = debt.lockedPhoneNumber;

    // Name Resolution
    const initialResolution = resolveName(otherId, rawOtherName);
    let { displayName: otherPartyName, source, status: resolvedStatus } = initialResolution;
    const { linkedUserId } = initialResolution;

    if (source !== 'contact' && lockedPhone) {
        const lockedResolution = resolveName(lockedPhone, rawOtherName);
        if (lockedResolution.source === 'contact') {
            otherPartyName = lockedResolution.displayName;
            source = 'contact';
            resolvedStatus = 'contact';
        } else if (source === 'user' && otherPartyName === otherId) {
            otherPartyName = lockedResolution.displayName;
            source = lockedResolution.source;
            resolvedStatus = lockedResolution.status;
        }
    }

    let finalDisplayName = otherPartyName;
    const isPhoneLike = (str: string) => str.replace(/\D/g, '').length >= 10 && !str.includes(' ');

    if (source !== 'contact') {
        if (isPhoneLike(finalDisplayName)) {
            finalDisplayName = formatPhoneNumber(finalDisplayName);
        } else if (finalDisplayName.length > 20 && lockedPhone) {
            finalDisplayName = formatPhoneNumber(lockedPhone);
        }
    }

    const isPaid = debt.status === 'PAID';
    const isRejectedByReceiver = debt.status === 'REJECTED_BY_RECEIVER';

    const totalInstallments = debt.installments?.length || 0;
    const paidInstallments = debt.installments?.filter(i => i.isPaid).length || 0;
    const hasInstallments = totalInstallments > 0;

    // 1-Hour Rule Logic
    const isCreator = debt.createdBy === currentUserId;
    const now = new Date();
    const createdAt = debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date();
    const diffMinutes = differenceInMinutes(now, createdAt);
    const isEditable = isCreator && diffMinutes < 60;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        const confirmed = await showConfirm(
            "Dosyayı Sil",
            "Bu dosyayı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
            "warning"
        );
        if (confirmed) {
            try {
                if (isEditable) {
                    await permanentlyDeleteDebt(debt.id, currentUserId);
                    showAlert("Silindi", "Dosya kalıcı olarak silindi.", "success");
                } else {
                    showAlert("Hata", "Süre dolduğu için silinemez.", "error");
                }
            } catch (error) {
                console.error(error);
                showAlert("Hata", "Silme işlemi başarısız.", "error");
            }
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        if (!isEditable) {
            showAlert("Hata", "Düzenleme süresi doldu.", "error");
            return;
        }
        setShowEditModal(true);
    };

    const handleComplete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        showAlert("Bilgi", "Borcu tamamlama (silme/hibe) henüz swipe ile aktif değil. Detaydan yapınız.", "info");
    };

    const handleHide = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        showAlert("Bilgi", "Arşivleme özelliği '1 Saat Kuralı' gereği kaldırılmıştır.", "info");
    };



    // Visual Styling
    const isChat = variant === 'chat';
    const isMine = debt.createdBy === currentUserId;

    if (isChat) {
        const nextInst = debt.installments?.find(i => !i.isPaid);

        return (
            <div className={clsx("flex w-full mb-3 px-1", isMine ? "justify-end" : "justify-start")}>
                <div className={clsx(
                    "flex items-end gap-3 w-full",
                    isMine ? "flex-row-reverse" : "flex-row"
                )}>
                    {/* Avatar */}
                    {!hideAvatar && (
                        <Avatar
                            uid={isMine ? currentUserId : (linkedUserId || (otherId.length > 20 ? otherId : undefined))}
                            name={isMine ? 'Ben' : finalDisplayName}
                            size="sm"
                            className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mb-0.5"
                            status={isMine ? 'system' : resolvedStatus}
                        />
                    )}

                    {/* Bubble Card */}
                    <div
                        onClick={onClick}
                        className={clsx(
                            "p-3 rounded-2xl border-2 shadow-sm transition-all flex-1 relative group cursor-pointer bg-white dark:bg-slate-900 active:scale-[0.98]",
                            className,
                            isLender ? "border-purple-200 dark:border-purple-800" : "border-orange-200 dark:border-orange-800",
                            isMine ? "rounded-tr-sm bg-purple-50/10" : "rounded-tl-sm bg-white dark:bg-slate-900",
                            (disabled || isRejectedByReceiver) && "opacity-50 grayscale"
                        )}
                    >
                        <div className="flex flex-col gap-1">
                            {/* Title & Date */}
                            <div className="flex justify-between items-start gap-2">
                                <h3 className="font-bold text-[13px] text-text-primary truncate">
                                    {debt.note || "Vadeli Borç"}
                                </h3>
                                <div className="text-[9px] text-text-secondary opacity-60 whitespace-nowrap pt-0.5">
                                    {debt.createdAt?.toDate ? format(debt.createdAt.toDate(), 'd MMM', { locale: tr }) : ''}
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className={clsx(
                                    "text-base font-bold leading-none",
                                    isPaid ? "text-text-secondary line-through" : (isLender ? "text-purple-700 dark:text-purple-400" : "text-orange-700 dark:text-orange-400")
                                )}>
                                    {formatCurrency(debt.remainingAmount, debt.currency)}
                                </span>
                                {debt.originalAmount && debt.originalAmount !== debt.remainingAmount && (
                                    <span className="text-[9px] text-text-tertiary">
                                        / {formatCurrency(debt.originalAmount, debt.currency)}
                                    </span>
                                )}
                            </div>

                            {/* Status/Next Installment */}
                            {isPaid ? (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 dark:text-green-500 uppercase tracking-tight mt-1">
                                    <CheckCircle size={10} /> TAMAMLANDI
                                </div>
                            ) : nextInst ? (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    VADE: {format(nextInst.dueDate.toDate(), 'd MMM', { locale: tr })}
                                    <span className="opacity-60 ml-0.5">({formatCurrency(nextInst.amount, debt.currency)})</span>
                                </div>
                            ) : debt.dueDate && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight mt-1">
                                    VADE: {format(debt.dueDate.toDate(), 'd MMM', { locale: tr })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Spacer to achieve "total - 2x avatar" look */}
                    {!hideAvatar && (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden="true" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                onClick={onClick}
                className={clsx(
                    "p-4 border-2 active:scale-[0.98] transition-all cursor-pointer relative shadow-sm hover:shadow-md bg-white dark:bg-slate-900 mb-3 group",
                    "rounded-2xl",
                    isNew && "ring-2 ring-green-500/20",
                    isLender ? "border-purple-200 dark:border-purple-800" : "border-orange-200 dark:border-orange-800",
                    className
                )}
            >
                <div className="flex items-start gap-4">
                    {!hideAvatar && (
                        <Avatar
                            name={finalDisplayName}
                            size="sm"
                            className={clsx("shadow-sm bg-white", (disabled || isRejectedByReceiver) && "grayscale")}
                            status={otherPartyStatus}
                            uid={linkedUserId || (otherId.length > 20 ? otherId : undefined)}
                        />
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-3">
                            <div className="min-w-0 flex-1">
                                <h3 className={clsx(
                                    "font-bold text-gray-900 dark:text-white truncate flex items-center gap-2 text-lg",
                                    (disabled || isRejectedByReceiver) && "line-through text-gray-500"
                                )}>
                                    {debt.note || `${formatCurrency(debt.originalAmount || debt.remainingAmount, debt.currency)} Borç Kaydı`}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={clsx(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                        isLender
                                            ? "bg-purple-50 text-purple-700 border-purple-200"
                                            : "bg-orange-50 text-orange-700 border-orange-200"
                                    )}>
                                        {isLender ? "VERİLEN" : "ALINAN"}
                                    </span>
                                    {hasInstallments && (
                                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {paidInstallments}/{totalInstallments} Taksit
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                                <div className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold mb-0.5">
                                    Kalan
                                </div>
                                <div className={clsx(
                                    "font-bold tracking-tight text-lg leading-none mb-1",
                                    isPaid || isRejectedByReceiver ? "text-gray-400 line-through" : (isLender ? "text-purple-700 dark:text-purple-400" : "text-orange-700 dark:text-orange-400"),
                                    disabled && "opacity-50"
                                )}>
                                    {formatCurrency(debt.remainingAmount, debt.currency)}
                                </div>
                                {debt.originalAmount && debt.originalAmount !== debt.remainingAmount && (
                                    <div className="text-[10px] text-text-tertiary">
                                        Toplam: {formatCurrency(debt.originalAmount, debt.currency)}
                                    </div>
                                )}
                                {debt.dueDate && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 mt-1 uppercase tracking-tighter">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                        Vade: {format(debt.dueDate.toDate(), 'd MMM', { locale: tr })}
                                    </div>
                                )}
                                <div className="text-[10px] text-text-secondary opacity-70 mt-1">
                                    {debt.createdAt?.toDate ? format(debt.createdAt.toDate(), 'd MMM', { locale: tr }) : ''}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {debt.originalAmount && debt.originalAmount > 0 && (
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                                <div
                                    className={clsx(
                                        "h-full rounded-full transition-all duration-500",
                                        isLender ? "bg-purple-500" : "bg-orange-500"
                                    )}
                                    style={{
                                        width: `${Math.min(100, Math.max(0, ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100))}%`
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Three Dot Menu (Desktop Only) */}
                    {!hideMenu && isDesktop && (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    setOpenUpwards(spaceBelow < 200);
                                    setShowMenu(!showMenu);
                                }}
                                className={clsx(
                                    "p-1 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-opacity",
                                    showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}
                            >
                                <MoreVertical size={20} />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                                    <div className={clsx(
                                        "absolute right-0 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                                        openUpwards ? "bottom-full mb-1" : "top-full mt-1"
                                    )}>
                                        {isEditable && (
                                            <>
                                                <button
                                                    onClick={handleEdit}
                                                    className="w-full text-left px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700"
                                                >
                                                    <Edit2 size={16} /> Düzenle
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} /> Sil
                                                </button>
                                            </>
                                        )}

                                        {/* Always show Complete and Hide options */}
                                        <button
                                            onClick={handleComplete}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center gap-2 border-t border-gray-100 dark:border-slate-700"
                                        >
                                            <CheckCircle size={16} /> Tamamla
                                        </button>
                                        <button
                                            onClick={handleHide}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <EyeOff size={16} /> Gizle
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <CreateDebtModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                editMode={true}
                initialData={debt}
                targetUser={
                    linkedUserId ? { uid: linkedUserId, displayName: finalDisplayName } as User :
                        { name: finalDisplayName, phoneNumber: lockedPhone || '' } as Contact
                }
            />
        </>
    );
};
