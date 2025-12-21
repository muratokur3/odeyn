
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, Phone, MessageCircle, Trash2, Edit2, X, MoreVertical, Ban, UserPlus, VolumeX, Volume2 } from 'lucide-react';
import { searchUserByPhone, getContacts, updateContact, addContact, deleteContact, muteUser, unmuteUser } from '../services/db';
import { blockUser, isUserBlocked, unblockUser } from '../services/blockService'; // Import block services
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { PhoneInput } from '../components/PhoneInput';
import { formatCurrency } from '../utils/format';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // Added imports
import { db } from '../services/firebase'; // Added import
import clsx from 'clsx';
import { useModal } from '../context/ModalContext';

import type { User, Contact } from '../types'; // Added import

export const PersonDetail = () => {
    const { id } = useParams<{ id: string }>(); // This can be a userId or a contactId (phone number)
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { allDebts: debts, loading } = useDebts();
    const { resolveName } = useContactName(); // Added this
    const { showAlert, showConfirm } = useModal();
    const [rates, setRates] = useState<CurrencyRates | null>(null);
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
    const [isBlocked, setIsBlocked] = useState(false); // Block state
    const [isMuted, setIsMuted] = useState(false);

    // Helper to get target UID safely
    const getTargetUid = () => {
        if (id && id.length > 20) return id;
        if (targetUserObject) {
            if ('uid' in targetUserObject) return targetUserObject.uid;
            if ('linkedUserId' in targetUserObject && targetUserObject.linkedUserId) return targetUserObject.linkedUserId;
        }
        return null;
    };

    // Check block & mute status
    useEffect(() => {
        const checkStatus = async () => {
            if (!user || !id) return;
            const targetUid = getTargetUid();

            if (targetUid) {
                // Check Block
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);

                // Check Mute
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const uData = userSnap.data() as User;
                    setIsMuted(uData.mutedCreators?.includes(targetUid) || false);
                }
            }
        };
        checkStatus();
    }, [user, id, targetUserObject]);

    const handleBlockToggle = async () => {
        if (!user) return;
        const targetUid = getTargetUid();

        if (!targetUid) {
            showAlert("Uyarı", "Bu kişi sisteme kayıtlı değil, engellenemez. Sadece rehberinizden silebilirsiniz.", "warning");
            return;
        }

        if (isBlocked) {
            const confirmed = await showConfirm("Engeli Kaldır", "Kullanıcının engelini kaldırmak istiyor musunuz?");
            if (confirmed) {
                await unblockUser(user.uid, targetUid);
                setIsBlocked(false);
                showAlert("Başarılı", "Engel kaldırıldı.", "success");
            }
        } else {
            const confirmed = await showConfirm(
                "Kullanıcıyı Engelle",
                "Bu kişiyi engellemek istiyor musunuz? Mevcut borçlar silinmez ancak yeni işlem yapılamaz.",
                "warning"
            );
            if (confirmed) {
                // Pass the person's name to the blockUser function
                await blockUser(user.uid, targetUid, personInfo.name);
                setIsBlocked(true);
                showAlert("Engellendi", "Kullanıcı engellendi.", "success");
            }
        }
    };

    const handleMuteToggle = async () => {
        if (!user) return;
        const targetUid = getTargetUid();

        if (!targetUid) {
            showAlert("Uyarı", "Bu kişi sisteme kayıtlı değil, sessize alınamaz.", "warning");
            return;
        }

        if (isMuted) {
            const confirmed = await showConfirm("Sessize Almayı Kaldır", "Bu kullanıcının sessize alma durumunu kaldırmak istiyor musunuz?");
            if (confirmed) {
                await unmuteUser(user.uid, targetUid);
                setIsMuted(false);
                showAlert("Başarılı", "Kullanıcı artık sessize alınmıyor.", "success");
            }
        } else {
            const confirmed = await showConfirm(
                "Kullanıcıyı Sessize Al",
                "Bu kullanıcıyı sessize almak istiyor musunuz? Size eklediği borçları göremeyeceksiniz (Otomatik Gizli), ancak karşı taraf normal eklendiğini sanacak.",
                "info"
            );
            if (confirmed) {
                await muteUser(user.uid, targetUid);
                setIsMuted(true);
                showAlert("Sessize Alındı", "Kullanıcı sessize alındı.", "success");
            }
        }
    };

    // const [isScrolled, setIsScrolled] = useState(false); // Removed scroll logic

    /* Removed scroll effect
    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.scrollY > 20;
            setIsScrolled(scrolled);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    */

    const handleDelete = async () => {
        if (!user || !contactId) return;

        const confirmed = await showConfirm(
            "Kişiyi Sil",
            "Bu kişiyi rehberinizden silmek istediğinize emin misiniz? Geçmiş borç kayıtları silinmez.",
            "warning"
        );
        if (confirmed) {
            try {
                await deleteContact(user.uid, contactId);
                showAlert("Başarılı", "Kişi rehberden silindi.", "success");
                // Refresh to update UI (will show 'Add to Contacts' button)
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error("Delete contact error:", error);
                showAlert("Hata", "Silme işlemi sırasında bir sorun oluştu.", "error");
            }
        }
    };

    // Fetch rates for summary calculation
    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // Check if user is registered and find Contact ID
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);

    useEffect(() => {
        const checkRegistrationAndContact = async () => {
            if (!id || !user) return;
            // Only clean if it looks like a phone number (short, starts with + or digit)
            // If it's a long UID, leave it be.
            const isUID = id.length > 20;
            const cleanId = isUID ? id : cleanPhoneNumber(id);

            let foundSysUser: User | null = null;
            let foundContactData: Contact | undefined;

            // 1. Check Registration & Fetch User
            if (id.length > 20) { // UID check
                setResolvedUid(id);
                setIsRegisteredUser(true);
                // Fetch User Details for UID
                try {
                    const userDoc = await getDoc(doc(db, 'users', id));
                    if (userDoc.exists()) {
                        foundSysUser = userDoc.data() as User;
                    }
                } catch (e) {
                    console.error("Failed to fetch user by UID", e);
                }
            } else {
                foundSysUser = await searchUserByPhone(id);
                if (foundSysUser) {
                    setResolvedUid(foundSysUser.uid);
                    setIsRegisteredUser(true);
                } else {
                    setResolvedUid(null);
                    setIsRegisteredUser(false);
                }
            }

            // 2. Find Contact ID for editing AND for Modal Target
            try {
                const myContacts = await getContacts(user.uid);

                if (id.length > 20) {
                    // ID is UID
                    // 1. Try to find by linkedUserId
                    foundContactData = myContacts.find(c => c.linkedUserId === id);

                    // 2. If not found, and we found a system user, try to match by their phone number
                    if (!foundContactData && foundSysUser && foundSysUser.primaryPhoneNumber) {
                        const userPhone = cleanPhoneNumber(foundSysUser.primaryPhoneNumber);
                        foundContactData = myContacts.find(c => c.phoneNumber === userPhone);
                    }
                } else {
                    // ID is Phone
                    foundContactData = myContacts.find(c =>
                        c.phoneNumber === cleanId || c.phoneNumber === id
                    );
                }

                if (foundContactData) {
                    setContactId(foundContactData.id);
                    setEditName(foundContactData.name);
                    setEditPhone(foundContactData.phoneNumber);
                    setTargetUserObject(foundContactData);
                } else if (foundSysUser) {
                    setTargetUserObject(foundSysUser);
                } else {
                    // Raw phone number
                    setTargetUserObject(null); // Don't lock to a user object
                    // We will rely on passing initialPhoneNumber and initialName to the modal
                }
            } catch (error) {
                console.error("Error finding contact:", error);
            }
        };
        checkRegistrationAndContact();
    }, [id, user]);

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return; // contactId check removed to allow creation

        setSubmittingEdit(true);
        try {
            if (contactId) {
                // Update existing
                await updateContact(user.uid, contactId, {
                    name: editName,
                    phoneNumber: editPhone
                });
                showAlert("Başarılı", "Kişi bilgileri güncellendi.", "success");
            } else {
                // Add new contact
                await addContact(user.uid, editName, editPhone);
                showAlert("Başarılı", "Kişi rehbere eklendi.", "success");
            }

            setShowEditModal(false);
            // window.location.reload(); 
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem başarısız oldu.", "error");
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
            // Also check resolvedUid if available (handles case where URL is phone but debt has UID)
            // Base matching logic
            const isMatch = otherId === id ||
                cleanOtherId === cleanId ||
                (d.participants.includes(id)) ||
                (resolvedUid && otherId === resolvedUid);

            if (!isMatch) return false;

            // ASYMMETRIC VISIBILITY FILTER:
            // If I am the Creator (Lender or Borrower who created it): Show Everything (Active, Rejected, Hidden)
            // If I am the Receiver (I did not assign this to myself): Hide Rejected/Hidden

            const amICreator = d.createdBy === user.uid;

            if (amICreator) {
                // I created it, I see it even if they rejected it.
                return true;
            } else {
                // I am the receiver. 
                // Exclude if REJECTED_BY_RECEIVER or AUTO_HIDDEN
                if (d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') {
                    return false;
                }
                return true;
            }
        });
    }, [debts, id, user, resolvedUid]);



    const personInfo = useMemo(() => {
        // Determine fallback name and phone from debts if available
        let fallbackName = '';

        // Use navigation state as high priority fallback for immediate render (Fixes UID flash)
        const locationState = location.state as { name?: string; phone?: string } | undefined;
        if (locationState?.name) {
            fallbackName = locationState.name;
        }

        // Always clean the ID from URL (handles + becoming space) IF it is a phone number.
        const isUID = id && id.length > 20;
        const cleanId = isUID ? (id || '') : cleanPhoneNumber(id || '');
        let phone = cleanId;

        // 1. Try to get better phone from targetUserObject (fetched/found user/contact)
        if (targetUserObject) {
            if ('primaryPhoneNumber' in targetUserObject && targetUserObject.primaryPhoneNumber) {
                phone = targetUserObject.primaryPhoneNumber;
            } else if ('phoneNumber' in targetUserObject && targetUserObject.phoneNumber) {
                phone = targetUserObject.phoneNumber;
            }
        }

        // 2. Fallback to Debt Information
        if ((!phone || phone.length > 20) && personDebts.length > 0) {
            const first = personDebts[0];
            const isLender = first.lenderId === user?.uid;

            if (!fallbackName) {
                fallbackName = isLender ? first.borrowerName : first.lenderName;
            }

            // Check lockedPhoneNumber first (most reliable for debt context)
            if (first.lockedPhoneNumber) {
                phone = first.lockedPhoneNumber;
            } else {
                const otherId = isLender ? first.borrowerId : first.lenderId;
                // If the ID param is a UID, we prefer the phone from the debt record if it looks like a phone
                if (id && id.length > 20 && otherId.length <= 15) {
                    phone = cleanPhoneNumber(otherId);
                }
            }
        }

        // 3. Navigation State Fallback (Lowest priority for phone, but high for name?)
        if ((!phone || phone.length > 20) && locationState?.phone) {
            phone = locationState.phone;
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
    }, [personDebts, user, id, contactId, editName, editPhone, resolveName, targetUserObject, location.state]);

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
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    {/* Back Button */}
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </button>

                    {/* Avatar */}
                    <div className="shrink-0">
                        <Avatar
                            name={personInfo.name}
                            size="lg"
                            status={isRegisteredUser ? 'system' : (contactId ? 'contact' : 'none')}
                            className="shadow-sm"
                            uid={
                                targetUserObject
                                    ? ('uid' in targetUserObject ? targetUserObject.uid : targetUserObject.linkedUserId)
                                    : (id && id.length > 20 ? id : undefined)
                            }
                        />
                    </div>

                    {/* Name & Phone */}
                    <div className="flex flex-col justify-center overflow-hidden min-w-0 mr-2">
                        <h1 className="text-base font-bold text-text-primary leading-tight truncate">{personInfo.name}</h1>
                        <p className="text-xs text-text-secondary font-medium mt-0.5 truncate">{formatPhoneNumber(personInfo.phone || '')}</p>
                    </div>

                    {/* Right Side Actions */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {/* WhatsApp */}
                        <a
                            href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-green-600 dark:text-green-500 flex items-center justify-center hover:bg-green-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <MessageCircle size={18} />
                        </a>

                        {/* Call */}
                        <a
                            href={`tel:${personInfo.phone || ''}`}
                            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-500 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <Phone size={18} />
                        </a>

                        {/* More Options Menu, moved inside div to reuse space if needed, 
                            but actually we just removed the primary action button. 
                            WhatsApp and Call buttons remain. 
                        */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {/* Dropdown Menu */}
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                                        {/* 1. Edit / Add (Context Dependent) */}
                                        {contactId ? (
                                            <button
                                                onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                            >
                                                <Edit2 size={16} /> Düzenle
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditName(personInfo.name);
                                                    setEditPhone(personInfo.phone || '');
                                                    setShowEditModal(true);
                                                    setShowMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center gap-2"
                                            >
                                                <UserPlus size={16} /> Rehbere Ekle
                                            </button>
                                        )}

                                        <div className="h-px bg-border my-0"></div>

                                        {/* 2. Universal Actions (Mute & Block) */}
                                        <button
                                            onClick={() => { handleMuteToggle(); setShowMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                            {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                            {isMuted ? 'Sessize Almayı Kaldır' : 'Sessize Al'}
                                        </button>

                                        <button
                                            onClick={() => { handleBlockToggle(); setShowMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-2"
                                        >
                                            <Ban size={16} /> {isBlocked ? 'Engeli Kaldır' : 'Kullanıcıyı Engelle'}
                                        </button>

                                        {/* 3. Delete (Contact Only) */}
                                        {contactId && (
                                            <>
                                                <div className="h-px bg-border my-0"></div>
                                                <button
                                                    onClick={() => { handleDelete(); setShowMenu(false); }}
                                                    className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} /> Kişiyi Sil
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Blocked Badge */}
                {isBlocked && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800 flex items-center gap-3">
                        <Ban className="text-orange-600 shrink-0" size={20} />
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                            Bu kullanıcı engellendi. Yeni işlem yapamazsınız ancak geçmiş kayıtlar tutulur.
                        </p>
                    </div>
                )}

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
                                disabled={isBlocked} // Pass blocked status to disable interactions
                            />
                        ))
                    ) : (
                        <div className="text-center py-10 text-text-secondary opacity-60">
                            <p>Henüz kayıtlı işlem yok.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit Modal */}
            {
                showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-text-primary">
                                    {contactId ? "Kişiyi Düzenle" : "Rehbere Ekle"}
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
