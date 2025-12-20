import React, { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import type { Contact } from '../types';
import { cleanPhone } from '../utils/phoneUtils';

interface ImportContactsButtonProps {
    onContactsSelected: (contacts: Partial<Contact>[]) => void;
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

    const handleImport = async () => {
        if (!isSupported) {
            alert('Tarayıcınız bu özelliği desteklemiyor. Bu özellik sadece desteklenen mobil tarayıcılarda (Chrome Mobile, Samsung Internet vb.) çalışır.');
            return;
        }

        setIsLoading(true);
        try {
            const props = ['name', 'tel'];
            const options = { multiple: true };

            // @ts-ignore - navigator.contacts is experimental and may not be in standard TS types
            const selectedContacts = await navigator.contacts.select(props, options);

            if (!selectedContacts || selectedContacts.length === 0) {
                setIsLoading(false);
                return;
            }

            const processedContacts: Partial<Contact>[] = [];
            const processedNumbers = new Set<string>(); // To handle duplicates within the selection

            // Add existing numbers to set for O(1) lookup, ensuring we normalize them too
            const existingNumbers = new Set(existingContacts.map(c => cleanPhone(c.phoneNumber)));

            for (const contact of selectedContacts) {
                const name = contact.name?.[0];
                const tels = contact.tel || [];

                if (!name || tels.length === 0) continue;

                for (const tel of tels) {
                    const clean = cleanPhone(tel);
                    if (!clean || clean.length < 8) continue; // Basic validity check

                    // Deduplication logic
                    if (existingNumbers.has(clean)) continue;
                    if (processedNumbers.has(clean)) continue;

                    processedNumbers.add(clean);
                    processedContacts.push({
                        name: name,
                        phoneNumber: clean
                    });

                    // Only take the first valid number for a contact to avoid clutter?
                    // Or user might want all numbers.
                    // Let's add all unique valid numbers.
                }
            }

            onContactsSelected(processedContacts);

        } catch (error) {
            console.error('Error selecting contacts:', error);
            // Don't alert if user just cancelled
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
