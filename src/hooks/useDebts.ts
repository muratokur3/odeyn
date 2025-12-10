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
            setIncomingRequests([]);
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToUserDebts(user.uid, (data) => {
            let processed = data;
            if (!includeDeleted) {
                processed = data.filter(d => !d.isDeleted);
            }

            setAllDebts(processed);

            // Filter for Dashboard Main List
            const mainList = processed.filter(d => {
                const isCreator = d.createdBy === user.uid;
                const isPending = d.status === 'PENDING';
                const isRejected = d.status === 'REJECTED';
                const isPaid = d.status === 'PAID';

                if (isRejected) return false; // Rejected never shows
                if (isPaid) return false;     // Paid currently hidden from main list per request

                if (isCreator) {
                    return true; // Creator sees all (Pending & Active)
                } else {
                    // Receiver
                    if (isPending) return false; // Pending -> Incoming Requests
                    return true; // Active shows
                }
            });
            setDashboardDebts(mainList);

            // Filter for Incoming Requests
            const requests = processed.filter(d => {
                const isCreator = d.createdBy === user.uid;
                // Only if I am NOT creator and it is PENDING
                return !isCreator && d.status === 'PENDING';
            });
            setIncomingRequests(requests);

            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid, includeDeleted]);

    return { allDebts, dashboardDebts, incomingRequests, loading };
};
