import React, { useMemo } from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import type { Debt } from '../types';
import clsx from 'clsx';

interface QuickPayWidgetProps {
    debts: Debt[];
    onPay: (debt: Debt) => void;
}

export const QuickPayWidget: React.FC<QuickPayWidgetProps> = ({ debts, onPay }) => {
    // Compute current time once per render to avoid calling impure function in map
    const now = useMemo(() => Date.now(), []);
    
    // Filter for upcoming/overdue debts where I am the borrower
    const upcomingDebts = debts
        .filter(d => d.dueDate && d.status === 'ACTIVE')
        .sort((a, b) => a.dueDate!.toMillis() - b.dueDate!.toMillis())
        .slice(0, 3); // Top 3 most urgent

    if (upcomingDebts.length === 0) return null;

    return (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} className="text-orange-500" />
                    Yaklaşan Ödemeler
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {upcomingDebts.map(debt => {
                    const isOverdue = debt.dueDate!.toMillis() < now;
                    
                    return (
                        <div 
                            key={debt.id} 
                            onClick={() => onPay(debt)}
                            className={clsx(
                                "group bg-surface p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-lg active:scale-95",
                                isOverdue ? "border-red-500/30 bg-red-500/5 shadow-red-500/5" : "border-slate-700 hover:border-primary"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-text-secondary truncate max-w-[120px]">
                                    {debt.lenderName}
                                </span>
                                <span className={clsx(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                    isOverdue ? "bg-red-500 text-white" : "bg-orange-500/20 text-orange-500"
                                )}>
                                    {isOverdue ? 'GECİKTİ' : 'YAKLAŞTI'}
                                </span>
                            </div>
                            
                            <div className="text-xl font-black text-text-primary mb-1">
                                {formatCurrency(debt.remainingAmount, debt.currency)}
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[11px] text-text-secondary">
                                    {formatDistanceToNow(debt.dueDate!.toDate(), { addSuffix: true, locale: tr })}
                                </span>
                                <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
