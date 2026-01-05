/**
 * UserBalanceHeader Component
 * Multi-currency balance display with toggle for special debts
 */

import { useState, useMemo } from 'react';
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { CurrencyChips } from './CurrencyChips';
import { 
    calculateStreamBalance, 
    calculateDebtsBalance, 
    mergeBalances,
    formatCurrencyAmount,
    getCurrencySymbol,
    type CurrencyBalances 
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
        const entries = Array.from(debtsBalance.entries()).filter(([_, amount]) => amount !== 0);
        if (entries.length === 0) return null;
        
        // Show first currency preview
        const [currency, amount] = entries[0];
        const sign = amount > 0 ? '+' : '';
        return `${sign}${getCurrencySymbol(currency)}${Math.abs(amount).toLocaleString('tr-TR')}`;
    }, [debtsBalance]);

    const hasSpecialDebts = specialDebts.length > 0;
    const displayBalance = showTotalBalance ? totalBalance : streamBalance;

    return (
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border space-y-4">
            {/* Balance Display */}
            <div className="text-center">
                <p className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
                    {showTotalBalance ? 'Toplam Bakiye' : 'Akış Bakiyesi'}
                </p>
                <CurrencyChips balances={displayBalance} size="lg" />
            </div>

            {/* Toggle for Special Debts */}
            {hasSpecialDebts && (
                <button
                    onClick={() => setShowTotalBalance(!showTotalBalance)}
                    className={clsx(
                        "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all",
                        showTotalBalance
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800"
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

            {/* Breakdown (when toggled) */}
            {showTotalBalance && (
                <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Akış</span>
                        <CurrencyChips balances={streamBalance} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary flex items-center gap-1">
                            <FolderOpen size={12} />
                            Özel Borçlar
                        </span>
                        <CurrencyChips balances={debtsBalance} size="sm" />
                    </div>
                </div>
            )}
        </div>
    );
};
