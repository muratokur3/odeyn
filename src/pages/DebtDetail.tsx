import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDebtDetails } from '../hooks/useDebtDetails';
import { usePayment } from '../hooks/usePayment';
import { declarePayment, softDeleteDebt, updateDebt, deletePendingDebt, forgiveDebt } from '../services/db'; // Added new services
import { checkBlockStatus } from '../services/blockService'; // Import block check
import { useAuth } from '../hooks/useAuth';
import { HistoryList } from '../components/HistoryList';
import { PaymentModal } from '../components/PaymentModal';
import { InstallmentList } from '../components/InstallmentList';
import { EditDebtModal } from '../components/EditDebtModal';
import { formatCurrency } from '../utils/format';
import { ArrowLeft, Trash2, Edit2, MessageCircle, Phone, XCircle, CheckCircle, Ban } from 'lucide-react'; // Added icons
import type { Debt } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import clsx from 'clsx';

import { useModal } from '../context/ModalContext';

export const DebtDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { debt, logs, loading } = useDebtDetails(id);
    const { user } = useAuth();
    const { pay } = usePayment();
    const { showAlert, showConfirm } = useModal();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | undefined>(undefined);
    const [paymentInitialAmount, setPaymentInitialAmount] = useState<number | undefined>(undefined);
    const [paymentInitialNote, setPaymentInitialNote] = useState<string>('');
    const [isBlocked, setIsBlocked] = useState(false);

    const isLender = user?.uid === debt?.lenderId;
    const isBorrower = user?.uid === debt?.borrowerId;

    // Check block status
    useEffect(() => {
        const check = async () => {
            if (user && debt) {
                const otherId = isLender ? debt.borrowerId : debt.lenderId;
                if (otherId.length > 20) {
                    const blocked = await checkBlockStatus(user.uid, otherId);
                    setIsBlocked(blocked);
                }
            }
        };
        check();
    }, [user, debt, isLender]);

    const handleDelete = async () => {
        if (!debt || !user) return;

        // Logic for Pending Deletion (Hard Delete) vs Active (Soft/Forgive)
        if (debt.status === 'PENDING' && debt.createdBy === user.uid) {
             const confirmed = await showConfirm(
                "Borcu İptal Et",
                "Bu bekleyen borç kaydını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
                "warning"
            );
            if (confirmed) {
                await deletePendingDebt(debt.id, user.uid);
                navigate(-1);
                showAlert("Başarılı", "Borç kaydı silindi.", "success");
            }
        } else {
             // Fallback to soft delete for others or use Archive logic
             const confirmed = await showConfirm(
                "Arşivle",
                "Bu borç kaydını arşivlemek/gizlemek istediğinize emin misiniz?",
                "info"
            );
            if (confirmed) {
                await softDeleteDebt(debt.id);
                navigate(-1);
                showAlert("Başarılı", "Kayıt arşivlendi.", "success");
            }
        }
    };

    const handleForgive = async () => {
         if (!debt || !user) return;
         if (isBlocked) {
             showAlert("Hata", "Engellenen kullanıcıyla işlem yapılamaz.", "error");
             return;
         }
         const confirmed = await showConfirm(
            "Borcu Sil / Hibe Et",
            "Bu borcu ödendi olarak işaretleyip kapatmak istediğinize emin misiniz? Kalan tutar sıfırlanacak.",
            "warning"
        );
        if (confirmed) {
            await forgiveDebt(debt.id, user.uid);
            showAlert("Başarılı", "Borç silindi/hibe edildi.", "success");
        }
    };

    const handleUpdate = async (debtId: string, data: Partial<Debt>) => {
        if (isBlocked) {
             showAlert("Hata", "Engellenen kullanıcıyla işlem yapılamaz.", "error");
             return;
        }
        await updateDebt(debtId, data);
        showAlert("Başarılı", "Borç güncellendi.", "success");
    };

    const handlePayment = async (amount: number, note: string) => {
        if (!debt || !user) return;
        if (isBlocked) {
             showAlert("Hata", "Engellenen kullanıcıyla işlem yapılamaz.", "error");
             return;
        }

        if (isBorrower && !debt.canBorrowerAddPayment) {
            await declarePayment(debt.id, amount, note, user.uid, selectedInstallmentId);
            showAlert("Bildirim Gönderildi", "Ödeme bildirimi gönderildi. Alacaklı onayladığında düşülecektir.", "info");
        } else {
            // Lender OR Borrower with permission
            await pay(debt.id, amount, note);
            showAlert("Başarılı", "Ödeme eklendi.", "success");
        }
        setIsPaymentModalOpen(false);
        setSelectedInstallmentId(undefined);
        setPaymentInitialAmount(undefined);
        setPaymentInitialNote('');
    };

    const handleInstallmentPayment = (amount: number, note: string, installmentId: string) => {
        if (isBlocked) {
             showAlert("Hata", "Engellenen kullanıcıyla işlem yapılamaz.", "error");
             return;
        }
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
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-background rounded-full transition-colors"
                            aria-label="Geri dön"
                        >
                            <ArrowLeft size={24} className="text-text-secondary" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary truncate max-w-[200px]">
                                {debt.borrowerName} & {debt.lenderName}
                            </h1>
                            {/* Communication Buttons */}
                            {(isLender || isBorrower) && !isBlocked && (
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
                    <div className="flex gap-1">
                         {/* Forgive Button (Only Lender can forgive Active Debts) */}
                         {isLender && debt.status !== 'PENDING' && debt.remainingAmount > 0 && !isBlocked && (
                            <button
                                onClick={handleForgive}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                                title="Borcu Sil/Hibe Et"
                                aria-label="Borcu Sil/Hibe Et"
                            >
                                <CheckCircle size={20} />
                            </button>
                        )}

                        {/* Edit Button (Creator or allowed) */}
                        {user?.uid === debt.createdBy && debt.status !== 'PAID' && !isBlocked && (
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
                                aria-label="Düzenle"
                            >
                                <Edit2 size={20} />
                            </button>
                        )}

                        {/* Delete/Cancel Button */}
                        {(user?.uid === debt.createdBy || debt.status === 'PENDING') && (
                            <button
                                onClick={handleDelete}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                title={debt.status === 'PENDING' ? 'İptal Et' : 'Arşivle'}
                                aria-label={debt.status === 'PENDING' ? 'İptal Et' : 'Arşivle'}
                            >
                                {debt.status === 'PENDING' ? <XCircle size={20} /> : <Trash2 size={20} />}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Blocked Banner */}
                {isBlocked && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
                         <Ban className="text-red-600 shrink-0" size={24} />
                         <div>
                            <h3 className="font-bold text-red-700 dark:text-red-300">İşlemler Kısıtlandı</h3>
                            <p className="text-sm text-red-600 dark:text-red-400">Bu işlem engellenen bir kullanıcıya ait olduğu için ödeme, düzenleme ve iletişim özellikleri devre dışı bırakılmıştır.</p>
                         </div>
                    </div>
                )}

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
                        disabled={isBlocked}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all",
                            isBlocked
                                ? "bg-gray-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed shadow-none"
                                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                        )}
                    >
                        {isBlocked ? 'İşlem Kısıtlı' : (isBorrower && !debt.canBorrowerAddPayment ? 'Ödeme Bildir' : 'Ödeme Ekle')}
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
