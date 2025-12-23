/**
 * Balance Aggregator Utility
 * Calculates multi-currency balances from transactions and debts
 */

import type { Transaction, Debt } from '../types';

export type CurrencyBalances = Map<string, number>;

/**
 * Currency symbols map
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CHF: '₣',
    AUD: 'A$',
    CAD: 'C$',
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (currency: string): string => {
    return CURRENCY_SYMBOLS[currency] || currency;
};

/**
 * Calculate balance from transactions
 * From current user's perspective:
 * - OUTGOING = I gave money (they owe me) = positive
 * - INCOMING = I received money (I owe them) = negative
 * 
 * For other party's entries (reverse perspective)
 */
export const calculateStreamBalance = (
    transactions: Transaction[],
    currentUserId: string
): CurrencyBalances => {
    const balances = new Map<string, number>();
    
    // All stream transactions are in TRY for now
    let tryBalance = 0;
    
    transactions.forEach(tx => {
        if (tx.createdBy === currentUserId) {
            // I created this entry
            if (tx.direction === 'OUTGOING') {
                tryBalance += tx.amount; // I gave, they owe me
            } else {
                tryBalance -= tx.amount; // I took, I owe them
            }
        } else {
            // They created this entry (reverse my perspective)
            if (tx.direction === 'OUTGOING') {
                tryBalance -= tx.amount; // They gave me, I owe them
            } else {
                tryBalance += tx.amount; // They took from me, they owe me
            }
        }
    });
    
    if (tryBalance !== 0) {
        balances.set('TRY', tryBalance);
    }
    
    return balances;
};

/**
 * Calculate balance from debts (special/files)
 * Positive = they owe me, Negative = I owe them
 */
export const calculateDebtsBalance = (
    debts: Debt[],
    currentUserId: string
): CurrencyBalances => {
    const balances = new Map<string, number>();
    
    debts.forEach(debt => {
        // Skip completed or rejected debts
        if (debt.status === 'PAID' || debt.status === 'REJECTED' || debt.status === 'ARCHIVED') {
            return;
        }
        
        const currency = debt.currency || 'TRY';
        const currentBalance = balances.get(currency) || 0;
        
        if (debt.lenderId === currentUserId) {
            // I'm the lender, they owe me
            balances.set(currency, currentBalance + debt.remainingAmount);
        } else {
            // I'm the borrower, I owe them
            balances.set(currency, currentBalance - debt.remainingAmount);
        }
    });
    
    return balances;
};

/**
 * Merge two currency balance maps
 */
export const mergeBalances = (
    balance1: CurrencyBalances,
    balance2: CurrencyBalances
): CurrencyBalances => {
    const merged = new Map<string, number>(balance1);
    
    balance2.forEach((amount, currency) => {
        const existing = merged.get(currency) || 0;
        merged.set(currency, existing + amount);
    });
    
    return merged;
};

/**
 * Format currency amount for display
 * Uses proper locale formatting
 */
export const formatCurrencyAmount = (
    amount: number,
    currency: string,
    showSign: boolean = true
): string => {
    const absAmount = Math.abs(amount);
    const symbol = getCurrencySymbol(currency);
    
    // Format with Turkish locale for thousands separator
    const formattedNumber = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(absAmount);
    
    if (showSign && amount !== 0) {
        const sign = amount > 0 ? '+' : '-';
        return `${symbol} ${sign}${formattedNumber}`;
    }
    
    return `${symbol} ${formattedNumber}`;
};

/**
 * Get balance status (positive, negative, zero)
 */
export type BalanceStatus = 'positive' | 'negative' | 'zero';

export const getBalanceStatus = (amount: number): BalanceStatus => {
    if (amount > 0) return 'positive';
    if (amount < 0) return 'negative';
    return 'zero';
};
