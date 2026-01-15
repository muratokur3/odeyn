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
export type CurrencySummary = {
    net: number;
    receivables: number;
    payables: number;
};

export type DetailedBalances = Map<string, CurrencySummary>;

export const calculateStreamBalance = (
    transactions: Transaction[],
    currentUserId: string
): DetailedBalances => {
    const balances = new Map<string, CurrencySummary>();
    
    transactions.forEach(tx => {
        const currency = tx.currency || 'TRY';
        if (!balances.has(currency)) {
            balances.set(currency, { net: 0, receivables: 0, payables: 0 });
        }
        
        const summary = balances.get(currency)!;
        let change = 0;

        if (tx.createdBy === currentUserId) {
            if (tx.direction === 'OUTGOING') {
                change = tx.amount;
                summary.receivables += tx.amount;
            } else {
                change = -tx.amount;
                summary.payables += tx.amount;
            }
        } else {
            if (tx.direction === 'OUTGOING') {
                change = -tx.amount;
                summary.payables += tx.amount;
            } else {
                change = tx.amount;
                summary.receivables += tx.amount;
            }
        }

        summary.net += change;
    });
    
    return balances;
};

/**
 * Calculate balance from debts (special/files)
 * Positive = they owe me, Negative = I owe them
 */
export const calculateDebtsBalance = (
    debts: Debt[],
    currentUserId: string
): DetailedBalances => {
    const balances = new Map<string, CurrencySummary>();
    
    debts.forEach(debt => {
        // Skip completed or rejected debts
        if (debt.status === 'PAID' || debt.status === 'REJECTED' || debt.status === 'ARCHIVED' || debt.status === 'REJECTED_BY_RECEIVER' || debt.status === 'AUTO_HIDDEN') {
            return;
        }
        
        const currency = debt.currency || 'TRY';
        if (!balances.has(currency)) {
            balances.set(currency, { net: 0, receivables: 0, payables: 0 });
        }
        
        const summary = balances.get(currency)!;
        
        if (debt.lenderId === currentUserId) {
            // I'm the lender, they owe me
            summary.receivables += debt.remainingAmount;
            summary.net += debt.remainingAmount;
        } else {
            // I'm the borrower, I owe them
            summary.payables += debt.remainingAmount;
            summary.net -= debt.remainingAmount;
        }
    });
    
    return balances;
};

/**
 * Merge two detailed currency balance maps
 */
export const mergeBalances = (
    balance1: DetailedBalances,
    balance2: DetailedBalances
): DetailedBalances => {
    const merged = new Map<string, CurrencySummary>();
    
    // Copy first map
    balance1.forEach((summary, currency) => {
        merged.set(currency, { ...summary });
    });
    
    // Add second map
    balance2.forEach((summary, currency) => {
        if (!merged.has(currency)) {
            merged.set(currency, { ...summary });
        } else {
            const existing = merged.get(currency)!;
            existing.net += summary.net;
            existing.receivables += summary.receivables;
            existing.payables += summary.payables;
        }
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
