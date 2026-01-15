import { useState, useEffect } from 'react';
import type { Debt } from '../types';
import { subscribeToUserDebts } from '../services/db';
import { useAuth } from './useAuth';

export const useDebts = (includeDeleted = false) => {
    const { user } = useAuth();
    const [allDebts, setAllDebts] = useState<Debt[]>([]);
    const [dashboardDebts, setDashboardDebts] = useState<Debt[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setAllDebts([]);
            setDashboardDebts([]);
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToUserDebts(user.uid, (data: Debt[]) => {
            let processed = data;
            // Removed: includeDeleted filter check (User requested trash removal)
            // But we might still need to filter isDeleted in DB query?
            // For now, let's just filter out deleted ones hardcoded.
            processed = data.filter(d => !d.isDeleted);

            setAllDebts(processed);

            // Filter for Dashboard Main List
            const mainList = processed.filter(d => {
                const isPaid = d.status === 'PAID';
                if (isPaid) return false;

                // Treat PENDING as ACTIVE for visibility since approval is removed
                const isVisibleStatus = 
                    d.status === 'ACTIVE' || 
                    d.status === 'PENDING' || 
                    d.status === 'APPROVED' || 
                    d.status === 'PARTIALLY_PAID' ||
                    d.status === 'REJECTED_BY_RECEIVER' || 
                    d.status === 'AUTO_HIDDEN';

                return isVisibleStatus;
            });
            setDashboardDebts(mainList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    return { allDebts, dashboardDebts, loading };
};
