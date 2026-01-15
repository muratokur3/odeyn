/**
 * UserBalanceHeader Component
 * Multi-currency balance display with toggle for special debts
 */

import { useState, useMemo, useEffect } from 'react';
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import { 
    calculateStreamBalance, 
    calculateDebtsBalance, 
    mergeBalances,
    getCurrencySymbol
} from '../utils/balanceAggregator';
import clsx from 'clsx';
import type { Transaction, Debt } from '../types';

interface UserBalanceHeaderProps {
    transactions: Transaction[];
    specialDebts: Debt[];
    currentUserId: string;
}

export const UserBalanceHeader: React.FC<UserBalanceHeaderProps> = ({
    transactions,
    specialDebts,
    currentUserId
}) => {
    const [showTotalBalance, setShowTotalBalance] = useState(false);
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [toggledCards, setToggledCards] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    const toggleCardCurrency = (currency: string) => {
        setToggledCards(prev => ({ ...prev, [currency]: !prev[currency] }));
    };

    // Calculate stream balance (transactions only)
    const streamBalance = useMemo(() => {
        return calculateStreamBalance(transactions, currentUserId);
    }, [transactions, currentUserId]);

    // Calculate special debts balance
    const debtsBalance = useMemo(() => {
        return calculateDebtsBalance(specialDebts, currentUserId);
    }, [specialDebts, currentUserId]);

    // Calculate total balance (stream + debts)
    const totalBalance = useMemo(() => {
        return mergeBalances(streamBalance, debtsBalance);
    }, [streamBalance, debtsBalance]);

    // Get preview of debts balance for toggle button
    const debtsPreview = useMemo(() => {
        const entries = Array.from(debtsBalance.entries()).filter(([, s]) => s.net !== 0);
        if (entries.length === 0) return null;
        
        const [currency, summary] = entries[0];
        const sign = summary.net > 0 ? '+' : '';
        return `${sign}${getCurrencySymbol(currency)}${Math.abs(summary.net).toLocaleString('tr-TR')}`;
    }, [debtsBalance]);

    const hasSpecialDebts = specialDebts.length > 0;
    const displayBalance = showTotalBalance ? totalBalance : streamBalance;

    return (
        <div className="bg-surface p-4 rounded-2xl shadow-sm border border-border space-y-4">
            {/* Balance Display */}
            <div>
                <p className="text-[11px] text-text-secondary mb-2 uppercase tracking-wide font-semibold px-1">
                    {showTotalBalance ? 'Toplam Varlık (Akış + Özel)' : 'Akış Varlığı'}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide pt-1">
                    {Array.from(displayBalance.entries())
                        .sort((a, b) => (a[0] === 'TRY' ? -1 : b[0] === 'TRY' ? 1 : 0))
                        .map(([currency, balance]) => {
                            const isToggled = toggledCards[currency];
                            const net = (isToggled && rates) ? convertToTRY(balance.net, currency, rates) : balance.net;
                            const receivables = (isToggled && rates) ? convertToTRY(balance.receivables, currency, rates) : balance.receivables;
                            const payables = (isToggled && rates) ? convertToTRY(balance.payables, currency, rates) : balance.payables;

                            return (
                                <SummaryCard
                                    key={currency}
                                    title={showTotalBalance ? `Toplam (${currency})` : `Akış (${currency})`}
                                    currency={currency}
                                    net={net}
                                    receivables={receivables}
                                    payables={payables}
                                    isToggled={isToggled}
                                    onToggle={() => toggleCardCurrency(currency)}
                                    showToggle={currency !== 'TRY'}
                                    variant={balance.net >= 0 ? 'emerald' : 'rose'}
                                    className="!w-[200px]"
                                />
                            );
                        })}
                    
                    {displayBalance.size === 0 && (
                         <div className="py-8 text-center w-full text-text-tertiary italic text-sm">
                            Hesap Denk
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle for Special Debts */}
            {hasSpecialDebts && (
                <button
                    onClick={() => setShowTotalBalance(!showTotalBalance)}
                    className={clsx(
                        "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all border shadow-sm",
                        showTotalBalance
                            ? "bg-blue-600 border-blue-700 text-white shadow-blue-500/20"
                            : "bg-surface border-border text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                >
                    <FolderOpen size={16} />
                    <span>
                        {showTotalBalance 
                            ? 'Sadece Akışı Göster' 
                            : 'Özel Borçları Dahil Et'
                        }
                    </span>
                    {!showTotalBalance && debtsPreview && (
                        <span className="text-xs opacity-70">({debtsPreview})</span>
                    )}
                    {showTotalBalance ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            )}

            {/* Breakdown Section */}
            {hasSpecialDebts && showTotalBalance && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="h-px bg-border mb-4"></div>
                    <div className="space-y-6">
                        {/* Stream Layer */}
                        <div>
                             <p className="text-[10px] text-text-tertiary mb-2 uppercase tracking-widest font-bold px-1 flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                Akış Dağılımı
                             </p>
                             <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide py-1">
                                {Array.from(streamBalance.entries())
                                    .sort((a) => (a[0] === 'TRY' ? -1 : 1))
                                    .map(([currency, balance]) => (
                                        <SummaryCard
                                            key={currency}
                                            title={currency}
                                            currency={currency}
                                            net={balance.net}
                                            receivables={balance.receivables}
                                            payables={balance.payables}
                                            variant="auto"
                                            className="!w-[180px] scale-95 origin-left"
                                        />
                                    ))
                                }
                             </div>
                        </div>

                        {/* Debts Layer */}
                        <div>
                             <p className="text-[10px] text-text-tertiary mb-2 uppercase tracking-widest font-bold px-1 flex items-center gap-2">
                                <div className="w-1 h-3 bg-purple-500 rounded-full"></div>
                                Özel Borçlar Dağılımı
                             </p>
                             <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide py-1">
                                {Array.from(debtsBalance.entries())
                                    .sort((a) => (a[0] === 'TRY' ? -1 : 1))
                                    .map(([currency, balance]) => (
                                        <SummaryCard
                                            key={currency}
                                            title={currency}
                                            currency={currency}
                                            net={balance.net}
                                            receivables={balance.receivables}
                                            payables={balance.payables}
                                            variant="auto"
                                            className="!w-[180px] scale-95 origin-left"
                                        />
                                    ))
                                }
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
