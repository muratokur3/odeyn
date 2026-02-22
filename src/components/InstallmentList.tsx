import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Check, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import type { Installment, GoldDetail } from '../types';
import clsx from 'clsx';

interface InstallmentListProps {
    installments: Installment[];
    currency: string;
    goldDetail?: GoldDetail;
    onPayInstallment: (amount: number, note: string, installmentId: string) => void;
    isBorrower: boolean;
}

export const InstallmentList: React.FC<InstallmentListProps> = ({ installments, currency, goldDetail, onPayInstallment, isBorrower }) => {
    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={18} />
                Taksit Planı
            </h3>
            <div className="space-y-3">
                {installments.map((inst, index) => {
                    const isPreviousPaid = index === 0 || installments[index - 1].isPaid;
                    const canPay = !inst.isPaid && isPreviousPaid;

                    return (
                        <div key={inst.id} className={clsx(
                            "p-3 rounded-lg border flex justify-between items-center shadow-sm",
                            inst.isPaid ? "bg-green-50 border-green-200" : "bg-white border-slate-200",
                            !canPay && !inst.isPaid && "opacity-50"
                        )}>
                            <div>
                                <p className="text-sm font-medium text-gray-900">
                                    {index + 1}. Taksit
                                </p>
                                <p className="text-xs text-gray-500">
                                    Vade: {format(inst.dueDate.toDate(), 'd MMM yyyy', { locale: tr })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={clsx(
                                    "font-semibold",
                                    inst.isPaid ? "text-green-600" : "text-gray-900"
                                )}>
                                    {formatCurrency(inst.amount, currency, goldDetail)}
                                </span>

                                {inst.isPaid ? (
                                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded-full shrink-0">
                                        <Check size={12} /> Ödendi
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onPayInstallment(inst.amount, `${index + 1}. Taksit Ödemesi`, inst.id)}
                                        className={clsx(
                                            "text-xs px-3 py-1.5 rounded-lg transition-all shrink-0 font-bold",
                                            "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-500/20"
                                        )}
                                    >
                                        Öde
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
