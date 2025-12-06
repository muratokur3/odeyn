export const cleanPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Take the last 10 digits
    return digits.slice(-10);
};

export const formatPhoneNumber = (phone: string): string => {
    const cleaned = cleanPhoneNumber(phone);
    if (cleaned.length !== 10) return phone; // Return original if not valid length

    // Format: +90 (555) 123 45 67
    return `+90 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
};

export const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = cleanPhoneNumber(phone);
    return cleaned.length === 10 && parseInt(cleaned[0]) === 5; // TR mobile numbers start with 5
};
