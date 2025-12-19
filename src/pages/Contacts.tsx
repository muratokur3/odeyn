import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getContacts, addContact, deleteContact, updateContact, createDebt, batchAddContacts } from '../services/db';
import type { Contact } from '../types';
import { Search, ArrowLeft, Wallet, X, Ban } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SwipeableItem } from '../components/SwipeableItem';
import { Avatar } from '../components/Avatar';
import { cleanPhone, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { PhoneInput } from '../components/PhoneInput';
import { ImportContactsButton } from '../components/ImportContactsButton';

import { useModal } from '../context/ModalContext';

export const Contacts = () => {
    const { user, blockedUsers } = useAuth(); // Get blocked users
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

    // Import Contact State
    const [importedContacts, setImportedContacts] = useState<Partial<Contact>[]>([]);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [contactAccessEnabled, setContactAccessEnabled] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [duplicateContact, setDuplicateContact] = useState<Contact | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('contact_access_enabled');
        if (saved !== null) {
            setContactAccessEnabled(JSON.parse(saved));
        }
    }, []);

    const handleImportConfirm = async () => {
        if (!user || importedContacts.length === 0) return;

        setSubmitting(true);
        try {
            // Prepare valid contacts
            const validContacts = importedContacts
                .filter((c): c is { name: string; phoneNumber: string } => !!c.name && !!c.phoneNumber)
                .map(c => ({ name: c.name, phoneNumber: c.phoneNumber }));

            if (validContacts.length > 0) {
                await batchAddContacts(user.uid, validContacts);

                await loadContacts();
                setShowImportPreview(false);
                setImportedContacts([]);

                showAlert("İçe Aktarma Başarılı", `${validContacts.length} kişi rehberinize eklendi.`, "success");
            } else {
                showAlert("Uyarı", "Geçerli kişi bulunamadı.", "warning");
            }
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İçe aktarma sırasında bir sorun oluştu.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (phone) {
            const cleanedInput = cleanPhone(phone);
            // Only check if we have a valid-ish phone number (length check implicitly via cleanPhone or just existence)
            // cleanPhone returns E.164 usually +90... so length > 3
            if (cleanedInput && cleanedInput.length > 5) {
                const found = contacts.find(c =>
                    c.phoneNumber === cleanedInput &&
                    (!editingContact || c.id !== editingContact.id)
                );
                setDuplicateContact(found || null);
            } else {
                setDuplicateContact(null);
            }
        } else {
            setDuplicateContact(null);
        }
    }, [phone, contacts, editingContact]);

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
        setDuplicateContact(null);
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm)
    );

    // Helper to check if contact is blocked
    const isContactBlocked = (contact: Contact) => {
        return contact.linkedUserId && blockedUsers.some(b => b.blockedUid === contact.linkedUserId);
    };

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            {/* Header */}
            <header className="bg-surface shadow-sm sticky top-0 z-40 transition-colors duration-200">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-text-secondary hover:bg-background rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg font-bold text-text-primary">Rehberim</h1>
                    </div>
                    {contactAccessEnabled && (
                        <ImportContactsButton
                            existingContacts={contacts}
                            onContactsSelected={(newContacts) => {
                                setImportedContacts(newContacts);
                                setShowImportPreview(true);
                            }}
                        />
                    )}
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
                        {filteredContacts.map(contact => {
                            const blocked = isContactBlocked(contact);
                            return (
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
                                            <div className="w-10 h-10 flex items-center justify-center relative">
                                                <Avatar
                                                    name={contact.name}
                                                    size="md"
                                                    status={contact.linkedUserId ? 'system' : 'contact'}
                                                    className={blocked ? "grayscale opacity-70" : "shadow-sm"}
                                                    uid={contact.linkedUserId}
                                                />
                                                {blocked && (
                                                    <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-border">
                                                        <Ban size={12} className="text-red-500" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`font-semibold ${blocked ? 'text-gray-500 line-through decoration-red-500/50' : 'text-text-primary'}`}>
                                                        {contact.name}
                                                    </h3>
                                                    {blocked && <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">Engelli</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm text-text-secondary">{formatPhoneNumber(contact.phoneNumber)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 pl-2">
                                            {/* Quick Debt Creation Button */}
                                            {blocked ? (
                                                <button
                                                    disabled
                                                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center cursor-not-allowed"
                                                >
                                                    <Ban size={20} />
                                                </button>
                                            ) : (
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
                                            )}
                                        </div>
                                    </div>
                                </SwipeableItem>
                            );
                        })}
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
                                    {duplicateContact && (
                                        <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            <p>Bu numara zaten rehberinizde <strong>{duplicateContact.name}</strong> adıyla kayıtlı.</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting || !!duplicateContact}
                                    className={`w-full py-3 rounded-xl font-semibold transition-all mt-2 ${
                                        submitting || !!duplicateContact
                                            ? 'bg-gray-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-primary text-white hover:bg-blue-600 active:scale-95'
                                    }`}
                                >
                                    {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Import Preview Modal */}
            {showImportPreview && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface p-6 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col relative">
                        <button
                            onClick={() => setShowImportPreview(false)}
                            className="absolute right-4 top-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold mb-4 text-text-primary">
                            Kişileri Onayla
                        </h2>

                        <div className="overflow-y-auto flex-1 space-y-2 mb-4 pr-2">
                             <p className="text-sm text-text-secondary mb-2">
                                {importedContacts.length} yeni kişi eklenecek.
                            </p>
                            {importedContacts.map((contact, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                                    <div>
                                        <div className="font-medium text-text-primary">{contact.name}</div>
                                        <div className="text-xs text-text-secondary">{formatPhoneNumber(contact.phoneNumber || '')}</div>
                                    </div>
                                    <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded text-green-600">
                                        <span className="text-xs font-bold">YENİ</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowImportPreview(false)}
                                className="flex-1 py-3 rounded-xl font-medium border border-border text-text-primary hover:bg-background transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleImportConfirm}
                                disabled={submitting}
                                className="flex-1 py-3 rounded-xl font-semibold bg-primary text-white hover:bg-blue-600 active:scale-95 transition-all"
                            >
                                {submitting ? 'Ekleniyor...' : 'Onayla ve Ekle'}
                            </button>
                        </div>
                    </div>
                 </div>
            )}

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
