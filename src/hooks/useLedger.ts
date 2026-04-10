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
    findActiveLedger,
    getLedgerTransactionsPage
} from '../services/transactionService';
import type { Transaction, Debt } from '../types';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuthContext } from '../context/AuthContext';

interface UseLedgerResult {
    ledger: Debt | null;
    ledgerId: string | null;
    transactions: Transaction[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    balance: number;
    createLedger: () => Promise<void>;
    loadMore: () => Promise<void>;
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
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const { blockedUsers } = useAuthContext();
    const [loadingMore, setLoadingMore] = useState(false);

    const isBlocked = blockedUsers?.some(b => b.blockedUid === otherPartyId);

    const PAGE_SIZE = 20;

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
                    if (existingLedger && !isBlocked) {
                        setLedger(existingLedger);
                        setLedgerId(existingLedger.id);
                    } else {
                        setLedger(null);
                        setLedgerId(null);
                    }
                }
            } catch (error) {
                console.error('Error finding ledger:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        findLedger();

        return () => { isMounted = false; };
    }, [userId, otherPartyId, isBlocked]);

    // Subscribe to ledger document
    useEffect(() => {
        if (!ledgerId || isBlocked) return;
        const unsubscribe = subscribeLedger(ledgerId, (updatedLedger) => setLedger(updatedLedger));
        return () => unsubscribe();
    }, [ledgerId, isBlocked]);

    // REAL-TIME: Subscribe to FIRST PAGE of transactions
    useEffect(() => {
        if (!ledgerId || isBlocked) {
            setTransactions([]);
            return;
        }

        // We listen to the first page only to keep it real-time at the top
        // NOTE: We'd need to update subcribeLedgerTransactions to return snippets or use getDocs for snapshots
        // For now, let's just use the list growth approach. 
        const unsubscribe = subscribeLedgerTransactions(ledgerId, (txs) => {
            setTransactions(prev => {
                if (prev.length <= PAGE_SIZE) return txs;

                const txIds = new Set(txs.map(t => t.id));
                const tail = prev.filter(t => !txIds.has(t.id));
                const combined = [...txs, ...tail];
                return combined.sort((a,b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
                    return timeB - timeA;
                });
            });
            setLoading(false);
        }, PAGE_SIZE);

        return () => unsubscribe();
    }, [ledgerId, isBlocked]);

    // Load More Callback
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !ledgerId || transactions.length < PAGE_SIZE || isBlocked) return;

        setLoadingMore(true);
        try {
            // We need the ACTUAL snapshot of the last transaction to use startAfter
            // Since onSnapshot doesn't easily expose it here without architectural changes,
            // we'll fetch the last doc's snapshot manually ONCE or find it.
            
            let cursor = lastDoc;
            if (!cursor) {
                // If we don't have a snapshot, we fetch the first PAGE to get the cursor for the tail
                const { lastVisible } = await getLedgerTransactionsPage(ledgerId, null, PAGE_SIZE);
                cursor = lastVisible;
            }

            if (!cursor) {
                setHasMore(false);
                return;
            }

            const { transactions: moreTxs, lastVisible } = await getLedgerTransactionsPage(ledgerId, cursor, PAGE_SIZE);
            
            if (moreTxs.length < PAGE_SIZE) setHasMore(false);
            setLastDoc(lastVisible);

            if (moreTxs.length > 0) {
                setTransactions(prev => {
                    const txIds = new Set(prev.map(p => p.id));
                    const newUnique = moreTxs.filter((m: Transaction) => !txIds.has(m.id));
                    return [...prev, ...newUnique];
                });
            }
        } catch (error) {
            console.error('Error loading more transactions:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [ledgerId, transactions, loadingMore, hasMore, lastDoc, isBlocked]);

    // Create ledger callback
    const createLedger = useCallback(async () => {
        if (!userId || !userName || !otherPartyId || !otherPartyName) return;
        setLoading(true);
        try {
            const newLedgerId = await getOrCreateLedger(userId, userName, otherPartyId, otherPartyName);
            setLedgerId(newLedgerId);
        } catch (error) {
            console.error('Error creating ledger:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, userName, otherPartyId, otherPartyName]);

    // Calculate balance from client-side transactions
    const balance = userId ? calculateLedgerBalance(transactions, userId) : 0;

    // Balance sanity check: compare server balance with client calculation
    // Only meaningful when all transactions are loaded (no pagination pending)
    useEffect(() => {
        if (ledger && ledgerId && !hasMore && transactions.length > 0) {
            const serverBalance = ledger.remainingAmount || 0;
            // Calculate from lender's perspective (same as updateLedgerBalance on server)
            const lenderId = ledger.lenderId;
            let recalcBalance = 0;
            transactions.forEach(tx => {
                if (tx.createdBy === lenderId) {
                    recalcBalance += tx.direction === 'OUTGOING' ? tx.amount : -tx.amount;
                } else {
                    recalcBalance += tx.direction === 'OUTGOING' ? -tx.amount : tx.amount;
                }
            });

            if (Math.abs(serverBalance - recalcBalance) > 0.01) {
                console.warn(
                    `[useLedger] Balance mismatch detected! Server: ${serverBalance}, Recalculated: ${recalcBalance}, Ledger: ${ledgerId}`
                );
            }
        }
    }, [ledger, ledgerId, hasMore, transactions]);

    return {
        ledger,
        ledgerId,
        transactions,
        loading,
        loadingMore,
        hasMore,
        balance,
        createLedger,
        loadMore
    };
};
