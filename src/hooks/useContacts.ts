import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getContacts } from '../services/db';
import type { Contact } from '../types';

export const useContacts = () => {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadContacts();
        } else {
            setContacts([]);
            setLoading(false);
        }
    }, [user?.uid]);

    const loadContacts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getContacts(user.uid);
            setContacts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isContact = (identifier: string) => {
        // Identifier can be UID or Phone
        // Check if any contact has this phone or linkedUserId
        return contacts.some(c => c.phoneNumber === identifier || c.linkedUserId === identifier);
    };

    return { contacts, loading, refreshContacts: loadContacts, isContact };
};
