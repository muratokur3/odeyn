import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useContacts } from '../hooks/useContacts';
import { useAuth } from '../hooks/useAuth';
import { useContactName } from '../hooks/useContactName';
import { ContactRow } from '../components/ContactRow';
import { useNotificationContext } from '../context/NotificationContext';
import { useUserIdentifiers } from '../hooks/useUserIdentifiers';
import { useNavigate } from 'react-router-dom';
import { Wallet, Bell, Sun, Moon, CalendarClock } from 'lucide-react';
import { PendingPaymentsModal } from '../components/PendingPaymentsModal';


import { useTheme } from '../context/ThemeContext';
import { fetchRates, convertToTRY, convertPureMetalToTRY, type CurrencyRates } from '../services/currency';
import type { Debt } from '../types';
import { SummaryCard } from '../components/SummaryCard';
import { EditDebtModal } from '../components/EditDebtModal';
import { getGoldType, calculatePureMetalWeight } from '../utils/goldConstants';
import { updateDebt, addPayment, claimLegacyDebts } from '../services/db';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FeedbackWidget } from '../components/FeedbackWidget';
import { PaymentModal } from '../components/PaymentModal';

// Types
interface ContactSummary {
    id: string; // The unique identifier for the contact (User ID or Phone Number)
    name: string;
    netBalance: number;
    currency: string;
    lastActivity: Date;
    lastActionSnippet: string;
    status: 'none' | 'system' | 'contact';
    photoURL?: string; // Added support for avatar
    linkedUserId?: string;
    hasUnreadActivity?: boolean; // New Field
}

export const Dashboard = () => {
    const { dashboardDebts, loading } = useDebts();
    const { user } = useAuth();
    const { identifiers, isMe } = useUserIdentifiers();

    const navigate = useNavigate();

    // Carousel & Filter State
    const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | string>('ALL');
    const carouselRef = useRef<HTMLDivElement>(null);
    const lastUpdateSourceRef = useRef<'SCROLL' | 'CLICK' | null>(null);
    const isFirstLoadRef = useRef(true);
    const selectedCurrencyRef = useRef(selectedCurrency);

    useEffect(() => {
        selectedCurrencyRef.current = selectedCurrency;
    }, [selectedCurrency]);

    const { unreadCount, setShowModal } = useNotificationContext();
    const { contactsMap } = useContacts(); // Get contacts map
    const { resolveName } = useContactName();
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
    const [quickPayDebt, setQuickPayDebt] = useState<Debt | null>(null);
    const [showUpcomingPayments, setShowUpcomingPayments] = useState(false);

    // State
    const [rates, setRates] = useState<CurrencyRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // GHOST USER PROTOCOL: Background Claiming & Normalization
    useEffect(() => {
        const phone = user?.phoneNumber;
        if (user?.uid && phone) {
            // 1. Claim Legacy Debts (Multi-format)
            // Note: Firestore real-time listeners will automatically update when debts are claimed
            claimLegacyDebts(user.uid, phone as string)
                .then(count => {
                    if (count > 0) {
                        console.log(`[GhostUser] ${count} legacy debts claimed and will appear automatically.`);
                    }
                })
                .catch(err => console.error("Ghost User background claim failed:", err));

            // 2. Normalize Address Book (One-time background fix)
            import('../services/db').then(m => m.normalizeAllUserContacts(user.uid as string));
        }
    }, [user?.uid, user?.phoneNumber]);






    const handleUpdateDebt = async (debtId: string, data: Partial<Debt>) => {
        await updateDebt(debtId, data);
        setEditingDebt(null);
    };

    // Removed getContactStatus in favor of resolveName source


    // Calculations & Aggregation
    const useMemoResult = useMemo(() => {
        if (!user || !rates || identifiers.length === 0) return {
            contactSummaries: [],
            availableCurrencies: [],
            totalsByCurrency: {} as Record<string, {
                receivables: number,
                payables: number,
                net: number,
                currency: string,
                pureGoldReceivables: number,
                pureGoldPayables: number,
                pureGoldNet: number
            }>,
            grandTotalInTRY: { receivables: 0, payables: 0, net: 0, currency: 'TRY' }
        };

        const contactMap = new Map<string, {
            name: string;
            source: 'contact' | 'user' | 'phone';
            status: 'contact' | 'system' | 'none'; // Add status
            balances: Map<string, number>; // Net balances per currency
            lastActivity: Date;
            lastSnippet: string;
            linkedUserId?: string;
            hasUnreadActivity?: boolean;
        }>();

        const totalsByCurrency: Record<string, {
            receivables: number,
            payables: number,
            net: number,
            currency: string,
            pureGoldReceivables: number,
            pureGoldPayables: number,
            pureGoldNet: number
        }> = {};
        const currencies = new Set<string>();
        const grandTotalInTRY = { receivables: 0, payables: 0, net: 0, currency: 'TRY' };

        // 1. Process Dashboard Debts
        if (identifiers.length === 0) {
            return {
                contactSummaries: [],
                availableCurrencies: [],
                totalsByCurrency: {},
                grandTotalInTRY: { receivables: 0, payables: 0, net: 0, currency: 'TRY' }
            };
        }

        dashboardDebts.forEach(d => {
            let currency = d.currency || 'TRY';
            if (currency === 'GOLD' && d.goldDetail?.type) {
                currency = `GOLD:${d.goldDetail.type}`;
            }
            currencies.add(currency);

            if (!totalsByCurrency[currency]) {
                totalsByCurrency[currency] = {
                    receivables: 0, payables: 0, net: 0, currency,
                    pureGoldReceivables: 0, pureGoldPayables: 0, pureGoldNet: 0
                };
            }

            const isLender = isMe(d.lenderId);
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const fallbackName = isLender ? d.borrowerName : d.lenderName;

            // STRICT ASYMMETRIC RULES FOR TOTALS:

            // 1. Should we count this debt?
            let shouldCountReceivable = false;
            let shouldCountPayable = false;

            // RECEIVABLES (I am Lender): Include ACTIVE, PENDING, REJECTED_BY_RECEIVER, AUTO_HIDDEN
            if (isLender) {
                if (d.status === 'ACTIVE' || d.status === 'PENDING' || d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') {
                    shouldCountReceivable = true;
                }
            }
            // PAYABLES (I am Borrower): Include ACTIVE, PENDING. 
            // EXPLICITLY EXCLUDE: REJECTED_BY_RECEIVER, AUTO_HIDDEN
            else {
                if (d.status === 'ACTIVE' || d.status === 'PENDING') {
                    shouldCountPayable = true;
                }
            }

            // Global Totals
            if (shouldCountReceivable || shouldCountPayable) {
                const amount = d.remainingAmount;
                const isGold = d.currency === 'GOLD';
                const baseCurr = isGold ? 'GOLD' : d.currency;
                const goldDetail = d.goldDetail;
                const pureWeight = (isGold && goldDetail)
                    ? calculatePureMetalWeight(goldDetail.type, amount, goldDetail.weightPerUnit)
                    : 0;

                const customRates = d.customExchangeRate ? { [baseCurr]: d.customExchangeRate } : undefined;
                const tryVal = convertToTRY(amount, baseCurr, rates!, customRates, goldDetail);

                if (shouldCountReceivable) {
                    totalsByCurrency[currency].receivables += amount;
                    totalsByCurrency[currency].net += amount;
                    totalsByCurrency[currency].pureGoldReceivables += pureWeight;
                    totalsByCurrency[currency].pureGoldNet += pureWeight;

                    grandTotalInTRY.receivables += tryVal;
                    grandTotalInTRY.net += tryVal;
                } else if (shouldCountPayable) {
                    totalsByCurrency[currency].payables += amount;
                    totalsByCurrency[currency].net -= amount;
                    totalsByCurrency[currency].pureGoldPayables += pureWeight;
                    totalsByCurrency[currency].pureGoldNet -= pureWeight;

                    grandTotalInTRY.payables += tryVal;
                    grandTotalInTRY.net -= tryVal;
                }
            }

            // Contact Summaries (Same logic for individual balances)
            // Note: If I rejected it, it shouldn't show up in my balance with that person either.
            if (shouldCountReceivable || shouldCountPayable) {
                // Initialize contact map if needed (code below)
            } else {
                return; // Skip this debt completely if it doesn't count for me
            }
            // Resolve name if possible
            const resolution = resolveName(otherId, fallbackName, d.lockedPhoneNumber);
            let displayName = resolution.displayName;

            // ULTIMATE FALLBACK: If resolveName returns a phone number (display name equals formatted identifier)
            // or if it's "Bilinmeyen" but we have a fallbackName snapshot, use the snapshot.
            const isPhoneFormat = displayName.replace(/\s/g, '').replace(/\+/g, '').length >= 10 && !isNaN(Number(displayName.replace(/\s/g, '').replace(/\+/g, '')));
            if ((isPhoneFormat || displayName === 'Bilinmeyen') && fallbackName && fallbackName !== otherId) {
                displayName = fallbackName;
            }

            // UNIFY CONTACTS: Build a canonical ID trying every possible identifier.
            // Priority: contact's linkedUserId > resolved linkedUserId from name > otherId
            // Also check if a phone-keyed entry already exists for the same person to avoid duplicates.
            let unifiedContactId = resolution.linkedUserId || otherId;

            // Secondary dedup: if we used phone as key but there's already a bucket under the linkedUserId, merge.
            if (!contactMap.has(unifiedContactId) && resolution.linkedUserId && contactMap.has(resolution.linkedUserId)) {
                unifiedContactId = resolution.linkedUserId;
            }
            // And reverse: if the otherId is a UID and a phone-bucket exists for the same person,
            // try to find that phone-bucket and point to the phone bucket's contact instead.
            if (!contactMap.has(unifiedContactId)) {
                // Look for any existing bucket whose linkedUserId matches the current resolution
                if (resolution.linkedUserId) {
                    for (const [existingKey, existingEntry] of contactMap.entries()) {
                        if (existingEntry.linkedUserId === resolution.linkedUserId) {
                            unifiedContactId = existingKey; // merge into existing bucket
                            break;
                        }
                    }
                }
            }

            // Initialize contact entry if it doesn't exist
            if (!contactMap.has(unifiedContactId)) {
                // Check in contactsMap for Activity Feed Metadata
                const contactMeta = contactsMap.get(unifiedContactId) || contactsMap.get(otherId);

                let snippet = '';
                let activityDate = new Date(0);
                let unread = false;

                if (contactMeta) {
                    if (contactMeta.lastActivityMessage) snippet = contactMeta.lastActivityMessage;
                    if (contactMeta.lastActivityAt) activityDate = contactMeta.lastActivityAt.toDate();
                    if (contactMeta.hasUnreadActivity) unread = contactMeta.hasUnreadActivity;
                }

                contactMap.set(unifiedContactId, {
                    name: displayName,
                    source: resolution.source,
                    status: resolution.status,
                    balances: new Map<string, number>(),
                    lastActivity: activityDate,
                    lastSnippet: snippet,
                    linkedUserId: resolution.linkedUserId,
                    hasUnreadActivity: unread
                });
            } else {
                // Upgrade existing entry if we found a better source
                const existing = contactMap.get(unifiedContactId)!;
                if (existing.source !== 'contact' && resolution.source === 'contact') {
                    existing.name = resolution.displayName;
                    existing.source = 'contact';
                    existing.status = 'contact';
                    existing.linkedUserId = resolution.linkedUserId || existing.linkedUserId;
                }
            }

            const contact = contactMap.get(unifiedContactId)!;
            const debtDate = d.createdAt.toDate();

            // Fallback Activity Calculation (if no metadata or newer debt exists found)
            // If the debt is newer than the stored activity (from contact metadata or previous iteration), update date.
            // But we prefer the Metadata Message if available and newer?
            // Actually, metadata IS the source of truth for the "Feed".
            // But if metadata is missing (legacy), we fall back to debt date/snippet.

            // Logic: If lastSnippet is empty (no metadata), use debt snippet.
            // If debtDate > contact.lastActivity, update date?
            // If we have metadata, lastActivity should be accurate.

            if (!contact.lastSnippet || debtDate > contact.lastActivity) {
                // Only override if we don't have a metadata-based snippet, or if this debt is surprisingly newer (shouldn't happen if syncing works)
                // Actually, let's presume metadata is king for "Feed". 
                // But for "Last activity date" sorting, we want the REAL latest date.

                if (debtDate > contact.lastActivity) {
                    contact.lastActivity = debtDate;
                }

                // Only generate snippet if we don't have one from metadata
                if (!contact.lastSnippet) {
                    const action = d.status === 'PAID' ? 'Ödendi' : (isLender ? 'Borç verdin' : 'Borç aldın');
                    contact.lastSnippet = `${action} • ${formatDistanceToNow(debtDate, { addSuffix: true, locale: tr })}`;
                }
            }

            // Update Contact Balance per currency
            const effectiveBalance = isLender ? d.remainingAmount : -d.remainingAmount;
            const currentBalance = contact.balances.get(currency) || 0;
            contact.balances.set(currency, currentBalance + effectiveBalance);
        });

        // 2. Convert Map to List & Filter
        const mapEntries = Array.from(contactMap.entries());
        const summaries = mapEntries.map(([id, data]) => {
            let displayBalance = 0;
            let displayCurrency = 'TRY';

            if (selectedCurrency === 'ALL') {
                // Calculate total converted to TRY
                data.balances.forEach((amt, curr) => {
                    // Extract base currency and sub-type for gold
                    const isGold = curr.startsWith('GOLD:');
                    const baseCurr = isGold ? 'GOLD' : curr;
                    const goldType = isGold ? curr.split(':')[1] : undefined;
                    const goldDetail = goldType ? { type: goldType } : undefined;

                    displayBalance += convertToTRY(amt, baseCurr, rates!, undefined, goldDetail);
                });
                displayCurrency = 'TRY';
            } else {
                // Show specific currency balance
                displayBalance = data.balances.get(selectedCurrency) || 0;
                displayCurrency = selectedCurrency;
            }

            return {
                id,
                name: data.name,
                netBalance: displayBalance,
                currency: displayCurrency,
                lastActivity: data.lastActivity,
                lastActionSnippet: data.lastSnippet, // lastActionSnippet is what ContactRow expects
                status: data.status,
                linkedUserId: data.linkedUserId,
                hasUnreadActivity: data.hasUnreadActivity
            } as ContactSummary;
        }).filter(c => Math.abs(c.netBalance) > 0.01);

        // 3. Sorting
        summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

        // 5. Grand Total in TRY is already calculated during process

        return {
            contactSummaries: summaries,
            availableCurrencies: Array.from(currencies).sort(),
            totalsByCurrency,
            grandTotalInTRY
        };

    }, [dashboardDebts, user, rates, resolveName, contactsMap, selectedCurrency, identifiers.length, isMe]);

    // Stable now for render phase (React Purity)
    const [renderNow] = useState(() => Date.now());

    const { upcomingToPay, upcomingToReceive, totalUpcomingCount } = useMemo(() => {
        if (!user) return { upcomingToPay: [] as Debt[], upcomingToReceive: [] as Debt[], totalUpcomingCount: 0 };

        const next14Days = renderNow + (14 * 24 * 60 * 60 * 1000);

        const filterUpcoming = (d: Debt) => {
            if (d.status !== 'ACTIVE') return false;

            // 1. Check direct due date
            if (d.dueDate && d.dueDate.toMillis() <= next14Days) return true;

            // 2. Check installments
            if (d.installments && d.installments.length > 0) {
                return d.installments.some(inst => !inst.isPaid && inst.dueDate.toMillis() <= next14Days);
            }

            return false;
        };

        const toPay = dashboardDebts.filter((d: Debt) => d.borrowerId === user.uid && filterUpcoming(d))
            .sort((a: Debt, b: Debt) => {
                const aTime = a.dueDate?.toMillis() || 0;
                const bTime = b.dueDate?.toMillis() || 0;
                return aTime - bTime;
            });

        const toReceive = dashboardDebts.filter((d: Debt) => d.lenderId === user.uid && filterUpcoming(d))
            .sort((a: Debt, b: Debt) => {
                const aTime = a.dueDate?.toMillis() || 0;
                const bTime = b.dueDate?.toMillis() || 0;
                return aTime - bTime;
            });

        return {
            upcomingToPay: toPay,
            upcomingToReceive: toReceive,
            totalUpcomingCount: toPay.length + toReceive.length
        };
    }, [dashboardDebts, user, renderNow]);

    const { contactSummaries, totalsByCurrency, grandTotalInTRY } = useMemoResult;
    const { theme, toggleTheme } = useTheme();

    const [toggledCards, setToggledCards] = useState<Record<string, boolean>>({});

    const toggleCardCurrency = (currency: string) => {
        setToggledCards(prev => ({ ...prev, [currency]: !prev[currency] }));
    };

    // ===========================================================================
    // CAROUSEL SCROLL SYNC
    // ===========================================================================
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;

        let scrollTimer: ReturnType<typeof setTimeout> | null = null;

        const detectActiveCard = () => {
            const containerCenter = el.scrollLeft + el.offsetWidth / 2;
            const cards = el.querySelectorAll('[data-currency]');
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
                const currency = (closestCard as HTMLElement).getAttribute('data-currency');
                if (currency && currency !== selectedCurrencyRef.current) {
                    lastUpdateSourceRef.current = 'SCROLL';
                    setSelectedCurrency(currency);
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
    }, [loading]);

    const cardCount = useMemoResult.availableCurrencies.length + 1;

    // Auto-scroll to selected card
    useEffect(() => {
        const el = carouselRef.current;
        if (!el || lastUpdateSourceRef.current === 'SCROLL') {
            lastUpdateSourceRef.current = null;
            return;
        }

        const cards = el.querySelectorAll('[data-currency]');
        const cardArray = Array.from(cards);
        const targetIndex = cardArray.findIndex(c => c.getAttribute('data-currency') === selectedCurrency);

        if (targetIndex !== -1) {
            const targetCard = cardArray[targetIndex] as HTMLElement;
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
    }, [selectedCurrency, cardCount]);

    // Stable click handler for ContactRow to prevent re-renders
    const handleContactClick = useCallback((id: string, contactData: { name: string, linkedUserId?: string }) => {
        navigate(`/person/${id}`, {
            state: {
                name: contactData.name,
                id: contactData.linkedUserId || id
            }
        });
    }, [navigate]);

    if (loading) return <div className="flex justify-center items-center h-screen text-lg text-text-primary">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-gray-50 dark:bg-slate-900 pb-28 transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 px-4 pt-4 pb-2 flex justify-between items-center shadow-sm z-50 sticky top-0">
                <div className="flex items-center gap-2">
                    {/* Brand Logo / Text */}
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 dark:bg-blue-500 rounded-lg p-1.5 shadow-sm">
                            <Wallet className="text-white" size={20} strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                            Pamuk<span className="text-blue-600 dark:text-blue-400">Eller</span>
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full hover:bg-gray-200 transition-colors"
                        aria-label={theme === 'dark' ? "Aydınlık moda geç" : "Karanlık moda geç"}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={() => setShowUpcomingPayments(true)}
                        className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full relative hover:bg-gray-200 transition-colors"
                        aria-label="Yaklaşan Ödemeler"
                    >
                        <CalendarClock size={18} />
                        {totalUpcomingCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 px-1">
                                {totalUpcomingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full relative hover:bg-gray-200 transition-colors"
                        aria-label="Bildirimler"
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 px-1">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <FeedbackWidget />

            {quickPayDebt && (
                <PaymentModal
                    isOpen={!!quickPayDebt}
                    onClose={() => setQuickPayDebt(null)}
                    onSubmit={async (amount, note) => {
                        if (quickPayDebt && user) {
                            await addPayment(quickPayDebt.id, amount, note, user.uid as string);
                        }
                    }}
                    maxAmount={quickPayDebt.remainingAmount}
                    currency={quickPayDebt.currency}
                    goldDetail={quickPayDebt.goldDetail}
                />
            )}

            {/* Main Content */}
            <main className="px-4 py-6 max-w-5xl mx-auto">

                {/* 2. Top Totals - Carousel style from PersonStream */}
                <div
                    ref={carouselRef}
                    className="flex gap-4 overflow-x-auto pb-8 pt-4 px-4 snap-x snap-mandatory scrollbar-hide bg-surface/50 border-b border-border mb-6"
                    style={{ scrollPadding: '0 2rem', touchAction: 'pan-x' }}
                >
                    {/* Left Spacer for centering first card */}
                    <div className="shrink-0 w-[8vw] sm:w-[15vw]" />

                    {/* 1. FIXED GRAND TOTAL CARD (Net Assets in TRY) */}
                    <SummaryCard
                        data-currency="ALL"
                        title="Toplam Varlık"
                        currency="TRY"
                        net={grandTotalInTRY.net}
                        receivables={grandTotalInTRY.receivables}
                        payables={grandTotalInTRY.payables}
                        variant="auto"
                        className="!w-[300px] sm:!w-[340px] cursor-pointer"
                        isActive={selectedCurrency === 'ALL'}
                        largeText={true}
                        onClick={() => {
                            lastUpdateSourceRef.current = 'CLICK';
                            setSelectedCurrency('ALL');
                        }}
                    />

                    {/* 2. DYNAMIC CURRENCY CARDS */}
                    {Object.values(totalsByCurrency)
                        .sort((a, b) => (a.currency === 'TRY' ? -1 : b.currency === 'TRY' ? 1 : 0))
                        .map((total) => {
                            const isNetPositive = total.net >= 0;
                            const isToggled = toggledCards[total.currency];

                            const isGold = total.currency.startsWith('GOLD:');
                            const baseCurr = isGold ? 'GOLD' : total.currency;
                            const goldType = isGold ? total.currency.split(':')[1] : undefined;
                            const goldTypeData = goldType ? getGoldType(goldType) : undefined;

                            const net = (isToggled && rates)
                                ? (isGold ? convertPureMetalToTRY(total.pureGoldNet, rates, 'GOLD') : convertToTRY(total.net, baseCurr, rates))
                                : total.net;
                            const receivables = (isToggled && rates)
                                ? (isGold ? convertPureMetalToTRY(total.pureGoldReceivables, rates, 'GOLD') : convertToTRY(total.receivables, baseCurr, rates))
                                : total.receivables;
                            const payables = (isToggled && rates)
                                ? (isGold ? convertPureMetalToTRY(total.pureGoldPayables, rates, 'GOLD') : convertToTRY(total.payables, baseCurr, rates))
                                : total.payables;

                            return (
                                <SummaryCard
                                    key={total.currency}
                                    data-currency={total.currency}
                                    title={isGold ? `Altın (${goldTypeData?.label || goldType})` : `Net Varlık (${total.currency})`}
                                    currency={total.currency}
                                    net={net}
                                    receivables={receivables}
                                    payables={payables}
                                    isToggled={isToggled}
                                    onToggle={() => toggleCardCurrency(total.currency)}
                                    showToggle={total.currency !== 'TRY'}
                                    variant={isNetPositive ? 'emerald' : 'rose'}
                                    className="!w-[300px] sm:!w-[340px] cursor-pointer"
                                    isActive={selectedCurrency === total.currency}
                                    largeText={true}
                                    onClick={() => {
                                        lastUpdateSourceRef.current = 'CLICK';
                                        setSelectedCurrency(total.currency);
                                    }}
                                />
                            );
                        })
                    }
                    {/* Right Spacer for centering last card */}
                    <div className="shrink-0 w-[8vw] sm:w-[15vw]" />
                </div>

                {/* CONTACT SUMMARY LIST */}
                <div className="space-y-3 pb-20">
                    {contactSummaries.map((contact) => (
                        <ContactRow
                            key={contact.id}
                            id={contact.id}
                            name={contact.name}
                            netBalance={contact.netBalance}
                            currency={contact.currency}
                            lastActionSnippet={contact.lastActionSnippet}
                            onClick={handleContactClick}
                            status={contact.status}
                            photoURL={undefined}
                            linkedUserId={contact.linkedUserId}
                            hasUnreadActivity={contact.hasUnreadActivity}
                        />
                    ))}

                    {contactSummaries.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-60">
                            <div className="bg-gray-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                                <Wallet size={40} className="text-gray-400 dark:text-gray-500" />
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">Bu görünümde kişi yok.</p>
                            <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Yeni bir işlem ekleyerek başlayabilirsin.</p>
                        </div>
                    )}
                </div>
            </main>

            <PendingPaymentsModal
                isOpen={showUpcomingPayments}
                onClose={() => setShowUpcomingPayments(false)}
                toPay={upcomingToPay}
                toReceive={upcomingToReceive}
            />

            {editingDebt && (
                <EditDebtModal
                    isOpen={!!editingDebt}
                    onClose={() => setEditingDebt(null)}
                    debt={editingDebt}
                    onUpdate={handleUpdateDebt}
                />
            )}
        </div >
    );
};
