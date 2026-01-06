/**
 * PersonStream - Profile Hub (Ana Merkez)
 * Summary of Stream (Chips) + List of Special Debts
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, FolderOpen, MoreVertical, Edit2, UserPlus, Volume2, VolumeX, Ban, Trash2 } from 'lucide-react';
import { searchUserByPhone, getContacts, markContactAsRead, createDebt, addContact, updateContact, deleteContact, muteUser, unmuteUser } from '../services/db';
import { isUserBlocked, blockUser, unblockUser } from '../services/blockService';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { CurrencyChips } from '../components/CurrencyChips';
import { PhoneInput } from '../components/PhoneInput';
import { calculateStreamBalance } from '../utils/balanceAggregator';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useModal } from '../context/ModalContext';
import type { User, Contact } from '../types';
import { useLedger } from '../hooks/useLedger';

export const PersonStream = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { allDebts: debts } = useDebts();
    const { resolveName } = useContactName();
    const { showAlert, showConfirm } = useModal();
    
    // State
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);
    const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);

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
            } else {
                // If not in contacts, pre-fill with defaults
                if (!contactId) {
                    const { displayName } = resolveName(id, '');
                    setEditName(displayName);
                    setEditPhone(id.length <= 15 ? cleanId : '');
                }
            }

            const targetUid = getTargetUid() || id;
            if (targetUid) {
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);

                if (targetUid.length > 20) {
                     const userRef = doc(db, 'users', user.uid);
                     const userSnap = await getDoc(userRef);
                     if (userSnap.exists()) {
                         const uData = userSnap.data() as User;
                         setIsMuted(uData.mutedCreators?.includes(targetUid) || false);
                     }
                }
            }
        };

        fetchTarget();
        markContactAsRead(user.uid, id);
    }, [user, id]);

    // Listen for Global FAB Trigger
    useEffect(() => {
        const handleFabTrigger = () => {
            if (isBlocked) return;
            setShowCreateDebtModal(true);
        };
        window.addEventListener('trigger-person-fab-action', handleFabTrigger);
        return () => window.removeEventListener('trigger-person-fab-action', handleFabTrigger);
    }, [isBlocked]);

    // Person info
    const personInfo = useMemo(() => {
        const locationState = location.state as { name?: string } | undefined;
        let name = locationState?.name || '';
        let phone = id && id.length > 20 ? '' : cleanPhoneNumber(id || '');

        if (targetUserObject) {
            if ('displayName' in targetUserObject) name = targetUserObject.displayName || name;
            else if ('name' in targetUserObject) name = targetUserObject.name || name;
            if ('primaryPhoneNumber' in targetUserObject) phone = targetUserObject.primaryPhoneNumber || phone;
            else if ('phoneNumber' in targetUserObject) phone = targetUserObject.phoneNumber || phone;
        }

        const { displayName } = resolveName(id || '', name);
        return { name: displayName, phone };
    }, [id, targetUserObject, resolveName, location.state]);

    // Ledger hook (for Stream Summary)
    const otherPartyId = getTargetUid() || id;
    const { transactions } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    // Calculate Stream Balance
    const streamBalance = useMemo(() => {
        if (!user) return new Map();
        return calculateStreamBalance(transactions, user.uid);
    }, [transactions, user]);

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
        }).sort((a, b) => {
            // Sort by creation desc
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [debts, id, user, resolvedUid]);

    // Actions
    const handleBlockToggle = async () => {
        if (!user) return;
        const targetUid = getTargetUid();
        if (!targetUid || targetUid.length <= 15) {
            showAlert("Uyarı", "Bu kişi sisteme kayıtlı değil, engellenemez.", "warning");
            return;
        }

        if (isBlocked) {
            if (await showConfirm("Engeli Kaldır", "Engeli kaldırmak istiyor musunuz?")) {
                await unblockUser(user.uid, targetUid);
                setIsBlocked(false);
                showAlert("Başarılı", "Engel kaldırıldı.", "success");
            }
        } else {
            if (await showConfirm("Engelle", "Bu kişiyi engellemek istiyor musunuz?", "warning")) {
                await blockUser(user.uid, targetUid, personInfo.name);
                setIsBlocked(true);
                showAlert("Engellendi", "Kullanıcı engellendi.", "success");
            }
        }
    };

    const handleMuteToggle = async () => {
        if (!user) return;
        const targetUid = getTargetUid();
        if (!targetUid || targetUid.length <= 15) {
             showAlert("Uyarı", "Bu kişi sisteme kayıtlı değil.", "warning");
             return;
        }

        if (isMuted) {
            await unmuteUser(user.uid, targetUid);
            setIsMuted(false);
            showAlert("Başarılı", "Sessize alma kaldırıldı.", "success");
        } else {
            await muteUser(user.uid, targetUid);
            setIsMuted(true);
            showAlert("Sessize Alındı", "Kullanıcı sessize alındı.", "success");
        }
    };

    const handleDeleteContact = async () => {
        if (!user || !contactId) return;
        if (await showConfirm("Sil", "Kişiyi rehberden silmek istediğinize emin misiniz?")) {
            await deleteContact(user.uid, contactId);
            navigate(-1);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSubmittingEdit(true);
        try {
            if (contactId) {
                await updateContact(user.uid, contactId, { name: editName, phoneNumber: editPhone });
            } else {
                await addContact(user.uid, editName, editPhone);
            }
            setShowEditModal(false);
            window.location.reload();
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem başarısız.", "error");
        } finally {
            setSubmittingEdit(false);
        }
    };

    if (!user) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;

    return (
        <div className="bg-background min-h-[calc(100vh-64px)] pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft size={22} />
                </button>

                <Avatar name={personInfo.name} size="md" photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined} />

                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-text-primary truncate">{personInfo.name}</h1>
                    <p className="text-xs text-text-secondary">{formatPhoneNumber(personInfo.phone)}</p>
                </div>

                <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-text-secondary hover:bg-slate-100 rounded-full">
                        <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                         <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    {contactId ? <><Edit2 size={16} /> Düzenle</> : <><UserPlus size={16} /> Rehbere Ekle</>}
                                </button>
                                <div className="h-px bg-border my-0"></div>
                                <button
                                    onClick={() => { handleMuteToggle(); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                    {isMuted ? 'Sessizi Kaldır' : 'Sessize Al'}
                                </button>
                                <button
                                    onClick={() => { handleBlockToggle(); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                                >
                                    <Ban size={16} /> {isBlocked ? 'Engeli Kaldır' : 'Engelle'}
                                </button>
                                {contactId && (
                                    <button
                                        onClick={() => { handleDeleteContact(); setShowMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Sil
                                    </button>
                                )}
                            </div>
                         </>
                    )}
                </div>
            </header>

            {isBlocked && (
                <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 text-center text-sm text-orange-700 dark:text-orange-300">
                    Bu kullanıcı engellenmiş
                </div>
            )}

            <main className="p-4 space-y-6">
                {/* A. Akış Özeti (Stream Summary) */}
                <section>
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1">Akış Özeti</h2>
                    <div 
                        onClick={() => navigate(`/person/${id}/history`)}
                        className="bg-surface rounded-2xl p-5 border border-border shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group relative"
                    >
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary group-hover:translate-x-1 transition-transform">
                            <ArrowLeft className="rotate-180" size={20} />
                        </div>

                        <div className="pr-8">
                            {transactions.length > 0 ? (
                                <CurrencyChips balances={streamBalance} size="md" />
                            ) : (
                                <div className="text-text-secondary flex items-center gap-2">
                                    <span className="text-2xl">💬</span>
                                    <span>Henüz akış kaydı yok</span>
                                </div>
                            )}
                            <p className="text-xs text-text-tertiary mt-2 font-medium">Detaylı geçmiş için dokunun</p>
                        </div>
                    </div>
                </section>

                {/* B. Özel Borçlar Listesi (Special Debts List) */}
                <section>
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <FolderOpen size={14} />
                        Özel Borçlar
                    </h2>

                    {personDebts.length > 0 ? (
                        <div className="space-y-3">
                            {personDebts.map(debt => {
                                const isMyEntry = debt.createdBy === user?.uid;
                                const isNew = !isMyEntry && lastReadTimestamp && debt.createdAt && debt.createdAt.toMillis() > lastReadTimestamp;
                                return (
                                    <div key={debt.id} className="w-full">
                                        <DebtCard
                                            debt={debt}
                                            isNew={!!isNew}
                                            currentUserId={user.uid}
                                            onClick={() => navigate(`/debt/${debt.id}`)}
                                            disabled={isBlocked}
                                            variant="default"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-surface/50 rounded-xl p-8 text-center border border-dashed border-border">
                            <FolderOpen size={32} className="mx-auto mb-3 opacity-30 text-text-secondary" />
                            <p className="text-text-secondary font-medium">Özel borç yok</p>
                            <p className="text-xs text-text-tertiary mt-1">Vadeli veya taksitli borçlar burada görünür</p>
                        </div>
                    )}
                </section>
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

            {/* Edit Contact Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-700">
                        <h2 className="text-xl font-bold text-text-primary mb-4">{contactId ? "Kişiyi Düzenle" : "Rehbere Ekle"}</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">İsim</label>
                                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-background text-text-primary" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Telefon</label>
                                <PhoneInput value={editPhone} onChange={setEditPhone} required />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2 text-text-secondary hover:bg-background rounded-lg">İptal</button>
                                <button type="submit" disabled={submittingEdit} className="flex-1 py-2 bg-primary text-white rounded-lg">{submittingEdit ? '...' : 'Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
