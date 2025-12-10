import { useState, useMemo, useEffect } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useAuth } from '../hooks/useAuth';
import { useContacts } from '../hooks/useContacts';
import { useContactName } from '../hooks/useContactName';
import { ContactRow } from '../components/ContactRow';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, Bell, Sun, Moon, ArrowRight } from 'lucide-react';
import { createDebt } from '../services/db';
import { formatCurrency } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import clsx from 'clsx';
import type { Debt, Installment } from '../types';
import { EditDebtModal } from '../components/EditDebtModal';
import { updateDebt } from '../services/db';
import { cleanPhoneNumber } from '../utils/phone';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

// Types
type FilterType = 'ALL' | 'RECEIVABLES' | 'PAYABLES';
type TimeFilter = 'ALL' | 'THIS_WEEK' | 'THIS_MONTH';

interface ContactSummary {
    id: string; // The unique identifier for the contact (User ID or Phone Number)
    name: string;
    netBalance: number;
    currency: string;
    lastActivity: Date;
    lastActionSnippet: string;
    status: 'none' | 'system' | 'contact';
}

export const Dashboard = () => {
    const { debts, loading } = useDebts();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { notifications } = useNotifications();
    const { isContact } = useContacts();
    const { resolveName } = useContactName();
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

    // State
    const [filterType, setFilterType] = useState<FilterType>('ALL');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
    const [rates, setRates] = useState<CurrencyRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    const handleCreateDebt = async (
        borrowerId: string,
        borrowerName: string,
        amount: number,
        type: 'LENDING' | 'BORROWING',
        currency: string,
        note?: string,
        dueDate?: Date,
        installments?: Installment[],
        canBorrowerAddPayment?: boolean,
        requestApproval?: boolean
    ) => {
        if (!user) return;
        try {
            const targetId = borrowerId.length <= 15 ? cleanPhoneNumber(borrowerId) : borrowerId;
            await createDebt(
                user.uid,
                user.displayName || 'Bilinmeyen',
                targetId,
                borrowerName,
                amount,
                type,
                currency,
                note,
                dueDate,
                installments,
                canBorrowerAddPayment,
                requestApproval
            );
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    const handleUpdateDebt = async (debtId: string, data: Partial<Debt>) => {
        await updateDebt(debtId, data);
        setEditingDebt(null);
    };

    // Helper to determine contact status
    const getContactStatus = (id: string): 'none' | 'system' | 'contact' => {
        if (!user) return 'none';
        const isSystemUser = id.length > 20; // Basic check for UID vs Phone
        const isUserContact = isContact(id);
        if (isSystemUser) return 'system';
        if (isUserContact) return 'contact';
        return 'none';
    };

    // Calculations & Aggregation
    const useMemoResult = useMemo(() => {
        if (!user || !rates) return {
            incomingRequests: [],
            contactSummaries: [],
            availableCurrencies: [],
            grandTotal: { receivables: 0, payables: 0, net: 0, currency: 'TRY' }
        };

        const incoming: Debt[] = [];
        const contactMap = new Map<string, {
            name: string;
            balance: number;
            lastActivity: Date;
            lastSnippet: string;
        }>();

        let totalReceivables = 0;
        let totalPayables = 0;
        const currencies = new Set<string>();

        // 1. Process all debts
        debts.forEach(d => {
            const isCreator = d.createdBy === user.uid;

            // Collect currencies for scanner
            if (d.currency) currencies.add(d.currency);

            // Pending Requests Handling
            if (d.status === 'PENDING' && !isCreator) {
                // Respect currency filter for incoming as well? Usually incoming should always be visible.
                // Let's filter visually if needed, but 'incoming' list is usually separate. 
                // Let's keep incoming always visible or filter? User said "doviz filtreleme neden silindi".
                // Usually affects the main list. Let's Filter incoming too for consistency if strict.
                // But for now, let's keep incoming global, as they are alerts.
                incoming.push(d);
                return;
            }

            if (d.status === 'REJECTED') return;

            // GLOBAL CURRENCY FILTER CHECK
            // If selectedCurrency is not ALL, and debt currency doesn't match, skip it for aggregation
            if (selectedCurrency !== 'ALL' && (d.currency || 'TRY') !== selectedCurrency) {
                return;
            }

            const isActiveForBalance = d.status === 'ACTIVE' || d.status === 'PARTIALLY_PAID';

            // Identify Other Party
            // Identify Other Party
            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const fallbackName = isLender ? d.borrowerName : d.lenderName;

            // Resolve Name if new or check if we have a better one?
            // Since we group by ID, we only need to set the name once or keep the best one.
            // But for simplicity in this loop, let's resolve it if we haven't added it yet.

            let displayName = fallbackName;

            if (!contactMap.has(otherId)) {
                const resolution = resolveName(otherId, fallbackName);
                displayName = resolution.displayName;

                contactMap.set(otherId, {
                    name: displayName,
                    balance: 0,
                    lastActivity: new Date(0),
                    lastSnippet: ''
                });
            }

            const existing = contactMap.get(otherId)!;

            // Calculate Amount
            // If Single Currency selected, use raw amount. If ALL, use TRY.
            let amountToAdd = d.remainingAmount;
            if (selectedCurrency === 'ALL') {
                amountToAdd = convertToTRY(d.remainingAmount, d.currency || 'TRY', rates);
            }

            // Update Balance
            if (isActiveForBalance) {
                if (isLender) {
                    existing.balance += amountToAdd;
                    totalReceivables += amountToAdd;
                } else {
                    existing.balance -= amountToAdd;
                    totalPayables += amountToAdd;
                }
            }

            // Update Last Activity
            // We consider this debt for activity log even if it's pending (if I created it)
            const debtDate = d.createdAt?.toDate() || new Date(0);
            if (debtDate > existing.lastActivity) {
                existing.lastActivity = debtDate;
                const action = d.status === 'PAID' ? 'Ödendi' : (isLender ? 'Borç verdin' : 'Borç aldın');
                existing.lastSnippet = `${action} • ${formatDistanceToNow(debtDate, { addSuffix: true, locale: tr })}`;
            }

            contactMap.set(otherId, existing);
        });

        // 2. Convert Map to List
        let summaries: ContactSummary[] = Array.from(contactMap.entries()).map(([id, data]) => ({
            id,
            name: data.name,
            netBalance: data.balance,
            currency: selectedCurrency === 'ALL' ? 'TRY' : selectedCurrency,
            lastActivity: data.lastActivity,
            lastActionSnippet: data.lastSnippet,
            status: getContactStatus(id)
        }));

        // 3. Filters
        // Time Filter
        const now = new Date();
        if (timeFilter === 'THIS_WEEK') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            summaries = summaries.filter(c => c.lastActivity >= oneWeekAgo);
        } else if (timeFilter === 'THIS_MONTH') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            summaries = summaries.filter(c => c.lastActivity >= oneMonthAgo);
        }

        // Type Filter (Receivables / Payables)
        if (filterType === 'RECEIVABLES') {
            summaries = summaries.filter(c => c.netBalance > 0);
        } else if (filterType === 'PAYABLES') {
            summaries = summaries.filter(c => c.netBalance < 0);
        }

        // 4. Sorting: 
        // Rule: Active (Non-zero) first (sorted by date), Then Settled (Zero) last (sorted by date).
        summaries.sort((a, b) => {
            const aIsSettled = a.netBalance === 0;
            const bIsSettled = b.netBalance === 0;

            if (aIsSettled && !bIsSettled) return 1; // a is settled, put it after b
            if (!aIsSettled && bIsSettled) return -1; // b is settled, put a before b

            // Both have same settled status, sort by date desc
            return b.lastActivity.getTime() - a.lastActivity.getTime();
        });

        return {
            incomingRequests: incoming,
            contactSummaries: summaries,
            availableCurrencies: Array.from(currencies).sort(),
            grandTotal: {
                receivables: totalReceivables,
                payables: totalPayables,
                net: totalReceivables - totalPayables,
                currency: selectedCurrency === 'ALL' ? 'TRY' : selectedCurrency
            }
        };

    }, [debts, user, rates, filterType, timeFilter, selectedCurrency]);

    const { incomingRequests, contactSummaries, grandTotal, availableCurrencies } = useMemoResult;
    const { theme, toggleTheme } = useTheme();

    const isNetPositive = grandTotal.net >= 0;

    if (loading) return <div className="flex justify-center items-center h-screen text-lg text-text-primary">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-gray-50 dark:bg-slate-900 pb-28 transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 px-4 pt-4 pb-2 flex justify-between items-center shadow-sm z-50 sticky top-0">
                <div className="flex items-center gap-2">
                    {/* Brand Logo / Text */}
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
                    <button onClick={toggleTheme} className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full hover:bg-gray-200 transition-colors">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button onClick={() => setShowNotifications(true)} className="p-2.5 bg-gray-100 dark:bg-slate-700 rounded-full relative hover:bg-gray-200 transition-colors">
                        <Bell size={18} />
                        {notifications.length > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* HERO CARD - NET WORTH */}
            <div className="px-4 py-4 bg-white dark:bg-slate-800 pb-6 rounded-b-3xl shadow-sm mb-4">
                <div className={clsx(
                    "rounded-3xl p-6 shadow-xl text-white transition-all relative overflow-hidden",
                    isNetPositive
                        ? "bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-900/20"
                        : "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20"
                )}>
                    {/* Pattern */}
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet size={120} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2 opacity-90">
                            <div className="flex items-center gap-2">
                                <Wallet size={18} />
                                <span className="text-sm font-medium">Net Varlık ({selectedCurrency === 'ALL' ? 'Tahmini' : selectedCurrency})</span>
                            </div>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-bold backdrop-blur-sm">{grandTotal.currency}</span>
                        </div>

                        <div className="text-4xl font-bold tracking-tight mb-6 tabular-nums">
                            {formatCurrency(grandTotal.net, grandTotal.currency)}
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-white/10">
                            <div className="flex-1">
                                <p className="text-xs opacity-70 mb-1 font-medium">Toplam Alacak</p>
                                <p className="font-bold text-lg text-emerald-100 tabular-nums">
                                    +{formatCurrency(grandTotal.receivables, grandTotal.currency)}
                                </p>
                            </div>
                            <div className="w-px bg-white/10"></div>
                            <div className="flex-1">
                                <p className="text-xs opacity-70 mb-1 font-medium">Toplam Borç</p>
                                <p className="font-bold text-lg text-rose-100 tabular-nums">
                                    -{formatCurrency(grandTotal.payables, grandTotal.currency)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CURRENCY SELECTOR */}
                <div className="mt-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                        <button
                            onClick={() => setSelectedCurrency('ALL')}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                                selectedCurrency === 'ALL'
                                    ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-slate-900"
                                    : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300"
                            )}
                        >
                            Tümü (₺)
                        </button>
                        {availableCurrencies.map(currency => {
                            if (currency === 'TRY' && selectedCurrency === 'ALL') return null;
                            if (currency === 'TRY') {
                                // Optional: Decide how to show TRY option when filtering
                            }
                            return (
                                <button
                                    key={currency}
                                    onClick={() => setSelectedCurrency(currency)}
                                    className={clsx(
                                        "px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                                        selectedCurrency === currency
                                            ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-slate-900"
                                            : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300"
                                    )}
                                >
                                    {currency}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="px-4 space-y-4 mt-4">

                {/* Filters */}
                <div className="flex flex-col gap-3">
                    <div className="flex p-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={clsx(
                                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filterType === 'ALL'
                                    ? "bg-gray-100 text-gray-900 dark:bg-slate-700 dark:text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                            )}
                        >
                            Tümü
                        </button>
                        <button
                            onClick={() => setFilterType('RECEIVABLES')}
                            className={clsx(
                                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filterType === 'RECEIVABLES'
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                            )}
                        >
                            Alacaklar
                        </button>
                        <button
                            onClick={() => setFilterType('PAYABLES')}
                            className={clsx(
                                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filterType === 'PAYABLES'
                                    ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                            )}
                        >
                            Verecekler
                        </button>
                    </div>
                </div>

                {/* Incoming Requests Section (Separate from Contact List) */}
                {incomingRequests.length > 0 && (
                    <div className="mb-6 space-y-3 animate-in slide-in-from-top-4 fade-in">
                        {/* Incoming Requests Banner */}
                        {incomingRequests.length > 0 && (
                            <div
                                onClick={() => navigate('/pending-requests')}
                                className="mb-4 mx-1 p-3 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-500 text-white p-2 rounded-full shadow-sm">
                                        <Bell size={18} fill="currentColor" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                            {incomingRequests.length} Yeni Onay İsteği
                                        </span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                            İşlem yapmak için dokun
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight size={18} className="text-orange-400" />
                            </div>
                        )}
                    </div>
                )}

                {/* Contact List Title */}
                <div className="flex items-center justify-between px-1 pt-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kişiler</h2>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"
                    >
                        {showFilters ? 'Gizle' : 'Filtrele'}
                    </button>
                </div>

                {/* Advanced Filters Panel - Mostly Time */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 ml-1">Son İşlem Zamanı</label>
                            <select
                                value={timeFilter}
                                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                className="w-full bg-gray-50 dark:bg-slate-900 border-0 rounded-xl px-3 py-3 text-sm text-gray-800 dark:text-gray-200 ring-1 ring-gray-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">Tüm Zamanlar</option>
                                <option value="THIS_WEEK">Bu Hafta İşlem Yaptıklarım</option>
                                <option value="THIS_MONTH">Bu Ay İşlem Yaptıklarım</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* CONTACT SUMMARY LIST */}
                <div className="space-y-3 pb-20">
                    {contactSummaries.map((contact) => (
                        <ContactRow
                            key={contact.id}
                            name={contact.name}
                            netBalance={contact.netBalance}
                            currency={contact.currency}
                            lastActionSnippet={contact.lastActionSnippet}
                            onClick={() => navigate(`/person/${cleanPhoneNumber(contact.id)}`)}
                            status={contact.status}
                        />
                    ))}

                    {contactSummaries.length === 0 && incomingRequests.length === 0 && (
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

            {/* FIXED FAB VISUAL HACK: Pointer-events-none container to constrain width */}
            <div className="fixed bottom-0 left-0 right-0 w-full max-w-3xl mx-auto h-0 z-50 pointer-events-none">
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="absolute bottom-24 right-6 bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-transform active:scale-95 pointer-events-auto"
                >
                    <Plus size={28} strokeWidth={2.5} />
                </button>
            </div>

            {/* Modals */}
            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateDebt}
            />

            <NotificationsModal
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
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