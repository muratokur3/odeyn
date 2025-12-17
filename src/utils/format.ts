export const formatCurrency = (amount: number | undefined | null, currency: string) => {
    const validAmount = amount ?? 0;

    if (currency === 'GOLD') {
        return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Gr`;
    }

    try {
        return validAmount.toLocaleString('tr-TR', { style: 'currency', currency });
    } catch {
        // Fallback for invalid currency codes
        return `${validAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`;
    }
};
