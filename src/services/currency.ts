export interface CurrencyRates {
    date: string;
    usd: Record<string, number>;
}

const API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

export const fetchRates = async (): Promise<CurrencyRates | null> => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch rates');
        return await response.json();
    } catch (error) {
        console.error('Error fetching currency rates:', error);
        return null;
    }
};

export const convertToTRY = (amount: number, currency: string, rates: CurrencyRates): number => {
    if (currency === 'TRY') return amount;
    if (!rates || !rates.usd) return 0;

    const usdToTry = rates.usd['try'];
    if (!usdToTry) return 0;

    // 1. Convert to USD
    let amountInUsd = 0;

    if (currency === 'USD') {
        amountInUsd = amount;
    } else if (currency === 'GOLD') {
        // Gold logic:
        // API usually provides 'xau' (Gold Ounce) price in USD (or relative to USD).
        // However, the API returns how many units of currency X you get for 1 USD.
        // So rates.usd['xau'] = X means 1 USD = X Ounces of Gold.
        // Price of 1 Oz Gold in USD = 1 / rates.usd['xau'].

        // We store Gold in Grams.
        // 1 Oz = 31.1034768 Grams.
        // Price of 1 Gram Gold in USD = (1 / rates.usd['xau']) / 31.1034768.

        const xauRate = rates.usd['xau']; // Ounces per USD
        if (xauRate) {
            const pricePerOzInUsd = 1 / xauRate;
            const pricePerGramInUsd = pricePerOzInUsd / 31.1034768;
            amountInUsd = amount * pricePerGramInUsd;
        }
    } else {
        // Standard currency (e.g., EUR)
        // rates.usd['eur'] = X means 1 USD = X EUR.
        // 1 EUR = 1/X USD.
        const rate = rates.usd[currency.toLowerCase()];
        if (rate) {
            amountInUsd = amount / rate;
        }
    }

    // 2. Convert USD to TRY
    return amountInUsd * usdToTry;
};
