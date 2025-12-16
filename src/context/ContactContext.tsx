import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Contact } from '../types';
import { useAuth } from '../hooks/useAuth';
import { subscribeToContacts } from '../services/db';

interface ContactContextType {
    contacts: Contact[];
    contactsMap: Record<string, Contact>;
    loading: boolean;
    refreshContacts: () => void;
    isContact: (identifier: string) => boolean;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export const ContactProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

    const isContact = (identifier: string) => {
        return contacts.some(c => c.phoneNumber === identifier || c.linkedUserId === identifier);
    };

    const refreshContacts = () => { };

    const value = {
        contacts,
        contactsMap,
        loading,
        refreshContacts,
        isContact
    };

    return (
        <ContactContext.Provider value={value}>
            {children}
        </ContactContext.Provider>
    );
};

export const useContactContext = () => {
    const context = useContext(ContactContext);
    if (context === undefined) {
        throw new Error('useContactContext must be used within a ContactProvider');
    }
    return context;
};
