import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import clsx from 'clsx';

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
    className?: string; // Additional classes for the container
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
    title,
    currency,
    net,
    receivables,
    payables,
    isToggled,
    onToggle,
    showToggle,
    variant = 'auto',
    className
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
        <div className={clsx("snap-center shrink-0 w-[85%] max-w-[260px]", className)}>
             <div className={clsx(
                "rounded-2xl p-4 shadow-lg text-white transition-all relative overflow-hidden h-full flex flex-col justify-between min-h-[160px]",
                bgClass
            )}>
                {/* Pattern */}
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Wallet size={80} />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2 opacity-90">
                            <div className="flex items-center gap-1.5">
                                <Wallet size={14} />
                                <span className="text-[11px] font-medium truncate max-w-[120px]">{title}</span>
                            </div>
                            {showToggle && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                                    className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold backdrop-blur-sm hover:bg-white/30 transition-colors active:scale-95"
                                >
                                    {isToggled ? `Geri` : 'TRY'}
                                </button>
                            )}
                            {!showToggle && (
                                 <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold backdrop-blur-sm uppercase">{currency}</span>
                            )}
                        </div>

                        <div className="text-2xl font-bold tracking-tight tabular-nums truncate">
                            {formatCurrency(net, isToggled ? 'TRY' : currency)}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-3 mt-4 border-t border-white/10">
                        <div className="flex-1">
                            <p className="text-[10px] opacity-70 mb-0.5 font-medium">Verilen</p>
                            <p className="font-bold text-sm text-emerald-100 tabular-nums truncate">
                                +{formatCurrency(receivables, isToggled ? 'TRY' : currency)}
                            </p>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex-1">
                            <p className="text-[10px] opacity-70 mb-0.5 font-medium">Alınan</p>
                            <p className="font-bold text-sm text-rose-100 tabular-nums truncate">
                                -{formatCurrency(payables, isToggled ? 'TRY' : currency)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
