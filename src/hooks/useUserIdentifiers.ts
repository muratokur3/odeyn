import { useMemo } from 'react';
import { useAuth } from './useAuth';

export const useUserIdentifiers = () => {
    const { user } = useAuth();

    return useMemo(() => {
        if (!user) return { identifiers: [], isMe: () => false };

        const ids = new Set<string>();
        ids.add(user.uid);

        if (user.phoneNumber) {
            ids.add(user.phoneNumber);
            // Also add raw variation if needed (though phoneNumber is strictly E.164 now)
            const raw = user.phoneNumber.replace('+90', '0');
            ids.add(raw);
        }

        const identifierArray = Array.from(ids);
        console.log(`[useUserIdentifiers] User ${user.uid} IDs:`, identifierArray);

        return {
            identifiers: identifierArray,
            isMe: (id?: string) => {
                if (!id) return false;
                const cleanId = id.startsWith('phone:') ? id.replace('phone:', '') : id;
                return ids.has(cleanId) || ids.has(id);
            }
        };
    }, [user]);
};
