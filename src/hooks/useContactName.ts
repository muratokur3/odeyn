import { useContacts } from './useContacts';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';

interface ContactNameResult {
    displayName: string; // The best name found
    source: 'contact' | 'user' | 'phone';
    originalName?: string; // If 'contact', this is the contact name. If 'user', display name.
}

export const useContactName = () => {
    const { contacts } = useContacts();

    const resolveName = (identifier: string, fallbackName?: string): ContactNameResult => {
        // 1. Check Local Contacts (My Address Book)
        // Identifier could be a Phone or a UID. 
        // Contacts are stored with 'phoneNumber' (cleaned) and 'linkedUserId'.

        const contactMatch = contacts.find(c =>
            c.phoneNumber === identifier || c.linkedUserId === identifier
        );

        if (contactMatch) {
            return {
                displayName: contactMatch.name,
                source: 'contact',
                originalName: contactMatch.name
            };
        }

        // 2. Check fallbackName (This usually comes from the Transaction 'targetUserName' or 'lenderName' snapshot)
        // In this app, we store 'lenderName'/'borrowerName' on the Debt record at creation.
        // If that name was set by the User (e.g. from their profile), use it? 
        // OR does prompt say "Check Users table. Is there a display_name?"
        // Since we don't fetch *ALL* users to client, we rely on the name stored in the Debt record 
        // OR we fetch the user profile if we have a UID.
        // For lists, likely we rely on the snapshot name IF we don't have a contact.

        if (fallbackName && identifier.length > 15) {
            // If it's a UID and we have a name (likely from Auth profile at creation), use it.
            return {
                displayName: fallbackName,
                source: 'user',
                originalName: fallbackName
            };
        }

        // 3. Fallback to Phone
        // If identifier looks like a phone, format it.
        if (identifier.replace(/\D/g, '').length >= 10) {
            return {
                displayName: formatPhoneNumber(identifier),
                source: 'phone'
            };
        }

        return {
            displayName: fallbackName || identifier,
            source: 'user'
        };
    };

    return { resolveName };
};
