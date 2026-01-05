/**
 * useLedger Hook
 * Subscribe to a shared LEDGER debt and its transactions between two users
 */

import { useState, useEffect, useCallback } from 'react';
import { 
    getOrCreateLedger, 
    subscribeLedger, 
    subscribeLedgerTransactions, 
    calculateLedgerBalance,
    findActiveLedger 
} from '../services/transactionService';
import type { Transaction, Debt } from '../types';

interface UseLedgerResult {
    ledger: Debt | null;
    ledgerId: string | null;
    transactions: Transaction[];
    loading: boolean;
    balance: number; // From current user's perspective
    createLedger: () => Promise<void>;
}

export const useLedger = (
    userId: string | undefined,
    userName: string | undefined,
    otherPartyId: string | undefined,
    otherPartyName: string | undefined
): UseLedgerResult => {
    const [ledger, setLedger] = useState<Debt | null>(null);
    const [ledgerId, setLedgerId] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Find existing ledger on mount
    useEffect(() => {
        if (!userId || !otherPartyId) {
            setLedger(null);
            setLedgerId(null);
            setTransactions([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const findLedger = async () => {
            try {
                const existingLedger = await findActiveLedger(userId, otherPartyId);
                if (isMounted) {
                    if (existingLedger) {
                        setLedger(existingLedger);
                        setLedgerId(existingLedger.id);
                    } else {
                        setLedger(null);
                        setLedgerId(null);
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error finding ledger:', error);
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        findLedger();

        return () => {
            isMounted = false;
        };
    }, [userId, otherPartyId]);

    // Subscribe to ledger document
    useEffect(() => {
        if (!ledgerId) return;

        const unsubscribe = subscribeLedger(ledgerId, (updatedLedger) => {
            setLedger(updatedLedger);
        });

        return () => unsubscribe();
    }, [ledgerId]);

    // Subscribe to transactions
    useEffect(() => {
        if (!ledgerId) {
            setTransactions([]);
            return;
        }

        const unsubscribe = subscribeLedgerTransactions(ledgerId, (txs) => {
            setTransactions(txs);
        });

        return () => unsubscribe();
    }, [ledgerId]);

    // Create ledger callback
    const createLedger = useCallback(async () => {
        if (!userId || !userName || !otherPartyId || !otherPartyName) return;

        setLoading(true);
        try {
            const newLedgerId = await getOrCreateLedger(
                userId,
                userName,
                otherPartyId,
                otherPartyName
            );
            setLedgerId(newLedgerId);
        } catch (error) {
            console.error('Error creating ledger:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, userName, otherPartyId, otherPartyName]);

    // Calculate balance from current user's perspective
    const balance = userId ? calculateLedgerBalance(transactions, userId) : 0;

    return { 
        ledger, 
        ledgerId, 
        transactions, 
        loading, 
        balance,
        createLedger 
    };
};
