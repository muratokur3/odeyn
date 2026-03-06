import { calculatePureMetalWeight } from '../utils/goldConstants';

export interface CurrencyRates {
    date: string;
    usd: Record<string, number>;
}

// ============= FOREX / CRYPTO RATES (fawazahmed0) =============

const API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRates {
    timestamp: number;
    data: CurrencyRates;
}

let memoryCache: CachedRates | null = null;

export const fetchRates = async (): Promise<CurrencyRates | null> => {
    const now = Date.now();

    if (memoryCache && (now - memoryCache.timestamp < CACHE_DURATION)) {
        return memoryCache.data;
    }

    if (typeof localStorage !== 'undefined') {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored) {
                const parsed: CachedRates = JSON.parse(stored);
                if (now - parsed.timestamp < CACHE_DURATION) {
                    memoryCache = parsed;
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to read currency cache', e);
        }
    }

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch rates');
        const data: CurrencyRates = await response.json();

        const cacheEntry: CachedRates = { timestamp: now, data };
        memoryCache = cacheEntry;

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
            } catch (e) {
                console.warn('Failed to save currency cache', e);
            }
        }

        return data;
    } catch (error) {
        console.error('Error fetching currency rates:', error);
        if (memoryCache) return memoryCache.data;
        if (typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(CACHE_KEY);
                if (stored) return JSON.parse(stored).data;
            } catch { /* ignore */ }
        }
        return null;
    }
};

// ============= TURKISH GOLD PRICES (CollectAPI) =============
// Budget: ~90 req/month (3x/day × 30 days). Cache = 8 hours.

const GOLD_API_CACHE_KEY = 'turkish_gold_rates_cache';
const GOLD_CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours → ≈3 fetches/day

/**
 * Turkish gold prices keyed by our goldConstants type IDs.
 * Values are SELL prices in TRY.
 *   - GRAM types   → price per gram
 *   - SIKKE types  → price per coin (adet)
 *   - SILVER types → price per gram
 */
export interface TurkishGoldRates {
    timestamp: number;
    // gram altın
    GRAM_22: number;  // 22 Ayar gram
    GRAM_24: number;  // 24 Ayar (Has) gram
    // sikke (adet)
    CEYREK: number;
    YARIM: number;
    TAM: number;
    ATA: number;
    // raw gram price → used to derive 14/18-ayar etc.
    gramBase: number; // 24k TRY/gram
}

interface CachedGoldRates {
    timestamp: number;
    data: TurkishGoldRates;
}

let goldMemoryCache: CachedGoldRates | null = null;

/**
 * CollectAPI field name → our system mapping.
 * API returns: name (e.g. "gram_altin"), alis, satis
 */
const COLLECTAPI_MAP: Record<string, keyof TurkishGoldRates> = {
    'gram_altin':  'GRAM_22',
    'gram_has_altin': 'GRAM_24',
    'ceyrek_yeni': 'CEYREK',
    'yarim_yeni':  'YARIM',
    'tam_yeni':    'TAM',
    'ata_yeni':    'ATA',
};

export const fetchTurkishGoldRates = async (): Promise<TurkishGoldRates | null> => {
    const now = Date.now();

    // 1. Memory cache check
    if (goldMemoryCache && (now - goldMemoryCache.timestamp < GOLD_CACHE_DURATION)) {
        return goldMemoryCache.data;
    }

    // 2. LocalStorage cache check
    if (typeof localStorage !== 'undefined') {
        try {
            const stored = localStorage.getItem(GOLD_API_CACHE_KEY);
            if (stored) {
                const parsed: CachedGoldRates = JSON.parse(stored);
                if (now - parsed.timestamp < GOLD_CACHE_DURATION) {
                    goldMemoryCache = parsed;
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('[GoldAPI] Failed to read local cache', e);
        }
    }

    // 3. Fetch from CollectAPI
    const apiKey = import.meta.env.VITE_COLLECTAPI_KEY;
    if (!apiKey) {
        console.warn('[GoldAPI] No VITE_COLLECTAPI_KEY set. Skipping Turkish gold rates.');
        return null;
    }

    try {
        const response = await fetch('https://api.collectapi.com/economy/goldPrice', {
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            console.warn('[GoldAPI] API returned', response.status);
            return null;
        }

        const json = await response.json();
        const items: { name: string; alis: string; satis: string }[] = json?.result ?? [];

        if (!items.length) return null;

        const rates: Partial<TurkishGoldRates> = { timestamp: now };

        for (const item of items) {
            const key = COLLECTAPI_MAP[item.name];
            if (key) {
                // satis = sell price (what we use for valuation)
                const val = parseFloat(item.satis.replace(',', '.').replace(/\./g, (m, offset, str) => offset === str.lastIndexOf('.') ? '.' : ''));
                if (!isNaN(val)) (rates as Record<string, unknown>)[key] = val;
            }
        }

        // Derive gramBase: 24k per gram
        rates.gramBase = rates.GRAM_24 ?? (rates.GRAM_22 ? rates.GRAM_22 / 0.9166 : 0);

        // Fill any missing fields with 0 so callers don't crash
        const full: TurkishGoldRates = {
            timestamp: now,
            GRAM_22: rates.GRAM_22 ?? 0,
            GRAM_24: rates.GRAM_24 ?? 0,
            CEYREK: rates.CEYREK ?? 0,
            YARIM: rates.YARIM ?? 0,
            TAM: rates.TAM ?? 0,
            ATA: rates.ATA ?? 0,
            gramBase: rates.gramBase ?? 0,
        };

        // Cache it
        const entry: CachedGoldRates = { timestamp: now, data: full };
        goldMemoryCache = entry;
        if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem(GOLD_API_CACHE_KEY, JSON.stringify(entry)); }
            catch { /* storage full */ }
        }

        console.log('[GoldAPI] Turkish gold rates updated', full);
        return full;

    } catch (error) {
        console.error('[GoldAPI] Fetch failed:', error);
        // Return stale cache if available
        if (goldMemoryCache) return goldMemoryCache.data;
        if (typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(GOLD_API_CACHE_KEY);
                if (stored) return JSON.parse(stored).data;
            } catch { /* ignore */ }
        }
        return null;
    }
};

// ============= CONVERSION FUNCTIONS =============

/**
 * Convert an amount to TRY.
 * For GOLD/SILVER types, uses Turkish market prices when available,
 * falling back to xau/xag-based calculation.
 */
export const convertToTRY = (
    amount: number,
    currency: string,
    rates: CurrencyRates | null,
    customRates?: Record<string, number>,
    goldDetail?: { type?: string; weightPerUnit?: number },
    turkishGold?: TurkishGoldRates | null
): number => {
    if (currency === 'TRY') return amount;

    // Custom override (e.g. user-set rate)
    if (customRates && customRates[currency]) {
        return amount * customRates[currency];
    }

    if (!rates || !rates.usd) return 0;

    const usdToTry = rates.usd['try'];
    if (!usdToTry) return 0;

    // ---- GOLD / SILVER ----
    if (currency === 'GOLD' || currency === 'SILVER') {
        const type = goldDetail?.type ?? '';
        const weightPerUnit = goldDetail?.weightPerUnit;

        // Try Turkish market price first
        if (turkishGold && turkishGold.gramBase > 0) {
            return convertGoldToTRY_Turkish(amount, type, weightPerUnit, turkishGold);
        }

        // Fallback: xau/xag-based
        const metalKey = currency === 'GOLD' ? 'xau' : 'xag';
        const rate = rates.usd[metalKey];
        if (rate) {
            const pricePerGramInUsd = (1 / rate) / 31.1034768;
            const effectiveGrams = goldDetail
                ? calculatePureMetalWeight(type, amount, weightPerUnit)
                : amount;
            return effectiveGrams * pricePerGramInUsd * usdToTry;
        }
        return 0;
    }

    // ---- OTHER FIAT (USD, EUR, ...) ----
    if (currency === 'USD') return amount * usdToTry;

    const rate = rates.usd[currency.toLowerCase()];
    if (rate) return (amount / rate) * usdToTry;

    return 0;
};

/**
 * Convert gold amount to TRY using Turkish market prices.
 * Uses sikke prices directly for sikke types,
 * derives gram price × purity for others.
 */
function convertGoldToTRY_Turkish(
    amount: number,
    typeId: string,
    weightPerUnit: number | undefined,
    tg: TurkishGoldRates
): number {
    // Direct market prices for sikke types
    const sikkeMap: Record<string, number> = {
        CEYREK: tg.CEYREK,
        YARIM:  tg.YARIM,
        TAM:    tg.TAM,
        ATA:    tg.ATA,
        CUMHURIYET: tg.ATA,
        RESAT:  tg.ATA,   // approximation
        GREMSE: tg.TAM * 2.5, // approximation: ~2.5 tam
        BESLI:  tg.TAM * 5,
    };

    if (sikkeMap[typeId] && sikkeMap[typeId] > 0) {
        return amount * sikkeMap[typeId];
    }

    // For gram-based types, use gramBase (24k TRY/gram) × purity multiplier
    const purityMap: Record<string, number> = {
        GRAM_24:    1,
        GRAM_22:    0.9166,
        GRAM_18:    0.750,
        GRAM_14:    0.5833,
        BILEZIK_22: 0.9166,
        BILEZIK_14: 0.5833,
        TAKI_24:    1,
        TAKI_22:    0.9166,
        TAKI_18:    0.750,
        TAKI_14:    0.5833,
        TAKI_8:     0.3333,
        SILVER_999: 0,  // handled separately
        SILVER_925: 0,
    };

    const purity = purityMap[typeId];
    if (purity !== undefined && purity > 0) {
        // Bilezik/Takı: amount = quantity, price = qty × weight × purity × gramBase
        if (typeId.startsWith('BILEZIK') || typeId.startsWith('TAKI')) {
            const grams = amount * (weightPerUnit ?? 0) * purity;
            return grams * tg.gramBase;
        }
        // Gram types: amount is total weight
        return amount * purity * tg.gramBase;
    }

    return 0;
}

export const convertPureMetalToTRY = (
    grams: number,
    rates: CurrencyRates | null,
    metal: 'GOLD' | 'SILVER' = 'GOLD',
    turkishGold?: TurkishGoldRates | null
): number => {
    // Use Turkish gramBase if available
    if (metal === 'GOLD' && turkishGold && turkishGold.gramBase > 0) {
        return grams * turkishGold.gramBase;
    }

    if (!rates || !rates.usd) return 0;
    const metalKey = metal === 'GOLD' ? 'xau' : 'xag';
    const rate = rates.usd[metalKey];
    const usdToTry = rates.usd['try'];
    if (!rate || !usdToTry) return 0;

    const pricePerGramInUsd = (1 / rate) / 31.1034768;
    return grams * pricePerGramInUsd * usdToTry;
};
