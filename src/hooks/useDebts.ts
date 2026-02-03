import { useState, useEffect } from 'react';
import type { Debt } from '../types';
import { subscribeToUserDebts } from '../services/db';
import { useAuth } from './useAuth';

export const useDebts = () => {
    const { user } = useAuth();
    const [dashboardDebts, setDashboardDebts] = useState<Debt[]>([]);
    const [allDebts, setAllDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setDashboardDebts([]);
            setAllDebts([]);
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToUserDebts(user.uid, (data: Debt[]) => {
            // No soft delete - accept all debts
            const processed = data;
            setAllDebts(processed);

            // Filter for Dashboard Main List
           const mainList = processed.filter(d => {
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
    }, [user]);

    return { dashboardDebts, allDebts, loading };
};
