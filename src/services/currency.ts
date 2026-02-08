export interface CurrencyRates {
    date: string;
    usd: Record<string, number>;
}

const API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRates {
    timestamp: number;
    data: CurrencyRates;
}

// In-memory cache for the current session lifetime
let memoryCache: CachedRates | null = null;

export const fetchRates = async (): Promise<CurrencyRates | null> => {
    const now = Date.now();

    // 1. Check Memory Cache
    if (memoryCache && (now - memoryCache.timestamp < CACHE_DURATION)) {
        return memoryCache.data;
    }

    // 2. Check LocalStorage
    if (typeof localStorage !== 'undefined') {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored) {
                const parsed: CachedRates = JSON.parse(stored);
                if (now - parsed.timestamp < CACHE_DURATION) {
                    memoryCache = parsed; // Sync memory cache
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to read currency cache', e);
        }
    }

    // 3. Fetch from API
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch rates');
        const data: CurrencyRates = await response.json();

        // Update caches
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

        // Fallback: If fetch fails, try to return stale cache if available
        if (memoryCache) return memoryCache.data;
        if (typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(CACHE_KEY);
                if (stored) {
                    return JSON.parse(stored).data;
                }
            } catch {
                // Ignore fallback errors
            }
        }

        return null;
    }
};

export const convertToTRY = (
    amount: number, 
    currency: string, 
    rates: CurrencyRates | null, 
    customRates?: Record<string, number>
): number => {
    if (currency === 'TRY') return amount;
    
    // 1. Check Custom Rates Priority
    if (customRates && customRates[currency]) {
        return amount * customRates[currency]; // Direct conversion factor
    }

    if (!rates || !rates.usd) return 0;

    const usdToTry = rates.usd['try'];
    if (!usdToTry) return 0;

    // 2. Convert to USD (Standard Flow)
    let amountInUsd = 0;

    if (currency === 'USD') {
        amountInUsd = amount;
    } else if (currency === 'GOLD') {
        const xauRate = rates.usd['xau']; 
        if (xauRate) {
            const pricePerOzInUsd = 1 / xauRate;
            const pricePerGramInUsd = pricePerOzInUsd / 31.1034768;
            amountInUsd = amount * pricePerGramInUsd;
        }
    } else {
        const rate = rates.usd[currency.toLowerCase()];
        if (rate) {
            amountInUsd = amount / rate;
        }
    }

    // 3. Convert USD to TRY
    return amountInUsd * usdToTry;
};
