import type { PaymentLog, GoldDetail } from '../types';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { History, Wallet, X, RefreshCw } from 'lucide-react';
import { rejectPayment } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';
import { AdaptiveActionRow } from './AdaptiveActionRow';
import { type SwipeAction } from './SwipeableItem';

import { useModal } from '../hooks/useModal';
import { Avatar } from './Avatar';

interface HistoryListProps {
    logs: PaymentLog[];
    currency: string;
    goldDetail?: GoldDetail;
    isLender: boolean;
    debtId: string;
    otherPartyId?: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({ logs, currency, goldDetail, isLender, debtId, otherPartyId }) => {
    const { showAlert, showConfirm } = useModal();
    const { user } = useAuth();
    const [openRowId, setOpenRowId] = useState<string | null>(null);

    // Auto-Reset: Click anywhere else closes row
    useEffect(() => {
        const handleClickOutside = () => {
            if (openRowId) setOpenRowId(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openRowId]);

    const handleReject = async (paymentId: string) => {
        if (!user) return;
        const confirmed = await showConfirm("Ödeme Reddi", "Bu ödemeyi reddetmek istediğinize emin misiniz?");
        if (!confirmed) return;
        try {
            await rejectPayment(debtId, paymentId, user.uid);
            showAlert("Reddedildi", "Ödeme reddedildi.", "success");
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem başarısız.", "error");
        }
    };

    if (logs.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                <History className="mx-auto mb-2 opacity-50" size={32} />
                <p>Henüz işlem yok</p>
            </div>
        );
    }

    const canReject = (log: PaymentLog) => {
        if (!user) return false;
        // Allow rejecting if I didn't perform it, and it's not already rejected.
        // Also ensure it's a payment type.
        return log.performedBy !== user.uid && log.status !== 'REJECTED' && (log.type === 'PAYMENT' || log.type === 'PAYMENT_DECLARATION');
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <History size={18} />
                İşlem Geçmişi
            </h3>
            <div className="space-y-3">
                {logs.map((log) => {
                    const isMine = log.performedBy === user?.uid;

                    const rightActions: SwipeAction[] = [];
                    if (canReject(log)) {
                        rightActions.push({
                            key: 'reject',
                            icon: <X size={20} className="text-white" />,
                            label: 'Reddet',
                            color: 'bg-red-500',
                            onClick: () => handleReject(log.id)
                        });
                    }

                    return (
                        <div key={log.id} className={clsx(
                            "flex items-center gap-2",
                            isMine ? "flex-row-reverse" : "flex-row"
                        )}>
                            {/* Avatar */}
                            <Avatar
                                uid={isMine ? user?.uid : otherPartyId}
                                size="sm"
                                className="w-5 h-5 flex-shrink-0"
                                status={!isMine && otherPartyId && otherPartyId.length > 20 ? 'system' : 'none'}
                            />

                            <AdaptiveActionRow
                                rightActions={rightActions}
                                isOpen={openRowId === `${log.id}_right` ? 'right' : null}
                                onOpen={(dir) => setOpenRowId(`${log.id}_${dir}`)}
                                onClose={() => setOpenRowId(null)}
                                className="flex-1"
                                contentClassName="bg-background"
                            >
                                <div className={clsx(
                                    "p-3 rounded-2xl border-2 relative shadow-sm max-w-[80%] sm:max-w-[70%] transition-all",
                                    isMine
                                        ? "ml-auto bg-green-50/20 border-green-200 rounded-tr-sm"
                                        : "mr-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-tl-sm",
                                    log.status === 'REJECTED' && "bg-red-50 border-red-200 opacity-75 grayscale"
                                )}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "p-2 rounded-full shadow-sm",
                                                log.type === 'PAYMENT' ? "bg-green-100 text-green-600" :
                                                    log.type === 'PAYMENT_DECLARATION' ? "bg-green-100 text-green-600" :
                                                    log.type === 'HARD_RESET' ? "bg-red-100 text-red-600" : "bg-white text-blue-600"
                                            )}>
                                                {log.type === 'HARD_RESET' ? <RefreshCw size={16} /> : <Wallet size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {log.type === 'INITIAL_CREATION' ? 'Borç Oluşturuldu' :
                                                        log.type === 'HARD_RESET' ? 'Kayıt Sıfırlandı' :
                                                        (log.type === 'PAYMENT' || log.type === 'PAYMENT_DECLARATION') ? 'Ödeme' : 'Not Eklendi'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {log.timestamp ? format(log.timestamp.toDate(), 'd MMM HH:mm', { locale: tr }) : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {log.amountPaid && (
                                                <p className={clsx(
                                                    "font-semibold",
                                                    log.status === 'REJECTED' ? "text-gray-400 line-through" : "text-green-600"
                                                )}>
                                                    +{formatCurrency(log.amountPaid, currency, goldDetail)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {log.note && (
                                        <p className="text-xs text-gray-500 mb-2 pl-11">{log.note}</p>
                                    )}

                                    {log.status === 'REJECTED' && (
                                        <div className="pl-11 mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                            <X size={14} /> Reddedildi
                                        </div>
                                    )}
                                </div>
                            </AdaptiveActionRow>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
