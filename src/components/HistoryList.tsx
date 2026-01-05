import type { PaymentLog } from '../types';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { History, Wallet, X, MoreVertical } from 'lucide-react';
import { rejectPayment } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';
import { SwipeableItem } from './SwipeableItem';

import { useModal } from '../context/ModalContext';

interface HistoryListProps {
    logs: PaymentLog[];
    currency: string;
    isLender: boolean;
    debtId: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({ logs, currency, isLender, debtId }) => {
    const { showAlert, showConfirm } = useModal();
    const { user } = useAuth();



    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const toggleMenu = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (openMenuId === id) {
            setOpenMenuId(null);
        } else {
            setOpenMenuId(id);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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
                    return (
                        <SwipeableItem
                            key={log.id}
                            onSwipeLeft={canReject(log) ? () => handleReject(log.id) : undefined}
                            leftActionColor="bg-red-500"
                            leftActionIcon={<X size={20} className="text-white" />}
                            className="mb-3"
                            contentClassName="bg-background" // Match page bg
                        >
                            <div className={clsx(
                                "p-3 rounded-lg border relative shadow-sm w-[90%] md:w-[85%]", // Width constraint
                                isMine ? "ml-auto bg-green-50/50 border-green-200" : "mr-auto bg-white border-slate-200", // Alignment & Color
                                log.status === 'REJECTED' && "bg-red-50 border-red-200 opacity-75" // Rejected override
                            )}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "p-2 rounded-full shadow-sm",
                                            log.type === 'PAYMENT' ? "bg-green-100 text-green-600" :
                                                log.type === 'PAYMENT_DECLARATION' ? "bg-green-100 text-green-600" : "bg-white text-blue-600" // Unified color for payment
                                        )}>
                                            <Wallet size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {log.type === 'INITIAL_CREATION' ? 'Borç Oluşturuldu' :
                                                    (log.type === 'PAYMENT' || log.type === 'PAYMENT_DECLARATION') ? 'Ödeme' : 'Not Eklendi'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {log.timestamp ? format(log.timestamp.toDate(), 'd MMM HH:mm', { locale: tr }) : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Side: Amount + Menu */}
                                    <div className="flex items-center gap-2">
                                        {log.amountPaid && (
                                            <p className={clsx(
                                                "font-semibold",
                                                log.status === 'REJECTED' ? "text-gray-400 line-through" : "text-green-600"
                                            )}>
                                                +{formatCurrency(log.amountPaid, currency)}
                                            </p>
                                        )}

                                        {/* Action Menu Trigger - only if rejectable */}
                                        {canReject(log) && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => toggleMenu(log.id, e)}
                                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {openMenuId === log.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-10 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleReject(log.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <X size={14} /> Reddet / İptal
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {log.note && (
                                    <p className="text-xs text-gray-500 mb-2 pl-11">{log.note}</p>
                                )}

                                {/* Status Indicator (Only if Rejected) - Button removed */}
                                {log.status === 'REJECTED' && (
                                    <div className="pl-11 mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                        <X size={14} /> Reddedildi
                                    </div>
                                )}
                            </div>
                        </SwipeableItem>
                    );
                })}
            </div>
        </div>
    );
};
