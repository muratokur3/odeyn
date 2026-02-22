import type { GoldDetail } from '../types';
import { getGoldType, BILEZIK_MODELS, TAKI_TYPES } from './goldConstants';

export const CURRENCIES = [
    { code: 'TRY', symbol: '₺', label: 'LİRA' },
    { code: 'USD', symbol: '$', label: 'DOLAR' },
    { code: 'EUR', symbol: '€', label: 'EURO' },
    { code: 'GBP', symbol: '£', label: 'STERLİN' },
    { code: 'GOLD', symbol: 'GA', label: 'ALTIN' },
    { code: 'SILVER', symbol: 'GM', label: 'GÜMÜŞ' },
] as const;

export const formatCurrency = (amount: number | undefined | null, currency: string, goldDetail?: GoldDetail) => {
    const validAmount = amount ?? 0;

    if (currency === 'GOLD' || currency.startsWith('GOLD:') || currency === 'SILVER' || currency.startsWith('SILVER:')) {
        const isGold = currency === 'GOLD' || currency.startsWith('GOLD:');
        const typeId = goldDetail?.type || (currency.includes(':') ? currency.split(':')[1] : 'GRAM_24');
        const type = getGoldType(typeId);

        if (type) {
            if (type.category === 'SIKKE') {
                return `${validAmount.toLocaleString('tr-TR')} Adet ${type.label}`;
            }
            if (type.category === 'BILEZIK' || type.category === 'TAKI') {
                let label = `${validAmount.toLocaleString('tr-TR')} Adet`;
                if (goldDetail?.carat) label += ` ${goldDetail.carat} Ayar`;
                if (goldDetail?.weightPerUnit) label += ` ${goldDetail.weightPerUnit} Gr`;

                let subLabel = '';
                if (goldDetail?.subTypeLabel) {
                    const modelList = type.category === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES;
                    const model = modelList.find(m => m.id === goldDetail.subTypeLabel);
                    subLabel = model?.label || goldDetail.subTypeLabel;
                }

                label += ` ${subLabel} ${type.label}`;
                return label.replace(/\s+/g, ' ').trim();
            }
            return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Gr ${type.label}`;
        }
        return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} Gr ${isGold ? 'Altın' : 'Gümüş'}`;
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
 * Safely parses a value to a number, returning undefined if invalid or NaN.
 */
export const safeParseFloat = (val: string | number | undefined | null): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return (num !== null && num !== undefined && !isNaN(num) && isFinite(num)) ? num : undefined;
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
    const cleanAmount = typeof amount === 'string' ? amount.replace(',', '.') : amount.toString();
    const num = parseFloat(cleanAmount);

    if (isNaN(num) || num <= 0) return '';

    // Integer part
    const integerPart = Math.floor(num);
    let verbal = numberToTurkishWords(integerPart);

    // Fractional part (up to 2 decimals)
    const fraction = Math.round((num - integerPart) * 100);
    if (fraction > 0) {
        verbal += ` virgül ${numberToTurkishWords(fraction)}`;
    }

    if (!verbal) return '';

    if (currency === 'GOLD' || currency.startsWith('GOLD:') || currency === 'SILVER' || currency.startsWith('SILVER:')) {
        const isGold = currency === 'GOLD' || currency.startsWith('GOLD:');
        const typeId = goldDetail?.type || (currency.includes(':') ? currency.split(':')[1] : (isGold ? 'GRAM_24' : 'SILVER_999'));
        const type = getGoldType(typeId);

        if (type) {
            if (type.category === 'BILEZIK' || type.category === 'TAKI') {
                let detail = '';
                if (goldDetail?.carat) detail += `${goldDetail.carat} Ayar `;
                if (goldDetail?.weightPerUnit) detail += `${goldDetail.weightPerUnit} Gram `;

                let subLabel = '';
                if (goldDetail?.subTypeLabel) {
                    const modelList = type.category === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES;
                    const model = modelList.find(m => m.id === goldDetail.subTypeLabel);
                    subLabel = model?.label || goldDetail.subTypeLabel;
                }

                detail += `${subLabel} ${type.label}`;
                return `${verbal} Adet ${detail.replace(/\s+/g, ' ').trim()}`;
            }
            if (type.category === 'SIKKE') {
                return `${verbal} Adet ${type.label}`;
            }
            return `${verbal} Gram ${type.label}`;
        }
        return `${verbal} Gram ${isGold ? 'Altın' : 'Gümüş'}`;
    }

    const currencyNames: Record<string, string> = {
        'TRY': 'Türk Lirası',
        'USD': 'Amerikan Doları',
        'EUR': 'Euro',
        'GBP': 'İngiliz Sterlini',
        'CHF': 'İsviçre Frangı',
        'SAR': 'Suudi Arabistan Riyali',
        'CAD': 'Kanada Doları',
        'AUD': 'Avustralya Doları',
        'JPY': 'Japon Yeni',
        'SILVER': 'Gümüş'
    };

    const currencyLabel = currencyNames[currency] || currency;
    return `${verbal} ${currencyLabel}`;
};
