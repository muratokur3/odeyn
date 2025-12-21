import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import type { Debt } from '../types';
import { Timestamp, deleteField } from 'firebase/firestore';
import { useModal } from '../context/ModalContext';

interface EditDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    debt: Debt;
    onUpdate: (debtId: string, data: Partial<Debt>) => Promise<void>;
}

export const EditDebtModal: React.FC<EditDebtModalProps> = ({ isOpen, onClose, debt, onUpdate }) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [note, setNote] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const { showAlert } = useModal();

    const hasPayments = debt.originalAmount !== debt.remainingAmount;

    useEffect(() => {
        if (isOpen && debt) {
            setAmount(debt.originalAmount.toString());
            setCurrency(debt.currency);
            setNote(debt.note || '');
            if (debt.dueDate) {
                setDueDate(debt.dueDate.toDate().toISOString().split('T')[0]);
            } else {
                setDueDate('');
            }
        }
    }, [isOpen, debt]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updates: any = {
                note
            };

            if (dueDate) {
                updates.dueDate = Timestamp.fromDate(new Date(dueDate));
            } else {
                // If cleared, remove the field from DB using deleteField()
                updates.dueDate = deleteField();
            }

            if (!hasPayments) {
                const numAmount = parseFloat(amount);
                if (!isNaN(numAmount) && numAmount > 0) {
                    updates.originalAmount = numAmount;
                    updates.remainingAmount = numAmount; // Reset remaining if no payments
                    updates.currency = currency;
                }
            }

            // Remove undefined keys just in case (though we handle dueDate specifically now)
            Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

            await onUpdate(debt.id, updates);
            onClose();
        } catch (error) {
            console.error("Error updating debt:", error);
            showAlert("Hata", "Güncelleme sırasında bir hata oluştu.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-text-primary">Borcu Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                {hasPayments && (
                    <div className="mb-4 p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg text-sm flex items-start gap-2 border border-yellow-500/20">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>Bu borç için ödeme yapıldığı için tutar ve para birimi değiştirilemez.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Tutar</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={hasPayments}
                                min={0}
                                step="0.01"
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                required
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Para Birimi</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                disabled={hasPayments}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="TRY">TRY</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GOLD">Altın (Gr)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Vade Tarihi</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Not</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all resize-none"
                            placeholder="Borç ile ilgili not..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Güncelleniyor...' : 'Güncelle'}
                    </button>
                </form>
            </div>
        </div>
    );
};
