import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Check, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import type { Installment } from '../types';
import clsx from 'clsx';

interface InstallmentListProps {
    installments: Installment[];
    currency: string;
    onPayInstallment: (amount: number, note: string, installmentId: string) => void;
    isBorrower: boolean;
}

export const InstallmentList: React.FC<InstallmentListProps> = ({ installments, currency, onPayInstallment, isBorrower }) => {
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
                            "p-3 rounded-lg border flex justify-between items-center",
                            inst.isPaid ? "bg-green-50 border-green-100" : "bg-white border-gray-100",
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
                                    {formatCurrency(inst.amount, currency)}
                                </span>

                                {inst.isPaid ? (
                                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded-full">
                                        <Check size={12} /> Ödendi
                                    </div>
                                ) : (
                                    isBorrower && (
                                        <button
                                            onClick={() => onPayInstallment(inst.amount, `${index + 1}. Taksit Ödemesi`, inst.id)}
                                            disabled={!canPay}
                                            className={clsx(
                                                "text-xs px-3 py-1.5 rounded-lg transition-colors",
                                                canPay
                                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            )}
                                        >
                                            Öde
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
