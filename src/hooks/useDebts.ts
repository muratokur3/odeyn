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
                const isPending = d.status === 'PENDING'; // Legacy
                const isRejected = d.status === 'REJECTED'; // Legacy
                const isPaid = d.status === 'PAID';

                // New Statuses
                const isRejectedByReceiver = d.status === 'REJECTED_BY_RECEIVER';
                const isAutoHidden = d.status === 'AUTO_HIDDEN';
                const isActive = d.status === 'ACTIVE';

                if (isPaid) return false;     // Paid currently hidden from main list per request

                if (isCreator) {
                    // CREATOR VIEW (Receivables):
                    // Shows: ACTIVE, REJECTED_BY_RECEIVER, AUTO_HIDDEN.
                    // Also Legacy: PENDING, REJECTED, APPROVED.
                    return isActive || isRejectedByReceiver || isAutoHidden || isPending || isRejected || d.status === 'APPROVED';
                } else {
                    // RECEIVER VIEW (Payables):
                    // Shows: ACTIVE ONLY (and Legacy APPROVED).
                    // EXPLICITLY EXCLUDE: REJECTED_BY_RECEIVER, AUTO_HIDDEN.
                    // Legacy PENDING is supposedly gone/auto-active, but if exists, prompt says "No Confirmation", so maybe hide or show? 
                    // Prompt "Calculate My Payables ... status == 'ACTIVE'".
                    // Let's stick to ACTIVE and APPROVED (Legacy Active). Also PENDING to match calculations.
                    return isActive || d.status === 'APPROVED' || isPending;
                }
            });
            setDashboardDebts(mainList);

            // Filter for Incoming Requests (Legacy Support Only)
            const requests = processed.filter(d => {
                const isCreator = d.createdBy === user.uid;
                // Only retain this for legacy PENDING items if any
                return !isCreator && d.status === 'PENDING';
            });
            setIncomingRequests(requests);

            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid, includeDeleted]);

    return { allDebts, dashboardDebts, incomingRequests, loading };
};
