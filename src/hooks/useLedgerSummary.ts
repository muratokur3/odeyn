/**
 * useLedgerSummary Hook
 * Aggregates ALL ledger transactions across ALL the user's active ledgers
 * to produce per-currency balance totals for the Dashboard.
 *
 * Design:
 * - Reads the list of active LEDGER documents (from useDebts.ledgerDebts)
 * - For each ledger, one-time fetches ALL transactions from the sub-collection
 * - Re-fetches whenever the set of ledger IDs changes
 * - Returns totals keyed by currency (same shape as Dashboard's totalsByCurrency)
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Transaction, Debt } from '../types';
import { calculatePureMetalWeight } from '../utils/goldConstants';

export interface LedgerCurrencyTotal {
    receivables: number;
    payables: number;
    net: number;
    currency: string;
    pureGoldReceivables: number;
    pureGoldPayables: number;
    pureGoldNet: number;
}

export type LedgerSummaryMap = Record<string, LedgerCurrencyTotal>;

/**
 * Calculates per-currency balances from an array of transactions,
 * from the perspective of `currentUserId`.
 */
function aggregateTransactions(
    transactions: Transaction[],
    currentUserId: string
): LedgerSummaryMap {
    const totals: LedgerSummaryMap = {};

    for (const tx of transactions) {
        let currency = tx.currency || 'TRY';
        if (currency === 'GOLD' && tx.goldDetail?.type) {
            currency = `GOLD:${tx.goldDetail.type}`;
        }

        if (!totals[currency]) {
            totals[currency] = {
                receivables: 0, payables: 0, net: 0, currency,
                pureGoldReceivables: 0, pureGoldPayables: 0, pureGoldNet: 0,
            };
        }

        const t = totals[currency];
        const amount = tx.amount;

        // Altın ise pure metal ağırlığını hesapla
        const pureWeight = (currency.startsWith('GOLD') && tx.goldDetail)
            ? calculatePureMetalWeight(tx.goldDetail.type, amount, tx.goldDetail.weightPerUnit)
            : 0;

        // OUTGOING from me = I gave = receivable (they owe me)
        // INCOMING to me   = they gave = payable (I owe them)
        const iMadeThis = tx.createdBy === currentUserId;

        if (iMadeThis) {
            if (tx.direction === 'OUTGOING') {
                t.receivables += amount;
                t.net += amount;
                t.pureGoldReceivables += pureWeight;
                t.pureGoldNet += pureWeight;
            } else {
                t.payables += amount;
                t.net -= amount;
                t.pureGoldPayables += pureWeight;
                t.pureGoldNet -= pureWeight;
            }
        } else {
            if (tx.direction === 'OUTGOING') {
                t.payables += amount;
                t.net -= amount;
                t.pureGoldPayables += pureWeight;
                t.pureGoldNet -= pureWeight;
            } else {
                t.receivables += amount;
                t.net += amount;
                t.pureGoldReceivables += pureWeight;
                t.pureGoldNet += pureWeight;
            }
        }
    }

    return totals;
}

/**
 * Merge two LedgerSummaryMap objects by adding quantities.
 */
function mergeSummaries(a: LedgerSummaryMap, b: LedgerSummaryMap): LedgerSummaryMap {
    const result: LedgerSummaryMap = { ...a };
    for (const [currency, total] of Object.entries(b)) {
        if (!result[currency]) {
            result[currency] = { ...total };
        } else {
            result[currency].receivables += total.receivables;
            result[currency].payables += total.payables;
            result[currency].net += total.net;
            result[currency].pureGoldReceivables += total.pureGoldReceivables;
            result[currency].pureGoldPayables += total.pureGoldPayables;
            result[currency].pureGoldNet += total.pureGoldNet;
        }
    }
    return result;
}

export const useLedgerSummary = (
    ledgerDebts: Debt[],
    currentUserId: string | undefined
): { summary: LedgerSummaryMap; loading: boolean } => {
    const [summary, setSummary] = useState<LedgerSummaryMap>({});
    const [loading, setLoading] = useState(false);
    // Track the last set of IDs to avoid redundant fetches
    const prevIdsRef = useRef<string>('');

    useEffect(() => {
        if (!currentUserId || ledgerDebts.length === 0) {
            setSummary({});
            setLoading(false);
            return;
        }

        const ids = ledgerDebts.map(d => d.id).sort().join(',');
        if (ids === prevIdsRef.current) return; // nothing changed
        prevIdsRef.current = ids;

        let cancelled = false;
        setLoading(true);

        const fetchAll = async () => {
            try {
                const perLedgerResults = await Promise.all(
                    ledgerDebts.map(async (ledger) => {
                        const txRef = collection(db, 'debts', ledger.id, 'transactions');
                        const q = query(txRef, orderBy('createdAt', 'desc'));
                        const snap = await getDocs(q);
                        const txs: Transaction[] = snap.docs.map(d => ({
                            id: d.id,
                            ...d.data(),
                        } as Transaction));
                        return aggregateTransactions(txs, currentUserId);
                    })
                );

                if (!cancelled) {
                    const merged = perLedgerResults.reduce(mergeSummaries, {});
                    setSummary(merged);
                }
            } catch (err) {
                console.error('[useLedgerSummary] Failed to fetch ledger transactions:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchAll();
        return () => { cancelled = true; };
    }, [ledgerDebts, currentUserId]);

    return { summary, loading };
};
