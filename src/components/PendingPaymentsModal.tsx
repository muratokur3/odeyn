import React from 'react';
import { X, Calendar, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import type { Debt } from '../types';
import clsx from 'clsx';

interface PendingPaymentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    toPay: Debt[];
    toReceive: Debt[];
}

export const PendingPaymentsModal: React.FC<PendingPaymentsModalProps> = ({ isOpen, onClose, toPay, toReceive }) => {
    const navigate = useNavigate();
    const [now] = React.useState(() => Date.now());

    if (!isOpen) return null;

    const renderDebtItem = (debt: Debt, type: 'PAY' | 'RECEIVE') => {
        // Find the effective due date: either the top-level dueDate or the next unpaid installment
        let effectiveDate = debt.dueDate;
        if (debt.installments && debt.installments.length > 0) {
            const nextInstallment = debt.installments
                .filter(i => !i.isPaid)
                .sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis())[0];
            
            if (nextInstallment) {
                effectiveDate = nextInstallment.dueDate;
            }
        }

        const isOverdue = effectiveDate ? effectiveDate.toMillis() < now : false;
        const name = type === 'PAY' ? debt.lenderName : debt.borrowerName;

        return (
            <div
                key={debt.id}
                onClick={() => {
                    navigate(`/debt/${debt.id}`);
                    onClose();
                }}
                className={clsx(
                    "p-3 rounded-xl border cursor-pointer transition-all active:scale-95 group",
                    isOverdue 
                        ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" 
                        : "bg-surface border-border hover:border-primary"
                )}
            >
                <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-text-secondary truncate max-w-[150px]">
                        {name}
                    </span>
                    <span className={clsx(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold",
                        isOverdue ? "bg-red-500 text-white" : "bg-orange-500/20 text-orange-500"
                    )}>
                        {isOverdue ? 'GECİKTİ' : 'YAKLAŞTI'}
                    </span>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="text-lg font-black text-text-primary">
                        {formatCurrency(debt.remainingAmount, debt.currency)}
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] text-text-secondary flex items-center gap-1">
                            <Calendar size={10} />
                            {effectiveDate ? formatDistanceToNow(effectiveDate.toDate(), { addSuffix: true, locale: tr }) : 'Vadesiz'}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-black/60 backdrop-blur-md" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-surface rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in slide-in-from-top-4 border border-border max-h-[85vh] flex flex-col"
            >
                <div className="flex justify-between items-center p-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600/10 p-2 rounded-lg">
                            <Clock size={20} className="text-blue-600" />
                        </div>
                        <h2 className="text-lg font-black text-text-primary tracking-tight">Yaklaşan Ödemeler</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 space-y-8 flex-1">
                    {/* TO RECEIVE */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={18} className="text-emerald-500" />
                            <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">Alacaklarım</h3>
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {toReceive.length}
                            </span>
                        </div>
                        {toReceive.length === 0 ? (
                            <p className="text-xs text-text-secondary italic pl-7">Yaklaşan tahsilat yok.</p>
                        ) : (
                            <div className="space-y-3">
                                {toReceive.map(d => renderDebtItem(d, 'RECEIVE'))}
                            </div>
                        )}
                    </section>

                    {/* TO PAY */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingDown size={18} className="text-rose-500" />
                            <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">Borçlarım</h3>
                            <span className="bg-rose-500/10 text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {toPay.length}
                            </span>
                        </div>
                        {toPay.length === 0 ? (
                            <p className="text-xs text-text-secondary italic pl-7">Yaklaşan ödeme yok.</p>
                        ) : (
                            <div className="space-y-3">
                                {toPay.map(d => renderDebtItem(d, 'PAY'))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
                    <p className="text-[10px] text-center text-text-secondary font-medium">
                        Vadesi gelen veya 14 gün içinde vadesi dolacak aktif kayıtlar burada listelenir.
                    </p>
                </div>
            </div>
        </div>
    );
};
