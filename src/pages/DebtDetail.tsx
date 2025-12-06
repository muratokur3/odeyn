import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDebtDetails } from '../hooks/useDebtDetails';
import { usePayment } from '../hooks/usePayment';
import { declarePayment, softDeleteDebt, updateDebt } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import { HistoryList } from '../components/HistoryList';
import { PaymentModal } from '../components/PaymentModal';
import { InstallmentList } from '../components/InstallmentList';
import { EditDebtModal } from '../components/EditDebtModal';
import { formatCurrency } from '../utils/format';
import { ArrowLeft, Trash2, Edit2, MessageCircle, Phone } from 'lucide-react';
import type { Debt } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import clsx from 'clsx';

export const DebtDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { debt, logs, loading } = useDebtDetails(id);
    const { user } = useAuth();
    const { pay } = usePayment();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | undefined>(undefined);
    const [paymentInitialAmount, setPaymentInitialAmount] = useState<number | undefined>(undefined);
    const [paymentInitialNote, setPaymentInitialNote] = useState<string>('');

    const isLender = user?.uid === debt?.lenderId;
    const isBorrower = user?.uid === debt?.borrowerId;

    const handleDelete = async () => {
        if (confirm("Bu borç kaydını silmek istediğinize emin misiniz? Çöp kutusuna taşınacaktır.")) {
            if (debt) {
                await softDeleteDebt(debt.id);
                navigate(-1);
            }
        }
    };

    const handleUpdate = async (debtId: string, data: Partial<Debt>) => {
        await updateDebt(debtId, data);
    };

    const handlePayment = async (amount: number, note: string) => {
        if (!debt || !user) return;

        if (isBorrower && !debt.canBorrowerAddPayment) {
            await declarePayment(debt.id, amount, note, user.uid, selectedInstallmentId);
            alert("Ödeme bildirimi gönderildi. Alacaklı onayladığında düşülecektir.");
        } else {
            // Lender OR Borrower with permission
            await pay(debt.id, amount, note);
        }
        setIsPaymentModalOpen(false);
        setSelectedInstallmentId(undefined);
        setPaymentInitialAmount(undefined);
        setPaymentInitialNote('');
    };

    const handleInstallmentPayment = (amount: number, note: string, installmentId: string) => {
        setSelectedInstallmentId(installmentId);
        setPaymentInitialAmount(amount);
        setPaymentInitialNote(note);
        setIsPaymentModalOpen(true);
    };

    if (loading) return <div className="flex justify-center items-center h-screen">Yükleniyor...</div>;
    if (!debt) return <div className="flex justify-center items-center h-screen">Borç bulunamadı</div>;

    const progress = ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100;

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            <header className="bg-surface shadow-sm p-4 sticky top-0 z-40 transition-colors duration-200">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-background rounded-full transition-colors">
                            <ArrowLeft size={24} className="text-text-secondary" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary truncate max-w-[200px]">
                                {debt.borrowerName} & {debt.lenderName}
                            </h1>
                            {/* Communication Buttons */}
                            {(isLender || isBorrower) && (
                                <div className="flex items-center gap-2 mt-1">
                                    <a
                                        href={`https://wa.me/${(isLender ? debt.borrowerId : debt.lenderId).replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-600 hover:text-green-700 transition-colors"
                                    >
                                        <MessageCircle size={16} />
                                    </a>
                                    <a
                                        href={`tel:${isLender ? debt.borrowerId : debt.lenderId}`}
                                        className="text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        <Phone size={16} />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                    {user?.uid === debt.createdBy && (
                        <div className="flex gap-1">
                            <button onClick={() => setIsEditModalOpen(true)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full">
                                <Edit2 size={20} />
                            </button>
                            <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Summary Card */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border text-center transition-colors duration-200">
                    <p className="text-text-secondary mb-1">Kalan Tutar</p>
                    <h2 className="text-4xl font-bold text-text-primary mb-6">
                        {formatCurrency(debt.remainingAmount, debt.currency)}
                    </h2>

                    <div className="relative h-3 bg-background rounded-full overflow-hidden mb-2 border border-border">
                        <div
                            className={clsx(
                                "absolute top-0 left-0 h-full transition-all duration-500",
                                progress === 100 ? "bg-green-500" : "bg-blue-500"
                            )}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-text-secondary">
                        <span>%0</span>
                        <span>%{Math.round(progress)} Ödendi</span>
                        <span>%100</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-text-secondary">
                        <span>Ekleyen: {debt.createdBy === user?.uid ? 'Siz' : (user?.uid === debt.lenderId ? debt.borrowerName : debt.lenderName)}</span>
                        <span>{debt.createdAt ? format(debt.createdAt.toDate(), 'd MMM yyyy HH:mm', { locale: tr }) : '-'}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                {debt.status !== 'PAID' && (
                    <button
                        onClick={() => {
                            setPaymentInitialAmount(undefined);
                            setPaymentInitialNote('');
                            setIsPaymentModalOpen(true);
                        }}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all",
                            "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                        )}
                    >
                        {isBorrower && !debt.canBorrowerAddPayment ? 'Ödeme Bildir' : 'Ödeme Ekle'}
                    </button>
                )}

                {/* Installments */}
                {debt.installments && debt.installments.length > 0 && (
                    <InstallmentList
                        installments={debt.installments}
                        currency={debt.currency}
                        onPayInstallment={handleInstallmentPayment}
                        isBorrower={!!isBorrower}
                    />
                )}

                {/* History */}
                <HistoryList
                    logs={logs}
                    currency={debt.currency}
                    isLender={!!isLender}
                    debtId={debt.id}
                />
            </main>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={handlePayment}
                maxAmount={debt.remainingAmount}
                currency={debt.currency}
                initialAmount={paymentInitialAmount}
                initialNote={paymentInitialNote}
            />

            <EditDebtModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                debt={debt}
                onUpdate={handleUpdate}
            />
        </div>
    );
};
