import { useState } from 'react';
import { makePayment } from '../services/db';
import { useAuth } from './useAuth';
import { checkCooldown, getRemainingCooldown, COOLDOWN } from '../utils/rateLimiter';

export const usePayment = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pay = async (debtId: string, amount: number, note?: string, installmentId?: string, method?: 'CASH' | 'IBAN' | 'CREDIT_CARD' | 'OTHER') => {
        if (!user) return;

        // Rate limiting
        if (!checkCooldown('payment', COOLDOWN.PAYMENT)) {
            const remaining = getRemainingCooldown('payment', COOLDOWN.PAYMENT);
            const msg = `Lütfen ${remaining} saniye bekleyin.`;
            setError(msg);
            throw new Error(msg);
        }

        setLoading(true);
        setError(null);
        try {
            await makePayment(debtId, amount, user.uid, note, installmentId, method);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { pay, loading, error };
};
