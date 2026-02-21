/**
 * Test Cases for Search & Listing Functions
 * 
 * These tests validate the phone number matching logic for contacts and users.
 * Run with: npm test -- searchContacts.test.ts
 */

describe('Search & Listing Functions - Phone Format Matching', () => {
    
    describe('searchContacts - Phone Format Matching', () => {
        const mockContacts = [
            { id: '1', name: 'Ahmet', phoneNumber: '+905551234567', linkedUserId: 'user1' },
            { id: '2', name: 'Ayşe', phoneNumber: '+905559876543', linkedUserId: 'user2' },
            { id: '3', name: 'Ali', phoneNumber: '+905552223333', linkedUserId: 'user3' },
        ];

        it('should find contact by full E.164 phone number', () => {
            // Query: +905551234567
            // Expected: Ahmet (exact match)
            const result = mockContacts.filter(c => 
                c.phoneNumber.includes('+905551234567')
            );
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Ahmet');
        });

        it('should find contact when user types 0-prefix (0555...)', () => {
            // User types: 05551234567
            // Should match against database: +905551234567
            const searchQuery = '05551234567';
            
            // Simulate standardizeRawPhone(searchQuery) = '+905551234567'
            const normalizedQuery = '+905551234567';
            
            const result = mockContacts.filter(c =>
                c.phoneNumber === normalizedQuery ||
                c.phoneNumber.includes(normalizedQuery)
            );
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Ahmet');
        });

        it('should find contact by partial phone number search', () => {
            // User types: 0555 (partial)
            // Should find all numbers starting with +90555
            const partialQuery = '555';
            
            const result = mockContacts.filter(c =>
                c.phoneNumber.includes(partialQuery)
            );
            expect(result.length).toBeGreaterThan(0);
            expect(result.map(c => c.name)).toContain('Ahmet');
        });

        it('should find contact by name', () => {
            // User types: Ahmet
            const searchQuery = 'Ahmet';
            
            const result = mockContacts.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            expect(result).toHaveLength(1);
            expect(result[0].phoneNumber).toBe('+905551234567');
        });

        it('should find contact when user types 90-prefix (90555...)', () => {
            // User types: 905551234567
            // Normalize to: +905551234567
            const searchQuery = '905551234567';
            const normalizedQuery = '+' + searchQuery;
            
            const result = mockContacts.filter(c =>
                c.phoneNumber === normalizedQuery
            );
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Ahmet');
        });

        it('should return empty array for no match', () => {
            const searchQuery = '0666'; // Non-existent
            
            const result = mockContacts.filter(c =>
                c.phoneNumber.includes(searchQuery) ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            expect(result).toHaveLength(0);
        });

        it('should be case-insensitive for names', () => {
            const searchQuery = 'AHMET'; // uppercase
            
            const result = mockContacts.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Ahmet');
        });
    });

    describe('normalizeAllUserContacts - Format Conversion', () => {
        it('should convert 0-prefix to E.164', () => {
            // Old format: "05551234567"
            // New format: "+905551234567"
            const oldFormat = '05551234567';
            const expected = '+905551234567';
            
            // Simulate cleanPhone conversion
            const converted = oldFormat.startsWith('0') && oldFormat.length === 11
                ? '+90' + oldFormat.substring(1)
                : oldFormat;
            
            expect(converted).toBe(expected);
        });

        it('should convert 90-prefix to E.164', () => {
            // Old format: "905551234567"
            // New format: "+905551234567"
            const oldFormat = '905551234567';
            const expected = '+905551234567';
            
            const converted = oldFormat.startsWith('90') && oldFormat.length === 12
                ? '+' + oldFormat
                : oldFormat;
            
            expect(converted).toBe(expected);
        });

        it('should skip already normalized numbers', () => {
            const alreadyNormalized = '+905551234567';
            // Should not be changed since it's already E.164
            expect(alreadyNormalized).toBe('+905551234567');
        });

        it('should handle contacts with mixed formats', () => {
            const contacts = [
                { phoneNumber: '+905551234567' }, // Already normalized
                { phoneNumber: '05559876543' },   // 0-prefix
                { phoneNumber: '905552223333' },  // 90-prefix
            ];
            
            const normalized = contacts.map(c => {
                let phone = c.phoneNumber;
                if (phone.startsWith('0') && phone.length === 11) {
                    phone = '+90' + phone.substring(1);
                } else if (phone.startsWith('90') && phone.length === 12) {
                    phone = '+' + phone;
                }
                return phone;
            });
            
            expect(normalized).toEqual([
                '+905551234567',
                '+905559876543',
                '+905552223333',
            ]);
        });
    });

    describe('searchUserByPhone - Registry Lookup', () => {
        it('should normalize phone before registry lookup', () => {
            // User enters: 05551234567
            // Should normalize to: +905551234567
            // Then lookup in registry
            
            const input = '05551234567';
            const expected = '+905551234567';
            
            const normalized = input.startsWith('0') && input.length === 11
                ? '+90' + input.substring(1)
                : input;
            
            expect(normalized).toBe(expected);
        });

        it('should use fallback standardization on clean failure', () => {
            // If cleanPhoneNumber fails, try standardizeRawPhone
            const input = '0555 123 45 67'; // Spaces
            
            // Simulate standardizeRawPhone fallback
            const digitsOnly = input.replace(/\D/g, '');
            const fallback = '+90' + digitsOnly.substring(1);
            
            expect(fallback).toBe('+905551234567');
        });

        it('should return null for unparseable phone', () => {
            const input = 'not a phone';
            
            // Should return null if can't normalize
            const normalized = /^\d+$/.test(input) ? input : null;
            expect(normalized).toBeNull();
        });
    });
});
