/**
 * TransactionList
 * Chat-style list of Cari transactions
 */

import React, { useState } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownLeft, Trash2, Edit2, X } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { deleteLedgerTransaction, updateLedgerTransaction } from '../services/transactionService';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { Transaction } from '../types';
import { SwipeableItem } from './SwipeableItem';

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

    // Edit State
    const [editAmount, setEditAmount] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editType, setEditType] = useState<'LENDING' | 'BORROWING'>('LENDING');
    const [isSaving, setIsSaving] = useState(false);

    const handleDelete = async (txId: string) => {
        if (!user) return;
        
        try {
            await deleteLedgerTransaction(ledgerId, txId);
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Silme işlemi başarısız.", "error");
        }
    };

    const handleEditStart = (tx: Transaction) => {
        setEditingTx(tx);
        setEditAmount(tx.amount.toString());
        setEditDesc(tx.description || '');
        // Map direction to type
        // OUTGOING (Benden Çıkan) = LENDING (Veriyorum) if I created it.
        // INCOMING (Bana Gelen) = BORROWING (Alıyorum) if I created it.
        setEditType(tx.direction === 'OUTGOING' ? 'LENDING' : 'BORROWING');
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTx) return;

        setIsSaving(true);
        try {
            const newAmount = parseFloat(editAmount);
            if (isNaN(newAmount) || newAmount <= 0) return;

            const direction = editType === 'LENDING' ? 'OUTGOING' : 'INCOMING';

            await updateLedgerTransaction(ledgerId, editingTx.id, {
                amount: newAmount,
                description: editDesc,
                direction
            });

            setEditingTx(null);
            showAlert("Başarılı", "İşlem güncellendi.", "success");
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Güncelleme başarısız.", "error");
        } finally {
            setIsSaving(false);
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
        <>
            <div className="space-y-3 pb-20">
                {transactions.map((tx) => {
                    const isMine = tx.createdBy === user?.uid;
                    const isOutgoing = tx.direction === 'OUTGOING';

                    // 1-Hour Correction Window Check
                    const now = new Date();
                    const createdAt = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date();
                    const diffMinutes = differenceInMinutes(now, createdAt);
                    const isModifiable = isMine && diffMinutes < 60;

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
                                            {formatCurrency(tx.amount, 'TRY')}
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

                    if (isModifiable) {
                        return (
                            <SwipeableItem
                                key={tx.id}
                                onSwipeLeft={() => handleDelete(tx.id)}
                                leftActionColor="bg-red-500"
                                leftActionIcon={<Trash2 className="text-white" size={20} />}
                                onSwipeRight={() => handleEditStart(tx)}
                                rightActionColor="bg-orange-500"
                                rightActionIcon={<Edit2 className="text-white" size={20} />}
                            >
                                {content}
                            </SwipeableItem>
                        );
                    }

                    return <div key={tx.id}>{content}</div>;
                })}
            </div>

            {/* Simple Edit Modal */}
            {editingTx && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                                <Edit2 size={20} className="text-orange-500" />
                                İşlemi Düzenle
                            </h2>
                            <button onClick={() => setEditingTx(null)} className="p-2 hover:bg-slate-700/50 rounded-full">
                                <X size={20} className="text-text-secondary" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSave} className="space-y-4">
                             {/* Type Toggle */}
                            <div className="flex p-1 bg-background rounded-xl border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setEditType('LENDING')}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                                        editType === 'LENDING' ? "bg-surface text-green-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                                    )}
                                >
                                    Verdim
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditType('BORROWING')}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                                        editType === 'BORROWING' ? "bg-surface text-red-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                                    )}
                                >
                                    Aldım
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Tutar</label>
                                <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    min={0}
                                    step="0.01"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all text-lg font-semibold"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Açıklama</label>
                                <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Kaydediliyor...' : 'Güncelle'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
