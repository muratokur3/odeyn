
export interface GoldTypeDefinition {
  id: string;
  label: string;
  multiplier: number; // Saf metal karşılığı çarpan (24K altın veya 999 gümüş)
  category: 'GRAM' | 'SIKKE' | 'BILEZIK' | 'TAKI' | 'SILVER';
  defaultCarat?: number;
  fixedCarat?: boolean; // If true, carat selection is hidden/fixed
}

export const GOLD_CATEGORIES = [
  { id: 'GRAM', label: 'Gram Altın' },
  { id: 'SIKKE', label: 'Fiziki Altın' },
  { id: 'BILEZIK', label: 'Bilezik' },
  { id: 'TAKI', label: 'Takı' },
] as const;

export const SILVER_CATEGORIES = [
  { id: 'SILVER', label: 'Gümüş' }
] as const;

export interface GoldModelDefinition {
  id: string;
  label: string;
  fixedCarat?: number;
}

export const GOLD_TYPES: GoldTypeDefinition[] = [
  // GRAMLAR
  { id: 'GRAM_24', label: '24 Ayar', multiplier: 1, category: 'GRAM', defaultCarat: 24, fixedCarat: true },
  { id: 'GRAM_22', label: '22 Ayar', multiplier: 0.9166, category: 'GRAM', defaultCarat: 22, fixedCarat: true },
  { id: 'GRAM_18', label: '18 Ayar', multiplier: 0.750, category: 'GRAM', defaultCarat: 18, fixedCarat: true },
  { id: 'GRAM_14', label: '14 Ayar', multiplier: 0.5833, category: 'GRAM', defaultCarat: 14, fixedCarat: true },

  // SİKKELER (Adet bazlı)
  { id: 'CEYREK', label: 'Çeyrek Altın', multiplier: 1.6065, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'YARIM', label: 'Yarım Altın', multiplier: 3.213, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'TAM', label: 'Tam Altın', multiplier: 6.426, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'ATA', label: 'Ata Altın', multiplier: 6.608, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'CUMHURIYET', label: 'Cumhuriyet Altını', multiplier: 6.608, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'GREMSE', label: 'Gremse Altın', multiplier: 16.065, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'RESAT', label: 'Reşat Altın', multiplier: 6.608, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },
  { id: 'BESLI', label: 'Beşi Bir Arada', multiplier: 33.04, category: 'SIKKE', defaultCarat: 22, fixedCarat: true },

  // BİLEZİKLER
  { id: 'BILEZIK_22', label: '22 Ayar Bilezik', multiplier: 0.9166, category: 'BILEZIK', defaultCarat: 22 },
  { id: 'BILEZIK_14', label: '14 Ayar Bilezik', multiplier: 0.5833, category: 'BILEZIK', defaultCarat: 14 },

  // TAKILAR
  { id: 'TAKI_22', label: '22 Ayar Takı', multiplier: 0.9166, category: 'TAKI', defaultCarat: 22 },
  { id: 'TAKI_14', label: '14 Ayar Takı', multiplier: 0.5833, category: 'TAKI', defaultCarat: 14 },
  { id: 'TAKI_8', label: '8 Ayar Takı', multiplier: 0.3333, category: 'TAKI', defaultCarat: 8 },

  // GÜMÜŞLER
  { id: 'SILVER_999', label: '999 Has Gümüş', multiplier: 1, category: 'SILVER' },
  { id: 'SILVER_925', label: '925 Ayar Gümüş', multiplier: 0.925, category: 'SILVER' },
];

export const BILEZIK_MODELS: GoldModelDefinition[] = [
  { id: 'Ajda', label: 'Ajda', fixedCarat: 22 },
  { id: 'Adana Burması', label: 'Adana Burması', fixedCarat: 22 },
  { id: 'Trabzon Hasırı', label: 'Trabzon Hasırı' },
  { id: 'Mega', label: 'Mega' },
  { id: 'Şarnel', label: 'Şarnel' },
  { id: 'İşçilikli', label: 'İşçilikli' },
  { id: 'Düz/Hediyelik', label: 'Düz/Hediyelik' },
  { id: 'Diğer', label: 'Diğer' }
];

export const TAKI_TYPES: GoldModelDefinition[] = [
  { id: 'Kolye', label: 'Kolye' },
  { id: 'Küpe', label: 'Küpe' },
  { id: 'Yüzük', label: 'Yüzük' },
  { id: 'Set', label: 'Set' },
  { id: 'Zincir', label: 'Zincir' },
  { id: 'Kelepçe', label: 'Kelepçe' },
  { id: 'Diğer', label: 'Diğer' }
];

export const GOLD_CARATS = [
  { value: 24, label: '24 Ayar' },
  { value: 22, label: '22 Ayar' },
  { value: 18, label: '18 Ayar' },
  { value: 14, label: '14 Ayar' },
  { value: 8, label: '8 Ayar' },
];

export const getGoldType = (id: string) => GOLD_TYPES.find(t => t.id === id);

export const calculatePureMetalWeight = (typeId: string, amount: number, weightPerUnit?: number) => {
  const type = getGoldType(typeId);
  if (!type) return 0;

  if (type.category === 'SIKKE') {
    return amount * type.multiplier;
  }

  if (type.category === 'BILEZIK' || type.category === 'TAKI') {
    // amount is quantity, weightPerUnit is grams per item
    return amount * (weightPerUnit || 0) * type.multiplier;
  }

  // GRAM category: amount is total weight
  return amount * type.multiplier;
};
