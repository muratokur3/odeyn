import { Wallet, ArrowDownCircle, ArrowUpCircle, Minus } from 'lucide-react';
import clsx from 'clsx';

interface BalanceCardProps {
    totalAmount: number;
    currency?: string;
    activeCount: number;
    direction: 'receivable' | 'payable' | 'neutral';
}

export const BalanceCard = ({ totalAmount, currency = 'TRY', activeCount, direction }: BalanceCardProps) => {
    const isPositive = direction === 'receivable';
    const isNegative = direction === 'payable';

    // Soft gradient colors like Dashboard SummaryCard
    const bgClass = isPositive
        ? "bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-900/20"
        : isNegative
            ? "bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-900/20"
            : "bg-gradient-to-br from-slate-500 to-gray-700 shadow-slate-900/20";

    const icon = isPositive ? (
        <ArrowDownCircle className="text-emerald-100" size={20} />
    ) : isNegative ? (
        <ArrowUpCircle className="text-rose-100" size={20} />
    ) : (
        <Minus className="text-slate-100" size={20} />
    );

    const directionText = isPositive ? 'Alacak' : isNegative ? 'Borç' : 'Dengede';
    const directionIcon = isPositive ? '↓' : isNegative ? '↑' : '•';

    return (
        <div className="w-full">
            <div className={clsx(
                "rounded-2xl p-6 shadow-lg text-white transition-all relative overflow-hidden",
                bgClass
            )}>
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Wallet size={100} />
                </div>

                <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 opacity-90">
                            <Wallet size={16} />
                            <span className="text-sm font-medium">Toplam Bakiye</span>
                        </div>
                        <span className="text-xs bg-white/20 px-2 py-1 rounded font-bold backdrop-blur-sm uppercase">
                            {currency}
                        </span>
                    </div>

                    {/* Main Amount */}
                    <div className="mb-4 text-center">
                        <div className="text-4xl font-bold tracking-tight tabular-nums">
                            {new Intl.NumberFormat('tr-TR').format(Math.abs(totalAmount))} TL
                        </div>
                    </div>

                    {/* Footer - Direction & Active Count */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/20">
                        <div className="flex items-center gap-2">
                            {icon}
                            <span className="text-sm font-medium opacity-90">
                                {directionIcon} {directionText}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            <span className="text-xs opacity-70">Aktif:</span>
                            <span className="font-bold text-sm">{activeCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
