import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useLedger } from './useLedger';
import { calculateLedgerBalance } from '../services/transactionService';
import type { Debt } from '../types';

interface PersonBalanceResult {
    totalAmount: number;
    currency: string;
    direction: 'receivable' | 'payable' | 'neutral';
    debtsAmount: number;  // From regular debts
    ledgerAmount: number; // From ledger transactions
}

/**
 * Custom hook to calculate total balance with a person
 * Combines regular debts + ledger transactions
 */
export const usePersonBalance = (
    personId: string,
    personName: string,
    debts: Debt[]
) => {
    const { user } = useAuth();
    const { transactions } = useLedger(
        user?.uid,
        user?.displayName,
        personId,
        personName
    );

    const balance = useMemo<PersonBalanceResult>(() => {
        if (!user) {
            return {
                totalAmount: 0,
                currency: 'TRY',
                direction: 'neutral',
                debtsAmount: 0,
                ledgerAmount: 0
            };
        }

        // Calculate regular debts balance
        let debtsBalance = 0;
        debts.forEach(debt => {
            if (debt.currency !== 'TRY') return; // For now, only TRY
            
            const isLender = debt.lenderId === user.uid;
            const amount = debt.remainingAmount || 0;
            
            if (isLender) {
                debtsBalance += amount; // They owe me
            } else {
                debtsBalance -= amount; // I owe them
            }
        });

        // Calculate ledger balance
        const ledgerBalance = calculateLedgerBalance(transactions, user.uid);

        // Total
        const total = debtsBalance + ledgerBalance;

        return {
            totalAmount: total,
            currency: 'TRY',
            direction: total > 0 ? 'receivable' : total < 0 ? 'payable' : 'neutral',
            debtsAmount: debtsBalance,
            ledgerAmount: ledgerBalance
        };
    }, [user, debts, transactions]);

    return balance;
};
