/**
 * PersonProfile - User Profile & Details Page
 * Accessed by clicking header in PersonStream
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, Phone, MessageCircle, Edit2, MoreVertical, Ban, UserPlus, VolumeX, Volume2, FolderOpen, ExternalLink } from 'lucide-react';
import { searchUserByPhone, getContacts, updateContact, addContact, deleteContact, muteUser, unmuteUser, createDebt } from '../services/db';
import { blockUser, isUserBlocked, unblockUser } from '../services/blockService';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { UserBalanceHeader } from '../components/UserBalanceHeader';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { PhoneInput } from '../components/PhoneInput';
import { formatPhoneForDisplay as formatPhoneNumber, cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import clsx from 'clsx';
import { useModal } from '../context/ModalContext';
import type { User, Contact } from '../types';
import { useLedger } from '../hooks/useLedger';

export const PersonProfile = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { allDebts: debts } = useDebts();
    const { resolveName } = useContactName();
    const { showAlert, showConfirm } = useModal();
    const [rates, setRates] = useState<CurrencyRates | null>(null);

    // State
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);
    const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);

    // Fetch rates
    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // Get target UID
    const getTargetUid = () => {
        if (id && id.length > 20) return id;
        if (targetUserObject) {
            if ('uid' in targetUserObject) return targetUserObject.uid;
            if ('linkedUserId' in targetUserObject && targetUserObject.linkedUserId) return targetUserObject.linkedUserId;
        }
        return null;
    };

    // Fetch user/contact info
    useEffect(() => {
        if (!user || !id) return;

        const fetchTarget = async () => {
            const cleanId = cleanPhoneNumber(id);
            
            if (id.length > 20) {
                const userDoc = await getDoc(doc(db, 'users', id));
                if (userDoc.exists()) {
                    setTargetUserObject({ uid: userDoc.id, ...userDoc.data() } as User);
                    setResolvedUid(id);
                }
            } else {
                const foundUser = await searchUserByPhone(cleanId);
                if (foundUser) {
                    setTargetUserObject(foundUser);
                    setResolvedUid(foundUser.uid);
                }
            }

            const contacts = await getContacts(user.uid);
            const contact = contacts.find(c => 
                cleanPhoneNumber(c.phoneNumber) === cleanId || c.id === id
            );
            if (contact) {
                setContactId(contact.id);
                setEditName(contact.name);
                setEditPhone(contact.phoneNumber);
                setLastReadTimestamp(contact.lastReadAt?.toMillis() || null);
                if (!targetUserObject) setTargetUserObject(contact);
            }

            const targetUid = getTargetUid() || id;
            if (targetUid) {
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);
            }

            if (user.mutedCreators?.includes(id)) {
                setIsMuted(true);
            }
        };

        fetchTarget();
    }, [user, id]);

    // Person info
    const personInfo = useMemo(() => {
        const locationState = location.state as { name?: string; phone?: string } | undefined;
        let name = locationState?.name || '';
        let phone = locationState?.phone || (id && id.length > 20 ? '' : cleanPhoneNumber(id || ''));

        if (targetUserObject) {
            if ('displayName' in targetUserObject) name = targetUserObject.displayName || name;
            else if ('name' in targetUserObject) name = targetUserObject.name || name;
            if ('primaryPhoneNumber' in targetUserObject) phone = targetUserObject.primaryPhoneNumber || phone;
            else if ('phoneNumber' in targetUserObject) phone = targetUserObject.phoneNumber || phone;
        }

        const { displayName } = resolveName(id || '', name);
        return { name: displayName, phone };
    }, [id, targetUserObject, resolveName, location.state]);

    // Ledger for balance
    const otherPartyId = getTargetUid() || id;
    const { transactions, balance: cariBalance } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    // Filter special debts (non-LEDGER)
    const personDebts = useMemo(() => {
        if (!debts || !id || !user) return [];
        const cleanId = cleanPhoneNumber(id);

        return debts.filter(d => {
            if (d.type === 'LEDGER') return false;

            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const cleanOtherId = cleanPhoneNumber(otherId);

            const isMatch = otherId === id ||
                cleanOtherId === cleanId ||
                d.participants.includes(id) ||
                (resolvedUid && otherId === resolvedUid);

            if (!isMatch) return false;

            const amICreator = d.createdBy === user.uid;
            if (amICreator) return true;
            if (d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') return false;
            return true;
        });
    }, [debts, id, user, resolvedUid]);

    // Action handlers
    const handleBlock = async () => {
        const targetUid = getTargetUid() || id;
        if (!user || !targetUid) return;

        const confirmed = await showConfirm(
            isBlocked ? "Engeli Kaldır" : "Engelle",
            isBlocked ? "Bu kullanıcının engelini kaldırmak istiyor musunuz?" : "Bu kullanıcıyı engellemek istiyor musunuz?",
            "warning"
        );

        if (confirmed) {
            try {
                if (isBlocked) {
                    await unblockUser(user.uid, targetUid);
                    setIsBlocked(false);
                    showAlert("Başarılı", "Engel kaldırıldı.", "success");
                } else {
                    await blockUser(user.uid, targetUid, personInfo.name);
                    setIsBlocked(true);
                    showAlert("Başarılı", "Kullanıcı engellendi.", "success");
                }
            } catch {
                showAlert("Hata", "İşlem başarısız.", "error");
            }
        }
        setShowMenu(false);
    };

    const handleMute = async () => {
        const targetUid = getTargetUid() || id;
        if (!user || !targetUid) return;

        try {
            if (isMuted) {
                await unmuteUser(user.uid, targetUid);
                setIsMuted(false);
                showAlert("Başarılı", "Bildirimler açıldı.", "success");
            } else {
                await muteUser(user.uid, targetUid);
                setIsMuted(true);
                showAlert("Başarılı", "Bildirimler kapatıldı.", "success");
            }
        } catch {
            showAlert("Hata", "İşlem başarısız.", "error");
        }
        setShowMenu(false);
    };

    const handleCall = () => {
        if (personInfo.phone) {
            window.location.href = `tel:${personInfo.phone}`;
        }
    };

    const handleWhatsApp = () => {
        if (personInfo.phone) {
            const cleanPhone = personInfo.phone.replace(/\D/g, '');
            window.open(`https://wa.me/${cleanPhone}`, '_blank');
        }
    };

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
                <button 
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ArrowLeft size={22} />
                </button>
                <h1 className="font-semibold text-text-primary flex-1">Profil</h1>
                
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <MoreVertical size={20} />
                </button>
            </header>

            {/* Menu Dropdown */}
            {showMenu && (
                <div className="absolute right-4 top-14 z-40 bg-surface rounded-xl shadow-xl border border-border py-1 min-w-[180px]">
                    {contactId && (
                        <button
                            onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                            className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                        >
                            <Edit2 size={16} />
                            Kişiyi Düzenle
                        </button>
                    )}
                    <button
                        onClick={handleMute}
                        className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3"
                    >
                        {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        {isMuted ? "Bildirimleri Aç" : "Bildirimleri Kapat"}
                    </button>
                    <button
                        onClick={handleBlock}
                        className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                    >
                        <Ban size={16} />
                        {isBlocked ? "Engeli Kaldır" : "Engelle"}
                    </button>
                </div>
            )}

            <main className="px-4 py-6 space-y-6">
                {/* Avatar & Name Card */}
                <div className="text-center">
                    <Avatar 
                        name={personInfo.name} 
                        photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined}
                        size="xl"
                        className="mx-auto mb-4"
                    />
                    <h2 className="text-2xl font-bold text-text-primary">{personInfo.name}</h2>
                    {personInfo.phone && (
                        <p className="text-text-secondary mt-1">{formatPhoneNumber(personInfo.phone)}</p>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={handleCall}
                        className="flex flex-col items-center gap-1 p-4 bg-surface rounded-2xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Phone size={24} className="text-green-600" />
                        <span className="text-xs text-text-secondary">Ara</span>
                    </button>
                    <button
                        onClick={handleWhatsApp}
                        className="flex flex-col items-center gap-1 p-4 bg-surface rounded-2xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <MessageCircle size={24} className="text-green-500" />
                        <span className="text-xs text-text-secondary">WhatsApp</span>
                    </button>
                    <button
                        onClick={() => navigate(`/person/${id}`, { state: { name: personInfo.name } })}
                        className="flex flex-col items-center gap-1 p-4 bg-surface rounded-2xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ExternalLink size={24} className="text-purple-600" />
                        <span className="text-xs text-text-secondary">Akış</span>
                    </button>
                </div>

                {/* Balance Header */}
                <UserBalanceHeader
                    transactions={transactions}
                    specialDebts={personDebts}
                    currentUserId={user?.uid || ''}
                />

                {/* Quick Navigation to Lists */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => navigate(`/person/${id}`, { state: { name: personInfo.name } })}
                        className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 text-left"
                    >
                        <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Akış İşlemleri</p>
                        <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{transactions.length} işlem</p>
                    </button>
                    <button
                        onClick={() => {
                            navigate(`/person/${id}`, { state: { name: personInfo.name } });
                            // Small delay to allow navigation, then scroll to special
                            setTimeout(() => window.dispatchEvent(new CustomEvent('scroll-to-special')), 100);
                        }}
                        className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 text-left"
                    >
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Özel İşlemler</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{personDebts.length} dosya</p>
                    </button>
                </div>
            </main>

            {/* Create Debt Modal */}
            <CreateDebtModal
                isOpen={showCreateDebtModal}
                onClose={() => setShowCreateDebtModal(false)}
                onSubmit={async (borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, initialPayment) => {
                    if (!user) return;
                    await createDebt(user.uid, user.displayName || 'Bilinmeyen', borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, initialPayment || 0);
                    setShowCreateDebtModal(false);
                }}
                targetUser={targetUserObject}
                initialPhoneNumber={personInfo.phone}
                initialName={personInfo.name}
            />

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-700">
                        <h2 className="text-xl font-bold text-text-primary mb-4">Kişiyi Düzenle</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">İsim</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Telefon</label>
                                <PhoneInput
                                    value={editPhone}
                                    onChange={setEditPhone}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-700 text-text-secondary"
                            >
                                İptal
                            </button>
                            <button
                                onClick={async () => {
                                    if (!user || !contactId) return;
                                    setSubmittingEdit(true);
                                    try {
                                        await updateContact(user.uid, contactId, { name: editName, phoneNumber: editPhone });
                                        showAlert("Başarılı", "Kişi güncellendi.", "success");
                                        setShowEditModal(false);
                                    } catch {
                                        showAlert("Hata", "Güncelleme başarısız.", "error");
                                    } finally {
                                        setSubmittingEdit(false);
                                    }
                                }}
                                disabled={submittingEdit}
                                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold"
                            >
                                {submittingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
