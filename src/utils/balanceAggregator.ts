/**
 * Balance Aggregator Utility
 * Calculates multi-currency balances from transactions and debts
 */

import type { Transaction, Debt } from '../types';
import { formatCurrency } from './format';
import { calculatePureMetalWeight } from './goldConstants';
import { convertToTRY, type CurrencyRates } from '../services/currency';

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
    pureGoldNet: number;
    pureGoldReceivables: number;
    pureGoldPayables: number;
    netTRY: number;
    receivablesTRY: number;
    payablesTRY: number;
};

export type DetailedBalances = Map<string, CurrencySummary>;

export const calculateStreamBalance = (
    transactions: Transaction[],
    currentUserId: string,
    rates?: CurrencyRates | null
): DetailedBalances => {
    const balances = new Map<string, CurrencySummary>();
    
    transactions.forEach(tx => {
        let currency = tx.currency || 'TRY';
        const baseCurr = currency === 'GOLD' ? 'GOLD' : currency;

        if (currency === 'GOLD' && tx.goldDetail?.type) {
            currency = `GOLD:${tx.goldDetail.type}`;
        }
        if (!balances.has(currency)) {
            balances.set(currency, {
                net: 0, receivables: 0, payables: 0,
                pureGoldNet: 0, pureGoldReceivables: 0, pureGoldPayables: 0,
                netTRY: 0, receivablesTRY: 0, payablesTRY: 0
            });
        }
        
        const summary = balances.get(currency)!;

        const pureWeight = (currency.startsWith('GOLD') && tx.goldDetail)
            ? calculatePureMetalWeight(tx.goldDetail.type, tx.amount, tx.goldDetail.weightPerUnit)
            : 0;

        const customRates = tx.customExchangeRate ? { [baseCurr]: tx.customExchangeRate } : undefined;
        const tryVal = rates ? convertToTRY(tx.amount, baseCurr, rates, customRates, tx.goldDetail) : 0;

        if (tx.createdBy === currentUserId) {
            if (tx.direction === 'OUTGOING') {
                summary.net += tx.amount;
                summary.receivables += tx.amount;
                summary.pureGoldNet += pureWeight;
                summary.pureGoldReceivables += pureWeight;
                summary.netTRY += tryVal;
                summary.receivablesTRY += tryVal;
            } else {
                summary.net -= tx.amount;
                summary.payables += tx.amount;
                summary.pureGoldNet -= pureWeight;
                summary.pureGoldPayables += pureWeight;
                summary.netTRY -= tryVal;
                summary.payablesTRY += tryVal;
            }
        } else {
            if (tx.direction === 'OUTGOING') {
                summary.net -= tx.amount;
                summary.payables += tx.amount;
                summary.pureGoldNet -= pureWeight;
                summary.pureGoldPayables += pureWeight;
                summary.netTRY -= tryVal;
                summary.payablesTRY += tryVal;
            } else {
                summary.net += tx.amount;
                summary.receivables += tx.amount;
                summary.pureGoldNet += pureWeight;
                summary.pureGoldReceivables += pureWeight;
                summary.netTRY += tryVal;
                summary.receivablesTRY += tryVal;
            }
        }
    });
    
    return balances;
};

/**
 * Calculate balance from debts (special/files)
 * Positive = they owe me, Negative = I owe them
 */
export const calculateDebtsBalance = (
    debts: Debt[],
    currentUserId: string,
    rates?: CurrencyRates | null
): DetailedBalances => {
    const balances = new Map<string, CurrencySummary>();
    
    debts.forEach(debt => {
        // Skip completed or rejected debts
        if (debt.status === 'PAID' || debt.status === 'REJECTED' || debt.status === 'ARCHIVED' || debt.status === 'REJECTED_BY_RECEIVER' || debt.status === 'AUTO_HIDDEN') {
            return;
        }
        
        let currency = debt.currency || 'TRY';
        const baseCurr = currency === 'GOLD' ? 'GOLD' : currency;

        if (currency === 'GOLD' && debt.goldDetail?.type) {
            currency = `GOLD:${debt.goldDetail.type}`;
        }
        if (!balances.has(currency)) {
            balances.set(currency, {
                net: 0, receivables: 0, payables: 0,
                pureGoldNet: 0, pureGoldReceivables: 0, pureGoldPayables: 0,
                netTRY: 0, receivablesTRY: 0, payablesTRY: 0
            });
        }
        
        const summary = balances.get(currency)!;
        
        const pureWeight = (currency.startsWith('GOLD') && debt.goldDetail)
            ? calculatePureMetalWeight(debt.goldDetail.type, debt.remainingAmount, debt.goldDetail.weightPerUnit)
            : 0;

        const customRates = debt.customExchangeRate ? { [baseCurr]: debt.customExchangeRate } : undefined;
        const tryVal = rates ? convertToTRY(debt.remainingAmount, baseCurr, rates, customRates, debt.goldDetail) : 0;

        if (debt.lenderId === currentUserId) {
            // I'm the lender, they owe me
            summary.receivables += debt.remainingAmount;
            summary.net += debt.remainingAmount;
            summary.pureGoldReceivables += pureWeight;
            summary.pureGoldNet += pureWeight;
            summary.netTRY += tryVal;
            summary.receivablesTRY += tryVal;
        } else {
            // I'm the borrower, I owe them
            summary.payables += debt.remainingAmount;
            summary.net -= debt.remainingAmount;
            summary.pureGoldPayables += pureWeight;
            summary.pureGoldNet -= pureWeight;
            summary.netTRY -= tryVal;
            summary.payablesTRY += tryVal;
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
            existing.pureGoldNet += summary.pureGoldNet;
            existing.pureGoldReceivables += summary.pureGoldReceivables;
            existing.pureGoldPayables += summary.pureGoldPayables;
            existing.netTRY += summary.netTRY;
            existing.receivablesTRY += summary.receivablesTRY;
            existing.payablesTRY += summary.payablesTRY;
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
    const formatted = formatCurrency(Math.abs(amount), currency);
    
    if (showSign && amount !== 0) {
        const sign = amount > 0 ? '+' : '-';
        return `${sign}${formatted}`;
    }
    
    return formatted;
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
