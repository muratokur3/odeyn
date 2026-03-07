import { useState, useEffect } from 'react';
import type { Debt } from '../types';
import { subscribeToUserDebts } from '../services/db';
import { useAuth } from './useAuth';
import { useUserIdentifiers } from './useUserIdentifiers';

export const useDebts = () => {
    const { user, blockedUsers, blockedUsersLoading } = useAuth();
    const { identifiers } = useUserIdentifiers();
    const [dashboardDebts, setDashboardDebts] = useState<Debt[]>([]);
    const [allDebts, setAllDebts] = useState<Debt[]>([]);
    const [ledgerDebts, setLedgerDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || identifiers.length === 0 || blockedUsersLoading) {
            setTimeout(() => {
                setDashboardDebts([]);
                setAllDebts([]);
                setLedgerDebts([]);
                setLoading(false);
            }, 0);
            return;
        }

        const unsubscribe = subscribeToUserDebts(identifiers, (data: Debt[]) => {
            // Filter out debts involving blocked users completely on the read side for EVERYWHERE
            const blockedUids = new Set((blockedUsers || []).map(b => b.blockedUid));
            const activeUnblockedData = data.filter(d => !blockedUids.has(d.lenderId) && !blockedUids.has(d.borrowerId));

            // Set allDebts to only unblocked data so their history is 0.
            setAllDebts(activeUnblockedData);

            // Expose active LEDGER debts for useLedgerSummary
            setLedgerDebts(
                activeUnblockedData.filter(d => d.type === 'LEDGER' && d.status === 'ACTIVE')
            );

            // Filter for Dashboard Main List (active, pending, etc.)
            const mainList = activeUnblockedData.filter(d => {
                const isPaid = d.status === 'PAID';
                if (isPaid) return false;

                // Treat PENDING as ACTIVE for visibility
                const isVisibleStatus =
                    d.status === 'ACTIVE' ||
                    d.status === 'PENDING' ||
                    d.status === 'REJECTED_BY_RECEIVER' ||
                    d.status === 'AUTO_HIDDEN';

                return isVisibleStatus;
            });
            setDashboardDebts(mainList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, identifiers, blockedUsers, blockedUsersLoading]);

    return { dashboardDebts, allDebts, ledgerDebts, loading };
};
