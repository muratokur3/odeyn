/**
 * QuickTransactionModal
 * Simple modal for adding Cari transactions (Verdim/Aldım)
 */

import { useState } from 'react';
import { X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { addTransaction } from '../services/transactionService';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { TransactionDirection } from '../types';

interface QuickTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string;
    contactName: string;
}

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = ({
    isOpen,
    onClose,
    contactId,
    contactName
}) => {
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [direction, setDirection] = useState<TransactionDirection>('OUTGOING');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !contactId) return;

        const numAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numAmount) || numAmount <= 0) {
            showAlert("Hata", "Geçerli bir tutar girin.", "error");
            return;
        }

        setSubmitting(true);
        try {
            await addTransaction(
                user.uid,
                contactId,
                numAmount,
                direction,
                description.trim() || undefined
            );
            showAlert("Başarılı", "İşlem eklendi.", "success");
            // Reset form
            setAmount('');
            setDescription('');
            setDirection('OUTGOING');
            onClose();
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem eklenemedi.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-xl animate-in slide-in-from-bottom sm:fade-in sm:zoom-in duration-200 border-t sm:border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-text-primary">
                        Hızlı İşlem
                    </h2>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <p className="text-sm text-text-secondary mb-4">
                    {contactName} ile işlem
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Direction Toggle */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setDirection('OUTGOING')}
                            className={clsx(
                                "flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all border-2",
                                direction === 'OUTGOING'
                                    ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                            )}
                        >
                            <ArrowUpRight size={20} />
                            Verdim
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('INCOMING')}
                            className={clsx(
                                "flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all border-2",
                                direction === 'INCOMING'
                                    ? "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                            )}
                        >
                            <ArrowDownLeft size={20} />
                            Aldım
                        </button>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Tutar (₺)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-4 text-3xl font-bold text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-text-primary focus:ring-2 focus:ring-primary outline-none"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Açıklama (Opsiyonel)</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Örn: Öğle yemeği"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-text-primary focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting || !amount}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-white transition-all",
                            direction === 'OUTGOING'
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700",
                            (submitting || !amount) && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {submitting ? 'Ekleniyor...' : (direction === 'OUTGOING' ? '💸 Verdim Olarak Ekle' : '💰 Aldım Olarak Ekle')}
                    </button>
                </form>
            </div>
        </div>
    );
};
