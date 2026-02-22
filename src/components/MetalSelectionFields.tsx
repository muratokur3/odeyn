import React from 'react';
import { GOLD_TYPES, GOLD_CATEGORIES, SILVER_CATEGORIES, BILEZIK_MODELS, TAKI_TYPES, GOLD_CARATS, getGoldType } from '../utils/goldConstants';
import clsx from 'clsx';

interface MetalSelectionFieldsProps {
    metal: 'GOLD' | 'SILVER';
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

export const MetalSelectionFields: React.FC<MetalSelectionFieldsProps> = ({
    metal,
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
    const isGold = metal === 'GOLD';
    const categories = isGold ? GOLD_CATEGORIES : SILVER_CATEGORIES;
    const labelPrefix = isGold ? 'Altın' : 'Gümüş';

    return (
        <div className={clsx(
            "p-4 rounded-xl border-2 space-y-3 animate-in fade-in slide-in-from-top-2",
            isGold
                ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                : "bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800"
        )}>
            <div className="flex items-center gap-2 mb-1">
                <div className={clsx(
                    "w-2 h-2 rounded-full animate-pulse",
                    isGold ? "bg-amber-500" : "bg-slate-400"
                )} />
                <span className={clsx(
                    "text-xs font-bold uppercase tracking-wider",
                    isGold ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"
                )}>
                    {labelPrefix} Seçimi
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={clsx(
                        "block text-[10px] font-bold mb-1 uppercase tracking-tight",
                        isGold ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                    )}>
                        {labelPrefix} Grubu
                    </label>
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
                        className={clsx(
                            "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none transition-all",
                            isGold ? "border-amber-200 dark:border-amber-800 focus:ring-2 focus:ring-amber-500" : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-slate-500"
                        )}
                    >
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                </div>

                {goldCategory !== 'BILEZIK' && (
                    <div>
                        <label className={clsx(
                            "block text-[10px] font-bold mb-1 uppercase tracking-tight",
                            isGold ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                        )}>
                            {labelPrefix} Türü
                        </label>
                        <select
                            value={goldTypeId}
                            onChange={(e) => setGoldTypeId(e.target.value)}
                            className={clsx(
                                "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none transition-all",
                                isGold ? "border-amber-200 dark:border-amber-800 focus:ring-2 focus:ring-amber-500" : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-slate-500"
                            )}
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
                            <label className={clsx(
                                "block text-[10px] font-bold mb-1 uppercase tracking-tight",
                                isGold ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                            )}>
                                Model / Detay
                            </label>
                            <select
                                value={goldSubType}
                                onChange={(e) => {
                                    setGoldSubType(e.target.value);
                                    const model = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === e.target.value);
                                    if (model?.fixedCarat) setGoldCustomCarat(model.fixedCarat);
                                }}
                                className={clsx(
                                    "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm font-semibold text-text-primary outline-none transition-all",
                                    isGold ? "border-amber-200 dark:border-amber-800 focus:ring-2 focus:ring-amber-500" : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-slate-500"
                                )}
                            >
                                <option value="">Seçiniz...</option>
                                {(goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={clsx(
                                "block text-[10px] font-bold mb-1 uppercase tracking-tight",
                                isGold ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                            )}>
                                Birim Gram
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={goldWeightPerUnit}
                                onChange={(e) => setGoldWeightPerUnit(e.target.value)}
                                placeholder="Örn: 20"
                                className={clsx(
                                    "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none transition-all",
                                    isGold ? "border-amber-200 dark:border-amber-800 focus:ring-2 focus:ring-amber-500" : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-slate-500"
                                )}
                            />
                        </div>
                    </div>

                    {/* Carat selection only if not fixed by model and not a fixed-carat type */}
                    {!getGoldType(goldTypeId)?.fixedCarat && !(goldCategory === 'BILEZIK' && BILEZIK_MODELS.find(m => m.id === goldSubType)?.fixedCarat) && (
                        <div>
                            <label className={clsx(
                                "block text-[10px] font-bold mb-1 uppercase tracking-tight",
                                isGold ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                            )}>
                                Ayar
                            </label>
                            <select
                                value={goldCustomCarat}
                                onChange={(e) => setGoldCustomCarat(Number(e.target.value))}
                                className={clsx(
                                    "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none transition-all",
                                    isGold ? "border-amber-200 dark:border-amber-800 focus:ring-2 focus:ring-amber-500" : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-slate-500"
                                )}
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
