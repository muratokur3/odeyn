import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { ArrowLeft, Plus, Phone, MessageCircle } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { formatCurrency } from '../utils/format';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { cleanPhoneNumber, formatPhoneNumber } from '../utils/phone';
import clsx from 'clsx';

export const PersonDetail = () => {
    const { id } = useParams<{ id: string }>(); // This can be a userId or a contactId (phone number)
    const { user } = useAuth();
    const navigate = useNavigate();
    const { debts, loading } = useDebts();
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch rates for summary calculation
    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // Filter debts for this person
    const personDebts = useMemo(() => {
        if (!debts || !id || !user) return [];
        const cleanId = cleanPhoneNumber(id);

        return debts.filter(d => {
            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const cleanOtherId = cleanPhoneNumber(otherId);

            // Check if ID matches or if it's a phone number match (for non-system users)
            return otherId === id || cleanOtherId === cleanId || (d.participants.includes(id));
        });
    }, [debts, id, user]);

    // Get Person Info from the first debt found (or passed state if we had it)
    const personInfo = useMemo(() => {
        if (personDebts.length === 0) {
            // If ID looks like a phone, format it
            const name = id && id.length <= 15 ? formatPhoneNumber(id) : 'Kişi';
            return { name, phone: id };
        }
        const first = personDebts[0];
        const isLender = first.lenderId === user?.uid;
        let name = isLender ? first.borrowerName : first.lenderName;
        const phone = isLender ? first.borrowerId : first.lenderId;

        // If name is raw phone, format it
        if (name.replace(/\D/g, '').length >= 10 && !name.includes(' ')) {
            name = formatPhoneNumber(name);
        }

        return {
            name,
            phone: phone.length > 15 ? '' : phone // Only show phone if it's not a UID (approx check)
        };
    }, [personDebts, user, id]);

    // Calculate Totals with this person
    const totals = useMemo(() => {
        if (!rates) return { net: 0, receivables: 0, payables: 0 };

        let receivables = 0;
        let payables = 0;

        personDebts.forEach(debt => {
            if (debt.status === 'PAID' || debt.status === 'REJECTED') return;

            const amountInTRY = convertToTRY(debt.remainingAmount, debt.currency, rates);
            if (debt.lenderId === user?.uid) {
                receivables += amountInTRY;
            } else {
                payables += amountInTRY;
            }
        });

        return {
            receivables,
            payables,
            net: receivables - payables
        };
    }, [personDebts, rates, user]);

    if (loading) return <div className="p-4 text-center">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-background">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-10 border-b border-border">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 flex items-center gap-3">
                        <Avatar
                            name={personInfo.name}
                            size="md"
                            status={id && id.length > 20 ? 'system' : 'contact'}
                        />
                        <div>
                            <h1 className="text-lg font-bold text-text-primary leading-tight">{personInfo.name}</h1>
                            {/* <p className="text-xs text-text-secondary">{personInfo.phone}</p> */}
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {personInfo.phone && personInfo.phone.length <= 15 && (
                            <>
                                <a
                                    href={`https://wa.me/${cleanPhoneNumber(personInfo.phone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                >
                                    <MessageCircle size={20} />
                                </a>
                                <a
                                    href={`tel:${personInfo.phone}`}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                >
                                    <Phone size={20} />
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Summary Card */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
                    <p className="text-sm text-text-secondary mb-1 text-center">Net Durum (TRY Karşılığı)</p>
                    <h2 className={clsx(
                        "text-3xl font-bold text-center mb-6",
                        totals.net > 0 ? "text-green-600" : totals.net < 0 ? "text-red-600" : "text-text-secondary"
                    )}>
                        {formatCurrency(Math.abs(totals.net), 'TRY')}
                        <span className="text-sm font-normal text-text-secondary ml-2 block mt-1">
                            {totals.net > 0 ? "Alacaklısınız" : totals.net < 0 ? "Vereceklisiniz" : "Hesap Denk"}
                        </span>
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-900/20 text-center">
                            <p className="text-xs text-green-700 dark:text-green-400 mb-1">Toplam Alacak</p>
                            <p className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totals.receivables, 'TRY')}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 text-center">
                            <p className="text-xs text-red-700 dark:text-red-400 mb-1">Toplam Verecek</p>
                            <p className="font-bold text-red-700 dark:text-red-400">{formatCurrency(totals.payables, 'TRY')}</p>
                        </div>
                    </div>
                </div>

                {/* Debt List */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-text-primary px-1">Hareketler</h3>
                    {personDebts.length > 0 ? (
                        personDebts.map(debt => (
                            <DebtCard
                                key={debt.id}
                                debt={debt}
                                currentUserId={user?.uid || ''}
                                onClick={() => navigate(`/debt/${debt.id}`)}
                            />
                        ))
                    ) : (
                        <div className="text-center py-10 text-text-secondary opacity-60">
                            <p>Henüz kayıtlı işlem yok.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* FAB to Add Debt to THIS person */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-24 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-blue-700 active:scale-90 transition-all z-20"
            >
                <Plus size={24} />
            </button>

            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialPhoneNumber={id} // Pre-fill with this person's ID/Phone
                onSubmit={async () => {
                    // Logic handled by modal, it refreshes list automatically via subscription
                }}
            />
        </div>
    );
};
