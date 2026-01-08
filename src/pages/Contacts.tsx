import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getContacts, deleteContact, updateContact, createDebt, batchAddContacts } from '../services/db';
import type { Contact } from '../types';
import { Search, ArrowLeft, Wallet, X, Ban, Edit2, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AdaptiveActionRow } from '../components/AdaptiveActionRow';
import { type SwipeAction } from '../components/SwipeableItem';
import { Avatar } from '../components/Avatar';
import { formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { ImportContactsButton } from '../components/ImportContactsButton';
import type { Conflict } from '../components/ImportContactsButton';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import { ContactModal } from '../components/ContactModal';


import { useModal } from '../context/ModalContext';

export const Contacts = () => {
    const { user, blockedUsers } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { showAlert, showConfirm } = useModal();
    const [contacts, setContacts] = useState<Contact[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [selectedContactForDebt, setSelectedContactForDebt] = useState<Contact | null>(null);
    const [showDebtModal, setShowDebtModal] = useState(false);

    const [importedContacts, setImportedContacts] = useState<Partial<Contact>[]>([]);
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [showConflictResolution, setShowConflictResolution] = useState(false);
    const [contactAccessEnabled, setContactAccessEnabled] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [initialPhone, setInitialPhone] = useState('');
    const [openRowId, setOpenRowId] = useState<string | null>(null);

    // Auto-Reset: Click anywhere else closes row
    useEffect(() => {
        const handleClickOutside = () => {
            if (openRowId) setOpenRowId(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openRowId]);

    useEffect(() => {
        const saved = localStorage.getItem('contact_access_enabled');
        if (saved !== null) {
            setContactAccessEnabled(JSON.parse(saved));
        }
    }, []);

    const handleContactsSelected = (newContacts: Partial<Contact>[], conflicts: Conflict[]) => {
        setImportedContacts(newContacts);
        setConflicts(conflicts);

        if (conflicts.length > 0) {
            setShowConflictResolution(true);
        } else if (newContacts.length > 0) {
            setShowImportPreview(true);
        }
    };

    const handleConflictResolution = async (resolutions: { [key: string]: 'update' | 'skip' }) => {
        if (!user) return;

        // We do NOT set Submitting globally because we want the UI to remain interactive for partial updates
        // setSubmitting(true);

        const toUpdate: { id: string, data: Partial<Contact> }[] = [];
        const resolvedPhones: string[] = [];

        for (const phone in resolutions) {
            resolvedPhones.push(phone);
            if (resolutions[phone] === 'update') {
                const conflict = conflicts.find(c => c.existingContact.phoneNumber === phone);
                if (conflict) {
                    toUpdate.push({ id: conflict.existingContact.id, data: { name: conflict.newContact.name } });
                }
            }
        }

        try {
            // Apply updates
            for (const update of toUpdate) {
                await updateContact(user.uid, update.id, update.data);
            }

            // If we updated anything, reload contacts to reflect changes in background
            if (toUpdate.length > 0) {
                await loadContacts();
            }

            // Remove resolved items from conflict list
            setConflicts(prev => {
                const remaining = prev.filter(c => !resolvedPhones.includes(c.existingContact.phoneNumber));

                // If no conflicts remain, check for pending imports
                if (remaining.length === 0 && importedContacts.length > 0) {
                    // All conflicts resolved, proceed to import verification if needed
                    // Or since the user might have "skipped" everything, we should just check if we need to show the import preview
                    // For now, let's just show import preview if there are still NEW contacts waiting

                    // We need to delay this slightly or just set the state layout
                    setTimeout(() => {
                        if (importedContacts.length > 0) {
                            setShowConflictResolution(false);
                            setShowImportPreview(true);
                        } else {
                            resetImportState();
                        }
                    }, 300);
                }

                return remaining;
            });


        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem sırasında bir hata oluştu.", "error");
        }
    };


    const handleImportConfirm = async (reset: boolean = true) => {
        if (!user || importedContacts.length === 0) return;

        setSubmitting(true);
        try {
            const validContacts = importedContacts
                .filter((c): c is { name: string; phoneNumber: string } => !!c.name && !!c.phoneNumber)
                .map(c => ({ name: c.name, phoneNumber: c.phoneNumber }));

            if (validContacts.length > 0) {
                await batchAddContacts(user.uid, validContacts);
                await loadContacts();
                showAlert("İçe Aktarma Başarılı", `${validContacts.length} yeni kişi rehberinize eklendi.`, "success");
            }
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İçe aktarma sırasında bir sorun oluştu.", "error");
        } finally {
            if (reset) {
                resetImportState();
                setSubmitting(false);
            }
        }
    };

    const resetImportState = () => {
        setShowImportPreview(false);
        setShowConflictResolution(false);
        setImportedContacts([]);
        setConflicts([]);
    }



    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user]);

    useEffect(() => {
        const state = location.state as { initialPhone?: string } | null;
        if (state?.initialPhone) {
            setInitialPhone(state.initialPhone);
            setShowModal(true);
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
            initialPayment || 0
        );
        setShowDebtModal(false);
    };

    const openEditModal = (contact: Contact) => {
        setEditingContact(contact);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingContact(null);
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm)
    );

    const groupedContacts = useMemo(() => {
        const groups: Record<string, Contact[]> = {};

        // 1. Sort Alphabetically (Turkish Support)
        const sorted = [...filteredContacts].sort((a, b) =>
            a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' })
        );

        // 2. Group by First Letter
        sorted.forEach(contact => {
            let letter = contact.name.charAt(0).toLocaleUpperCase('tr');
            if (!/[A-ZÇĞİÖŞÜ]/.test(letter)) {
                letter = '#';
            }
            if (!groups[letter]) {
                groups[letter] = [];
            }
            groups[letter].push(contact);
        });

        return groups;
    }, [filteredContacts]);

    const sortedGroupKeys = Object.keys(groupedContacts).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b, 'tr');
    });

    const isContactBlocked = (contact: Contact) => {
        return contact.linkedUserId && blockedUsers.some(b => b.blockedUid === contact.linkedUserId);
    };

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            <header className="bg-surface shadow-sm sticky top-0 z-40 transition-colors duration-200">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-text-secondary hover:bg-background rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg font-bold text-text-primary">Rehberim</h1>
                    </div>
                    <div>
                        {contactAccessEnabled && (
                            <ImportContactsButton
                                existingContacts={contacts}
                                onContactsSelected={handleContactsSelected}
                            />
                        )}

                    </div>

                </div>
            </header>

            <main className="max-w-2xl mx-auto space-y-4 pb-24">
                {/* Search Bar */}
                <div className="relative px-4 mt-4">
                    <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none">
                        <Search size={18} className="text-text-secondary" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Kişi ara..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all bg-surface text-text-primary shadow-sm"
                    />
                </div>

                {loading ? (
                    <div className="text-center py-10 text-text-secondary">Yükleniyor...</div>
                ) : filteredContacts.length > 0 ? (
                    <div className="bg-transparent">
                        {sortedGroupKeys.map(letter => (
                            <div key={letter} className="relative">
                                {/* Sticky Header */}
                                <div className="sticky top-[60px] z-30 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm px-6 py-2 border-y border-gray-100 dark:border-slate-800 text-sm font-bold text-primary shadow-sm">
                                    {letter}
                                </div>

                                {/* Group Items */}
                                <div className="bg-surface divide-y divide-border border-b border-border last:border-0">
                                    {groupedContacts[letter].map(contact => {
                                        const blocked = isContactBlocked(contact);

                                        // Configure Right Actions (Delete)
                                        const rightActions: SwipeAction[] = [
                                            {
                                                key: 'delete',
                                                icon: <Trash2 size={20} />,
                                                label: 'Sil',
                                                color: 'bg-red-500',
                                                onClick: () => handleDeleteContact(contact.id)
                                            }
                                        ];

                                        return (
                                            <AdaptiveActionRow
                                                key={contact.id}
                                                rightActions={rightActions}
                                                isOpen={openRowId === `${contact.id}_right` ? 'right' : null}
                                                onOpen={(dir) => setOpenRowId(`${contact.id}_${dir}`)}
                                                onClose={() => setOpenRowId(null)}
                                                className="mb-0"
                                            >
                                                <div className="p-4 pl-5 flex items-center justify-between hover:bg-background/50 transition-colors min-h-[72px]">
                                                    <div
                                                        onClick={() => {
                                                            const targetId = contact.linkedUserId || contact.phoneNumber;
                                                            navigate(`/person/${targetId}`, { state: { name: contact.name, phone: contact.phoneNumber } });
                                                        }}
                                                        className="flex items-center gap-4 cursor-pointer flex-1"
                                                    >
                                                        <div className="w-12 h-12 flex items-center justify-center relative shrink-0">
                                                            <Avatar
                                                                name={contact.name}
                                                                size="md"
                                                                status={contact.linkedUserId ? 'system' : 'contact'}
                                                                className={blocked ? "grayscale opacity-70" : "shadow-sm"}
                                                                uid={contact.linkedUserId}
                                                            />
                                                            {blocked && (
                                                                <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-border">
                                                                    <Ban size={14} className="text-red-500" />
                                                                </div>
                                                            )}
                                                            {!blocked && contact.hasUnreadActivity && (
                                                                <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface animate-pulse" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h3 className={`font-bold text-base truncate ${blocked ? 'text-gray-500 line-through decoration-red-500/50' : contact.hasUnreadActivity ? 'text-text-primary font-extrabold' : 'text-text-primary'}`}>
                                                                    {contact.name}
                                                                </h3>
                                                                {blocked && <span className="text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">Engelli</span>}
                                                            </div>
                                                            <p className={`text-sm truncate ${contact.hasUnreadActivity ? 'text-green-600 font-medium' : 'text-text-secondary'}`}>
                                                                {contact.hasUnreadActivity ? 'Yeni Hareket' : formatPhoneNumber(contact.phoneNumber)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 pl-3">
                                                        {blocked ? (
                                                            <button disabled className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed">
                                                                <Ban size={20} />
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                {/* Edit Button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditModal(contact);
                                                                    }}
                                                                    className="p-2.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                                                >
                                                                    <Edit2 size={18} />
                                                                </button>

                                                                {/* Wallet Button (Always Visible) */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedContactForDebt(contact);
                                                                        setShowDebtModal(true);
                                                                    }}
                                                                    className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                                                >
                                                                    <Wallet size={20} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </AdaptiveActionRow>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 px-4">
                        <div className="bg-surface inline-flex p-4 rounded-full mb-4 shadow-sm border border-border">
                            <Search size={32} className="text-text-secondary opacity-50" />
                        </div>
                        <h3 className="text-lg font-semibold text-text-primary mb-1">Kişi Bulunamadı</h3>
                        <p className="text-text-secondary text-sm">Aradığınız kriterlere uygun kayıt yok.</p>
                    </div>
                )}
            </main>

            <ContactModal
                isOpen={showModal}
                onClose={closeModal}
                contactToEdit={editingContact}
                initialPhone={initialPhone}
                initialName=""
                onSuccess={() => {
                    loadContacts();
                    closeModal();
                }}
            />

            {showImportPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface p-6 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col relative">
                        <button
                            onClick={resetImportState}
                            className="absolute right-4 top-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-text-primary">Kişileri Onayla</h2>
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
                                onClick={resetImportState}
                                className="flex-1 py-3 rounded-xl font-medium border border-border text-text-primary hover:bg-background transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={() => handleImportConfirm()}
                                disabled={submitting}
                                className="flex-1 py-3 rounded-xl font-semibold bg-primary text-white hover:bg-blue-600 active:scale-95 transition-all"
                            >
                                {submitting ? 'Ekleniyor...' : 'Onayla ve Ekle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConflictResolution && (
                <ConflictResolutionModal
                    conflicts={conflicts}
                    onResolve={handleConflictResolution}
                    onCancel={resetImportState}
                />
            )}

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
