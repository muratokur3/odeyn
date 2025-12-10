import { useState, useEffect } from 'react';
import type { Debt } from '../types';
import { subscribeToUserDebts } from '../services/db';
import { useAuth } from './useAuth';

export const useDebts = (includeDeleted = false) => {
    const { user } = useAuth();
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setDebts([]);
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToUserDebts(user.uid, (data) => {
            if (includeDeleted) {
                setDebts(data.filter(d => d.isDeleted));
            } else {
                setDebts(data.filter(d => !d.isDeleted));
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid, includeDeleted]);

    return { debts, loading };
};
