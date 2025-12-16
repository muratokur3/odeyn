import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getContacts, addContact, deleteContact, updateContact } from '../services/db';
import type { Contact } from '../types';
import { Search, ArrowLeft, Wallet, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SwipeableItem } from '../components/SwipeableItem';
import { Avatar } from '../components/Avatar';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { PhoneInput } from '../components/PhoneInput';
import { createDebt } from '../services/db';

import { useModal } from '../context/ModalContext';

export const Contacts = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { showAlert, showConfirm } = useModal();
    const [contacts, setContacts] = useState<Contact[]>([]);

    // ... (rest of states)
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [selectedContactForDebt, setSelectedContactForDebt] = useState<Contact | null>(null);
    const [showDebtModal, setShowDebtModal] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user]);

    // Check for initial phone number from navigation
    useEffect(() => {
        const state = location.state as { initialPhone?: string } | null;
        if (state?.initialPhone) {
            setPhone(state.initialPhone);
            setShowModal(true);
            // Clear state to prevent reopening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const loadContacts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getContacts(user.uid);
            setContacts(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        try {
            if (editingContact) {
                await updateContact(user.uid, editingContact.id, { name, phoneNumber: phone });
                showAlert("Başarılı", "Kişi güncellendi.", "success");
            } else {
                await addContact(user.uid, name, phone);
                showAlert("Başarılı", "Kişi eklendi.", "success");
            }
            await loadContacts();
            closeModal();
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem sırasında bir hata oluştu.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!user) return;
        const confirmed = await showConfirm("Kişi Sil", "Bu kişiyi silmek istediğinize emin misiniz?");
        if (!confirmed) return;

        try {
            await deleteContact(user.uid, contactId);
            await loadContacts();
            showAlert("Silindi", "Kişi başarıyla silindi.", "success");
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Silme işlemi başarısız oldu.", "error");
        }
    };

    const handleCreateDebtSubmit = async (
        borrowerId: string,
        borrowerName: string,
        amount: number,
        type: 'LENDING' | 'BORROWING',
        currency: string,
        note?: string,
        dueDate?: Date,
        installments?: any[],
        canBorrowerAddPayment?: boolean,
        requestApproval?: boolean,
        initialPayment?: number
    ) => {
        if (!user) return;
        await createDebt(
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
            requestApproval,
            initialPayment || 0
        );
        setShowDebtModal(false);
    };



    const openEditModal = (contact: Contact) => {
        setEditingContact(contact);
        setName(contact.name);
        setPhone(contact.phoneNumber);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingContact(null);
        setName('');
        setPhone('');
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm)
    );

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            {/* Header */}
            <header className="bg-surface shadow-sm sticky top-0 z-40 transition-colors duration-200">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-2 -ml-2 text-text-secondary hover:bg-background rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-text-primary">Rehberim</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
                {/* Search */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-text-secondary" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Kişi ara..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all bg-surface text-text-primary"
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-10 text-text-secondary">Yükleniyor...</div>
                ) : filteredContacts.length > 0 ? (
                    <div className="bg-surface rounded-xl shadow-sm border border-border divide-y divide-border overflow-hidden transition-colors duration-200">
                        {filteredContacts.map(contact => (
                            <SwipeableItem
                                key={contact.id}
                                onSwipeLeft={() => handleDeleteContact(contact.id)}
                                onSwipeRight={() => openEditModal(contact)}
                                className="mb-0"
                            >
                                <div className="p-4 flex items-center justify-between hover:bg-background/50 transition-colors">
                                    <div
                                        onClick={() => navigate(`/person/${contact.phoneNumber}`)}
                                        className="flex items-center gap-3 cursor-pointer flex-1"
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center">
                                            <Avatar
                                                name={contact.name}
                                                size="md"
                                                status={contact.linkedUserId ? 'system' : 'contact'}
                                                className="shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-text-primary">
                                                {contact.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-text-secondary">{formatPhoneNumber(contact.phoneNumber)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 pl-2">
                                        {/* Quick Debt Creation Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedContactForDebt(contact);
                                                setShowDebtModal(true);
                                            }}
                                            className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                        >
                                            <Wallet size={20} />
                                        </button>
                                    </div>
                                </div>
                            </SwipeableItem>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-text-secondary">
                        <p>Kayıtlı kişi bulunamadı.</p>
                    </div>
                )}
            </main>

            {/* FAB */}
            {/* FAB Removed per new navigation logic */}

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-surface p-6 rounded-2xl w-full max-w-md relative">
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute right-4 top-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h2 className="text-xl font-bold mb-6 text-text-primary">
                                {editingContact ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Ad Soyad
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                        placeholder="Ad Soyad"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Telefon Numarası
                                    </label>
                                    <PhoneInput
                                        value={phone}
                                        onChange={setPhone}
                                        required
                                        placeholder="555 123 45 67"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all mt-2"
                                >
                                    {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Debt Modal */}
            <CreateDebtModal
                isOpen={showDebtModal}
                onClose={() => setShowDebtModal(false)}
                initialPhoneNumber={selectedContactForDebt?.phoneNumber}
                targetUser={selectedContactForDebt}
                onSubmit={handleCreateDebtSubmit}
            />
        </div >
    );
};
