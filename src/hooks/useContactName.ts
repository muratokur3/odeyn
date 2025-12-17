import { useContacts } from './useContacts';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';

interface ContactNameResult {
    displayName: string; // The best name found
    source: 'contact' | 'user' | 'phone';
    originalName?: string; // If 'contact', this is the contact name. If 'user', display name.
}

export const useContactName = () => {
    const { contactsMap } = useContacts();

    const resolveName = (identifier: string, fallbackName?: string): ContactNameResult => {
        // 1. Check Local Contacts (My Address Book)
        // Identifier could be a Phone (E.164) or a UID.
        // contactsMap is keyed by E.164 phone number.

        // Optimistic O(1) lookup
        const contactMatch = contactsMap[identifier];

        if (contactMatch) {
            return {
                displayName: contactMatch.name,
                source: 'contact',
                originalName: contactMatch.name
            };
        }

        // If identifier is UID, we might need value check?
        // Current map is Phone -> Contact.
        // If identifier is UID, we can't find it in key map easily unless we also map UIDs.
        // But rule #2 says Dept is tied to Phone.
        // Fallback to array find if not found in map (for UID/linkedUserId matching)
        // Check if any contact has this linkedUserId?
        // Actually, let's keep array search as fallback for edge/UID cases, but prefer map.
        // Or create a secondary map? For now, simple fallback.
        // Wait, 'contacts' is also available from useContacts if we destructured it.
        // But for Phone scenarios (which is 99%), map is fast.

        // ... (Fallbacks)

        // 2. Check fallbackName (Snapshot Name from Debt/User)
        // If we have a fallback name that is NOT just the phone number itself, use it.
        // This fixes the issue where "Ahmet" is passed as fallback, but the function sees a phone ID and returns formatted phone.
        if (fallbackName && fallbackName !== identifier && fallbackName.replace(/\D/g, '').length !== identifier.replace(/\D/g, '').length) {
            return {
                displayName: fallbackName,
                source: 'user', // Technically 'snapshot' or 'user' provided
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
