export const GOLD_TYPES = [
    { id: 'GRAM', label: 'Gram Altın', hasCarat: true, hasWeight: true, hasQuantity: false },
    { id: 'CEYREK', label: 'Çeyrek Altın', hasCarat: false, hasWeight: false, hasQuantity: true, standardWeight: 1.75, standardCarat: 22 },
    { id: 'YARIM', label: 'Yarım Altın', hasCarat: false, hasWeight: false, hasQuantity: true, standardWeight: 3.50, standardCarat: 22 },
    { id: 'TAM', label: 'Tam Altın', hasCarat: false, hasWeight: false, hasQuantity: true, standardWeight: 7.00, standardCarat: 22 },
    { id: 'ATA', label: 'Ata Altın', hasCarat: false, hasWeight: false, hasQuantity: true, standardWeight: 7.21, standardCarat: 22 },
    { id: 'BILEZIK', label: 'Bilezik', hasCarat: true, hasWeight: true, hasQuantity: false },
] as const;

export const GOLD_CARATS = [
    { value: 24, label: '24 Ayar' },
    { value: 22, label: '22 Ayar' },
    { value: 18, label: '18 Ayar' },
    { value: 14, label: '14 Ayar' },
] as const;

export const getGoldMultiplier = (carat: number): number => {
    return carat / 24;
};

export const calculateGoldToGram24K = (type: string, amount: number, carat?: number, weight?: number): number => {
    const goldType = GOLD_TYPES.find(t => t.id === type);
    if (!goldType) return amount;

    if (goldType.hasQuantity) {
        const baseWeight = (goldType as { standardWeight?: number }).standardWeight || 0;
        const baseCarat = (goldType as { standardCarat?: number }).standardCarat || 24;
        return amount * baseWeight * getGoldMultiplier(baseCarat);
    }

    if (goldType.hasWeight && weight) {
        return weight * getGoldMultiplier(carat || 24);
    }

    // Default assume amount is grams
    return amount * getGoldMultiplier(carat || 24);
};
