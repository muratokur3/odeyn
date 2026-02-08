/**
 * QuickTransactionModal
 * Simple modal for adding Cari transactions (Verdim/Aldım)
 */

import { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { addLedgerTransaction, getOrCreateLedger } from '../services/transactionService';
import { getDebtsBetweenParticipants, makePayment } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { TransactionDirection } from '../types';

interface QuickTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ledgerId: string | null; // Shared ledger ID
    contactName: string;
    // For auto-creating ledger if needed
    userId?: string;
    userName?: string;
    otherPartyId?: string;
    otherPartyName?: string;
}

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = ({
    isOpen,
    onClose,
    ledgerId,
    contactName,
    userId,
    userName,
    otherPartyId,
    otherPartyName
}) => {
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [direction, setDirection] = useState<TransactionDirection>('OUTGOING');
    const [submitting, setSubmitting] = useState(false);
    const [availableDebts, setAvailableDebts] = useState<any[]>([]);
    const [matchedDebt, setMatchedDebt] = useState<any | null>(null);

    // Fetch debts for Smart Matching
    useEffect(() => {
        const fetchDebts = async () => {
            if (isOpen && user && otherPartyId) {
                try {
                    const debts = await getDebtsBetweenParticipants(user.uid, otherPartyId);
                    setAvailableDebts(debts);
                } catch (err) {
                    console.error("Smart matching fetch failed:", err);
                }
            }
        };
        fetchDebts();
    }, [isOpen, user, otherPartyId]);

    // Perform Matching Logic
    useEffect(() => {
        const numAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numAmount) || numAmount <= 0 || availableDebts.length === 0) {
            setMatchedDebt(null);
            return;
        }

        // Find a debt that matches the amount exactly or nearly
        // Direction check: 
        // If Verdim (OUTGOING) -> Match where I am the Borrower (I'm paying my debt)
        // If Aldım (INCOMING) -> Match where I am the Lender (They are paying me)
        const match = availableDebts.find(d => {
            const isMyBorrowing = d.borrowerId === user?.uid;
            const isMyLending = d.lenderId === user?.uid;
            const amountMatches = Math.abs(d.remainingAmount - numAmount) < 1;

            if (direction === 'OUTGOING' && isMyBorrowing && amountMatches) return true;
            if (direction === 'INCOMING' && isMyLending && amountMatches) return true;
            return false;
        });

        setMatchedDebt(match || null);
    }, [amount, direction, availableDebts, user?.uid]);

    const handleSmartPay = async () => {
        if (!matchedDebt || !user) return;
        setSubmitting(true);
        try {
            const numAmount = parseFloat(amount.replace(',', '.'));
            await makePayment(
                matchedDebt.id, 
                numAmount, 
                user.uid, 
                description || 'Hızlı ödeme eşleşmesi'
            );
            showAlert("Başarılı", "Ödeme borç kaydıyla eşleştirilerek yapıldı.", "success");
            onClose();
        } catch (err) {
            showAlert("Hata", "Eşleştirme sırasında hata oluştu.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            showAlert("Hata", "Oturum açmanız gerekiyor.", "error");
            return;
        }

        const numAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numAmount) || numAmount <= 0) {
            showAlert("Hata", "Geçerli bir tutar girin.", "error");
            return;
        }

        setSubmitting(true);
        try {
            // Get or create ledger if needed
            let targetLedgerId = ledgerId;
            
            if (!targetLedgerId) {
                // Need all params to create ledger
                const effectiveUserId = userId || user.uid;
                const effectiveUserName = userName || user.displayName || 'Kullanıcı';
                const effectiveOtherPartyId = otherPartyId;
                const effectiveOtherPartyName = otherPartyName || contactName;

                if (!effectiveOtherPartyId) {
                    showAlert("Hata", "Karşı taraf bilgisi eksik.", "error");
                    setSubmitting(false);
                    return;
                }

                console.log('Creating ledger with:', {
                    userId: effectiveUserId,
                    userName: effectiveUserName,
                    otherPartyId: effectiveOtherPartyId,
                    otherPartyName: effectiveOtherPartyName
                });

                targetLedgerId = await getOrCreateLedger(
                    effectiveUserId,
                    effectiveUserName,
                    effectiveOtherPartyId,
                    effectiveOtherPartyName
                );
            }

            if (!targetLedgerId) {
                showAlert("Hata", "Defter oluşturulamadı.", "error");
                setSubmitting(false);
                return;
            }

            console.log('Adding transaction to ledger:', targetLedgerId);

            await addLedgerTransaction(
                targetLedgerId,
                user.uid,
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
            console.error('Transaction error:', error);
            showAlert("Hata", "İşlem eklenemedi: " + (error as Error).message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200 h-auto max-h-[90dvh] flex flex-col border border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 pb-2 flex-none">
                    <h2 className="text-xl font-bold text-text-primary">
                        Hızlı İşlem
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
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

                        {/* Smart Match Suggestion */}
                        {matchedDebt && (
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 animate-in slide-in-from-top-2">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="text-primary mt-0.5" size={18} />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-text-primary">Eşleşen Borç Bulundu</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            Bu tutar, bekleyen bir borç '{matchedDebt.note || 'Borç'}' ile eşleşiyor.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleSmartPay}
                                            className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            Borca Ödeme Olarak Kaydet →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

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
        </div>
    );
};
