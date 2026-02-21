import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { standardizeRawPhone } from '../utils/phoneUtils';

export const useUserIdentifiers = () => {
    const { user } = useAuth();

    return useMemo(() => {
        if (!user) return { identifiers: [], isMe: () => false };

        const ids = new Set<string>();
        ids.add(user.uid);

        // Normalize and add all known phone numbers
        const addNormalized = (phone: string) => {
            const normalized = standardizeRawPhone(phone);
            if (normalized) ids.add(normalized);
            // Also add raw just in case
            ids.add(phone);
        };

        if (user.phoneNumbers) {
            user.phoneNumbers.forEach(addNormalized);
        }
        if (user.primaryPhoneNumber) {
            addNormalized(user.primaryPhoneNumber);
        }
        if (user.phoneNumber) {
            addNormalized(user.phoneNumber);
        }

        const identifierArray = Array.from(ids);
        console.log(`[useUserIdentifiers] User ${user.uid} IDs (Normalized):`, identifierArray);

        return {
            identifiers: identifierArray,
            isMe: (id?: string) => {
                if (!id) return false;
                const cleanId = id.startsWith('phone:') ? id.replace('phone:', '') : id;
                const normalizedId = standardizeRawPhone(cleanId);
                return ids.has(cleanId) || ids.has(normalizedId);
            }
        };
    }, [user]);
};
