/**
 * useTransactions Hook
 * Subscribe to transactions (Cari Hesap) for a specific contact
 */

import { useState, useEffect } from 'react';
import { subscribeToTransactions, calculateCariBalance } from '../services/transactionService';
import type { Transaction } from '../types';

interface UseTransactionsResult {
    transactions: Transaction[];
    loading: boolean;
    cariBalance: number; // Net balance (positive = they owe me, negative = I owe them)
}

export const useTransactions = (userId: string | undefined, contactId: string | undefined): UseTransactionsResult => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId || !contactId) {
            setTransactions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToTransactions(userId, contactId, (txs) => {
            setTransactions(txs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, contactId]);

    const cariBalance = calculateCariBalance(transactions);

    return { transactions, loading, cariBalance };
};
