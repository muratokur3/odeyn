import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { Timestamp, deleteField } from 'firebase/firestore';
import { useModal } from '../context/ModalContext';
import { formatAmountToWords } from '../utils/format';
import { AmountInput } from './AmountInput';
import type { Debt, GoldDetail } from '../types';
import { GOLD_TYPES, GOLD_CARATS } from '../utils/goldConstants';
import clsx from 'clsx';
import { Toggle } from './Toggle';

interface EditDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    debt: Debt;
    onUpdate: (debtId: string, data: Partial<Debt>) => Promise<void>;
}

export const EditDebtModal: React.FC<EditDebtModalProps> = ({ isOpen, onClose, debt, onUpdate }) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('TRY');

    // Gold State
    const [goldType, setGoldType] = useState<string>('GRAM');
    const [goldCarat, setGoldCarat] = useState<number>(24);
    const [goldWeight, setGoldWeight] = useState<string>('');
    const [goldQuantity, setGoldQuantity] = useState<string>('');

    // Custom Rate
    const [manualRate, setManualRate] = useState('');
    const [useManualRate, setUseManualRate] = useState(false);

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

            // Gold Detail Init
            if (debt.currency === 'GOLD' && debt.goldDetail) {
                setGoldType(debt.goldDetail.type);
                setGoldCarat(debt.goldDetail.carat || 24);
                setGoldWeight(debt.goldDetail.weight?.toString() || '');
                setGoldQuantity(debt.goldDetail.quantity?.toString() || '');
            }

            if (debt.customExchangeRate) {
                setManualRate(debt.customExchangeRate.toString());
                setUseManualRate(true);
            } else {
                setManualRate('');
                setUseManualRate(false);
            }

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
            const updates: Partial<Debt> = {
                note
            };

            const customRate = useManualRate ? parseFloat(manualRate) : undefined;
            if (customRate) {
                updates.customExchangeRate = customRate;
            } else if (debt.customExchangeRate) {
                updates.customExchangeRate = deleteField() as any;
            }

            if (dueDate) {
                updates.dueDate = Timestamp.fromDate(new Date(dueDate));
            } else {
                // If cleared, remove the field from DB using deleteField()
                updates.dueDate = deleteField() as any;
            }

            if (!hasPayments) {
                const numAmount = parseFloat(amount);
                if (!isNaN(numAmount) && numAmount > 0) {
                    updates.originalAmount = numAmount;
                    updates.remainingAmount = numAmount; // Reset remaining if no payments
                    updates.currency = currency;

                    if (currency === 'GOLD') {
                        const typeData = GOLD_TYPES.find(t => t.id === goldType);
                        updates.goldDetail = {
                            type: goldType as GoldDetail['type'],
                            label: typeData?.label || goldType,
                            carat: typeData?.hasCarat ? goldCarat : undefined,
                            weight: typeData?.hasWeight ? parseFloat(goldWeight) : undefined,
                            quantity: typeData?.hasQuantity ? parseFloat(goldQuantity) : undefined
                        };
                    } else if (debt.goldDetail) {
                        updates.goldDetail = deleteField() as any;
                    }
                }
            }

            // Remove undefined keys just in case (though we handle dueDate specifically now)
            Object.keys(updates).forEach(key => (updates as any)[key] === undefined && delete (updates as any)[key]);

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
                    <div className="space-y-1">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <AmountInput
                                    label="Tutar"
                                    value={amount}
                                    onChange={setAmount}
                                    disabled={hasPayments}
                                    required
                                />
                            </div>
                            <div className="w-1/3">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Döviz</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    disabled={hasPayments}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed h-[46px]"
                                >
                                    <option value="TRY">₺</option>
                                    <option value="USD">$</option>
                                    <option value="EUR">€</option>
                                    <option value="GOLD">Altın</option>
                                </select>
                            </div>
                        </div>
                        {amount && (
                            <p className="text-[10px] text-text-secondary italic text-left animate-in fade-in slide-in-from-top-1 px-1 mt-0.5">
                                {formatAmountToWords(amount, currency, currency === 'GOLD' ? { type: goldType as GoldDetail['type'], label: '' } : undefined)}
                            </p>
                        )}

                        {/* Gold Sub-selection */}
                        {currency === 'GOLD' && !hasPayments && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3 animate-in fade-in slide-in-from-top-2 mt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase">Altın Türü</label>
                                    <select
                                        value={goldType}
                                        onChange={(e) => setGoldType(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-semibold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none"
                                    >
                                        {GOLD_TYPES.map(t => (
                                            <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {GOLD_TYPES.find(t => t.id === goldType)?.hasCarat && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase">Ayar</label>
                                            <select
                                                value={goldCarat}
                                                onChange={(e) => setGoldCarat(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-semibold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none"
                                            >
                                                {GOLD_CARATS.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {GOLD_TYPES.find(t => t.id === goldType)?.hasWeight && (
                                        <div className={clsx(!GOLD_TYPES.find(t => t.id === goldType)?.hasCarat && "col-span-2")}>
                                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase">Gram</label>
                                            <input
                                                type="number"
                                                value={goldWeight}
                                                onChange={(e) => {
                                                    setGoldWeight(e.target.value);
                                                    setAmount(e.target.value);
                                                }}
                                                placeholder="Örn: 10.5"
                                                step="0.01"
                                                className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                    )}
                                    {GOLD_TYPES.find(t => t.id === goldType)?.hasQuantity && (
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase">Adet</label>
                                            <input
                                                type="number"
                                                value={goldQuantity}
                                                onChange={(e) => {
                                                    setGoldQuantity(e.target.value);
                                                    setAmount(e.target.value);
                                                }}
                                                placeholder="Örn: 2"
                                                className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Custom Rate Input */}
                    {currency !== 'TRY' && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800 animate-in fade-in transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-orange-700 dark:text-orange-300">Özel Kur Kullan</label>
                                <Toggle
                                    checked={useManualRate}
                                    onChange={setUseManualRate}
                                />
                            </div>
                            {useManualRate && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-text-secondary">
                                        1 {currency === 'GOLD' ? (GOLD_TYPES.find(t => t.id === goldType)?.label || 'Altın') : currency} =
                                    </span>
                                    <input
                                        type="number"
                                        value={manualRate}
                                        onChange={(e) => setManualRate(e.target.value)}
                                        step="0.01"
                                        className="flex-1 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none focus:ring-1 focus:ring-orange-500"
                                        placeholder="Örn: 34.50"
                                    />
                                    <span className="text-sm text-text-secondary">TRY</span>
                                </div>
                            )}
                        </div>
                    )}

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
