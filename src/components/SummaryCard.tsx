import React from 'react';
import { Wallet, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getGoldType } from '../utils/goldConstants';
import clsx from 'clsx';

// Altin/currency label'ini Dashboard ile tutarl\u0131 sekilde al
const getCurrencyLabel = (currency: string): string => {
    if (currency.startsWith('GOLD:')) {
        const goldType = currency.split(':')[1];
        return getGoldType(goldType)?.label || goldType;
    }
    return currency;
};

interface SummaryCardProps {
    title: string;
    currency: string;
    net: number;
    receivables: number;
    payables: number;
    isToggled?: boolean;
    onToggle?: () => void;
    showToggle?: boolean;
    variant?: 'indigo' | 'emerald' | 'rose' | 'auto';
    className?: string;
    isActive?: boolean; // New: For carousel focus
    largeText?: boolean; // New: For profile view
    onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps & React.HTMLAttributes<HTMLDivElement>> = ({
    title,
    currency,
    net,
    receivables,
    payables,
    isToggled,
    onToggle,
    showToggle,
    variant = 'auto',
    className,
    isActive = true,
    largeText = false,
    onClick,
    ...rest
}) => {
    const isNetPositive = net >= 0;
    
    // Size reduction (25% smaller than original dashboard cards)
    // Original: max-w-[340px], p-6, text-4xl, mb-8
    // Shrunken: max-w-[260px], p-4, text-2xl, mb-6

    const bgClass = variant === 'auto' 
        ? (isNetPositive 
            ? "bg-gradient-to-br from-indigo-600 to-purple-800 shadow-indigo-900/20" 
            : "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20")
        : (variant === 'indigo' 
            ? "bg-gradient-to-br from-indigo-600 to-purple-800 shadow-indigo-900/20"
            : variant === 'emerald'
                ? "bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-900/20"
                : "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20");

    return (
        <div 
            className={clsx(
                "snap-center shrink-0 w-[85%] max-w-[320px] transition-all duration-300", 
                !isActive && "opacity-40 grayscale-[20%]",
                className
            )}
            onClick={onClick}
            {...rest}
        >
             <div className={clsx(
                "rounded-2xl p-5 shadow-xl text-white transition-all relative overflow-hidden h-full flex flex-col justify-between min-h-[180px]",
                bgClass
            )}>
                {/* Pattern */}
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Wallet size={80} />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2 opacity-90">
                            <div className="flex items-center gap-2">
                                <Wallet size={largeText ? 18 : 14} />
                                <span className={clsx(
                                    "font-medium truncate max-w-[150px]",
                                    largeText ? "text-sm" : "text-[11px]"
                                )}>
                                    {title}
                                </span>
                            </div>
                            {showToggle && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                                    title={isToggled ? 'Orijinal para birimine dön' : 'TL karşılığını gör'}
                                    className="flex items-center gap-1 text-[10px] bg-white/20 px-2 py-1 rounded-lg font-bold backdrop-blur-sm hover:bg-white/30 transition-colors active:scale-95"
                                >
                                    {isToggled ? (
                                        <>
                                            <ArrowRightLeft size={10} />
                                            <span>{getCurrencyLabel(currency)}</span>
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRightLeft size={10} />
                                            <span>₺</span>
                                        </>
                                    )}
                                </button>
                            )}
                            {!showToggle && (
                                 <span className="text-[10px] bg-white/20 px-2 py-1 rounded-lg font-bold backdrop-blur-sm uppercase">
                                     {getCurrencyLabel(currency)}
                                 </span>
                            )}
                        </div>

                        <div className={clsx(
                            "font-bold tracking-tight tabular-nums truncate",
                            largeText ? "text-3xl mt-1" : "text-2xl"
                        )}>
                            {formatCurrency(net, isToggled ? 'TRY' : currency)}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 mt-5 border-t border-white/10">
                        <div className="flex-1">
                            <p className="text-[10px] opacity-70 mb-0.5 font-medium uppercase tracking-wider">Alacak</p>
                            <p className={clsx("font-bold tabular-nums truncate", largeText ? "text-lg" : "text-sm")}>
                                {formatCurrency(receivables, isToggled ? 'TRY' : currency)}
                            </p>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex-1">
                            <p className="text-[10px] opacity-70 mb-0.5 font-medium uppercase tracking-wider">Borç</p>
                            <p className={clsx("font-bold tabular-nums truncate", largeText ? "text-lg" : "text-sm")}>
                                {formatCurrency(payables, isToggled ? 'TRY' : currency)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
