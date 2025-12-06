import { useState, useEffect } from 'react';
import type { Debt, PaymentLog } from '../types';
import { subscribeToDebtDetails, subscribeToPaymentLogs } from '../services/db';

export const useDebtDetails = (debtId: string | undefined) => {
    const [debt, setDebt] = useState<Debt | null>(null);
    const [logs, setLogs] = useState<PaymentLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!debtId) {
            setLoading(false);
            return;
        }

        const unsubscribeDebt = subscribeToDebtDetails(debtId, (data) => {
            setDebt(data);
        });

        const unsubscribeLogs = subscribeToPaymentLogs(debtId, (data) => {
            setLogs(data);
            setLoading(false); // Assume loading is done when logs are fetched (or debt)
        });

        return () => {
            unsubscribeDebt();
            unsubscribeLogs();
        };
    }, [debtId]);

    return { debt, logs, loading };
};
