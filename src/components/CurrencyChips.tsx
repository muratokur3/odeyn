/**
 * CurrencyChips Component
 * Displays multi-currency balances as horizontal scrolling chips
 */

import clsx from 'clsx';
import { formatCurrencyAmount, getBalanceStatus, type CurrencyBalances } from '../utils/balanceAggregator';

interface CurrencyChipsProps {
    balances: CurrencyBalances;
    size?: 'sm' | 'md' | 'lg';
}

export const CurrencyChips: React.FC<CurrencyChipsProps> = ({
    balances,
    size = 'md'
}) => {
    // Convert Map to array and sort by currency code
    const entries = Array.from(balances.entries())
        .filter(([_, amount]) => amount !== 0) // Only show non-zero
        .sort((a, b) => a[0].localeCompare(b[0]));

    if (entries.length === 0) {
        return (
            <div className={clsx(
                "text-text-secondary",
                size === 'lg' ? "text-2xl" : size === 'md' ? "text-xl" : "text-base"
            )}>
                Hesap Denk
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            {entries.map(([currency, amount]) => {
                const status = getBalanceStatus(amount);
                
                return (
                    <div
                        key={currency}
                        className={clsx(
                            "px-3 py-1.5 rounded-full font-bold transition-all",
                            size === 'lg' ? "text-xl px-4 py-2" : size === 'md' ? "text-lg" : "text-sm",
                            status === 'positive' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            status === 'negative' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                            status === 'zero' && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        )}
                    >
                        {formatCurrencyAmount(amount, currency, true)}
                    </div>
                );
            })}
        </div>
    );
};
