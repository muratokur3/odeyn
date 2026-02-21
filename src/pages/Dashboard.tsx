import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useContacts } from '../hooks/useContacts';
import { useAuth } from '../hooks/useAuth';
import { useContactName } from '../hooks/useContactName';
import { ContactRow } from '../components/ContactRow';
import { NotificationsModal } from '../components/NotificationsModal';
import { NotificationToast, type ToastNotification } from '../components/NotificationToast';
import { useNotifications } from '../hooks/useNotifications';
import { useUserIdentifiers } from '../hooks/useUserIdentifiers';
import { useNavigate } from 'react-router-dom';
import { Wallet, Bell, Sun, Moon, CalendarClock } from 'lucide-react';
import { PendingPaymentsModal } from '../components/PendingPaymentsModal';


import { useTheme } from '../context/ThemeContext';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import type { Debt } from '../types';
import { SummaryCard } from '../components/SummaryCard';
import { EditDebtModal } from '../components/EditDebtModal';
import { updateDebt, addPayment, claimLegacyDebts } from '../services/db';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FeedbackWidget } from '../components/FeedbackWidget';
import { PaymentModal } from '../components/PaymentModal';

// Types
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

    const [showNotifications, setShowNotifications] = useState(false);
    const { notifications, markAsRead, deleteNotification, clearAllNotifications } = useNotifications();
    const { contactsMap } = useContacts(); // Get contacts map
    const { resolveName } = useContactName();
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
    const [quickPayDebt, setQuickPayDebt] = useState<Debt | null>(null);
    const [toast, setToast] = useState<ToastNotification | null>(null);
    const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
    const [showUpcomingPayments, setShowUpcomingPayments] = useState(false);

    // State
    const [rates, setRates] = useState<CurrencyRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    // GHOST USER PROTOCOL: Background Claiming & Normalization
    useEffect(() => {
        const phone = user?.primaryPhoneNumber || user?.phoneNumber;
        if (user?.uid && phone) {
            // 1. Claim Legacy Debts (Multi-format)
            // Note: Firestore real-time listeners will automatically update when debts are claimed
            claimLegacyDebts(user.uid, phone)
                .then(count => {
                    if (count > 0) {
                        console.log(`[GhostUser] ${count} legacy debts claimed and will appear automatically.`);
                    }
                })
                .catch(err => console.error("Ghost User background claim failed:", err));

            // 2. Normalize Address Book (One-time background fix)
            import('../services/db').then(m => m.normalizeAllUserContacts(user.uid));
        }
    }, [user?.uid, user?.primaryPhoneNumber, user?.phoneNumber]);

    // Toast notification for any new unread notifications
    useEffect(() => {
        if (notifications.length === 0) return;

        const newestNotif = notifications[0];

        // Show toast for any new unread notification (regardless of type)
        if (
            !newestNotif.read &&
            newestNotif.id !== lastNotificationId
        ) {
            setLastNotificationId(newestNotif.id);

            const titles: Record<string, string> = {
                'DEBT_CREATED': 'Yeni Borç Kaydı',
                'PAYMENT_MADE': 'Ödeme Alındı',
                'DEBT_REJECTED': 'İşlem Reddedildi',
                'DEBT_EDITED': 'Kayıt Güncellendi',
                'DUE_SOON': 'Ödeme Hatırlatması',
                'INSTALLMENT_DUE': 'Taksit Hatırlatması'
            };

            setToast({
                id: newestNotif.id,
                title: titles[newestNotif.type] || 'Bildirim',
                message: newestNotif.message,
                type: 'info',
                duration: 5000
            });
        }
    }, [notifications, lastNotificationId]);





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
            totalsByCurrency: {} as Record<string, { receivables: number, payables: number, net: number, currency: string }>,
            grandTotalInTRY: { receivables: 0, payables: 0, net: 0, currency: 'TRY' }
        };

        const contactMap = new Map<string, {
            name: string;
            source: 'contact' | 'user' | 'phone';
            status: 'contact' | 'system' | 'none'; // Add status
            balance: number; // Net balance in base currency (TRY)
            lastActivity: Date;
            lastSnippet: string;
            linkedUserId?: string;
            hasUnreadActivity?: boolean;
        }>();

        const totalsByCurrency: Record<string, { receivables: number, payables: number, net: number, currency: string }> = {};
        const currencies = new Set<string>();

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
            const currency = d.currency || 'TRY';
            currencies.add(currency);

            if (!totalsByCurrency[currency]) {
                totalsByCurrency[currency] = { receivables: 0, payables: 0, net: 0, currency };
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
                // Determine direction based on role
                if (isLender && shouldCountReceivable) {
                    totalsByCurrency[currency].receivables += d.remainingAmount;
                    totalsByCurrency[currency].net += d.remainingAmount;
                } else if (!isLender && shouldCountPayable) {
                    totalsByCurrency[currency].payables += d.remainingAmount;
                    totalsByCurrency[currency].net -= d.remainingAmount;
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

            // Initialize contact entry if it doesn't exist
            if (!contactMap.has(otherId)) {
                // Check in contactsMap for Activity Feed Metadata
                const contactMeta = contactsMap.get(otherId) || contactsMap.get(resolution.linkedUserId || '');
                // Note: contactsMap is keyed by ID? No, useContacts implementation maps by ID.
                // Assuming contactsMap is Map<string, Contact>.
                // We prioritize metadata from Contact object.

                let snippet = '';
                let activityDate = new Date(0);
                let unread = false;

                if (contactMeta) {
                    if (contactMeta.lastActivityMessage) snippet = contactMeta.lastActivityMessage;
                    if (contactMeta.lastActivityAt) activityDate = contactMeta.lastActivityAt.toDate();
                    if (contactMeta.hasUnreadActivity) unread = contactMeta.hasUnreadActivity;
                }

                contactMap.set(otherId, {
                    name: displayName,
                    source: resolution.source, // Store the source
                    status: resolution.status, // Store the status
                    balance: 0,
                    lastActivity: activityDate,
                    lastSnippet: snippet,
                    linkedUserId: resolution.linkedUserId,
                    hasUnreadActivity: unread
                });
            } else {
                // If we already have an entry, but current resolution is 'contact' and stored is NOT 'contact',
                // we should upgrade the name/source because we found a better match (e.g. via lockedPhoneNumber hint)
                const existing = contactMap.get(otherId)!;
                if (existing.source !== 'contact' && resolution.source === 'contact') {
                    existing.name = resolution.displayName;
                    existing.source = 'contact';
                    existing.status = 'contact'; // Upgrade status
                    existing.linkedUserId = resolution.linkedUserId || existing.linkedUserId;
                }
            }

            const contact = contactMap.get(otherId)!;
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

            // Update Contact Balance (Always converted to TRY for unified list)
            // Rates is guaranteed not null here due to top check
            const amountInTRY = convertToTRY(d.remainingAmount, currency, rates!);
            if (isLender && shouldCountReceivable) {
                contact.balance += amountInTRY;
            } else if (!isLender && shouldCountPayable) {
                contact.balance -= amountInTRY;
            }
        });

        // 2. Convert Map to List & Filter
        const mapEntries = Array.from(contactMap.entries());
        const summaries = mapEntries.map(([id, data]) => {
            return {
                id,
                name: data.name,
                netBalance: data.balance,
                currency: 'TRY', // Contact list is unified in TRY
                lastActivity: data.lastActivity,
                lastActionSnippet: data.lastSnippet,
                status: data.status, // Use status from stored data
                // photoURL: undefined 
                linkedUserId: data.linkedUserId,
                hasUnreadActivity: data.hasUnreadActivity
            } as ContactSummary;
        }).filter(c => Math.abs(c.netBalance) > 0.01);

        // 3. Sorting
        summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

        // 5. Calculate Grand Total in TRY
        const grandTotalInTRY = { receivables: 0, payables: 0, net: 0, currency: 'TRY' };
        Object.values(totalsByCurrency).forEach(t => {
            // Rates guaranteed not null
            grandTotalInTRY.receivables += convertToTRY(t.receivables, t.currency, rates!);
            grandTotalInTRY.payables += convertToTRY(t.payables, t.currency, rates!);
            grandTotalInTRY.net += convertToTRY(t.net, t.currency, rates!);
        });

        return {
            contactSummaries: summaries,
            availableCurrencies: Array.from(currencies).sort(),
            totalsByCurrency,
            grandTotalInTRY
        };

    }, [dashboardDebts, user, rates, resolveName, contactsMap]);

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
                        onClick={() => setShowNotifications(true)}
                        className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full relative hover:bg-gray-200 transition-colors"
                        aria-label="Bildirimler"
                    >
                        <Bell size={18} />
                        {notifications.some(n => !n.read) && (
                            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 px-1">
                                {notifications.filter(n => !n.read).length}
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
                            await addPayment(quickPayDebt.id, amount, note, user.uid);
                        }
                    }}
                    maxAmount={quickPayDebt.remainingAmount}
                    currency={quickPayDebt.currency}
                />
            )}

            {/* Main Content */}
            <main className="px-4 py-6 max-w-5xl mx-auto">

                {/* 2. Top Totals */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-4 scrollbar-hide">
                    {/* HERO CARDS - HORIZONTAL SCROLL */}
                    {/* Scroll Container */}
                    <div className="flex gap-4 overflow-x-auto pb-6 px-4 snap-x snap-mandatory scrollbar-hide pt-4">

                        {/* 1. FIXED GRAND TOTAL CARD (Net Assets in TRY) */}
                        <SummaryCard
                            title="Toplam Varlık"
                            currency="TRY"
                            net={grandTotalInTRY.net}
                            receivables={grandTotalInTRY.receivables}
                            payables={grandTotalInTRY.payables}
                            variant="auto"
                        />

                        {/* 2. DYNAMIC CURRENCY CARDS */}
                        {Object.values(totalsByCurrency)
                            .sort((a, b) => (a.currency === 'TRY' ? -1 : b.currency === 'TRY' ? 1 : 0))
                            .map((total) => {
                                const isNetPositive = total.net >= 0;
                                const isToggled = toggledCards[total.currency];

                                const net = (isToggled && rates) ? convertToTRY(total.net, total.currency, rates) : total.net;
                                const receivables = (isToggled && rates) ? convertToTRY(total.receivables, total.currency, rates) : total.receivables;
                                const payables = (isToggled && rates) ? convertToTRY(total.payables, total.currency, rates) : total.payables;

                                return (
                                    <SummaryCard
                                        key={total.currency}
                                        title={`Net Varlık (${total.currency})`}
                                        currency={total.currency}
                                        net={net}
                                        receivables={receivables}
                                        payables={payables}
                                        isToggled={isToggled}
                                        onToggle={() => toggleCardCurrency(total.currency)}
                                        showToggle={total.currency !== 'TRY'}
                                        variant={isNetPositive ? 'emerald' : 'rose'}
                                    />
                                );
                            })
                        }
                        {/* Padding element for right-side peek if needed, but padding on container handles it usually */}
                        <div className="w-2 shrink-0"></div>
                    </div>
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

            <NotificationToast
                notification={toast}
                onClose={() => setToast(null)}
            />

            <NotificationsModal
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClearAll={clearAllNotifications}
            />

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