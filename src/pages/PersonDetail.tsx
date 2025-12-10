
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { ArrowLeft, Plus, Phone, MessageCircle, Trash2, Edit2, Share2, X } from 'lucide-react';
import { searchUserByPhone, getContacts, updateContact } from '../services/db';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { PhoneInput } from '../components/PhoneInput';
import { formatCurrency } from '../utils/format';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import clsx from 'clsx';

export const PersonDetail = () => {
    const { id } = useParams<{ id: string }>(); // This can be a userId or a contactId (phone number)
    const { user } = useAuth();
    const navigate = useNavigate();
    const { allDebts: debts, loading } = useDebts();
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isRegisteredUser, setIsRegisteredUser] = useState(false);

    // Edit Contact State
    const [contactId, setContactId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);

    const handleDelete = async () => {
        if (!user || !id) return;
        if (confirm("Bu kişiyi ve geçmişini silmek istediğinize emin misiniz?")) {
            // Deletion logic requires Contact ID. Since we often navigate by phone, 
            // we'd need to lookup the contact doc by phone first.
            // For now, only UI is implemented as per safety.
            alert("Kişi silme işlemi şu an sadece rehber listesinden yapılabilir.");
        }
    };

    // Fetch rates for summary calculation
    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // Check if user is registered and find Contact ID
    useEffect(() => {
        const checkRegistrationAndContact = async () => {
            if (!id || !user) return;
            const cleanId = cleanPhoneNumber(id);

            // 1. Check Registration
            if (id.length > 15) {
                setIsRegisteredUser(true);
            } else {
                const userFound = await searchUserByPhone(id);
                setIsRegisteredUser(!!userFound);
            }

            // 2. Find Contact ID for editing
            try {
                const myContacts = await getContacts(user.uid);
                const foundContact = myContacts.find(c =>
                    c.phoneNumber === cleanId || c.phoneNumber === id
                );
                if (foundContact) {
                    setContactId(foundContact.id);
                    setEditName(foundContact.name);
                    setEditPhone(foundContact.phoneNumber);
                }
            } catch (error) {
                console.error("Error finding contact:", error);
            }
        };
        checkRegistrationAndContact();
    }, [id, user]);

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !contactId) return;

        setSubmittingEdit(true);
        try {
            await updateContact(user.uid, contactId, {
                name: editName,
                phoneNumber: editPhone
            });
            setShowEditModal(false);
            // Ideally reload or update local state, but page might rely on 'debts' or just navigation ID.
            // Since ID is phone, if phone changes, we should navigate? 
            // If only name changes, we want to see it. 
            // However, personInfo is derived from debts or navigation ID.
            // We might need to refresh debts or handle this better. 
            // For now, let's just close and maybe simple reload?
            window.location.reload(); // Simple refresh to pick up new name from updated contacts/debts
        } catch (error) {
            console.error(error);
            alert("Güncelleme başarısız oldu.");
        } finally {
            setSubmittingEdit(false);
        }
    };

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
        // If we found a contact in the database, use that info
        if (contactId && editName) {
            return {
                name: editName,
                phone: editPhone || (id || '')
            }
        }

        if (personDebts.length === 0) {
            // If ID looks like a phone, format it
            const name = id && id.length <= 15 ? formatPhoneNumber(id) : 'Kişi';
            return { name, phone: id || '' };
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
            phone: phone.length > 20 ? '' : phone // Only show phone if it's not a UID (approx check)
        };
    }, [personDebts, user, id, contactId, editName, editPhone]);

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
            <header className="bg-surface sticky top-0 z-10 shadow-sm transition-colors duration-200">
                <div className="max-w-2xl mx-auto">
                    <div className="absolute left-4 top-3">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                    <div className="flex flex-col items-center justify-center pt-6 pb-4 w-full">
                        <div className="mb-3">
                            <Avatar
                                name={personInfo.name}
                                size="xl"
                                status={isRegisteredUser ? 'system' : 'contact'}
                                className="shadow-md"
                            />
                        </div>
                        <h1 className="text-xl font-bold text-text-primary text-center leading-tight">{personInfo.name}</h1>
                        <p className="text-sm text-text-secondary font-medium mt-1">{formatPhoneNumber(personInfo.phone || '')}</p>
                    </div>
                </div>

                {/* Actions - Distinct Area */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50 border-t border-b border-gray-100 dark:border-slate-800 flex items-center justify-around gap-2 overflow-x-auto">
                    {/* Message */}
                    <a
                        href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1 min-w-[64px] group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                            <MessageCircle size={20} />
                        </div>
                        <span className="text-[10px] text-gray-600 dark:text-slate-400 font-medium group-hover:text-blue-600 transition-colors">Mesaj</span>
                    </a >

                    {/* Call */}
                    < a
                        href={`tel:${personInfo.phone || ''}`}
                        className="flex flex-col items-center gap-1 min-w-[64px] group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:bg-green-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                            <Phone size={20} />
                        </div>
                        <span className="text-[10px] text-gray-600 dark:text-slate-400 font-medium group-hover:text-green-600 transition-colors">Ara</span>
                    </a >

                    {/* Invite (only if not registered) */}
                    {
                        !isRegisteredUser && (
                            <a
                                href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}?text=DebtDert'e gel!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1 min-w-[64px] group cursor-pointer"
                            >
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                                    <Share2 size={20} />
                                </div>
                                <span className="text-[10px] text-gray-600 dark:text-slate-400 font-medium group-hover:text-indigo-600 transition-colors">Davet Et</span>
                            </a>
                        )
                    }


                    {/* Edit - Active if Contact Found */}
                    {
                        contactId ? (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex flex-col items-center gap-1 min-w-[64px] group"
                            >
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 flex items-center justify-center group-hover:bg-gray-100 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                                    <Edit2 size={20} />
                                </div>
                                <span className="text-[10px] text-gray-600 dark:text-slate-400 font-medium group-hover:text-gray-900 transition-colors">Düzenle</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => alert("Bu kişi rehberinizde kayıtlı değil.")}
                                className="flex flex-col items-center gap-1 min-w-[64px] group opacity-50"
                            >
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 flex items-center justify-center cursor-not-allowed">
                                    <Edit2 size={20} />
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium">Düzenle</span>
                            </button>
                        )
                    }

                    {/* Delete */}
                    <button
                        onClick={handleDelete}
                        className="flex flex-col items-center gap-1 min-w-[64px] group"
                    >
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-red-500 flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-900/10 transition-colors shadow-sm">
                            <Trash2 size={20} />
                        </div>
                        <span className="text-[10px] text-gray-600 dark:text-slate-400 font-medium group-hover:text-red-600 transition-colors">Sil</span>
                    </button>

                </div >
            </header >

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
                targetUser={
                    // Pass full object if possible, but we might only have ID.
                    // If we have personDebts, we can try to find the full object or just pass ID.
                    // For now, passing initialPhoneNumber is enough, modal handles search if needed, but we want to lock it.
                    // Actually we can pass undefined targetUser and let initialPhoneNumber do work, OR pass a dummy object.
                    // Let's just implement the submit handler.
                    undefined
                }
                onSubmit={async (borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, requestApproval) => {
                    if (!user) return;
                    // For PersonDetail, we are already focused on a person.
                    // The Modal handles the UI but we must call createDebt.
                    // Note: borrowerId coming from Modal might be the phone number or UID.
                    await import('../services/db').then(({ createDebt }) => createDebt(
                        user.uid,
                        user.displayName || 'Bilinmeyen',
                        borrowerId,
                        borrowerName,
                        amount,
                        type,
                        currency,
                        note,
                        dueDate,
                        installments,
                        canBorrowerAddPayment,
                        requestApproval
                    ));
                    setShowCreateModal(false);
                }}
            />
            {/* Edit Modal */}
            {
                showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-text-primary">
                                    Kişiyi Düzenle
                                </h2>
                                <button onClick={() => setShowEditModal(false)} className="text-text-secondary hover:text-text-primary">
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">İsim Soyisim</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-background text-text-primary focus:ring-2 focus:ring-primary outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Telefon Numarası
                                    </label>
                                    <PhoneInput
                                        value={editPhone}
                                        onChange={setEditPhone}
                                        required
                                        placeholder="555 123 45 67"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 py-2 text-text-secondary hover:bg-background rounded-lg font-medium transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingEdit}
                                        className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                    >
                                        {submittingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
