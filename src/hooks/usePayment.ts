/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { makePayment } from '../services/db';
import { useAuth } from './useAuth';

export const usePayment = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pay = async (debtId: string, amount: number, note?: string) => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            await makePayment(debtId, amount, user.uid, note);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { pay, loading, error };
};
