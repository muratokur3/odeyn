
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, Plus, Phone, MessageCircle, Trash2, Edit2, Share2, X, MoreVertical } from 'lucide-react';
import { searchUserByPhone, getContacts, updateContact } from '../services/db';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { PhoneInput } from '../components/PhoneInput';
import { formatCurrency } from '../utils/format';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import clsx from 'clsx';

import { useModal } from '../context/ModalContext';

import { Timestamp } from 'firebase/firestore'; // Added import
import type { User, Contact } from '../types'; // Added import

export const PersonDetail = () => {
    const { id } = useParams<{ id: string }>(); // This can be a userId or a contactId (phone number)
    const { user } = useAuth();
    const navigate = useNavigate();
    const { allDebts: debts, loading } = useDebts();
    const { resolveName } = useContactName(); // Added this
    const { showAlert, showConfirm } = useModal();
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isRegisteredUser, setIsRegisteredUser] = useState(false);

    // New State for Modal Target
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);

    // Edit Contact State
    const [contactId, setContactId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.scrollY > 20;
            setIsScrolled(scrolled);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDelete = async () => {
        if (!user || !id) return;
        const confirmed = await showConfirm(
            "Kişi Silme",
            "Bu kişiyi ve geçmişini silmek istediğinize emin misiniz?",
            "warning"
        );
        if (confirmed) {
            // Deletion logic requires Contact ID. Since we often navigate by phone, 
            // we'd need to lookup the contact doc by phone first.
            // For now, only UI is implemented as per safety.
            showAlert("Bilgi", "Kişi silme işlemi şu an sadece rehber listesinden yapılabilir.", "info");
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

            let foundSysUser: User | null = null;
            let foundContactData: Contact | undefined;

            // 1. Check Registration
            if (id.length > 20) { // UID check
                // If ID is UID, we can't easily fetch user without getDoc logic here or relying on search.
                // Assuming searchUserByPhone won't work for UID.
                // But typically we navigate by phone in this app.
                // If ID is UID, we assume registered.
                setIsRegisteredUser(true);
            } else {
                foundSysUser = await searchUserByPhone(id);
                setIsRegisteredUser(!!foundSysUser);
            }

            // 2. Find Contact ID for editing AND for Modal Target
            try {
                const myContacts = await getContacts(user.uid);
                foundContactData = myContacts.find(c =>
                    c.phoneNumber === cleanId || c.phoneNumber === id
                );

                if (foundContactData) {
                    setContactId(foundContactData.id);
                    setEditName(foundContactData.name);
                    setEditPhone(foundContactData.phoneNumber);
                    setTargetUserObject(foundContactData);
                } else if (foundSysUser) {
                    setTargetUserObject(foundSysUser);
                } else {
                    // Raw phone number, construct temp contact object for Modal
                    setTargetUserObject({
                        id: 'temp',
                        name: formatPhoneNumber(id),
                        phoneNumber: cleanId,
                        createdAt: Timestamp.now()
                    });
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
            showAlert("Başarılı", "Kişi bilgileri güncellendi.", "success");
            // window.location.reload(); // Replacing reload with state update would be better but reloading is safe for now
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Güncelleme başarısız oldu.", "error");
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

    // Get Person Info using standard hook
    const personInfo = useMemo(() => {
        // Determine fallback name and phone from debts if available
        let fallbackName = '';
        const cleanId = cleanPhoneNumber(id || ''); // Always clean the ID from URL (handles + becoming space)
        let phone = cleanId;

        if (personDebts.length > 0) {
            const first = personDebts[0];
            const isLender = first.lenderId === user?.uid;
            fallbackName = isLender ? first.borrowerName : first.lenderName;
            const otherId = isLender ? first.borrowerId : first.lenderId;
            // If the ID param is a UID, we prefer the phone from the debt record if it looks like a phone
            if (id && id.length > 20 && otherId.length <= 15) {
                phone = cleanPhoneNumber(otherId);
            }
        }

        // Local override if we just edited (optimistic UI)
        if (contactId && editName) {
            return {
                name: editName,
                phone: cleanPhoneNumber(editPhone || phone)
            };
        }

        const { displayName } = resolveName(id || '', fallbackName);

        return {
            name: displayName,
            phone: phone.length > 20 ? '' : phone
        };
    }, [personDebts, user, id, contactId, editName, editPhone, resolveName]);

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
        <div className="min-h-full bg-background pb-24">
            {/* Header */}
            <header className="bg-surface sticky top-0 z-10 shadow-sm transition-colors duration-200">
                <div className="max-w-2xl mx-auto relative">
                    {/* Top Bar */}
                    <div className="flex justify-between items-center px-4 pt-2 pb-0">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>

                        {/* More Options */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 -mr-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {/* Dropdown Menu */}
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        {contactId ? (
                                            <button
                                                onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                            >
                                                <Edit2 size={16} /> Düzenle
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-text-secondary opacity-50 cursor-not-allowed flex items-center gap-2"
                                            >
                                                <Edit2 size={16} /> Düzenle
                                            </button>
                                        )}
                                        <div className="h-px bg-border my-0"></div>
                                        <button
                                            onClick={() => { handleDelete(); setShowMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                        >
                                            <Trash2 size={16} /> Kişiyi Sil
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={clsx(
                        "flex flex-col items-center justify-center w-full px-4 transition-all duration-300 ease-in-out",
                        isScrolled ? "scale-75 -mt-6 pb-0 opacity-90" : "pt-0 pb-4 -mt-2 opacity-100"
                    )}>
                        <div className={clsx("transition-all duration-300", isScrolled ? "mb-1" : "mb-3")}>
                            <Avatar
                                name={personInfo.name}
                                size={isScrolled ? 'md' : 'xl'}
                                status={isRegisteredUser ? 'system' : 'contact'}
                                className="shadow-md transition-all duration-300"
                            />
                        </div>
                        <h1 className="text-xl font-bold text-text-primary text-center leading-tight">{personInfo.name}</h1>
                        <p className="text-sm text-text-secondary font-medium mt-1">{formatPhoneNumber(personInfo.phone || '')}</p>


                    </div>
                </div>

                {/* Actions - Distinct Area */}
                <div className={clsx(
                    "px-4 bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center gap-4 transition-all duration-300 ease-in-out overflow-hidden border-t border-b border-gray-100 dark:border-slate-800",
                    isScrolled ? "max-h-0 py-0 opacity-0 border-none" : "max-h-24 py-3 opacity-100"
                )}>

                    {/* Primary Action: Create Debt */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all">
                            <Plus size={24} className="stroke-[3]" />
                        </div>
                        <span className="text-[11px] font-bold text-primary">Yeni İşlem</span>
                    </button>

                    <div className="w-px h-8 bg-gray-300 dark:bg-slate-700 mx-2"></div>
                    {/* Message */}
                    <a
                        href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-green-600 dark:text-green-500 flex items-center justify-center group-hover:bg-green-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                            <MessageCircle size={20} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">WhatsApp</span>
                    </a >

                    {/* Call */}
                    < a
                        href={`tel:${personInfo.phone || ''}`}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-500 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                            <Phone size={20} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">Ara</span>
                    </a >

                    {/* Invite */}
                    {
                        !isRegisteredUser && (
                            <a
                                href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}?text=DebtDert'e gel!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1 group cursor-pointer"
                            >
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-500 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-slate-700 transition-colors shadow-sm">
                                    <Share2 size={20} />
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium">Davet</span>
                            </a>
                        )
                    }
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

            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialPhoneNumber={id}
                targetUser={targetUserObject}
                onSubmit={async (borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, requestApproval) => {
                    if (!user) return;
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
