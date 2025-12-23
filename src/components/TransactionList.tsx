/**
 * TransactionList
 * Chat-style list of Cari transactions
 */

import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownLeft, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { deleteTransaction } from '../services/transactionService';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { Transaction } from '../types';

interface TransactionListProps {
    transactions: Transaction[];
    contactId: string;
    onRefresh?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    contactId
}) => {
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();

    const handleDelete = async (txId: string) => {
        if (!user) return;
        
        const confirmed = await showConfirm(
            "İşlemi Sil",
            "Bu işlemi silmek istediğinize emin misiniz?",
            "warning"
        );
        
        if (confirmed) {
            try {
                await deleteTransaction(user.uid, contactId, txId);
                showAlert("Silindi", "İşlem silindi.", "success");
            } catch (error) {
                console.error(error);
                showAlert("Hata", "Silme işlemi başarısız.", "error");
            }
        }
    };

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12 text-text-secondary">
                <div className="text-4xl mb-3 opacity-50">💸</div>
                <p className="font-medium">Henüz işlem yok</p>
                <p className="text-sm mt-1 opacity-70">Aşağıdaki + butonuyla ilk işlemi ekleyin</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {transactions.map((tx) => {
                const isMine = tx.createdBy === user?.uid;
                const isOutgoing = tx.direction === 'OUTGOING';

                return (
                    <div
                        key={tx.id}
                        className={clsx(
                            "flex w-full",
                            isMine ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={clsx(
                                "p-4 rounded-2xl shadow-sm border max-w-[85%] min-w-[200px] relative group",
                                isOutgoing
                                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
                                isMine ? "rounded-tr-sm" : "rounded-tl-sm"
                            )}
                        >
                            {/* Delete Button (on hover) */}
                            {isMine && (
                                <button
                                    onClick={() => handleDelete(tx.id)}
                                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                    title="Sil"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}

                            <div className="flex items-center gap-3 mb-2">
                                <div className={clsx(
                                    "p-2 rounded-full",
                                    isOutgoing ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                )}>
                                    {isOutgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-text-secondary">
                                        {isOutgoing ? 'Verdim' : 'Aldım'}
                                    </p>
                                </div>
                                <p className={clsx(
                                    "text-lg font-bold",
                                    isOutgoing ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                )}>
                                    {isOutgoing ? '+' : '-'}{formatCurrency(tx.amount, 'TRY')}
                                </p>
                            </div>

                            {tx.description && (
                                <p className="text-sm text-text-primary pl-11 mb-2">{tx.description}</p>
                            )}

                            <div className="text-[10px] text-text-secondary text-right opacity-70">
                                {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'HH:mm • d MMM', { locale: tr }) : ''}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
