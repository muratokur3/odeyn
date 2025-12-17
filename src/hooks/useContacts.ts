import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getContacts, syncContactsWithSystem } from '../services/db';
import type { Contact } from '../types';

export const useContacts = () => {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load & Sync
    useEffect(() => {
        if (user) {
            loadContacts();

            // Trigger background sync to link contacts with system users
            // We do this silently in the background
            syncContactsWithSystem(user.uid).then(() => {
                // Optional: reload if changes detected, but simpler to just reload on next visit or manual refresh
                // or we could reload silently:
                // loadContacts();
            });
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
