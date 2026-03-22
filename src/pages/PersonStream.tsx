/**
 * PersonStream - Modern Person Profile Page
 * Clean, tab-based UI with BalanceCard + Debts/Ledger/History tabs
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePersonDebts } from '../hooks/usePersonDebts';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { useLedger } from '../hooks/useLedger';
import { ArrowLeft, MoreVertical, Edit2, UserPlus, Ban, Trash2, Phone, MessageCircle } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import clsx from 'clsx';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionList } from '../components/TransactionList';
import { formatCurrency } from '../utils/format';
import { getGoldType } from '../utils/goldConstants';
import { calculateStreamBalance, calculateDebtsBalance, mergeBalances, type DetailedBalances } from '../utils/balanceAggregator';
import { fetchRates, fetchTurkishGoldRates, type CurrencyRates, type TurkishGoldRates } from '../services/currency';
import { DebtsTab } from '../components/DebtsTab';
import { DateFilterDropdown, type QuickFilterType } from '../components/DateFilterDropdown';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { ContactModal } from '../components/ContactModal';
import { useModal } from '../hooks/useModal';
import { getContacts, markContactAsRead, deleteContact, deletePersonHistory } from '../services/db';
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

    // Block Self View
    useEffect(() => {
        if (user && id) {
            const target = cleanPhone(id);
            const me = cleanPhone(user.phoneNumber || '');
            if ((target && me && target === me) || id === user.uid) {
                navigate('/', { replace: true });
            }
        }
    }, [user, id, navigate]);

    // State
    const [tabMode, setTabMode] = useState<TabMode>(() => {
        // ⚠️ DEFAULT: 'TOTAL' — başlangıçta toplam görünür
        return (localStorage.getItem(`tabMode_${id}`) as TabMode) || 'TOTAL';
    });
    const carouselRef = useRef<HTMLDivElement>(null);
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showProfilePanel, setShowProfilePanel] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
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
                            const blocked = await isUserBlocked(user.uid, contact.linkedUserId);
                            setIsBlocked(blocked);
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

    // Custom hooks for data
    const { allDebts: rawDebts } = useDebts();
    const { allDebts } = usePersonDebts(id || '', resolvedUid);

    const personInfo = useMemo(() => {
        let name = '';
        const cleanId = cleanPhone(id || '');
        let phone = id && id.length > 20 ? '' : cleanId;

        // 1. Try to find the latest name from ANY debt related to this person (including LEDGER)
        const latestDebtWithPossibleName = [...rawDebts]
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
            .find(d => {
                const isMatch = d.lenderId === id || d.borrowerId === id ||
                    cleanPhone(d.lenderId) === cleanId ||
                    cleanPhone(d.borrowerId) === cleanId ||
                    (resolvedUid && (d.lenderId === resolvedUid || d.borrowerId === resolvedUid));
                return isMatch;
            });

        if (latestDebtWithPossibleName) {
            const isLender = latestDebtWithPossibleName.lenderId === user?.uid ||
                cleanPhone(latestDebtWithPossibleName.lenderId) === cleanPhone(user?.phoneNumber || '');
            name = isLender ? latestDebtWithPossibleName.borrowerName : latestDebtWithPossibleName.lenderName;
        }

        // 2. If we have a targetUserObject (contact), its saved name might be better
        if (targetUserObject) {
            if ('displayName' in targetUserObject) name = targetUserObject.displayName || name;
            else if ('name' in targetUserObject) name = targetUserObject.name || name;
            phone = targetUserObject.phoneNumber || phone;
        }

        const resolution = resolveName(id || '', name, phone);
        let displayName = resolution.displayName;
        const status = resolution.status;

        // --- 3. DASHBOARD-CONSISTENT ULTIMATE FALLBACK ---
        const isPhoneFormat = displayName.replace(/\s/g, '').replace(/\+/g, '').length >= 10 && !isNaN(Number(displayName.replace(/\s/g, '').replace(/\+/g, '')));

        if ((isPhoneFormat || displayName === 'Bilinmeyen') && name && name !== id && name !== 'Bilinmeyen') {
            displayName = name;
        }

        return { name: displayName, phone, status };
    }, [id, targetUserObject, resolveName, rawDebts, user, resolvedUid]);

    // useLedger for LEDGER tab
    const {
        transactions,
        ledgerId,
        loadMore,
        hasMore,
        loadingMore
    } = useLedger(
        user?.uid,
        user?.displayName,
        resolvedUid || id || undefined,
        personInfo.name
    );

    const [rates, setRates] = useState<CurrencyRates | null>(null);
    const [turkishGold, setTurkishGold] = useState<TurkishGoldRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
        fetchTurkishGoldRates().then(setTurkishGold);
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
        return calculateStreamBalance(transactions, user.uid, rates, turkishGold);
    }, [transactions, user, rates, turkishGold]);

    const normalDebtsBalance = useMemo(() => {
        if (!user) return new Map() as DetailedBalances;
        return calculateDebtsBalance(normalDebts, user.uid, rates, turkishGold);
    }, [normalDebts, user, rates, turkishGold]);

    const installmentBalance = useMemo(() => {
        if (!user) return new Map() as DetailedBalances;
        return calculateDebtsBalance(installmentDebts, user.uid, rates, turkishGold);
    }, [installmentDebts, user, rates, turkishGold]);

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

    // ===========================================================================
    // ⚠️  KRİTİK: CAROUSEL SCROLL SYNC — DOKUNMA!
    // ===========================================================================
    // Kaydırmayla sekme değişme mantığı: carousel div'indeki 'scroll' eventini dinle.
    //   - Kaydırma durduktan 100ms sonra merkeze en yakın kartı geometrik hesapla.
    //   - isScrollingRef KULLANILMAZ: React cleanup clearTimeout'u iptal edebilir
    //     ve ref sonsuza kadar true kalır → swipe hiç çalışmaz.
    //   - Döngü koruması: mode !== tabModeRef.current zaten saptırıyor.
    //   - IntersectionObserver KULLANILMAZ (entries[] yanlış/eksik olabilir).
    //   - window.scroll KULLANILMAZ (yatay kaydırmayı da tetikler).
    // 🚫 BU BLOĞU DEĞİŞTİRME!
    // ===========================================================================
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;

        let scrollTimer: ReturnType<typeof setTimeout> | null = null;

        const detectActiveCard = () => {
            const containerCenter = el.scrollLeft + el.offsetWidth / 2;
            const cards = el.querySelectorAll('[data-mode]');
            let closestCard: Element | null = null;
            let closestDist = Infinity;

            cards.forEach(card => {
                const cardEl = card as HTMLElement;
                const cardCenter = cardEl.offsetLeft + cardEl.offsetWidth / 2;
                const dist = Math.abs(cardCenter - containerCenter);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestCard = card;
                }
            });

            if (closestCard) {
                const mode = (closestCard as HTMLElement).getAttribute('data-mode') as TabMode;
                if (mode && mode !== tabModeRef.current) {
                    lastUpdateSourceRef.current = 'SCROLL';
                    setTabMode(mode);
                }
            }
        };

        const handleScroll = () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(detectActiveCard, 150);
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
            if (scrollTimer) clearTimeout(scrollTimer);
        };
    }, [id]);

    // Kartlar render edildikten sonra scrollTo işlemini tetikle
    const cardCount = 3; // TOTAL, LEDGER, INSTALLMENT

    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;
        const modes: TabMode[] = ['TOTAL', 'LEDGER', 'INSTALLMENT'];
        const index = modes.indexOf(tabMode);
        if (index === -1) return;
        const cards = el.querySelectorAll('[data-mode]');
        const targetCard = cards[index] as HTMLElement;
        if (targetCard) {
            let targetScroll = targetCard.offsetLeft - (el.offsetWidth - targetCard.offsetWidth) / 2;
            const maxScroll = el.scrollWidth - el.offsetWidth;
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll > 0 ? maxScroll : 0));
            const isFirst = isFirstLoadRef.current;
            isFirstLoadRef.current = false;
            el.scrollTo({
                left: targetScroll,
                behavior: isFirst ? 'auto' : 'smooth'
            });
        }
        lastUpdateSourceRef.current = null;
    }, [tabMode, cardCount]);


    // Tab configuration


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



    const handleDeleteContact = async () => {
        if (!user || !contactId) return;
        if (await showConfirm("Sil", "Kişiyi rehberden silmek istediğinize emin misiniz?")) {
            await deleteContact(user.uid, contactId);
            navigate(-1);
        }
    };

    const handleDeleteHistory = async () => {
        if (!user) return;
        if (await showConfirm("Tüm Geçmişi Sil", "Bu kişiyle olan tüm geçmişiniz (borçlar, kayıtlar) silinecektir. Eğer kişiyi siz eklediyseniz rehberden de silinir. Bu işlem geri alınamaz.", "error")) {
            const cleanP = id ? cleanPhone(id) : null;
            await deletePersonHistory(user.uid, resolvedUid, cleanP, contactId || undefined);
            navigate('/');
        }
    };

    const handleOpenEdit = () => {
        setEditName(personInfo.name || '');
        setEditPhone(personInfo.phone || '');
        setShowEditModal(true);
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
            <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 relative">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft size={22} />
                </button>

                <div
                    onClick={() => setShowProfilePanel(!showProfilePanel)}
                    className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <Avatar
                        name={personInfo.name}
                        size="md"
                        photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined}
                        status={personInfo.status as 'none' | 'system' | 'contact'}
                    />

                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-text-primary truncate">{personInfo.name}</h1>
                        <p className="text-[10px] text-text-secondary leading-none mt-0.5">{formatPhoneForDisplay(personInfo.phone)}</p>
                    </div>
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
                                    onClick={() => { handleOpenEdit(); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-text-primary hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    {contactId ? <><Edit2 size={16} /> Düzenle</> : <><UserPlus size={16} /> Rehbere Ekle</>}
                                </button>
                                {resolvedUid && (
                                    <>
                                        <div className="h-px bg-border"></div>
                                        <button
                                            onClick={() => { handleBlockToggle(); setShowMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                                        >
                                            <Ban size={16} /> {isBlocked ? 'Engeli Kaldır' : 'Engelle'}
                                        </button>
                                    </>
                                )}
                                {contactId && (
                                    <button
                                        onClick={() => { handleDeleteContact(); setShowMenu(false); }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Rehberden Sil
                                    </button>
                                )}
                                <button
                                    onClick={() => { handleDeleteHistory(); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Tüm Geçmişi Sil
                                </button>
                            </div>
                        </>
                    )}
                </div>

            </header>


            {/* Profile panel - fixed overlay below header */}
            {showProfilePanel && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[29] bg-black/20"
                        onClick={() => setShowProfilePanel(false)}
                    />
                    {/* Panel */}
                    <div className="fixed top-[60px] left-0 right-0 z-[30] max-w-3xl mx-auto bg-surface border-b border-border shadow-2xl animate-in slide-in-from-top-2 duration-200">
                        <div className="p-5 flex flex-col items-center text-center space-y-4">
                            <Avatar
                                name={personInfo.name}
                                photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined}
                                size="xl"
                                status={personInfo.status as 'none' | 'system' | 'contact'}
                            />
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">{personInfo.name}</h2>
                                {personInfo.phone && (
                                    <p className="text-sm text-text-secondary mt-1">{formatPhoneForDisplay(personInfo.phone)}</p>
                                )}
                            </div>
                            <div className="flex justify-center gap-4 w-full pt-1">
                                <a
                                    href={`tel:+${cleanPhone(personInfo.phone || '')}`}
                                    onClick={() => setShowProfilePanel(false)}
                                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-1"
                                >
                                    <Phone size={24} className="text-blue-600" />
                                    <span className="text-xs font-semibold text-text-secondary">Ara</span>
                                </a>
                                <a
                                    href={`https://wa.me/${cleanPhone(personInfo.phone || '').replace(/^\+/, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setShowProfilePanel(false)}
                                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-1"
                                >
                                    <MessageCircle size={24} className="text-green-500" />
                                    <span className="text-xs font-semibold text-text-secondary">WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isBlocked && (
                <div className="m-4 bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-800/50 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-800/50 flex items-center justify-center mb-3">
                        <Ban size={24} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-lg font-bold text-orange-800 dark:text-orange-300 mb-2">Kullanıcı Engellendi</h3>
                    <p className="text-sm text-orange-700 dark:text-orange-400 mb-5 leading-relaxed">
                        Bu kişiyle olan tüm finansal verileriniz ve borç/alacak hesaplarınız şu an tamamen gizlenmektedir. 
                        Hesapları tekrar aktifleştirmek için engeli kaldırın.
                    </p>
                    <button 
                        onClick={handleBlockToggle}
                        className="bg-orange-600 text-white px-8 py-2.5 rounded-xl font-semibold hover:bg-orange-700 transition-colors shadow-sm"
                    >
                        Engeli Kaldır
                    </button>
                </div>
            )}

            <main className="p-0 space-y-0">

                {/* 1. Carousel Section */}
                <div
                    ref={carouselRef}
                    className="flex gap-4 overflow-x-auto pb-8 pt-4 px-4 snap-x snap-mandatory scrollbar-hide bg-surface/50 border-b border-border"
                    style={{ scrollPadding: '0 2rem', touchAction: 'pan-x' }}
                >
                    {/* Left Spacer for centering first card */}
                    <div className="shrink-0 w-[8vw] sm:w-[15vw]" />

                    {/* Card 1: TOPLAM */}
                    {(() => {
                        const entries = Array.from(totalBalance.entries());
                        const totalNet = entries.reduce((sum, [, b]) => sum + b.netTRY, 0);
                        const totalRec = entries.reduce((sum, [, b]) => sum + b.receivablesTRY, 0);
                        const totalPay = entries.reduce((sum, [, b]) => sum + b.payablesTRY, 0);

                        return (
                            <SummaryCard
                                data-mode="TOTAL"
                                title="Genel Durum"
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
                        const totalNet = entries.reduce((sum, [, b]) => sum + b.netTRY, 0);
                        const totalRec = entries.reduce((sum, [, b]) => sum + b.receivablesTRY, 0);
                        const totalPay = entries.reduce((sum, [, b]) => sum + b.payablesTRY, 0);

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
                        const totalNet = entries.reduce((sum, [, b]) => sum + b.netTRY, 0);
                        const totalRec = entries.reduce((sum, [, b]) => sum + b.receivablesTRY, 0);
                        const totalPay = entries.reduce((sum, [, b]) => sum + b.payablesTRY, 0);

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

                    {/* Right Spacer for centering last card */}
                    <div className="shrink-0 w-[8vw] sm:w-[15vw]" />
                </div>

                {/* 2. Tab Navigation removed as per user request */}

                {/* 3. Tab Content */}
                <div className="p-4">
                    {tabMode === 'TOTAL' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="grid gap-3">
                                {Array.from(totalBalance.entries()).sort((a) => a[0] === 'TRY' ? -1 : 1).map(([curr, bal]) => {
                                    const isGold = curr.startsWith('GOLD:');
                                    const goldType = isGold ? curr.split(':')[1] : undefined;
                                    const goldTypeData = goldType ? getGoldType(goldType) : undefined;
                                    const displayLabel = isGold ? (goldTypeData?.label || goldType) : curr;

                                    return (
                                        <div key={curr} className="flex justify-between items-center p-4 bg-surface rounded-xl border border-border shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                                                    {displayLabel}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-text-primary">{displayLabel}</p>
                                                    <p className="text-xs text-text-secondary">{bal.net >= 0 ? 'Alacaklı' : 'Borçlu'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={clsx("font-bold text-lg", bal.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                    {bal.net >= 0 ? '+' : ''}{formatCurrency(bal.net, curr)}
                                                </p>
                                                {curr !== 'TRY' && rates && (
                                                    <p className="text-xs text-text-secondary">
                                                        ≈ {bal.netTRY.toLocaleString('tr-TR')} TRY
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {tabMode === 'LEDGER' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                            {/* Filtreler */}
                            <div className="flex items-center justify-end gap-1.5 sm:gap-3">
                                <DateFilterDropdown onFilterChange={handleLedgerDateChange} />
                            </div>

                            <TransactionList
                                ledgerId={ledgerId || ''}
                                transactions={filteredTransactions}
                                onLoadMore={loadMore}
                                hasMore={hasMore}
                                loadingMore={loadingMore}
                            />
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
                targetUser={targetUserObject}
                initialName={personInfo.name}
                initialPhoneNumber={personInfo.phone}
            />

            <ContactModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                contactToEdit={targetUserObject && !('uid' in targetUserObject) ? (targetUserObject as Contact) : null}
                initialName={editName}
                initialPhone={editPhone}
                onSuccess={() => {
                    window.location.reload();
                }}
                checkDuplicates={!contactId} // Only check duplicates if creating new (though here we mostly edit)
            />
        </div>
    );
};
