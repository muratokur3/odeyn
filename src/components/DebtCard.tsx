import { respondToDebtRequest, deletePendingDebt, permanentlyDeleteDebt } from '../services/db';
import { useContactName } from '../hooks/useContactName';
import type { Debt } from '../types';
import { format, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CheckCheck, Clock, Ban, MoreVertical, Trash2, Archive, AlertTriangle, Edit2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { Avatar } from './Avatar';
import clsx from 'clsx';
import { useState } from 'react';
import { useModal } from '../context/ModalContext';
import { CreateDebtModal } from './CreateDebtModal';

interface DebtCardProps {
    debt: Debt;
    currentUserId: string;
    onClick: () => void;
    otherPartyStatus?: 'none' | 'system' | 'contact';
    disabled?: boolean;
    variant?: 'default' | 'chat';
    isNew?: boolean;
    className?: string; // NEW: Accept className override
}

export const DebtCard: React.FC<DebtCardProps> = ({
    debt,
    currentUserId,
    onClick,
    otherPartyStatus = 'none',
    disabled = false,
    variant = 'default',
    isNew = false,
    className
}) => {
    const { resolveName } = useContactName();
    const { showConfirm, showAlert } = useModal();
    const [showMenu, setShowMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const isLender = debt.lenderId === currentUserId;
    const rawOtherName = isLender ? debt.borrowerName : debt.lenderName;
    const otherId = isLender ? debt.borrowerId : debt.lenderId;
    const lockedPhone = debt.lockedPhoneNumber;

    // Name Resolution
    let { displayName: otherPartyName, source, linkedUserId } = resolveName(otherId, rawOtherName);

    if (source !== 'contact' && lockedPhone) {
        const lockedResolution = resolveName(lockedPhone, rawOtherName);
        if (lockedResolution.source === 'contact') {
            otherPartyName = lockedResolution.displayName;
            source = 'contact';
        } else if (source === 'user' && otherPartyName === otherId) {
            otherPartyName = lockedResolution.displayName;
            source = lockedResolution.source;
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
    const isPending = debt.status === 'PENDING';
    const isRejectedByReceiver = debt.status === 'REJECTED_BY_RECEIVER';
    const isActive = debt.status === 'ACTIVE';

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

    const handleArchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(false);
        // Implement Archive logic or Soft Delete logic
        showAlert("Bilgi", "Arşivleme özelliği yakında eklenecek.", "info");
    };


    // Visual Styling
    const isChat = variant === 'chat';

    return (
        <>
            <div
                onClick={onClick}
                className={clsx(
                    "p-4 border-2 active:scale-[0.98] transition-all cursor-pointer relative shadow-sm hover:shadow-md bg-white dark:bg-slate-900 mb-3",
                    isChat ? "rounded-xl border-dashed" : "rounded-2xl",
                    isNew && !isChat && "ring-2 ring-green-500/20",
                    isLender ? "border-purple-200 dark:border-purple-800" : "border-orange-200 dark:border-orange-800",
                    className // Merge className if provided
                )}
            >
                <div className="flex items-start gap-4">
                    {!isChat && (
                        <Avatar
                            name={finalDisplayName}
                            size="md"
                            className={clsx("shadow-sm bg-white", (disabled || isRejectedByReceiver) && "grayscale")}
                            status={otherPartyStatus}
                            uid={linkedUserId || (otherId.length > 20 ? otherId : undefined)}
                        />
                    )}

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-3">
                            <div className="min-w-0 flex-1">
                                <h3 className={clsx(
                                    "font-bold text-gray-900 dark:text-white truncate flex items-center gap-2",
                                    isChat ? "text-base" : "text-lg",
                                    (disabled || isRejectedByReceiver) && "line-through text-gray-500"
                                )}>
                                    {debt.note || "İsimsiz Dosya"}
                                </h3>
                                {isChat && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                            isLender
                                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                                : "bg-orange-50 text-orange-700 border-orange-200"
                                        )}>
                                            {isLender ? "ALACAK" : "BORÇ"}
                                        </span>
                                        {hasInstallments && (
                                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {paidInstallments}/{totalInstallments} Taksit
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                                <div className={clsx(
                                    "font-bold tracking-tight text-lg",
                                    isPaid || isRejectedByReceiver ? "text-gray-400 line-through" : (isLender ? "text-purple-700 dark:text-purple-400" : "text-orange-700 dark:text-orange-400"),
                                    disabled && "opacity-50"
                                )}>
                                    {formatCurrency(debt.remainingAmount, debt.currency)}
                                </div>
                                <div className="text-[10px] text-text-secondary opacity-70">
                                    {debt.createdAt?.toDate ? format(debt.createdAt.toDate(), 'd MMM', { locale: tr }) : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Three Dot Menu */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                            <MoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-20 overflow-hidden">
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

                                    {!isEditable && (
                                        <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic text-center">
                                            İşlem yapılamaz (Süre doldu)
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <CreateDebtModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                editMode={true}
                initialData={debt}
                targetUser={
                    linkedUserId ? { uid: linkedUserId, displayName: finalDisplayName } as any :
                    { name: finalDisplayName, phoneNumber: lockedPhone || '' } as any
                }
            />
        </>
    );
};
