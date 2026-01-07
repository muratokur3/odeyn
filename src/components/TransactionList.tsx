/**
 * TransactionList
 * Chat-style list of Cari transactions
 */

import { format, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownLeft, Trash2, Edit2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { deleteLedgerTransaction } from '../services/transactionService';
import { isTransactionEditable } from '../services/db'; // New helper
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { Transaction } from '../types';
import { SwipeableItem } from './SwipeableItem';
import { useState } from 'react';
import { CreateDebtModal } from './CreateDebtModal';

interface TransactionListProps {
    transactions: Transaction[];
    ledgerId: string; // Shared ledger ID
    onRefresh?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    ledgerId
}) => {
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);

    const handleDelete = async (txId: string) => {
        if (!user) return;
        
        showConfirm(
            "Kaydı Sil",
            "Bu işlem geri alınamaz. Kayıt tamamen silinecek. Emin misin?",
            async () => {
                try {
                    await deleteLedgerTransaction(ledgerId, txId);
                } catch (error) {
                    console.error(error);
                    showAlert("Hata", "Silme işlemi başarısız.", "error");
                }
            }
        );
    };

    const handleEdit = (tx: Transaction) => {
        setEditingTx(tx);
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
        <div className="space-y-3 pb-20">
            {transactions.map((tx) => {
                const isMine = tx.createdBy === user?.uid;
                const isOutgoing = tx.direction === 'OUTGOING';

                // 1-Hour Hard Delete Rule Check
                const createdAt = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date();
                const isEditable = isMine && isTransactionEditable(createdAt);

                const content = (
                    <div
                        className={clsx(
                            "flex w-full relative",
                            isMine ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={clsx(
                                "p-3 rounded-2xl shadow-sm border max-w-[85%] min-w-[140px] relative group transition-colors",
                                isOutgoing
                                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
                                isMine ? "rounded-tr-sm" : "rounded-tl-sm"
                            )}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between gap-4">
                                    <p className={clsx(
                                        "text-lg font-bold leading-none",
                                        isOutgoing ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                    )}>
                                        {formatCurrency(tx.amount, tx.currency || 'TRY')}
                                    </p>
                                    <div className="text-[10px] text-text-secondary opacity-70 whitespace-nowrap">
                                        {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'HH:mm', { locale: tr }) : ''}
                                    </div>
                                </div>

                                {tx.description && (
                                    <p className="text-sm text-text-primary leading-snug break-words">{tx.description}</p>
                                )}
                            </div>
                        </div>
                    </div>
                );

                if (isEditable) {
                    return (
                        <SwipeableItem
                            key={tx.id}
                            onSwipeLeft={() => handleDelete(tx.id)}
                            leftActionColor="bg-red-500"
                            leftActionIcon={<Trash2 className="text-white" size={20} />}

                            // Right Swipe for Edit
                            onSwipeRight={() => handleEdit(tx)}
                            rightActionColor="bg-blue-500"
                            rightActionIcon={<Edit2 className="text-white" size={20} />}
                        >
                            {content}
                        </SwipeableItem>
                    );
                }

                return <div key={tx.id}>{content}</div>;
            })}

            {/* Edit Modal (Reusing CreateDebtModal) */}
            {editingTx && (
                <CreateDebtModal
                    isOpen={!!editingTx}
                    onClose={() => setEditingTx(null)}
                    editMode={true}
                    initialData={{
                        // Mapping Transaction to Debt-like structure for the modal
                        id: editingTx.id,
                        lenderId: editingTx.direction === 'OUTGOING' ? (user?.uid || '') : '', // If Outgoing, I am lender
                        borrowerId: editingTx.direction === 'INCOMING' ? (user?.uid || '') : '',
                        // Names might be missing in Tx object, but Modal handles display logic or we can fetch/pass?
                        // Transaction object usually lacks names. But CreateDebtModal expects names for rendering card.
                        // However, editMode uses initialData primarily for amounts/notes.
                        // It will try to show "User Card" which might be empty if we don't pass name.
                        // Let's rely on the fact that Transaction List is for a specific person usually?
                        // Wait, TransactionList is used in PersonStream? Yes.
                        // So we know the other person. But we don't have it passed here explicitly as a user object.
                        // Let's modify TransactionList to accept targetUser?
                        // Or just let Modal handle "Shadow User" logic.
                        // We need to pass valid IDs.
                        originalAmount: editingTx.amount,
                        remainingAmount: editingTx.amount, // Irrelevant for edit display
                        currency: editingTx.currency || 'TRY',
                        note: editingTx.description,
                        createdAt: editingTx.createdAt,
                        createdBy: editingTx.createdBy,
                        status: 'ACTIVE',
                        participants: [],
                        lenderName: '',
                        borrowerName: ''
                    }}
                />
            )}
        </div>
    );
};
