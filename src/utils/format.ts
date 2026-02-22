import type { GoldDetail } from '../types';

export const formatCurrency = (amount: number | undefined | null, currency: string, goldDetail?: GoldDetail) => {
    const validAmount = amount ?? 0;

    if (currency === 'GOLD' || currency.startsWith('GOLD:')) {
        let label = 'Gr';
        let subType = '';

        if (goldDetail) {
            subType = goldDetail.type;
        } else if (currency.includes(':')) {
            subType = currency.split(':')[1];
        }

        if (subType === 'CEYREK') label = 'Çeyrek';
        else if (subType === 'YARIM') label = 'Yarım';
        else if (subType === 'TAM') label = 'Tam';
        else if (subType === 'ATA') label = 'Ata';
        else if (subType === 'BILEZIK') label = 'Gr (Bilezik)';

        return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: (subType === 'GRAM' || subType === 'BILEZIK' || !subType) ? 2 : 0, maximumFractionDigits: 2 })} ${label}`;
    }

    try {
        return validAmount.toLocaleString('tr-TR', { style: 'currency', currency });
    } catch {
        // Fallback for invalid currency codes
        return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`;
    }
};

/**
 * Formats a numeric value for bank-standard display (tr-TR locale)
 * E.g., 1250.5 -> "1.250,50"
 */
export const formatAmount = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Parses a bank-formatted string back to a numeric value
 * E.g., "1.250,50" -> 1250.5
 */
export const parseAmount = (formattedValue: string): number => {
    // Remove thousand separators (.) and replace decimal separator (,) with (.)
    const cleaned = formattedValue.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};
/**
 * Converts a number to its Turkish verbal representation.
 * Purely local string manipulation, no external API calls.
 */
export const numberToTurkishWords = (num: number): string => {
    if (num === 0) return 'Sıfır';
    if (num >= 1000000000) return ''; // Limit: 1 Billion

    const units = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
    const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
    const thousands = ['', 'Bin', 'Milyon', 'Milyar'];

    let words = '';
    let step = 0;

    while (num > 0) {
        const chunk = num % 1000;
        if (chunk > 0) {
            let chunkWords = '';
            const h = Math.floor(chunk / 100);
            const t = Math.floor((chunk % 100) / 10);
            const u = chunk % 10;

            if (h > 0) {
                if (h > 1) chunkWords += units[h] + ' ';
                chunkWords += 'Yüz ';
            }

            if (t > 0) chunkWords += tens[t] + ' ';
            if (u > 0) {
                // Handle "Bir Bin" (One Thousand) -> "Bin" (Thousand) except for higher orders
                if (u === 1 && step === 1 && h === 0 && t === 0) {
                    // Skip 'Bir'
                } else {
                    chunkWords += units[u] + ' ';
                }
            }

            words = chunkWords + thousands[step] + ' ' + words;
        }
        num = Math.floor(num / 1000);
        step++;
    }

    return words.trim();
};

/**
 * Returns a formatted string like "On Bin Türk Lirası"
 */
export const formatAmountToWords = (amount: number | string, currency: string, goldDetail?: GoldDetail): string => {
    const num = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, '')) : amount;
    if (isNaN(num) || num <= 0) return '';

    const verbal = numberToTurkishWords(num);
    if (!verbal) return '';

    const currencyNames: Record<string, string> = {
        'TRY': 'Türk Lirası',
        'USD': 'Amerikan Doları',
        'EUR': 'Euro',
        'GOLD': 'Gram Altın',
        'GRAM': 'Gram Altın',
        'CEYREK': 'Çeyrek Altın',
        'YARIM': 'Yarım Altın',
        'TAM': 'Tam Altın',
        'ATA': 'Ata Altın',
        'BILEZIK': 'Gram Bilezik'
    };

    let currencyLabel = currencyNames[currency] || currency;
    if (currency === 'GOLD' || currency.startsWith('GOLD:')) {
        const subType = goldDetail?.type || (currency.includes(':') ? currency.split(':')[1] : 'GRAM');
        currencyLabel = currencyNames[subType] || currencyNames['GOLD'];
    }

    return `${verbal} ${currencyLabel}`;
};
