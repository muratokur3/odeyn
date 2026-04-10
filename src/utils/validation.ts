/**
 * Input Validation & Sanitization Utilities
 * Finansal uygulama için güvenlik katmanı
 */

// --- Amount Validation ---

export const MIN_AMOUNT = 0.01;
export const MAX_AMOUNT = 10_000_000; // 10 milyon

export function validateAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
        return { valid: false, error: 'Geçersiz tutar formatı.' };
    }
    if (amount <= 0) {
        return { valid: false, error: 'Tutar sıfırdan büyük olmalıdır.' };
    }
    if (amount < MIN_AMOUNT) {
        return { valid: false, error: `Minimum tutar ${MIN_AMOUNT} olmalıdır.` };
    }
    if (amount > MAX_AMOUNT) {
        return { valid: false, error: `Maksimum tutar ${MAX_AMOUNT.toLocaleString('tr-TR')} olmalıdır.` };
    }
    return { valid: true };
}

// --- String Validation ---

export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_FEEDBACK_DESCRIPTION_LENGTH = 2000;

export function validateStringLength(text: string, maxLength: number, fieldName?: string): { valid: boolean; error?: string } {
    if (text.length > maxLength) {
        return { valid: false, error: `${fieldName || 'Metin'} en fazla ${maxLength} karakter olabilir.` };
    }
    return { valid: true };
}

// --- XSS Sanitization ---

const DANGEROUS_PATTERNS = [
    /<script[\s>]/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,       // onclick=, onerror=, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
];

export function sanitizeText(text: string): string {
    let sanitized = text;
    // HTML entity encode dangerous chars
    sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sanitized.trim();
}

export function containsDangerousContent(text: string): boolean {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(text));
}

// --- Combined Validators ---

export function validateDescription(text: string): { valid: boolean; error?: string; sanitized: string } {
    const sanitized = sanitizeText(text);
    const lengthCheck = validateStringLength(sanitized, MAX_DESCRIPTION_LENGTH, 'Açıklama');
    if (!lengthCheck.valid) return { ...lengthCheck, sanitized };
    return { valid: true, sanitized };
}

export function validateNote(text: string): { valid: boolean; error?: string; sanitized: string } {
    const sanitized = sanitizeText(text);
    const lengthCheck = validateStringLength(sanitized, MAX_NOTE_LENGTH, 'Not');
    if (!lengthCheck.valid) return { ...lengthCheck, sanitized };
    return { valid: true, sanitized };
}
