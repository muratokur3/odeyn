import React, { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import type { Contact } from '../types';
import { cleanPhone } from '../utils/phoneUtils';
import { useModal } from '../hooks/useModal';

export interface Conflict {
    newContact: Partial<Contact>;
    existingContact: Contact;
}

interface ImportContactsButtonProps {
    onContactsSelected: (newContacts: Partial<Contact>[], conflicts: Conflict[]) => void;
    existingContacts: Contact[];
    className?: string;
}

export const ImportContactsButton: React.FC<ImportContactsButtonProps> = ({
    onContactsSelected,
    existingContacts,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSupported] = useState('contacts' in navigator && 'ContactsManager' in window);
    const { showAlert } = useModal();

    const handleImport = async () => {
        if (!isSupported) {
            showAlert(
                'Desteklenmeyen Tarayıcı',
                'Tarayıcınız bu özelliği desteklemiyor. Bu özellik sadece modern mobil tarayıcılarda (örn: Android için Chrome) çalışır ve iOS (Safari/Chrome) üzerinde desteklenmez.',
                'warning'
            );
            return;
        }

        setIsLoading(true);
        try {
            const props = ['name', 'tel'];
            const options = { multiple: true };

            // @ts-ignore
            const selectedContacts = await navigator.contacts.select(props, options);

            if (!selectedContacts || selectedContacts.length === 0) {
                setIsLoading(false);
                return;
            }

            const newContacts: Partial<Contact>[] = [];
            const conflicts: Conflict[] = [];
            const processedNumbers = new Set<string>();

            const existingContactMap = new Map(existingContacts.map(c => [c.phoneNumber, c]));

            for (const contact of selectedContacts) {
                const name = contact.name?.[0];
                const tels = contact.tel || [];

                if (!name || tels.length === 0) continue;

                for (const tel of tels) {
                    const clean = cleanPhone(tel);
                    if (!clean || clean.length < 8) continue;
                    if (processedNumbers.has(clean)) continue; // Avoid duplicates from the same import batch

                    processedNumbers.add(clean);
                    const existingContact = existingContactMap.get(clean);

                    const newContactData = {
                        name: name,
                        phoneNumber: clean
                    };

                    if (existingContact) {
                        // Only a conflict if the name is different
                        if (existingContact.name !== name) {
                            conflicts.push({ newContact: newContactData, existingContact });
                        }
                    } else {
                        newContacts.push(newContactData);
                    }
                }
            }

            onContactsSelected(newContacts, conflicts);

        } catch (error) {
            console.error('Error selecting contacts:', error);
            // Optional: Handle specific error cases (e.g., user cancellation usually doesn't throw, but depends on browser)
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleImport}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors ${className}`}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <Users className="w-5 h-5" />
            )}
            <span className="font-medium">Rehberden Seç</span>
        </button>
    );
};
