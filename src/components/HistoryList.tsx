import type { PaymentLog } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { History, Wallet, Check, X, Clock } from 'lucide-react';
import { confirmPayment, rejectPayment } from '../services/db';
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

    const handleConfirm = async (paymentId: string) => {
        if (!user) return;
        const confirmed = await showConfirm("Ödeme Onayı", "Bu ödemeyi onaylıyor musunuz?");
        if (!confirmed) return;
        try {
            await confirmPayment(debtId, paymentId, user.uid);
            showAlert("Başarılı", "Ödeme onaylandı.", "success");
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem başarısız veya yetkiniz yok.", "error");
        }
    };

    const handleReject = async (paymentId: string) => {
        const confirmed = await showConfirm("Ödeme Reddi", "Bu ödemeyi reddetmek istediğinize emin misiniz?");
        if (!confirmed) return;
        try {
            await rejectPayment(debtId, paymentId);
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

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <History size={18} />
                İşlem Geçmişi
            </h3>
            <div className="space-y-3">
                {logs.map((log) => (
                    <SwipeableItem
                        key={log.id}
                        onSwipeRight={isLender && log.status === 'PENDING' ? () => handleConfirm(log.id) : undefined}
                        onSwipeLeft={isLender && log.status === 'PENDING' ? () => handleReject(log.id) : undefined}
                        editColor="bg-green-500"
                        deleteColor="bg-red-500"
                        EditIcon={Check}
                        DeleteIcon={X}
                        className="mb-3"
                    >
                        <div className={clsx(
                            "p-3 rounded-lg border",
                            log.status === 'PENDING' ? "bg-yellow-50 border-yellow-100" : "bg-gray-50 border-gray-100"
                        )}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "p-2 rounded-full shadow-sm",
                                        log.type === 'PAYMENT' ? "bg-green-100 text-green-600" :
                                            log.type === 'PAYMENT_DECLARATION' ? "bg-yellow-100 text-yellow-600" : "bg-white text-blue-600"
                                    )}>
                                        <Wallet size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {log.type === 'INITIAL_CREATION' ? 'Borç Oluşturuldu' :
                                                log.type === 'PAYMENT' ? 'Ödeme Yapıldı' :
                                                    log.type === 'PAYMENT_DECLARATION' ? 'Ödeme Bildirimi' : 'Not Eklendi'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {log.timestamp ? format(log.timestamp.toDate(), 'd MMM HH:mm', { locale: tr }) : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {log.amountPaid && (
                                        <p className={clsx(
                                            "font-semibold",
                                            log.status === 'PENDING' ? "text-yellow-600" : "text-green-600"
                                        )}>
                                            +{formatCurrency(log.amountPaid, currency)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {log.note && (
                                <p className="text-xs text-gray-500 mb-2 pl-11">{log.note}</p>
                            )}

                            {log.status === 'PENDING' && (
                                <div className="pl-11 mt-2">
                                    {isLender ? (
                                        <div className="hidden md:flex gap-2">
                                            <button
                                                onClick={() => handleConfirm(log.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                                            >
                                                <Check size={14} /> Onayla
                                            </button>
                                            <button
                                                onClick={() => handleReject(log.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-500 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                                            >
                                                <X size={14} /> Reddet
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                                            <Clock size={14} /> Onay Bekliyor
                                        </div>
                                    )}
                                </div>
                            )}
                            {log.status === 'REJECTED' && (
                                <div className="pl-11 mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                                    <X size={14} /> Reddedildi
                                </div>
                            )}
                        </div>
                    </SwipeableItem>
                ))}
            </div>
        </div>
    );
};
