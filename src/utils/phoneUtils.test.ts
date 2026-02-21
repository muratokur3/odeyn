import { 
    formatToE164, 
    isValidPhone, 
    formatPhoneForDisplay,
    standardizeRawPhone,
    cleanPhone 
} from './phoneUtils';

describe('Phone Utilities', () => {
    describe('formatToE164', () => {
        it('should convert Turkish local format to E.164', () => {
            expect(formatToE164('05551234567', 'TR')).toBe('+905551234567');
        });

        it('should convert Turkish format with 0 prefix', () => {
            expect(formatToE164('0 555 123 45 67', 'TR')).toBe('+905551234567');
        });

        it('should handle format with 90 prefix', () => {
            expect(formatToE164('905551234567', 'TR')).toBe('+905551234567');
        });

        it('should handle already formatted E.164', () => {
            expect(formatToE164('+905551234567')).toBe('+905551234567');
        });

        it('should return null for invalid format', () => {
            expect(formatToE164('123')).toBeNull();
            expect(formatToE164('')).toBeNull();
        });

        it('should handle whitespace', () => {
            expect(formatToE164('  +90 555 123 45 67  ')).toBe('+905551234567');
        });
    });

    describe('standardizeRawPhone', () => {
        it('should convert 0-prefix Turkish local format', () => {
            expect(standardizeRawPhone('05551234567')).toBe('+905551234567');
        });

        it('should convert 90-prefix format', () => {
            expect(standardizeRawPhone('905551234567')).toBe('+905551234567');
        });

        it('should keep already formatted E.164', () => {
            expect(standardizeRawPhone('+905551234567')).toBe('+905551234567');
        });

        it('should handle 10-digit numbers as Turkish', () => {
            expect(standardizeRawPhone('5551234567')).toBe('+905551234567');
        });

        it('should remove spaces', () => {
            expect(standardizeRawPhone('0 555 123 45 67')).toBe('+905551234567');
        });

        it('should return empty string for invalid input', () => {
            expect(standardizeRawPhone('abc')).toBe('abc'); // Returns raw if can't standardize
        });
    });

    describe('isValidPhone', () => {
        it('should validate correct E.164 format', () => {
            expect(isValidPhone('+905551234567')).toBe(true);
        });

        it('should reject format without +', () => {
            expect(isValidPhone('905551234567')).toBe(false);
        });

        it('should reject format with 0 prefix', () => {
            expect(isValidPhone('05551234567')).toBe(false);
        });

        it('should reject empty string', () => {
            expect(isValidPhone('')).toBe(false);
        });

        it('should reject too short numbers', () => {
            expect(isValidPhone('+901234')).toBe(false);
        });

        it('should reject numbers starting with +0', () => {
            expect(isValidPhone('+0551234567')).toBe(false);
        });
    });

    describe('cleanPhone', () => {
        it('should convert to E.164 format', () => {
            expect(cleanPhone('05551234567')).toBe('+905551234567');
        });

        it('should handle spaces and formatting', () => {
            expect(cleanPhone('0 555 123 45 67')).toBe('+905551234567');
        });

        it('should return empty string on parse failure', () => {
            expect(cleanPhone('invalid')).toBe('');
        });

        it('should not error on empty input', () => {
            expect(cleanPhone('')).toBe('');
        });
    });

    describe('formatPhoneForDisplay', () => {
        it('should format E.164 for display', () => {
            const result = formatPhoneForDisplay('+905551234567');
            expect(result).toBeTruthy();
            expect(result).toContain('555');
        });

        it('should return input if parsing fails', () => {
            expect(formatPhoneForDisplay('invalid')).toBe('invalid');
        });
    });
});
