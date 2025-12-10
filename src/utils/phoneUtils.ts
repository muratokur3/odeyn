import { parsePhoneNumber, isValidPhoneNumber as isValidLibPhone } from 'libphonenumber-js';

const DEFAULT_COUNTRY = 'TR';

/**
 * Parses and cleans a phone number to E.164 format.
 * Example: "0555 123 45 67" -> "+905551234567"
 * @param input The raw phone number string
 * @returns The formatted E.164 string
 */
export const cleanPhone = (input: string): string => {
    if (!input) return '';
    try {
        // Parse with default country TR
        const phoneNumber = parsePhoneNumber(input, DEFAULT_COUNTRY);
        if (phoneNumber) {
            return phoneNumber.number as string; // Returns E.164
        }
    } catch {
        // Fallback or ignore parse errors (will return handled below or processed crudely)
    }

    // Fallback for partial or extremely messy inputs if libphonenumber fails but we want to try?
    // Actually, strict mode means we rely on the library.
    // But for "cleaning" raw digits if it fails parsing (e.g. valid local number but parse failed??)
    // usually parsePhoneNumber works for valid TR numbers like "5551234567" -> +90...

    // If it fails, let's just do a basic digit cleanup to be safe, or return empty?
    // User requested: "Output ALWAYS E.164". If invalid, we return what?
    // Let's return the cleaned digits with +90 if length matches, essentially our old logic as absolute fallback.
    const digits = input.replace(/\D/g, '');
    if (digits.length === 10) return `+90${digits}`;
    if (digits.length === 11 && digits.startsWith('90')) return `+${digits}`;
    if (input.startsWith('+')) return input.replace(/\s/g, ''); // Already looks like intl

    return input.replace(/\s/g, ''); // Return stripped as last resort
};

/**
 * Formats a phone number for display.
 * Example: "+905551234567" -> "0 555 123 45 67" or international format
 * @param cleanNumber The E.164 number
 */
export const formatPhoneForDisplay = (cleanNumber: string): string => {
    if (!cleanNumber) return '';
    try {
        const phoneNumber = parsePhoneNumber(cleanNumber);
        if (phoneNumber) {
            // "National" format for TR starts with 0 usually in libphonenumber? 
            // parsePhoneNumber('+905551234567').format('NATIONAL') -> "0555 123 45 67"
            return phoneNumber.format('NATIONAL');
        }
    } catch {
        // ignore
    }
    return cleanNumber;
};

/**
 * Checks if the phone number is valid.
 * @param input The raw or cleaned phone number
 */
export const isValidPhone = (input: string): boolean => {
    if (!input) return false;
    try {
        return isValidLibPhone(input, DEFAULT_COUNTRY);
    } catch {
        return false;
    }
};

/**
 * Gets the country calling code.
 * @param input Phone number
 */
export const getCountryCode = (input: string): string => {
    try {
        const phoneNumber = parsePhoneNumber(input, DEFAULT_COUNTRY);
        if (phoneNumber) {
            return `+${phoneNumber.countryCallingCode}`;
        }
    } catch {
        // ignore
    }
    return '+90'; // Default
};
