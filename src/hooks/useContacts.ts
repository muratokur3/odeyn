import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { subscribeToContacts } from '../services/db';
import type { Contact } from '../types';

export const useContacts = () => {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe: () => void;
        if (user) {
            setLoading(true);
            unsubscribe = subscribeToContacts(user.uid, (data) => {
                setContacts(data);
                setLoading(false);
            });
        } else {
            setContacts([]);
            setLoading(false);
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.uid]);

    // Manual refresh is no longer needed but kept for API compatibility.
    const refreshContacts = () => { };

    const isContact = (identifier: string) => {
        // Identifier can be UID or Phone
        return contacts.some(c => c.phoneNumber === identifier || c.linkedUserId === identifier);
    };

    // Dictionary for O(1) lookup: key = E.164 Phone Number
    const contactsMap = useMemo(() => {
        const map: Record<string, Contact> = {};
        contacts.forEach(c => {
            if (c.phoneNumber) {
                map[c.phoneNumber] = c;
            }
        });
        return map;
    }, [contacts]);

    return { contacts, contactsMap, loading, refreshContacts, isContact };
};
