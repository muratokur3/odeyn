import { useState, useMemo, useEffect } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useAuth } from '../hooks/useAuth';
import { useContacts } from '../hooks/useContacts';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { Toggle } from '../components/Toggle';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, ArrowUpRight, ArrowDownLeft, Wallet, Bell, Sun, Moon } from 'lucide-react';
import { createDebt } from '../services/db';
import { formatCurrency } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import clsx from 'clsx';
import type { Debt, Installment } from '../types';
import { SwipeableItem } from '../components/SwipeableItem';

import { EditDebtModal } from '../components/EditDebtModal';
import { softDeleteDebt, updateDebt } from '../services/db';
import { cleanPhoneNumber } from '../utils/phone';

type FilterType = 'ALL' | 'RECEIVABLES' | 'PAYABLES';
type SortType = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC';
type TimeFilter = 'ALL' | 'THIS_WEEK' | 'THIS_MONTH';

export const Dashboard = () => {
    const { debts, loading } = useDebts();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { notifications } = useNotifications();
    const { isContact } = useContacts();
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

    const handleSwipeDelete = async (debtId: string) => {
        if (confirm("Bu kaydı silmek istediğinize emin misiniz? Çöp kutusuna taşınacaktır.")) {
            await softDeleteDebt(debtId);
        }
    };

    const handleSwipeEdit = (debt: Debt) => {
        setEditingDebt(debt);
    };

    const handleUpdateDebt = async (debtId: string, data: Partial<Debt>) => {
        await updateDebt(debtId, data);
        setEditingDebt(null);
    };

    const getDebtUserStatus = (debt: Debt) => {
        if (!user) return 'none';
        const isLender = debt.lenderId === user.uid;
        const otherId = isLender ? debt.borrowerId : debt.lenderId;

        // Heuristic: UIDs are usually long (>20 chars), Phone numbers are shorter
        const isSystemUser = otherId.length > 20;
        const isUserContact = isContact(otherId);

        if (isSystemUser) return 'system'; // Green (Registered)
        if (isUserContact) return 'contact'; // Blue (Only Contact)
        return 'none';
    };

    const [filterType, setFilterType] = useState<FilterType>('ALL');
    const [sortType, setSortType] = useState<SortType>('DATE_DESC');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
    const [includePending, setIncludePending] = useState(false);
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
        canBorrowerAddPayment?: boolean
    ) => {
        if (!user) return;
        try {
            // Ensure we pass a clean phone number if it's not a UID
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
                canBorrowerAddPayment
            );
        } catch (error) {
            console.error(error);
            alert("Borç oluşturulurken bir hata oluştu.");
        }
    };

    // Calculations & Filtering
    const useMemoResult = useMemo(() => {
        if (!user) return { incomingRequests: [], filteredDebts: [], totalsByCurrency: {}, availableCurrencies: [], grandTotal: { receivables: 0, payables: 0 } };

        let processedDebts = [...debts];

        // 1. Filter by Type
        if (filterType === 'RECEIVABLES') {
            processedDebts = processedDebts.filter(d => d.lenderId === user.uid);
        } else if (filterType === 'PAYABLES') {
            processedDebts = processedDebts.filter(d => d.borrowerId === user.uid);
        }

        // 2. Filter by Time
        const now = new Date();
        if (timeFilter === 'THIS_WEEK') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            processedDebts = processedDebts.filter(d => d.createdAt?.toDate() >= oneWeekAgo);
        } else if (timeFilter === 'THIS_MONTH') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            processedDebts = processedDebts.filter(d => d.createdAt?.toDate() >= oneMonthAgo);
        }

        // 3. Sort
        processedDebts.sort((a, b) => {
            switch (sortType) {
                case 'DATE_DESC':
                    return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
                case 'DATE_ASC':
                    return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
                case 'AMOUNT_DESC':
                    return b.remainingAmount - a.remainingAmount;
                case 'AMOUNT_ASC':
                    return a.remainingAmount - b.remainingAmount;
                default:
                    return 0;
            }
        });

        // Totals & Incoming
        const incoming: Debt[] = [];
        const totals: Record<string, { receivables: number; payables: number }> = {};
        const currencies = new Set<string>();

        // Initialize TRY to ensure it always exists
        totals['TRY'] = { receivables: 0, payables: 0 };
        currencies.add('TRY');

        debts.forEach(d => {
            const isCreator = d.createdBy === user.uid;
            const isPending = d.status === 'PENDING';
            const isActive = d.status === 'ACTIVE' || d.status === 'PARTIALLY_PAID';

            // Incoming Requests: Pending AND NOT created by me
            if (isPending && !isCreator) {
                incoming.push(d);
            }

            // Totals Logic
            let shouldIncludeInTotals = false;
            if (isCreator) {
                if (d.status !== 'REJECTED' && d.status !== 'PAID') {
                    shouldIncludeInTotals = true;
                }
            } else {
                if (isActive) {
                    shouldIncludeInTotals = true;
                } else if (isPending && includePending) {
                    shouldIncludeInTotals = true;
                }
            }

            if (shouldIncludeInTotals) {
                const currency = d.currency || 'TRY';
                currencies.add(currency);
                if (!totals[currency]) totals[currency] = { receivables: 0, payables: 0 };

                if (d.lenderId === user.uid) {
                    totals[currency].receivables += d.remainingAmount;
                } else {
                    totals[currency].payables += d.remainingAmount;
                }
            }
        });

        // Main List Filtering
        const finalFilteredDebts = processedDebts.filter(d => {
            const isCreator = d.createdBy === user.uid;
            const isPending = d.status === 'PENDING';
            const isActive = d.status === 'ACTIVE' || d.status === 'PARTIALLY_PAID';

            // Exclude Incoming Requests from main list (they are in the separate box)
            if (isPending && !isCreator) return false;

            // Visibility Logic
            if (isCreator) {
                return true; // Always show my created debts
            } else {
                // Created by others
                if (isActive) return true;
                if (isPending && includePending) return true;
                return false;
            }
        });

        // Calculate Grand Total in TRY if 'ALL' is selected
        let grandTotalReceivables = 0;
        let grandTotalPayables = 0;

        if (selectedCurrency === 'ALL' && rates) {
            Object.entries(totals).forEach(([curr, amounts]) => {
                grandTotalReceivables += convertToTRY(amounts.receivables, curr, rates);
                grandTotalPayables += convertToTRY(amounts.payables, curr, rates);
            });
        }

        // Filter by Currency
        const currencyFilteredDebts = finalFilteredDebts.filter(d => {
            if (selectedCurrency === 'ALL') return true;
            return (d.currency || 'TRY') === selectedCurrency;
        });

        return {
            incomingRequests: incoming,
            filteredDebts: currencyFilteredDebts,
            totalsByCurrency: totals,
            availableCurrencies: Array.from(currencies).sort(),
            grandTotal: {
                receivables: grandTotalReceivables,
                payables: grandTotalPayables
            }
        };
    }, [debts, user, filterType, sortType, timeFilter, includePending, selectedCurrency, rates]);

    const { incomingRequests, filteredDebts, totalsByCurrency, availableCurrencies, grandTotal } = useMemoResult;

    const { theme, toggleTheme } = useTheme();



    if (loading) return <div className="flex justify-center items-center h-screen text-text-primary">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            {/* Header */}
            {/* Top Bar - Sticky */}
            <div className="sticky top-0 left-0 right-0 z-50 bg-surface shadow-sm h-[50px] transition-colors duration-200">
                <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="p-2 text-text-secondary hover:bg-background rounded-full relative transition-colors"
                        >
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                            )}
                        </button>
                        <h1 className="text-xl font-bold text-text-primary"></h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx(
                                "p-2 rounded-full transition-colors",
                                showFilters ? "bg-blue-500/10 text-primary" : "text-text-secondary hover:bg-background"
                            )}
                        >
                            <Filter size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Collapsible Summary & Filters */}
            {/* Summary & Filters - Sticky */}
            <div className="sticky top-[50px] left-0 right-0 z-40 bg-surface shadow-sm transition-transform duration-300 border-t border-border/50">
                <div className="max-w-2xl mx-auto px-4 py-2">
                    {/* Combined Stats & Filters */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Net / All */}
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={clsx(
                                "p-1.5 rounded-xl shadow-sm border text-center transition-all",
                                filterType === 'ALL'
                                    ? "bg-primary border-primary text-white ring-2 ring-primary/30"
                                    : "bg-surface border-border hover:border-primary/50"
                            )}
                        >
                            <div className={clsx("flex justify-center mb-0.5", filterType === 'ALL' ? "text-white/80" : "text-primary")}>
                                <Wallet size={18} />
                            </div>
                            <p className={clsx("text-[10px] mb-0.5", filterType === 'ALL' ? "text-white/80" : "text-text-secondary")}>Net Durum</p>
                            <p className={clsx("font-bold text-xs sm:text-sm", filterType === 'ALL' ? "text-white" : "text-text-primary")}>
                                {selectedCurrency === 'ALL' ? (
                                    formatCurrency((grandTotal?.receivables || 0) - (grandTotal?.payables || 0), 'TRY')
                                ) : (
                                    formatCurrency(
                                        (totalsByCurrency[selectedCurrency]?.receivables || 0) -
                                        (totalsByCurrency[selectedCurrency]?.payables || 0),
                                        selectedCurrency
                                    )
                                )}
                            </p>
                        </button>

                        {/* Receivables */}
                        <button
                            onClick={() => setFilterType('RECEIVABLES')}
                            className={clsx(
                                "p-1.5 rounded-xl shadow-sm border text-center transition-all",
                                filterType === 'RECEIVABLES'
                                    ? "bg-green-600 border-green-600 text-white ring-2 ring-green-200"
                                    : "bg-surface border-border hover:border-green-500/50"
                            )}
                        >
                            <div className={clsx("flex justify-center mb-0.5", filterType === 'RECEIVABLES' ? "text-green-200" : "text-green-500")}>
                                <ArrowUpRight size={18} />
                            </div>
                            <p className={clsx("text-[10px] mb-0.5", filterType === 'RECEIVABLES' ? "text-green-100" : "text-text-secondary")}>Alacaklar</p>
                            <p className={clsx("font-bold text-xs sm:text-sm", filterType === 'RECEIVABLES' ? "text-white" : "text-text-primary")}>
                                {selectedCurrency === 'ALL' ? (
                                    formatCurrency(grandTotal?.receivables || 0, 'TRY')
                                ) : (
                                    formatCurrency(totalsByCurrency[selectedCurrency]?.receivables || 0, selectedCurrency)
                                )}
                            </p>
                        </button>

                        {/* Payables */}
                        <button
                            onClick={() => setFilterType('PAYABLES')}
                            className={clsx(
                                "p-1.5 rounded-xl shadow-sm border text-center transition-all",
                                filterType === 'PAYABLES'
                                    ? "bg-red-600 border-red-600 text-white ring-2 ring-red-200"
                                    : "bg-surface border-border hover:border-red-500/50"
                            )}
                        >
                            <div className={clsx("flex justify-center mb-0.5", filterType === 'PAYABLES' ? "text-red-200" : "text-red-500")}>
                                <ArrowDownLeft size={18} />
                            </div>
                            <p className={clsx("text-[10px] mb-0.5", filterType === 'PAYABLES' ? "text-red-100" : "text-text-secondary")}>Verecekler</p>
                            <p className={clsx("font-bold text-xs sm:text-sm", filterType === 'PAYABLES' ? "text-white" : "text-text-primary")}>
                                {selectedCurrency === 'ALL' ? (
                                    formatCurrency(grandTotal?.payables || 0, 'TRY')
                                ) : (
                                    formatCurrency(totalsByCurrency[selectedCurrency]?.payables || 0, selectedCurrency)
                                )}
                            </p>
                        </button>
                    </div>
                    {/* Currency Filter Pills */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 mt-2">
                        <button
                            onClick={() => setSelectedCurrency('ALL')}
                            className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border",
                                selectedCurrency === 'ALL'
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-surface text-text-secondary border-border hover:border-text-secondary/50"
                            )}
                        >
                            Tümü
                        </button>
                        {availableCurrencies.map(currency => (
                            <button
                                key={currency}
                                onClick={() => setSelectedCurrency(currency)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border",
                                    selectedCurrency === currency
                                        ? "bg-slate-800 text-white border-slate-800"
                                        : "bg-surface text-text-secondary border-border hover:border-text-secondary/50"
                                )}
                            >
                                {currency}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-2xl mx-auto p-2 space-y-6">

                {/* Filters & Tabs */}
                <div className="space-y-3">
                    {/* Sub Filters (Collapsible) */}
                    {showFilters && (
                        <div className="bg-surface p-4 rounded-xl shadow-lg border border-slate-700/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center text-text-secondary mb-2">
                                <span className="text-sm font-medium">Filtreleme Seçenekleri</span>
                                <button onClick={() => setShowFilters(false)} className="text-xs hover:text-text-primary">Kapat</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                                    className="bg-background border border-slate-700 text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-primary"
                                >
                                    <option value="ALL">Tüm Zamanlar</option>
                                    <option value="THIS_WEEK">Bu Hafta</option>
                                    <option value="THIS_MONTH">Bu Ay</option>
                                </select>

                                <select
                                    value={sortType}
                                    onChange={(e) => setSortType(e.target.value as SortType)}
                                    className="bg-background border border-slate-700 text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-primary"
                                >
                                    <option value="DATE_DESC">Tarih (Yeni-Eski)</option>
                                    <option value="DATE_ASC">Tarih (Eski-Yeni)</option>
                                    <option value="AMOUNT_DESC">Tutar (Çok-Az)</option>
                                    <option value="AMOUNT_ASC">Tutar (Az-Çok)</option>
                                </select>
                            </div>
                            <div className="pt-2 border-t border-slate-700/50">
                                <Toggle
                                    checked={includePending}
                                    onChange={setIncludePending}
                                    label="Bekleyenleri Göster"
                                />
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className="space-y-4">
                        {/* Incoming Requests Section */}
                        {includePending && incomingRequests.length > 0 && (
                            <div className="mb-6">
                                <h2 className="text-sm font-semibold text-gray-700 mb-3 px-1 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Onay Bekleyenler ({incomingRequests.length})
                                </h2>
                                <div className="space-y-3">
                                    {incomingRequests.map((debt) => (
                                        <DebtCard
                                            key={debt.id}
                                            debt={debt}
                                            currentUserId={user?.uid || ''}
                                            onClick={() => navigate(`/debt/${debt.id}`)}
                                            otherPartyStatus={getDebtUserStatus(debt)}
                                        />
                                    ))}
                                </div>
                                <div className="my-4 border-b border-gray-200"></div>
                            </div>
                        )}

                        {filteredDebts.map((debt) => (
                            <SwipeableItem
                                key={debt.id}
                                onSwipeLeft={() => handleSwipeDelete(debt.id)}
                                onSwipeRight={() => handleSwipeEdit(debt)}
                                className="mb-3"
                            >
                                <DebtCard
                                    debt={debt}
                                    currentUserId={user?.uid || ''}
                                    onClick={() => navigate(`/debt/${debt.id}`)}
                                    otherPartyStatus={getDebtUserStatus(debt)}
                                />
                            </SwipeableItem>
                        ))}

                        {filteredDebts.length === 0 && incomingRequests.length === 0 && (
                            <div className="text-center py-10 text-gray-500">
                                <Filter size={32} className="mx-auto mb-2 opacity-20" />
                                <p>Kayıt bulunamadı.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-24 right-4 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-blue-600 active:scale-90 transition-all z-20"
            >
                <Plus size={24} />
            </button>

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
