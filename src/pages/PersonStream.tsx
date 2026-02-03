/**
 * PersonStream - Modern Person Profile Page
 * Clean, tab-based UI with BalanceCard + Debts/Ledger/History tabs
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePersonDebts } from '../hooks/usePersonDebts';
import { usePersonBalance } from '../hooks/usePersonBalance';
import { useContactName } from '../hooks/useContactName';
import { useLedger } from '../hooks/useLedger';
import { ArrowLeft, MoreVertical, Edit2, UserPlus, Volume2, VolumeX, Ban, Trash2 } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import clsx from 'clsx';
import { BalanceCard } from '../components/BalanceCard';
import { TabBar, type Tab } from '../components/TabBar';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionList } from '../components/TransactionList';
import { calculateStreamBalance, calculateDebtsBalance, mergeBalances, type DetailedBalances } from '../utils/balanceAggregator';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import { DebtsTab } from '../components/DebtsTab';
import { DateFilterDropdown, type QuickFilterType } from '../components/DateFilterDropdown';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { useModal } from '../context/ModalContext';
import { getContacts, markContactAsRead, addContact, updateContact, deleteContact, muteUser, unmuteUser } from '../services/db';
import { isUserBlocked, blockUser, unblockUser } from '../services/blockService';
import { cleanPhone, formatPhoneForDisplay } from '../utils/phoneUtils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { User, Contact, Debt } from '../types';

type TabMode = 'TOTAL' | 'LEDGER' | 'INSTALLMENT';

export const PersonStream = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { resolveName } = useContactName();
    const { showAlert, showConfirm } = useModal();

    // State
    const [tabMode, setTabMode] = useState<TabMode>(() => {
        return (localStorage.getItem(`tabMode_${id}`) as TabMode) || 'TOTAL';
    });
    const carouselRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);
    const isFirstLoadRef = useRef(true);
    const lastUpdateSourceRef = useRef<'SCROLL' | 'CLICK' | null>(null);
    const tabModeRef = useRef(tabMode);

    useEffect(() => {
        tabModeRef.current = tabMode;
    }, [tabMode]);

    // Ledger Filter State
    const [ledgerDateFilter, setLedgerDateFilter] = useState<QuickFilterType>('all');
    const [ledgerCustomDateRange, setLedgerCustomDateRange] = useState<{ start?: Date; end?: Date }>({});

    useEffect(() => {
        if (id) {
            localStorage.setItem(`tabMode_${id}`, tabMode);
        }
    }, [tabMode, id]);

    // Get target UID helper
    const getTargetUid = useMemo(() => {
        return () => {
            if (id && id.length > 20) return id;
            if (targetUserObject) {
                if ('uid' in targetUserObject) return targetUserObject.uid;
                if ('linkedUserId' in targetUserObject && targetUserObject.linkedUserId) {
                    return targetUserObject.linkedUserId;
                }
            }
            return null;
        };
    }, [id, targetUserObject]);

    // Fetch target user/contact
    useEffect(() => {
        const fetchTarget = async () => {
            if (!user || !id) return;

            try {
                // Try to find contact first
                const contactsSnapshot = await getContacts(user.uid);
                const contact = contactsSnapshot.find(c => {
                    const contactPhone = cleanPhone(c.phoneNumber || '');
                    const idPhone = cleanPhone(id);
                    return c.linkedUserId === id || contactPhone === idPhone;
                });

                if (contact) {
                    setTargetUserObject(contact);
                    setContactId(contact.id);
                    if (contact.linkedUserId) {
                        setResolvedUid(contact.linkedUserId);
                        const userDoc = await getDoc(doc(db, 'users', contact.linkedUserId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data() as User;
                            const blocked = await isUserBlocked(user.uid, contact.linkedUserId);
                            setIsBlocked(blocked);
                            setIsMuted(userData.mutedCreators?.includes(user.uid) || false);
                        }
                    }
                } else if (id.length > 20) {
                    // Direct UID
                    const userDoc = await getDoc(doc(db, 'users', id));
                    if (userDoc.exists()) {
                        setTargetUserObject({ uid: id, ...userDoc.data() } as User);
                        setResolvedUid(id);
                        const blocked = await isUserBlocked(user.uid, id);
                        setIsBlocked(blocked);
                        const uData = userDoc.data() as User;
                        setIsMuted(uData.mutedCreators?.includes(user.uid) || false);
                    }
                }
            } catch (error) {
                console.error('Error fetching target:', error);
            }

            markContactAsRead(user.uid, id);
        };

        fetchTarget();
    }, [user, id]);

    // Listen for FAB trigger
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
        let name = '';
        let phone = id && id.length > 20 ? '' : cleanPhone(id || '');

        if (targetUserObject) {
            if ('displayName' in targetUserObject) name = targetUserObject.displayName || name;
            else if ('name' in targetUserObject) name = targetUserObject.name || name;
            if ('primaryPhoneNumber' in targetUserObject) phone = targetUserObject.primaryPhoneNumber || phone;
            else if ('phoneNumber' in targetUserObject) phone = targetUserObject.phoneNumber || phone;
        }

        const { displayName } = resolveName(id || '', name);
        return { name: displayName, phone };
    }, [id, targetUserObject, resolveName]);

    // Custom hooks for data
    const { allDebts, activeDebts, historyDebts, activeCount } = usePersonDebts(id || '', resolvedUid);
    const balance = usePersonBalance(id || '', personInfo.name, allDebts);

    // useLedger for LEDGER tab
    const { transactions, ledgerId } = useLedger(
        user?.uid,
        user?.displayName,
        id || undefined,
        personInfo.name
    );

    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [toggledCards, setToggledCards] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // Helper: Infer debt type for old debts without type field
    const getDebtType = (debt: Debt): string => {
        // If type exists, use it
        if (debt.type) return debt.type;
        
        // Fallback: infer from other fields
        if (debt.dueDate || (debt.installments && debt.installments.length > 0)) {
            return 'INSTALLMENT';
        }
        return 'ONE_TIME';
    };

    // Separate by debt type
    const normalDebts = useMemo(() => {
        return allDebts.filter(d => getDebtType(d) === 'ONE_TIME');
    }, [allDebts]);
    
    const installmentDebts = useMemo(() => allDebts.filter(d => getDebtType(d) === 'INSTALLMENT'), [allDebts]);

    // Calculate balances
    const streamBalance = useMemo(() => {
        if (!user) return new Map() as DetailedBalances;
        return calculateStreamBalance(transactions, user.uid);
    }, [transactions, user]);

    const normalDebtsBalance = useMemo(() => {
        if (!user) return new Map() as DetailedBalances;
        return calculateDebtsBalance(normalDebts, user.uid);
    }, [normalDebts, user]);

    const installmentBalance = useMemo(() => {
        if (!user) return new Map() as DetailedBalances;
        return calculateDebtsBalance(installmentDebts, user.uid);
    }, [installmentDebts, user]);

    const totalBalance = useMemo(() => {
        const merged1 = mergeBalances(streamBalance, normalDebtsBalance);
        return mergeBalances(merged1, installmentBalance);
    }, [streamBalance, normalDebtsBalance, installmentBalance]);

    // Ledger Filtering Logic
    const filteredTransactions = useMemo(() => {
        let result = [...transactions];

        // Date Filter
        if (ledgerDateFilter !== 'all' || ledgerCustomDateRange.start) {
            const now = new Date();
            let startDate: Date | null = null;

            if (ledgerCustomDateRange.start && ledgerCustomDateRange.end) {
                result = result.filter(t => {
                    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
                    return d >= ledgerCustomDateRange.start! && d <= ledgerCustomDateRange.end!;
                });
            } else {
                switch (ledgerDateFilter) {
                    case 'today':
                        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        break;
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                        break;
                    case 'quarter':
                        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                }
                if (startDate) {
                    result = result.filter(t => {
                        const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
                        return d >= startDate!;
                    });
                }
            }
        }

        return result;
    }, [transactions, ledgerDateFilter, ledgerCustomDateRange]);

    const handleLedgerDateChange = (filter: QuickFilterType, customStart?: Date, customEnd?: Date) => {
        setLedgerDateFilter(filter);
        if (customStart && customEnd) {
            setLedgerCustomDateRange({ start: customStart, end: customEnd });
        } else {
            setLedgerCustomDateRange({});
        }
    };

    // Carousel Scroll Sync using IntersectionObserver
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;

        const observer = new IntersectionObserver((entries) => {
            // When user IS scrolling manually, we want to update the tabMode
            if (isScrollingRef.current) return;

            // Find the entry that has the largest intersection ratio (most centered)
            const mostVisible = entries.reduce((prev, curr) => 
                (curr.intersectionRatio > prev.intersectionRatio) ? curr : prev
            );

            if (mostVisible.isIntersecting && mostVisible.intersectionRatio > 0.5) {
                const mode = mostVisible.target.getAttribute('data-mode') as TabMode;
                if (mode && mode !== tabModeRef.current) {
                    lastUpdateSourceRef.current = 'SCROLL';
                    setTabMode(mode);
                }
            }
        }, {
            root: el,
            threshold: [0, 0.25, 0.5, 0.75, 1.0],
            rootMargin: '0px -25% 0px -25%' // Focus on center 50% of the container
        });

        const cards = el.querySelectorAll('[data-mode]');
        cards.forEach(card => observer.observe(card));

        return () => observer.disconnect();
    }, []); // Stable observer

    // Scroll to active tab
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;

        // ONLY scrollTo if it's the first load OR if it was a CLICK change
        // Manual scrolls (SCROLL) already have the element in view.
        const shouldScroll = isFirstLoadRef.current || lastUpdateSourceRef.current === 'CLICK';
        lastUpdateSourceRef.current = null; // Reset for next change

        if (!shouldScroll) return;

        const modes: TabMode[] = ['TOTAL', 'LEDGER', 'INSTALLMENT'];
        const index = modes.indexOf(tabMode);
        if (index === -1) return;

        const cards = el.querySelectorAll('[data-mode]');
        const targetCard = cards[index] as HTMLElement;

        if (targetCard) {
            const targetScroll = targetCard.offsetLeft - (el.offsetWidth - targetCard.offsetWidth) / 2;
            
            isScrollingRef.current = true;
            el.scrollTo({ 
                left: targetScroll, 
                behavior: isFirstLoadRef.current ? 'auto' : 'smooth' 
            });
            
            const timer = setTimeout(() => { 
                isScrollingRef.current = false;
                isFirstLoadRef.current = false;
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [tabMode]);



    // Tab configuration
    const tabs: Tab[] = [
        { id: 'TOTAL', label: 'Özet' },
        { id: 'LEDGER', label: 'Borçlar' },
        { id: 'INSTALLMENT', label: 'Vadeli' }
    ];

    // Handlers
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

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                Yükleniyor...
            </div>
        );
    }

    return (
        <div className="bg-background min-h-[calc(100vh-64px)] pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft size={22} />
                </button>

                <Avatar 
                    name={personInfo.name} 
                    size="md" 
                    photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined} 
                />

                <div className="flex-1 min-w-0 text-center">
                    <h1 className="font-semibold text-text-primary truncate">{personInfo.name}</h1>
                    <p className="text-xs text-text-secondary">{formatPhoneForDisplay(personInfo.phone)}</p>
                </div>

                <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-text-secondary hover:bg-slate-100 rounded-full">
                        <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border z-20 overflow-hidden">
                                <button
                                    onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    {contactId ? <><Edit2 size={16} /> Düzenle</> : <><UserPlus size={16} /> Rehbere Ekle</>}
                                </button>
                                <div className="h-px bg-border"></div>
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

            <main className="p-0 space-y-0">
                {/* 1. Carousel Section */}
                <div 
                    ref={carouselRef}
                    className="flex gap-4 overflow-x-auto pb-8 pt-4 px-4 snap-x snap-mandatory scrollbar-hide bg-surface/50 border-b border-border"
                >
                    {/* Card 1: TOPLAM */}
                    {(() => {
                        const entries = Array.from(totalBalance.entries());
                        const totalNet = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.net, curr, rates) : 0), 0);
                        const totalRec = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.receivables, curr, rates) : 0), 0);
                        const totalPay = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.payables, curr, rates) : 0), 0);

                        return (
                            <SummaryCard
                                data-mode="TOTAL"
                                title="Toplam Net Varlık"
                                currency="TRY"
                                net={totalNet}
                                receivables={totalRec}
                                payables={totalPay}
                                variant="auto"
                                className="!w-[300px] sm:!w-[340px] cursor-pointer"
                                isActive={tabMode === 'TOTAL'}
                                largeText={true}
                                onClick={() => {
                                    lastUpdateSourceRef.current = 'CLICK';
                                    setTabMode('TOTAL');
                                }}
                            />
                        );
                    })()}

                    {/* Card 2: BORÇLAR (LEDGER) */}
                    {(() => {
                        const entries = Array.from(streamBalance.entries());
                        const totalNet = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.net, curr, rates) : 0), 0);
                        const totalRec = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.receivables, curr, rates) : 0), 0);
                        const totalPay = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.payables, curr, rates) : 0), 0);

                        return (
                            <SummaryCard
                                data-mode="LEDGER"
                                title="Borçlar (Cari)"
                                currency="TRY"
                                net={totalNet}
                                receivables={totalRec}
                                payables={totalPay}
                                variant="indigo"
                                className="!w-[300px] sm:!w-[340px] cursor-pointer"
                                isActive={tabMode === 'LEDGER'}
                                largeText={true}
                                onClick={() => {
                                    lastUpdateSourceRef.current = 'CLICK';
                                    setTabMode('LEDGER');
                                }}
                            />
                        );
                    })()}

                    {/* Card 3: VADELİ (INSTALLMENT) */}
                    {(() => {
                        const entries = Array.from(installmentBalance.entries());
                        const totalNet = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.net, curr, rates) : 0), 0);
                        const totalRec = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.receivables, curr, rates) : 0), 0);
                        const totalPay = entries.reduce((sum, [curr, b]) => sum + (rates ? convertToTRY(b.payables, curr, rates) : 0), 0);

                        return (
                            <SummaryCard
                                data-mode="INSTALLMENT"
                                title="Vadeli Borçlar"
                                currency="TRY"
                                net={totalNet}
                                receivables={totalRec}
                                payables={totalPay}
                                variant="rose"
                                className="!w-[300px] sm:!w-[340px] cursor-pointer"
                                isActive={tabMode === 'INSTALLMENT'}
                                largeText={true}
                                onClick={() => {
                                    lastUpdateSourceRef.current = 'CLICK';
                                    setTabMode('INSTALLMENT');
                                }}
                            />
                        );
                    })()}
                </div>

                {/* 2. Tab Navigation removed as per user request */}

                {/* 3. Tab Content */}
                <div className="p-4">
                    {tabMode === 'TOTAL' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                             <div className="grid gap-3">
                                {Array.from(totalBalance.entries()).sort((a,b) => a[0] === 'TRY' ? -1 : 1).map(([curr, bal]) => (
                                    <div key={curr} className="flex justify-between items-center p-4 bg-surface rounded-xl border border-border shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                {curr}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-text-primary">{curr}</p>
                                                <p className="text-xs text-text-secondary">{bal.net >= 0 ? 'Alacaklı' : 'Borçlu'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={clsx("font-bold text-lg", bal.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                {bal.net >= 0 ? '+' : ''}{bal.net.toLocaleString('tr-TR')} {curr}
                                            </p>
                                            {curr !== 'TRY' && rates && (
                                                <p className="text-xs text-text-secondary">
                                                    ≈ {convertToTRY(bal.net, curr, rates).toLocaleString('tr-TR')} TRY
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                    {tabMode === 'LEDGER' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                            {/* Filtreler */}
                            <div className="flex items-center justify-end gap-1.5 sm:gap-3">
                                <DateFilterDropdown onFilterChange={handleLedgerDateChange} />
                            </div>

                            <TransactionList ledgerId={ledgerId || ''} transactions={filteredTransactions} />
                        </div>
                    )}
                    {tabMode === 'INSTALLMENT' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <DebtsTab debts={installmentDebts} />
                        </div>
                    )}
                </div>
            </main>

            {/* Create Debt Modal */}
            <CreateDebtModal
                isOpen={showCreateDebtModal}
                onClose={() => setShowCreateDebtModal(false)}
            />

            {/* Edit Contact Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-surface rounded-2xl p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold mb-4">{contactId ? 'Kişiyi Düzenle' : 'Rehbere Ekle'}</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <input
                                type="text"
                                placeholder="Ad Soyad"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg"
                                required
                            />
                            <input
                                type="tel"
                                placeholder="Telefon"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg"
                                required
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingEdit}
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg"
                                >
                                    {submittingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
