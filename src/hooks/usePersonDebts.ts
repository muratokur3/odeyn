import { useMemo } from 'react';
import { useDebts } from './useDebts';
import { useAuth } from './useAuth';
import { cleanPhone } from '../utils/phoneUtils';

/**
 * Custom hook to get all debts related to a specific person
 * Filters out LEDGER type debts and applies visibility rules
 */
export const usePersonDebts = (personId: string, resolvedUid?: string | null) => {
    const { allDebts: debts } = useDebts();
    const { user } = useAuth();

    const personDebts = useMemo(() => {
        if (!debts || !personId || !user) return [];
        
        const cleanId = cleanPhone(personId);

        return debts.filter(d => {
            // Exclude LEDGER debts (they're in cari hesap)
            if (d.type === 'LEDGER') return false;

            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const cleanOtherId = cleanPhone(otherId);

            // Check if debt is related to this person
            const isMatch = 
                otherId === personId ||
                cleanOtherId === cleanId ||
                d.participants.includes(personId) ||
                (d.lockedPhoneNumber && d.lockedPhoneNumber === cleanId) ||
                (resolvedUid && otherId === resolvedUid);

            if (!isMatch) return false;

            // Visibility rules
            const amICreator = d.createdBy === user.uid;
            if (amICreator) return true; // Creator always sees it
            
            // Hide rejected/auto-hidden if I'm not creator
            if (d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') {
                return false;
            }
            
            return true;
        }).sort((a, b) => {
            // Sort by creation date descending (newest first)
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [debts, personId, user, resolvedUid]);

    // Separate into active and history
    const activeDebts = useMemo(() => {
        return personDebts.filter(d => 
            d.status === 'ACTIVE' || 
            d.status === 'PENDING'
        );
    }, [personDebts]);

    const historyDebts = useMemo(() => {
        return personDebts.filter(d => 
            d.status === 'PAID' || 
            d.status === 'ARCHIVED' ||
            d.status === 'REJECTED'
        );
    }, [personDebts]);

    return {
        allDebts: personDebts,
        activeDebts,
        historyDebts,
        totalCount: personDebts.length,
        activeCount: activeDebts.length
    };
};
