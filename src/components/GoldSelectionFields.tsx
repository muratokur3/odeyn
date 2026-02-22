import React from 'react';
import { GOLD_TYPES, GOLD_CATEGORIES, BILEZIK_MODELS, TAKI_TYPES, GOLD_CARATS, getGoldType } from '../utils/goldConstants';
import type { GoldDetail } from '../types';

// Helper to prevent NaN in Firestore
const safeParseFloat = (val: string | number): number | undefined => {
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return (num !== null && num !== undefined && !isNaN(num) && isFinite(num)) ? num : undefined;
};

interface GoldSelectionFieldsProps {
    goldCategory: string;
    setGoldCategory: (cat: string) => void;
    goldTypeId: string;
    setGoldTypeId: (id: string) => void;
    goldSubType: string;
    setGoldSubType: (sub: string) => void;
    goldWeightPerUnit: string;
    setGoldWeightPerUnit: (weight: string) => void;
    goldCustomCarat: number;
    setGoldCustomCarat: (carat: number) => void;
}

export const GoldSelectionFields: React.FC<GoldSelectionFieldsProps> = ({
    goldCategory,
    setGoldCategory,
    goldTypeId,
    setGoldTypeId,
    goldSubType,
    setGoldSubType,
    goldWeightPerUnit,
    setGoldWeightPerUnit,
    goldCustomCarat,
    setGoldCustomCarat
}) => {
    return (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-200 dark:border-amber-800 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Altın Seçimi</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tight">Altın Grubu</label>
                    <select
                        value={goldCategory}
                        onChange={(e) => {
                            const cat = e.target.value;
                            setGoldCategory(cat);
                            // Set default type for category
                            const firstType = GOLD_TYPES.find(t => t.category === cat);
                            if (firstType) setGoldTypeId(firstType.id);
                            setGoldSubType('');
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    >
                        {GOLD_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                </div>

                {goldCategory !== 'BILEZIK' && (
                    <div>
                        <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tight">Altın Türü</label>
                        <select
                            value={goldTypeId}
                            onChange={(e) => setGoldTypeId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        >
                            {GOLD_TYPES.filter(t => t.category === goldCategory).map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {(goldCategory === 'BILEZIK' || goldCategory === 'TAKI') && (
                <div className="space-y-3 animate-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tight">Model / Detay</label>
                            <select
                                value={goldSubType}
                                onChange={(e) => {
                                    setGoldSubType(e.target.value);
                                    const model = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === e.target.value);
                                    if (model?.fixedCarat) setGoldCustomCarat(model.fixedCarat);
                                }}
                                className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-semibold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            >
                                <option value="">Seçiniz...</option>
                                {(goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tight">Birim Gram</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={goldWeightPerUnit}
                                onChange={(e) => setGoldWeightPerUnit(e.target.value)}
                                placeholder="Örn: 20"
                                className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Carat selection only if not fixed by model and not a fixed-carat type */}
                    {!getGoldType(goldTypeId)?.fixedCarat && !(goldCategory === 'BILEZIK' && BILEZIK_MODELS.find(m => m.id === goldSubType)?.fixedCarat) && (
                        <div>
                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tight">Ayar</label>
                            <select
                                value={goldCustomCarat}
                                onChange={(e) => setGoldCustomCarat(Number(e.target.value))}
                                className="w-full px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            >
                                {GOLD_CARATS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
