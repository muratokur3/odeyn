import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, Phone, MessageCircle, Trash2, Edit2, X, MoreVertical, Ban, UserPlus, VolumeX, Volume2, FolderOpen } from 'lucide-react';
import { searchUserByPhone, getContacts, updateContact, addContact, deleteContact, muteUser, unmuteUser, markContactAsRead, createDebt } from '../services/db';
import { blockUser, isUserBlocked, unblockUser } from '../services/blockService';
import { Avatar } from '../components/Avatar';
import { DebtCard } from '../components/DebtCard';
import { TransactionList } from '../components/TransactionList';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { UserBalanceHeader } from '../components/UserBalanceHeader';
import { PhoneInput } from '../components/PhoneInput';
import { convertToTRY, fetchRates, type CurrencyRates } from '../services/currency';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import clsx from 'clsx';
import { useModal } from '../context/ModalContext';

import type { User, Contact } from '../types';
import { useLedger } from '../hooks/useLedger';

export const PersonDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { allDebts: debts, loading } = useDebts();
    const { resolveName } = useContactName();
    const { showAlert, showConfirm } = useModal();
    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [isRegisteredUser, setIsRegisteredUser] = useState(false);

    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);

    const [contactId, setContactId] = useState<string | null>(null);
    const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [activeViewIndex, setActiveViewIndex] = useState(0); // 0 = Stream, 1 = Files
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const viewWidth = container.offsetWidth;
        const newIndex = Math.round(scrollLeft / viewWidth);
        if (newIndex !== activeViewIndex) {
            setActiveViewIndex(newIndex);
        }
    };

    const scrollToView = (index: number) => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.scrollTo({
            left: index * container.offsetWidth,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        const handleBottomNavTrigger = () => {
            if (isBlocked) return;
            setShowCreateDebtModal(true);
        };

        window.addEventListener('trigger-person-fab-action', handleBottomNavTrigger);
        return () => window.removeEventListener('trigger-person-fab-action', handleBottomNavTrigger);
    }, [isBlocked]);

    const getTargetUid = () => {
        if (id && id.length > 20) return id;
        if (targetUserObject) {
            if ('uid' in targetUserObject) return targetUserObject.uid;
            if ('linkedUserId' in targetUserObject && targetUserObject.linkedUserId) return targetUserObject.linkedUserId;
        }
        return null;
    };

    useEffect(() => {
        if (user && id) {
            markContactAsRead(user.uid, id);
        }
    }, [user, id]);

    useEffect(() => {
        const checkStatus = async () => {
            if (!user || !id) return;
            const targetUid = getTargetUid();

            if (targetUid) {
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);

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
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error("Delete contact error:", error);
                showAlert("Hata", "Silme işlemi sırasında bir sorun oluştu.", "error");
            }
        }
    };

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    const [resolvedUid, setResolvedUid] = useState<string | null>(null);

    useEffect(() => {
        const checkRegistrationAndContact = async () => {
            if (!id || !user) return;
            const isUID = id.length > 20;

            let foundSysUser: User | null = null;

            if (id.length > 20) {
                setResolvedUid(id);
                setIsRegisteredUser(true);
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

            if (foundSysUser) {
                setTargetUserObject(foundSysUser);
            } else {
                 setTargetUserObject(null);
            }
        };
        checkRegistrationAndContact();
    }, [id, user]);

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmittingEdit(true);
        try {
            if (contactId) {
                await updateContact(user.uid, contactId, {
                    name: editName,
                    phoneNumber: editPhone
                });
                showAlert("Başarılı", "Kişi bilgileri güncellendi.", "success");
            } else {
                await addContact(user.uid, editName, editPhone);
                showAlert("Başarılı", "Kişi rehbere eklendi.", "success");
            }

            setShowEditModal(false);
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem başarısız oldu.", "error");
        } finally {
            setSubmittingEdit(false);
        }
    };

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
                (d.participants.includes(id)) ||
                (resolvedUid && otherId === resolvedUid);

            if (!isMatch) return false;

            const amICreator = d.createdBy === user.uid;

            if (amICreator) {
                return true;
            } else {
                if (d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') {
                    return false;
                }
                return true;
            }
        });
    }, [debts, id, user, resolvedUid]);

    const personInfo = useMemo(() => {
        let fallbackName = '';

        const locationState = location.state as { name?: string; phone?: string } | undefined;
        if (locationState?.name) {
            fallbackName = locationState.name;
        }

        const isUID = id && id.length > 20;
        const cleanId = isUID ? (id || '') : cleanPhoneNumber(id || '');
        let phone = cleanId;

        if (targetUserObject) {
            if ('primaryPhoneNumber' in targetUserObject && targetUserObject.primaryPhoneNumber) {
                phone = targetUserObject.primaryPhoneNumber;
            } else if ('phoneNumber' in targetUserObject && targetUserObject.phoneNumber) {
                phone = targetUserObject.phoneNumber;
            }
        }

        if ((!phone || phone.length > 20) && personDebts.length > 0) {
            const first = personDebts[0];
            const isLender = first.lenderId === user?.uid;

            if (!fallbackName) {
                fallbackName = isLender ? first.borrowerName : first.lenderName;
            }

            if (first.lockedPhoneNumber) {
                phone = first.lockedPhoneNumber;
            } else {
                const otherId = isLender ? first.borrowerId : first.lenderId;
                if (id && id.length > 20 && otherId.length <= 15) {
                    phone = cleanPhoneNumber(otherId);
                }
            }
        }

        if ((!phone || phone.length > 20) && locationState?.phone) {
            phone = locationState.phone;
        }

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
    

    useEffect(() => {
        const checkContactStatus = async () => {
            if (!user || !personInfo.phone) return;
            if (personInfo.phone.length > 20) return; 

            const phoneToCheck = cleanPhoneNumber(personInfo.phone);
            
            try {
                const contacts = await getContacts(user.uid);
                const match = contacts.find(c => c.phoneNumber === phoneToCheck);
                
                if (match) {
                    if (contactId !== match.id) {
                        setContactId(match.id);
                        setEditName(match.name);
                        setEditPhone(match.phoneNumber);
                        setTargetUserObject(match); 
                        
                        if (match.lastReadAt) {
                            setLastReadTimestamp(match.lastReadAt.toMillis());
                        } else {
                            setLastReadTimestamp(Date.now());
                        }
                    }
                } else {
                    if (contactId !== null) {
                        setContactId(null);
                    }
                }
            } catch (e) {
                console.error("Contact check error", e);
            }
        };
        
        checkContactStatus();
    }, [user, personInfo.phone]);

    const otherPartyId = getTargetUid() || id;
    const { 
        ledgerId, 
        transactions, 
        loading: txLoading, 
    } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    if (loading) return <div className="p-4 text-center">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-background pb-24">
            <header className="bg-surface sticky top-0 z-10 shadow-sm transition-colors duration-200">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
                        <ArrowLeft size={20} />
                    </button>

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

                    <div className="flex flex-col justify-center overflow-hidden min-w-0 mr-2">
                        <h1 className="text-base font-bold text-text-primary leading-tight truncate">{personInfo.name}</h1>
                        <p className="text-xs text-text-secondary font-medium mt-0.5 truncate">{formatPhoneNumber(personInfo.phone || '')}</p>
                    </div>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        <a
                            href={`https://wa.me/${cleanPhoneNumber(personInfo.phone || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-green-600 dark:text-green-500 flex items-center justify-center hover:bg-green-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <MessageCircle size={18} />
                        </a>

                        <a
                            href={`tel:${personInfo.phone || ''}`}
                            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-500 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <Phone size={18} />
                        </a>

                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>

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
                {isBlocked && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800 flex items-center gap-3">
                        <Ban className="text-orange-600 shrink-0" size={20} />
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                            Bu kullanıcı engellendi. Yeni işlem yapamazsınız ancak geçmiş kayıtlar tutulur.
                        </p>
                    </div>
                )}

                <UserBalanceHeader
                    transactions={transactions}
                    specialDebts={personDebts}
                    currentUserId={user?.uid || ''}
                />

                <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                        onClick={() => scrollToView(0)}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all",
                            activeViewIndex === 0
                                ? "bg-purple-600 text-white shadow-md"
                                : "bg-slate-100 dark:bg-slate-800 text-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                    >
                        Akış
                    </button>
                    <button
                        onClick={() => scrollToView(1)}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                            activeViewIndex === 1
                                ? "bg-blue-600 text-white shadow-md"
                                : "bg-slate-100 dark:bg-slate-800 text-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                    >
                        <FolderOpen size={14} />
                        Özel İşlemler
                        {personDebts.length > 0 && (
                            <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded text-xs">{personDebts.length}</span>
                        )}
                    </button>
                </div>

                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="snap-start shrink-0 w-full px-1 space-y-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-text-primary px-1">Cari Akışı</h3>
                            {txLoading ? (
                                <div className="text-center py-8 text-text-secondary">Yükleniyor...</div>
                            ) : ledgerId ? (
                                <TransactionList
                                    transactions={transactions}
                                    ledgerId={ledgerId}
                                />
                            ) : (
                                <div className="text-center py-12 text-text-secondary">
                                    <div className="text-4xl mb-3 opacity-50">💸</div>
                                    <p className="font-medium">Henüz defter oluşturulmadı</p>
                                    <p className="text-sm mt-1 opacity-70">İlk işlemi ekleyerek defteri başlatın</p>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="snap-start shrink-0 w-full px-1 space-y-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-text-primary px-1 flex items-center gap-2">
                                <FolderOpen size={16} />
                                Özel İşlemler
                            </h3>
                            {personDebts.length > 0 ? (
                                <div className="space-y-2">
                                    {personDebts.map(debt => {
                                        const isMyEntry = debt.createdBy === user?.uid;
                                        const isNew = !isMyEntry && lastReadTimestamp && debt.createdAt && debt.createdAt.toMillis() > lastReadTimestamp;
                                        return (
                                            <div key={debt.id} className={clsx("flex w-full", isMyEntry ? "justify-end" : "justify-start")}>
                                                <div className="w-full">
                                                    <DebtCard
                                                        debt={debt}
                                                        isNew={!!isNew}
                                                        currentUserId={user?.uid || ''}
                                                        onClick={() => navigate(`/debt/${debt.id}`)}
                                                        disabled={isBlocked}
                                                        variant="chat"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-text-secondary">
                                    <FolderOpen size={32} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-medium">Özel işlem yok</p>
                                    <p className="text-sm mt-1 opacity-70">Taksitli veya karmaşık borçlar burada görünecek</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

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
