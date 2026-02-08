import { useState, useEffect, useMemo } from 'react';
import { Calculator, ArrowRightLeft, Delete, Download, FileSpreadsheet } from 'lucide-react';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import { formatCurrency } from '../utils/format';
import { useDebts } from '../hooks/useDebts';
import { exportDebtsToCSV } from '../utils/export';
import { clsx } from 'clsx';

export const Tools = () => {
    const [activeTab, setActiveTab] = useState<'CALCULATOR' | 'CONVERTER' | 'EXPORT'>('CALCULATOR');

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
                    <button
                        onClick={() => setActiveTab('EXPORT')}
                        className={clsx(
                            "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                            activeTab === 'EXPORT' ? "bg-background text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Download size={18} />
                        Dışa Aktar
                    </button>
                </div>

                <div className="animate-in fade-in zoom-in-95 duration-300">
                    {activeTab === 'CALCULATOR' && <CalculatorView />}
                    {activeTab === 'CONVERTER' && <ConverterView />}
                    {activeTab === 'EXPORT' && <ExportView />}
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

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    const result = useMemo(() => {
        if (rates && amount) {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount)) return null;

            const amountInTry = convertToTRY(numAmount, fromCurrency, rates);
            const oneUnitToInTry = convertToTRY(1, toCurrency, rates);

            if (oneUnitToInTry > 0) {
                return amountInTry / oneUnitToInTry;
            }
        }
        return null;
    }, [amount, fromCurrency, toCurrency, rates]);

    return (
        <div className="w-full space-y-4">
            <div className="bg-surface p-6 rounded-2xl border border-border shadow-md ring-1 ring-black/5 dark:ring-white/5 transition-shadow hover:shadow-lg">
                <label className="block text-sm font-medium text-text-secondary mb-2 uppercase tracking-wider">Miktar</label>
                <div className="relative">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full text-4xl font-bold bg-transparent border-b-2 border-border focus:border-primary outline-none py-2 text-text-primary placeholder-gray-300"
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
                    <label className="block text-[10px] font-bold text-text-secondary mb-1 uppercase">Kaynak</label>
                    <select
                        value={fromCurrency}
                        onChange={(e) => setFromCurrency(e.target.value)}
                        className="w-full bg-transparent font-bold text-lg text-text-primary outline-none cursor-pointer"
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
                        className="p-3 rounded-full bg-surface border border-border hover:bg-background text-primary transition-all shadow-sm active:scale-95 active:rotate-180"
                    >
                        <ArrowRightLeft size={20} />
                    </button>
                </div>

                <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
                    <label className="block text-[10px] font-bold text-text-secondary mb-1 uppercase">Hedef</label>
                    <select
                        value={toCurrency}
                        onChange={(e) => setToCurrency(e.target.value)}
                        className="w-full bg-transparent font-bold text-lg text-text-primary outline-none cursor-pointer"
                    >
                        <option value="TRY">TRY</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GOLD">Altın</option>
                    </select>
                </div>
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 p-6 rounded-2xl border border-primary/20 text-center shadow-inner">
                <p className="text-sm font-medium text-text-secondary mb-1">Hesaplanan Değer</p>
                <h2 className="text-4xl font-black text-primary tracking-tight">
                    {formatCurrency(result || 0, toCurrency)}
                </h2>
                <p className="text-xs text-text-secondary mt-2 opacity-60 font-medium">
                    * Döviz kurları anlık değişiklik gösterebilir.
                </p>
            </div>
        </div>
    );
};

const ExportView = () => {
    const { allDebts } = useDebts();

    const handleExport = () => {
        if (allDebts.length === 0) {
            alert('Dışa aktarılacak borç bulunamadı.');
            return;
        }
        exportDebtsToCSV(allDebts);
    };

    return (
        <div className="w-full space-y-6">
            <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm text-center">
                <FileSpreadsheet size={48} className="mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-bold text-text-primary mb-2">Borçları Dışa Aktar</h3>
                <p className="text-sm text-text-secondary mb-4">
                    Tüm borçlarınızı CSV formatında dışa aktarın.
                </p>
                <button
                    onClick={handleExport}
                    disabled={allDebts.length === 0}
                    className="w-full px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    {allDebts.length} Borcu Dışa Aktar
                </button>
            </div>
        </div>
    );
};
