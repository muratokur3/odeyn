import { useState, useEffect } from 'react';
import { Calculator, ArrowRightLeft } from 'lucide-react';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import { formatCurrency } from '../utils/format';
import { clsx } from 'clsx';

export const Tools = () => {
    const [activeTab, setActiveTab] = useState<'CALCULATOR' | 'CONVERTER'>('CALCULATOR');

    return (
        <div className="min-h-full bg-background pb-6 px-4">
            <div className="sticky top-0 bg-background z-10 py-2 border-b border-border/50 mb-2 flex items-center justify-center">
                <h1 className="text-lg font-bold text-text-primary text-center">Araçlar</h1>
            </div>

            {/* Segmented Control */}
            <div className="bg-surface p-0.5 rounded-xl flex mb-4 border border-border">
                <button
                    onClick={() => setActiveTab('CALCULATOR')}
                    className={clsx(
                        "flex-1 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                        activeTab === 'CALCULATOR' ? "bg-background text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <Calculator size={16} />
                    Hesapla
                </button>
                <button
                    onClick={() => setActiveTab('CONVERTER')}
                    className={clsx(
                        "flex-1 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                        activeTab === 'CONVERTER' ? "bg-background text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                    )}
                >
                    <ArrowRightLeft size={16} />
                    Çevirici
                </button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {activeTab === 'CALCULATOR' ? <CalculatorView /> : <ConverterView />}
            </div>
        </div>
    );
};

const CalculatorView = () => {
    const [display, setDisplay] = useState('0');
    const [prevValue, setPrevValue] = useState<number | null>(null);
    const [operator, setOperator] = useState<string | null>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);

    const inputDigit = (digit: string) => {
        if (waitingForOperand) {
            setDisplay(digit);
            setWaitingForOperand(false);
        } else {
            setDisplay(display === '0' ? digit : display + digit);
        }
    };

    const inputDot = () => {
        if (!display.includes('.')) {
            setDisplay(display + '.');
            setWaitingForOperand(false);
        }
    };

    const clear = () => {
        setDisplay('0');
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(false);
    };

    const performOperation = (nextOperator: string) => {
        const inputValue = parseFloat(display);

        if (prevValue === null) {
            setPrevValue(inputValue);
        } else if (operator) {
            const currentValue = prevValue || 0;
            const newValue = calculate(currentValue, inputValue, operator);
            setPrevValue(newValue);
            setDisplay(String(newValue));
        }

        setWaitingForOperand(true);
        setOperator(nextOperator);
    };

    const calculate = (prev: number, next: number, op: string) => {
        switch (op) {
            case '+': return prev + next;
            case '-': return prev - next;
            case '*': return prev * next;
            case '/': return prev / next;
            default: return next;
        }
    };

    const CalcButton = ({ label, type = 'default', onClick }: { label: string, type?: 'default' | 'operator' | 'action', onClick: () => void }) => {
        let bgClass = "bg-surface text-text-primary hover:bg-slate-100 dark:hover:bg-slate-700";
        if (type === 'operator') bgClass = "bg-orange-500 text-white hover:bg-orange-600";
        if (type === 'action') bgClass = "bg-gray-300 dark:bg-slate-600 text-text-primary hover:bg-gray-400 dark:hover:bg-slate-500";

        return (
            <button
                onClick={onClick}
                className={clsx(
                    "h-14 sm:h-16 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-medium shadow-sm active:scale-95 transition-all",
                    bgClass
                )}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="max-w-xs mx-auto">
            <div className="bg-surface text-right p-4 sm:p-6 rounded-2xl mb-4 border border-border min-h-[4rem] sm:min-h-[5rem] flex items-end justify-end">
                <span className="text-3xl sm:text-4xl font-bold text-text-primary truncate">{display}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <CalcButton label="C" type="action" onClick={clear} />
                <CalcButton label="±" type="action" onClick={() => setDisplay(String(parseFloat(display) * -1))} />
                <CalcButton label="%" type="action" onClick={() => setDisplay(String(parseFloat(display) / 100))} />
                <CalcButton label="÷" type="operator" onClick={() => performOperation('/')} />

                <CalcButton label="7" onClick={() => inputDigit('7')} />
                <CalcButton label="8" onClick={() => inputDigit('8')} />
                <CalcButton label="9" onClick={() => inputDigit('9')} />
                <CalcButton label="×" type="operator" onClick={() => performOperation('*')} />

                <CalcButton label="4" onClick={() => inputDigit('4')} />
                <CalcButton label="5" onClick={() => inputDigit('5')} />
                <CalcButton label="6" onClick={() => inputDigit('6')} />
                <CalcButton label="-" type="operator" onClick={() => performOperation('-')} />

                <CalcButton label="1" onClick={() => inputDigit('1')} />
                <CalcButton label="2" onClick={() => inputDigit('2')} />
                <CalcButton label="3" onClick={() => inputDigit('3')} />
                <CalcButton label="+" type="operator" onClick={() => performOperation('+')} />

                <button onClick={() => inputDigit('0')} className="col-span-2 h-14 sm:h-16 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-medium shadow-sm active:scale-95 transition-all bg-surface text-text-primary hover:bg-slate-100 dark:hover:bg-slate-700">0</button>
                <CalcButton label="." onClick={inputDot} />
                <CalcButton label="=" type="operator" onClick={() => performOperation('=')} />
            </div>
        </div>
    );
};

const ConverterView = () => {
    const [amount, setAmount] = useState<string>('1');
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('TRY');
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [result, setResult] = useState<number | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    useEffect(() => {
        if (rates && amount) {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount)) return;

            // Convert From -> TRY
            const amountInTry = convertToTRY(numAmount, fromCurrency, rates);

            // Convert TRY -> To
            // convertToTRY converts X -> TRY.
            // To convert TRY -> Y, we need 1 / (Y -> TRY rate).
            // This is slightly complex because our convertToTRY is one-way.
            // Let's reuse convertToTRY logic but reverse it for the second step.

            // Simplification: convertToTRY handles X -> TRY.
            // If we want X -> Y:
            // 1. X -> TRY
            // 2. TRY -> Y (which is AmountInTry / (1 Y in TRY))

            const oneUnitToInTry = convertToTRY(1, toCurrency, rates);
            if (oneUnitToInTry > 0) {
                setResult(amountInTry / oneUnitToInTry);
            }
        }
    }, [amount, fromCurrency, toCurrency, rates]);

    return (
        <div className="max-w-sm mx-auto space-y-6">
            <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                <label className="block text-sm font-medium text-text-secondary mb-2">Miktar</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-3xl font-bold bg-transparent border-b border-border focus:border-primary outline-none py-2 text-text-primary"
                    placeholder="0.00"
                />
            </div>

            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                <div className="bg-surface p-4 rounded-xl border border-border">
                    <label className="block text-xs text-text-secondary mb-1">Para Birimi</label>
                    <select
                        value={fromCurrency}
                        onChange={(e) => setFromCurrency(e.target.value)}
                        className="w-full bg-transparent font-semibold text-text-primary outline-none"
                    >
                        <option value="TRY">TRY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GOLD">Altın</option>
                    </select>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={() => {
                            setFromCurrency(toCurrency);
                            setToCurrency(fromCurrency);
                        }}
                        className="p-3 rounded-full bg-surface border border-border hover:bg-background text-primary transition-colors"
                    >
                        <ArrowRightLeft size={20} />
                    </button>
                </div>

                <div className="bg-surface p-4 rounded-xl border border-border">
                    <label className="block text-xs text-text-secondary mb-1">Hedef</label>
                    <select
                        value={toCurrency}
                        onChange={(e) => setToCurrency(e.target.value)}
                        className="w-full bg-transparent font-semibold text-text-primary outline-none"
                    >
                        <option value="TRY">TRY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GOLD">Altın</option>
                    </select>
                </div>
            </div>

            <div className="bg-primary/10 p-6 rounded-2xl border border-primary/20 text-center">
                <p className="text-sm text-text-secondary mb-1">Sonuç</p>
                <h2 className="text-4xl font-bold text-primary">
                    {formatCurrency(result || 0, toCurrency)}
                </h2>
                <p className="text-xs text-text-secondary mt-2 opacity-70">
                    * Kurlar yaklaşık değerlerdir.
                </p>
            </div>
        </div>
    );
};
