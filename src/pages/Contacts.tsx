import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getContacts, addContact, deleteContact, updateContact, getUsersStatus } from '../services/db';
import type { Contact } from '../types';
import { Plus, Search, Trash2, ArrowLeft, Circle, Edit2, MessageCircle, Phone, Share2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { SwipeableItem } from '../components/SwipeableItem';
import { Avatar } from '../components/Avatar';
import { cleanPhoneNumber, formatPhoneNumber } from '../utils/phone';

export const Contacts = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [userStatuses, setUserStatuses] = useState<Record<string, { isOnline?: boolean; lastSeen?: Timestamp; displayName?: string }>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

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

            const linkedIds = data.map(c => c.linkedUserId).filter(id => id) as string[];
            if (linkedIds.length > 0) {
                const statuses = await getUsersStatus(linkedIds);
                setUserStatuses(statuses);
            }
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
            } else {
                await addContact(user.uid, name, phone);
            }
            await loadContacts();
            closeModal();
        } catch (error) {
            console.error(error);
            alert("İşlem sırasında bir hata oluştu.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!user || !confirm("Bu kişiyi silmek istediğinize emin misiniz?")) return;
        try {
            await deleteContact(user.uid, contactId);
            await loadContacts();
        } catch (error) {
            console.error(error);
            alert("Silme işlemi başarısız oldu.");
        }
    };

    const openAddModal = () => {
        setEditingContact(null);
        setName('');
        setPhone('');
        setShowModal(true);
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

            <main className="max-w-2xl mx-auto p-4 space-y-4">
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
                                                {contact.linkedUserId && userStatuses[contact.linkedUserId]?.displayName &&
                                                    userStatuses[contact.linkedUserId].displayName?.toLowerCase() !== contact.name.toLowerCase() && (
                                                        <span className="ml-2 text-xs font-normal text-text-secondary">
                                                            ({userStatuses[contact.linkedUserId].displayName})
                                                        </span>
                                                    )}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-text-secondary">{formatPhoneNumber(contact.phoneNumber)}</p>
                                                {contact.linkedUserId && userStatuses[contact.linkedUserId] && (
                                                    <div className="flex items-center gap-1 text-xs">
                                                        {userStatuses[contact.linkedUserId].isOnline ? (
                                                            <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                                                <Circle size={8} fill="currentColor" /> Çevrimiçi
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-secondary">
                                                                {userStatuses[contact.linkedUserId].lastSeen
                                                                    ? `Son görülme: ${formatDistanceToNow(userStatuses[contact.linkedUserId].lastSeen!.toDate(), { addSuffix: true, locale: tr })}`
                                                                    : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-1">
                                        {!contact.linkedUserId && (
                                            <a
                                                href={`https://wa.me/${cleanPhoneNumber(contact.phoneNumber)}?text=Merhaba, DebtDert uygulamasını kullanarak borç/alacak takibimizi kolayca yapabiliriz. Sen de katıl!`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-text-secondary hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Davet Et"
                                            >
                                                <Share2 size={18} />
                                            </a>
                                        )}
                                        <a
                                            href={`https://wa.me/${cleanPhoneNumber(contact.phoneNumber)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-text-secondary hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MessageCircle size={18} />
                                        </a>
                                        <a
                                            href={`tel:${contact.phoneNumber}`}
                                            className="p-2 text-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Phone size={18} />
                                        </a>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(contact);
                                            }}
                                            className="p-2 text-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteContact(contact.id);
                                            }}
                                            className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        >
                                            <Trash2 size={18} />
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
            <button
                onClick={openAddModal}
                className="fixed bottom-24 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-blue-600 active:scale-90 transition-all z-20"
            >
                <Plus size={24} />
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                        <h2 className="text-xl font-bold text-text-primary mb-4">
                            {editingContact ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">İsim Soyisim</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-background text-text-primary focus:ring-2 focus:ring-primary outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Telefon Numarası</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-background text-text-primary focus:ring-2 focus:ring-primary outline-none"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 text-text-secondary hover:bg-background rounded-lg font-medium transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                >
                                    {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
