import { useState, useEffect, useMemo } from 'react';
import { Calculator, ArrowRightLeft, Delete } from 'lucide-react';
import { fetchRates, convertToTRY, fetchTurkishGoldRates, type CurrencyRates, type TurkishGoldRates } from '../services/currency';
import { formatCurrency } from '../utils/format';
import { clsx } from 'clsx';

export const Tools = () => {
    const [activeTab, setActiveTab] = useState<'CALCULATOR' | 'CONVERTER'>('CALCULATOR');

    return (
        <div className="min-h-[calc(100dvh-6rem)] flex flex-col pt-4 pb-0 bg-background transition-colors duration-200">
            {/* Centered Content Wrapper */}
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full px-4">

                {/* Segmented Control */}
                <div className="bg-surface p-1 rounded-xl flex mb-6 border border-border shadow-sm">
                    <button
                        onClick={() => setActiveTab('CALCULATOR')}
                        className={clsx(
                            "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                            activeTab === 'CALCULATOR' ? "bg-background text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Calculator size={18} />
                        Hesapla
                    </button>
                    <button
                        onClick={() => setActiveTab('CONVERTER')}
                        className={clsx(
                            "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                            activeTab === 'CONVERTER' ? "bg-background text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <ArrowRightLeft size={18} />
                        Çevirici
                    </button>
                </div>

                <div className="animate-in fade-in zoom-in-95 duration-300">
                    {activeTab === 'CALCULATOR' && <CalculatorView />}
                    {activeTab === 'CONVERTER' && <ConverterView />}
                </div>
            </div>
        </div>
    );
};

const CalcButton = ({ children, variant = 'default', className, ...props }: { children: React.ReactNode, variant?: 'default' | 'operator' | 'action', className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const baseClass = "h-14 sm:h-16 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-medium shadow-sm active:scale-95 transition-all flex items-center justify-center select-none";

    let typeClass = "bg-surface text-text-primary hover:bg-slate-100 dark:hover:bg-slate-700/50 border-b-2 border-border";
    if (variant === 'operator') typeClass = "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20 shadow-lg border-b-4 border-orange-700 active:border-b-0 active:translate-y-[2px]";
    if (variant === 'action') typeClass = "bg-gray-200 dark:bg-slate-700 text-text-primary hover:bg-gray-300 dark:hover:bg-slate-600 border-b-2 border-gray-300 dark:border-slate-800";

    return (
        <button
            className={clsx(baseClass, typeClass, className)}
            type="button"
            {...props}
        >
            {children}
        </button>
    );
};

const CalculatorView = () => {
    const [display, setDisplay] = useState('0');
    const [prevValue, setPrevValue] = useState<number | null>(null);
    const [operator, setOperator] = useState<string | null>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(true);

    const clear = () => {
        setDisplay('0');
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
    };

    const inputDigit = (digit: string) => {
        if (waitingForOperand) {
            setDisplay(digit);
            setWaitingForOperand(false);
        } else {
            setDisplay(display === '0' ? digit : display + digit);
        }
    };

    const inputDot = () => {
        if (waitingForOperand) {
            setDisplay('0.');
            setWaitingForOperand(false);
            return;
        }
        if (!display.includes('.')) {
            setDisplay(display + '.');
        }
    };

    const backspace = () => {
        if (waitingForOperand) return;
        setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    };

    const calculate = (prev: number, next: number, op: string): number => {
        switch (op) {
            case '+': return prev + next;
            case '-': return prev - next;
            case '*': return prev * next;
            case '/': return prev / next;
            default: return next;
        }
    };

    const performOperation = (nextOperator: string) => {
        const inputValue = parseFloat(display);

        if (operator && waitingForOperand) {
            setOperator(nextOperator);
            return;
        }

        if (prevValue === null) {
            setPrevValue(inputValue);
        } else if (operator) {
            const result = calculate(prevValue, inputValue, operator);
            setDisplay(String(result));
            setPrevValue(result);
        }

        setWaitingForOperand(true);
        setOperator(nextOperator === '=' ? null : nextOperator);
    };

    return (
        <div className="w-full">
            <div className="bg-surface text-right p-6 rounded-2xl mb-6 border border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] min-h-[5rem] flex items-end justify-end">
                <span className="text-4xl font-bold text-text-primary break-all line-clamp-1 tracking-tight">{display}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
                <CalcButton variant="action" onClick={clear}>C</CalcButton>
                <CalcButton variant="action" onClick={backspace}><Delete size={24} /></CalcButton>
                <CalcButton variant="action" onClick={() => performOperation('%')}>%</CalcButton>
                <CalcButton variant="operator" onClick={() => performOperation('/')}>÷</CalcButton>

                <CalcButton onClick={() => inputDigit('7')}>7</CalcButton>
                <CalcButton onClick={() => inputDigit('8')}>8</CalcButton>
                <CalcButton onClick={() => inputDigit('9')}>9</CalcButton>
                <CalcButton variant="operator" onClick={() => performOperation('*')}>×</CalcButton>

                <CalcButton onClick={() => inputDigit('4')}>4</CalcButton>
                <CalcButton onClick={() => inputDigit('5')}>5</CalcButton>
                <CalcButton onClick={() => inputDigit('6')}>6</CalcButton>
                <CalcButton variant="operator" onClick={() => performOperation('-')}>-</CalcButton>

                <CalcButton onClick={() => inputDigit('1')}>1</CalcButton>
                <CalcButton onClick={() => inputDigit('2')}>2</CalcButton>
                <CalcButton onClick={() => inputDigit('3')}>3</CalcButton>
                <CalcButton variant="operator" onClick={() => performOperation('+')}>+</CalcButton>

                <CalcButton className="col-span-2" onClick={() => inputDigit('0')}>0</CalcButton>
                <CalcButton onClick={inputDot}>.</CalcButton>
                <CalcButton variant="operator" onClick={() => performOperation('=')}>=</CalcButton>
            </div>
        </div>
    );
};

const ConverterView = () => {
    const [amount, setAmount] = useState<string>('1');
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('TRY');
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [turkishGold, setTurkishGold] = useState<TurkishGoldRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
        fetchTurkishGoldRates().then(setTurkishGold);
    }, []);

    // All supported converter options
    const CURRENCY_OPTIONS = [
        { value: 'TRY',      label: '₺ Türk Lirası' },
        { value: 'USD',      label: '$ Amerikan Doları' },
        { value: 'EUR',      label: '€ Euro' },
        { value: 'GBP',      label: '£ İngiliz Sterlini' },
        { value: 'CHF',      label: '₣ İsviçre Frangı' },
        { value: 'SAR',      label: 'SAR Suudi Riyali' },
        { value: 'JPY',      label: '¥ Japon Yeni' },
        { value: 'CAD',      label: 'C$ Kanada Doları' },
        { value: 'AUD',      label: 'A$ Avustralya Doları' },
    ];

    const GOLD_OPTIONS = [
        { value: 'GOLD:GRAM_24',  label: '🥇 Has Altın (gram)' },
        { value: 'GOLD:GRAM_22',  label: '🥇 22 Ayar Altın (gram)' },
        { value: 'GOLD:GRAM_18',  label: '🥇 18 Ayar Altın (gram)' },
        { value: 'GOLD:GRAM_14',  label: '🥇 14 Ayar Altın (gram)' },
        { value: 'GOLD:CEYREK',   label: '🪙 Çeyrek Altın' },
        { value: 'GOLD:YARIM',    label: '🪙 Yarım Altın' },
        { value: 'GOLD:TAM',      label: '🪙 Tam Altın' },
        { value: 'GOLD:ATA',      label: '🪙 Ata Altın' },
        { value: 'GOLD:CUMHURIYET', label: '🪙 Cumhuriyet Altını' },
        { value: 'SILVER_999',    label: '🥈 Has Gümüş (gram)' },
    ];

    // Convert any supported currency to TRY
    const toTRY = (val: number, currency: string): number => {
        if (currency === 'TRY') return val;

        // Gold types
        if (currency.startsWith('GOLD:')) {
            const goldTypeId = currency.split(':')[1];

            if (turkishGold) {
                const sikkeMap: Record<string, number> = {
                    CEYREK: turkishGold.CEYREK,
                    YARIM: turkishGold.YARIM,
                    TAM: turkishGold.TAM,
                    ATA: turkishGold.ATA,
                    CUMHURIYET: turkishGold.ATA,
                };
                if (sikkeMap[goldTypeId] > 0) return val * sikkeMap[goldTypeId];

                const purityMap: Record<string, number> = {
                    GRAM_24: 1, GRAM_22: 0.9166, GRAM_18: 0.750, GRAM_14: 0.5833,
                };
                if (purityMap[goldTypeId] !== undefined && turkishGold.gramBase > 0) {
                    return val * purityMap[goldTypeId] * turkishGold.gramBase;
                }
            }

            // Fallback to xau
            if (rates) return convertToTRY(val, 'GOLD', rates, undefined, { type: goldTypeId });
            return 0;
        }

        // Silver
        if (currency === 'SILVER_999') {
            if (!rates) return 0;
            const rate = rates.usd['xag'];
            const usdToTry = rates.usd['try'];
            if (!rate || !usdToTry) return 0;
            return val * (1 / rate / 31.1034768) * usdToTry;
        }

        // Fiat
        if (!rates) return 0;
        return convertToTRY(val, currency, rates);
    };

    const result = useMemo(() => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) return null;

        const amountInTry = toTRY(numAmount, fromCurrency);
        const oneUnitToInTry = toTRY(1, toCurrency);
        if (oneUnitToInTry > 0) return amountInTry / oneUnitToInTry;
        return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount, fromCurrency, toCurrency, rates, turkishGold]);

    const isLoading = !rates && !turkishGold;
    const displayCurrency = toCurrency.startsWith('GOLD:') ? 'GOLD' : toCurrency === 'SILVER_999' ? 'SILVER' : toCurrency;

    // Dynamic font size: shrinks as formatted result grows longer
    const resultStr = formatCurrency(result ?? 0, displayCurrency);
    const resultFontSize = (() => {
        const len = resultStr.length;
        if (len <= 8)  return '3.2rem';
        if (len <= 11) return '2.5rem';
        if (len <= 14) return '2rem';
        if (len <= 17) return '1.5rem';
        return '1.2rem';
    })();

    const amountFontSize = (() => {
        const len = (amount || '').length;
        if (len <= 8)  return '2.2rem';
        if (len <= 11) return '1.8rem';
        if (len <= 14) return '1.4rem';
        return '1.1rem';
    })();

    const CurrencySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent font-bold text-sm text-text-primary outline-none cursor-pointer"
        >
            <optgroup label="Para Birimleri">
                {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Altın &amp; Gümüş">
                {GOLD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
        </select>
    );

    // Short label for the badge chip
    const getShortLabel = (val: string) => {
        if (val.startsWith('GOLD:')) {
            const map: Record<string, string> = {
                GRAM_24: '24K', GRAM_22: '22K', GRAM_18: '18K', GRAM_14: '14K',
                CEYREK: 'Çeyrek', YARIM: 'Yarım', TAM: 'Tam', ATA: 'Ata',
                CUMHURIYET: 'Cum.'
            };
            return map[val.split(':')[1]] ?? val.split(':')[1];
        }
        if (val === 'SILVER_999') return 'Gümüş';
        return val;
    };

    return (
        <div className="w-full space-y-3">

            {/* ── Result card (top, most prominent) ── */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 shadow-2xl shadow-violet-900/30">
                {/* decorative blur blobs */}
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5 blur-xl pointer-events-none" />

                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1 relative z-10">Sonuç</p>
                {isLoading ? (
                    <div className="flex items-center gap-2 relative z-10">
                        <div className="w-3 h-3 rounded-full bg-white/40 animate-bounce [animation-delay:.1s]" />
                        <div className="w-3 h-3 rounded-full bg-white/40 animate-bounce [animation-delay:.2s]" />
                        <div className="w-3 h-3 rounded-full bg-white/40 animate-bounce [animation-delay:.3s]" />
                    </div>
                ) : (
                    <h2
                        className="font-black text-white tracking-tight leading-none relative z-10 tabular-nums transition-all duration-200"
                        style={{ fontSize: resultFontSize }}
                    >
                        {resultStr}
                    </h2>
                )}

                <div className="flex items-center gap-2 mt-3 relative z-10 flex-wrap">
                    <span className="text-xs text-white/70 font-medium">
                        {amount || '1'} <span className="font-bold text-white">{getShortLabel(fromCurrency)}</span>
                        {' '}&rarr;{' '}
                        <span className="font-bold text-white">{getShortLabel(toCurrency)}</span>
                    </span>
                    {turkishGold && (
                        <span className="ml-auto text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-semibold border border-emerald-400/20">
                            ✓ TR Piyasa
                        </span>
                    )}
                </div>
            </div>

            {/* ── Amount input ── */}
            <div className="bg-surface rounded-2xl border border-border px-5 py-4 shadow-sm">
                <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase tracking-widest">Miktar</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full font-bold bg-transparent outline-none text-text-primary placeholder-text-secondary/30 tabular-nums transition-all duration-150"
                    style={{ fontSize: amountFontSize }}
                    placeholder="0"
                    inputMode="decimal"
                />
            </div>

            {/* ── From / Swap / To ── */}
            <div className="grid grid-cols-[1fr,44px,1fr] gap-2 items-stretch">
                {/* From */}
                <div className="bg-surface rounded-2xl border border-border px-4 py-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Kaynak</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-black text-text-primary">{getShortLabel(fromCurrency)}</span>
                    </div>
                    <CurrencySelect value={fromCurrency} onChange={setFromCurrency} />
                </div>

                {/* Swap */}
                <button
                    onClick={() => { setFromCurrency(toCurrency); setToCurrency(fromCurrency); }}
                    className="self-center rounded-full w-11 h-11 flex items-center justify-center bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-90 transition-all"
                >
                    <ArrowRightLeft size={18} />
                </button>

                {/* To */}
                <div className="bg-surface rounded-2xl border border-border px-4 py-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Hedef</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-lg font-black text-text-primary">{getShortLabel(toCurrency)}</span>
                    </div>
                    <CurrencySelect value={toCurrency} onChange={setToCurrency} />
                </div>
            </div>

            <p className="text-center text-[10px] text-text-secondary/50 font-medium">
                * Kurlar 8 saatte bir güncellenir
            </p>
        </div>
    );
};


