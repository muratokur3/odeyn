import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { Timestamp, deleteField } from 'firebase/firestore';
import { useModal } from '../context/ModalContext';
import { formatAmountToWords, safeParseFloat, CURRENCIES } from '../utils/format';
import { AmountInput } from './AmountInput';
import type { Debt, GoldDetail } from '../types';
import { GOLD_TYPES, GOLD_CATEGORIES, SILVER_CATEGORIES, BILEZIK_MODELS, TAKI_TYPES, GOLD_CARATS, getGoldType } from '../utils/goldConstants';
import clsx from 'clsx';
import { Toggle } from './Toggle';
import { MetalSelectionFields } from './MetalSelectionFields';

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
    const [goldCategory, setGoldCategory] = useState<string>('GRAM');
    const [goldTypeId, setGoldTypeId] = useState<string>('GRAM_24');
    const [goldSubType, setGoldSubType] = useState<string>('');
    const [goldWeightPerUnit, setGoldWeightPerUnit] = useState<string>('');
    const [goldCustomCarat, setGoldCustomCarat] = useState<number>(22);

    // Sync Metal Type ID
    useEffect(() => {
        if (currency === 'GOLD' && (goldCategory === 'BILEZIK' || goldCategory === 'TAKI')) {
            const model = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType);
            const effectiveCarat = model?.fixedCarat || goldCustomCarat;
            const targetType = `${goldCategory}_${effectiveCarat}`;
            if (GOLD_TYPES.some(t => t.id === targetType)) {
                setGoldTypeId(targetType);
            } else {
                setGoldTypeId(`${goldCategory}_22`); // Fallback
            }
        } else if (currency === 'SILVER') {
            if (goldCategory === 'SILVER') {
                if (!goldTypeId.startsWith('SILVER_')) {
                    setGoldTypeId('SILVER_999');
                }
            }
        }
    }, [currency, goldCategory, goldSubType, goldCustomCarat, goldTypeId]);

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
                const type = getGoldType(debt.goldDetail.type);
                if (type) setGoldCategory(type.category);
                setGoldTypeId(debt.goldDetail.type);
                setGoldSubType(debt.goldDetail.subTypeLabel || '');
                setGoldWeightPerUnit(debt.goldDetail.weightPerUnit?.toString() || '');
                setGoldCustomCarat(debt.goldDetail.carat || 22);
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

            const customRate = useManualRate ? safeParseFloat(manualRate) : undefined;
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
                const numAmount = safeParseFloat(amount);
                if (numAmount !== undefined && numAmount > 0) {
                    updates.originalAmount = numAmount;
                    updates.remainingAmount = numAmount; // Reset remaining if no payments
                    updates.currency = currency;

                    if (currency === 'GOLD' || currency === 'SILVER') {
                        const typeData = getGoldType(goldTypeId);
                        const selectedModel = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType);

                        updates.goldDetail = {
                            type: goldTypeId,
                            label: typeData?.label || goldTypeId,
                            subTypeLabel: goldSubType || undefined,
                            carat: selectedModel?.fixedCarat || (typeData?.fixedCarat ? typeData.defaultCarat : goldCustomCarat),
                            weightPerUnit: safeParseFloat(goldWeightPerUnit),
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
                        <div className="flex items-start gap-4 w-full">
                            <div className="flex-[2] min-w-0">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Döviz</label>
                                <select
                                    value={currency}
                                    onChange={(e) => {
                                        const newCurr = e.target.value;
                                        setCurrency(newCurr);
                                        if (newCurr === 'SILVER') {
                                            setGoldCategory('SILVER');
                                            setGoldTypeId('SILVER_999');
                                        } else if (newCurr === 'GOLD') {
                                            setGoldCategory('GRAM');
                                            setGoldTypeId('GRAM_24');
                                        }
                                    }}
                                    disabled={hasPayments}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed h-[46px]"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-[3] min-w-0">
                                <AmountInput
                                    label={currency === 'GOLD' ? (getGoldType(goldTypeId)?.category === 'GRAM' ? 'Gram' : 'Adet') : 'Tutar'}
                                    value={amount}
                                    onChange={setAmount}
                                    disabled={hasPayments}
                                    required
                                    allowDecimals={currency === 'SILVER' || (currency === 'GOLD' && getGoldType(goldTypeId)?.category === 'GRAM')}
                                    hideCommaSuffix={currency === 'GOLD' && getGoldType(goldTypeId)?.category !== 'GRAM'}
                                />
                            </div>
                        </div>
                        {amount && (
                            <p className="text-[10px] text-text-secondary italic text-left animate-in fade-in slide-in-from-top-1 px-1 mt-0.5">
                                {formatAmountToWords(amount, currency, (currency === 'GOLD' || currency === 'SILVER') ? {
                                    type: goldTypeId,
                                    label: getGoldType(goldTypeId)?.label || '',
                                    subTypeLabel: goldSubType,
                                    weightPerUnit: safeParseFloat(goldWeightPerUnit),
                                    carat: (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType)?.fixedCarat || (getGoldType(goldTypeId)?.fixedCarat ? getGoldType(goldTypeId)?.defaultCarat : goldCustomCarat)
                                } : undefined)}
                            </p>
                        )}

                        {/* Metal Sub-selection */}
                        {(currency === 'GOLD' || currency === 'SILVER') && !hasPayments && (
                             <MetalSelectionFields
                                metal={currency as 'GOLD' | 'SILVER'}
                                goldCategory={goldCategory}
                                setGoldCategory={setGoldCategory}
                                goldTypeId={goldTypeId}
                                setGoldTypeId={setGoldTypeId}
                                goldSubType={goldSubType}
                                setGoldSubType={setGoldSubType}
                                goldWeightPerUnit={goldWeightPerUnit}
                                setGoldWeightPerUnit={setGoldWeightPerUnit}
                                goldCustomCarat={goldCustomCarat}
                                setGoldCustomCarat={setGoldCustomCarat}
                            />
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
                                            1 {(currency === 'GOLD' || currency === 'SILVER') ? (getGoldType(goldTypeId)?.label || (currency === 'GOLD' ? 'Altın' : 'Gümüş')) : currency} =
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
