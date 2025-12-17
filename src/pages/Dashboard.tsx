import { useState, useEffect } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useAuth } from '../hooks/useAuth';
import { useContacts } from '../hooks/useContacts';
import { useContactName } from '../hooks/useContactName';
import { ContactRow } from '../components/ContactRow';
import { NotificationsModal } from '../components/NotificationsModal';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { Wallet, Bell, Sun, Moon, ArrowRight } from 'lucide-react';

import { formatCurrency } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import { fetchRates, convertToTRY, type CurrencyRates } from '../services/currency';
import clsx from 'clsx';
import type { Debt } from '../types';
import { EditDebtModal } from '../components/EditDebtModal';
import { updateDebt } from '../services/db';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { useDashboardStats } from '../hooks/useDashboardStats';

// Types
type FilterType = 'ALL' | 'RECEIVABLES' | 'PAYABLES';
type TimeFilter = 'ALL' | 'THIS_WEEK' | 'THIS_MONTH';

export const Dashboard = () => {
    const { dashboardDebts, incomingRequests, loading } = useDebts();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [showFilters, setShowFilters] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { notifications } = useNotifications();
    const { isContact } = useContacts();
    const { resolveName } = useContactName();
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

    // State
    const [filterType, setFilterType] = useState<FilterType>('ALL');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
    const [rates, setRates] = useState<CurrencyRates | null>(null);

    useEffect(() => {
        fetchRates().then(setRates);
    }, []);

    const handleUpdateDebt = async (debtId: string, data: Partial<Debt>) => {
        await updateDebt(debtId, data);
        setEditingDebt(null);
    };

    const { contactSummaries, totalsByCurrency, grandTotalInTRY } = useDashboardStats(
        dashboardDebts,
        user,
        rates,
        filterType,
        timeFilter,
        isContact,
        resolveName
    );

    const { theme, toggleTheme } = useTheme();
    const [toggledCards, setToggledCards] = useState<Record<string, boolean>>({});

    const toggleCardCurrency = (currency: string) => {
        setToggledCards(prev => ({ ...prev, [currency]: !prev[currency] }));
    };

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

            {/* HERO CARDS - HORIZONTAL SCROLL */}
            <div className="mb-4 overflow-hidden">
                {/* Scroll Container */}
                <div className="flex gap-4 overflow-x-auto pb-6 px-4 snap-x snap-mandatory scrollbar-hide pt-4">

                    {/* 1. FIXED GRAND TOTAL CARD (Net Assets in TRY) */}
                    <div className="snap-center shrink-0 w-[85%] max-w-[340px]">
                        <div className={clsx(
                            "rounded-3xl p-6 shadow-xl text-white transition-all relative overflow-hidden h-full flex flex-col justify-between",
                            grandTotalInTRY.net >= 0
                                ? "bg-gradient-to-br from-indigo-600 to-purple-800 shadow-indigo-900/20"
                                : "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20"
                        )}>
                            {/* Pattern */}
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Wallet size={120} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4 opacity-90">
                                    <div className="flex items-center gap-2">
                                        <Wallet size={18} />
                                        <span className="text-sm font-medium">Toplam Varlık</span>
                                    </div>
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-bold backdrop-blur-sm">TRY</span>
                                </div>

                                <div className="text-4xl font-bold tracking-tight mb-8 tabular-nums">
                                    {formatCurrency(grandTotalInTRY.net, 'TRY')}
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-white/10">
                                    <div className="flex-1">
                                        <p className="text-xs opacity-70 mb-1 font-medium">Toplam Alacak</p>
                                        <p className="font-bold text-lg text-emerald-100 tabular-nums">
                                            +{formatCurrency(grandTotalInTRY.receivables, 'TRY')}
                                        </p>
                                    </div>
                                    <div className="w-px bg-white/10"></div>
                                    <div className="flex-1">
                                        <p className="text-xs opacity-70 mb-1 font-medium">Toplam Borç</p>
                                        <p className="font-bold text-lg text-rose-100 tabular-nums">
                                            -{formatCurrency(grandTotalInTRY.payables, 'TRY')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. DYNAMIC CURRENCY CARDS */}
                    {Object.values(totalsByCurrency)
                        .sort((a, b) => (a.currency === 'TRY' ? -1 : b.currency === 'TRY' ? 1 : 0))
                        .map((total) => {
                            const isNetPositive = total.net >= 0;
                            const isToggled = toggledCards[total.currency];
                            const displayCurrency = isToggled ? 'TRY' : total.currency;

                            // values to display
                            const net = (isToggled && rates) ? convertToTRY(total.net, total.currency, rates) : total.net;
                            const receivables = (isToggled && rates) ? convertToTRY(total.receivables, total.currency, rates) : total.receivables;
                            const payables = (isToggled && rates) ? convertToTRY(total.payables, total.currency, rates) : total.payables;

                            return (
                                <div key={total.currency} className="snap-center shrink-0 w-[85%] max-w-[340px]">
                                    <div className={clsx(
                                        "rounded-3xl p-6 shadow-xl text-white transition-all relative overflow-hidden h-full flex flex-col justify-between",
                                        isNetPositive
                                            ? "bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-900/20"
                                            : "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20"
                                    )}>
                                        {/* Pattern */}
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Wallet size={120} />
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-4 opacity-90">
                                                <div className="flex items-center gap-2">
                                                    <Wallet size={18} />
                                                    <span className="text-sm font-medium">Net Varlık ({total.currency})</span>
                                                </div>

                                                {total.currency !== 'TRY' && (
                                                    <button
                                                        onClick={() => toggleCardCurrency(total.currency)}
                                                        className="text-xs bg-white/20 px-2 py-1 rounded-md font-bold backdrop-blur-sm hover:bg-white/30 transition-colors active:scale-95"
                                                    >
                                                        {isToggled ? `Çevir: ${total.currency}` : 'TRY Göster'}
                                                    </button>
                                                )}
                                                {total.currency === 'TRY' && (
                                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-bold backdrop-blur-sm">{total.currency}</span>
                                                )}
                                            </div>

                                            <div className="text-4xl font-bold tracking-tight mb-8 tabular-nums transition-all duration-300">
                                                {formatCurrency(net, displayCurrency)}
                                            </div>

                                            <div className="flex gap-4 pt-4 border-t border-white/10">
                                                <div className="flex-1">
                                                    <p className="text-xs opacity-70 mb-1 font-medium">Toplam Alacak</p>
                                                    <p className="font-bold text-lg text-emerald-100 tabular-nums">
                                                        +{formatCurrency(receivables, displayCurrency)}
                                                    </p>
                                                </div>
                                                <div className="w-px bg-white/10"></div>
                                                <div className="flex-1">
                                                    <p className="text-xs opacity-70 mb-1 font-medium">Toplam Borç</p>
                                                    <p className="font-bold text-lg text-rose-100 tabular-nums">
                                                        -{formatCurrency(payables, displayCurrency)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    }
                    {/* Padding element for right-side peek if needed, but padding on container handles it usually */}
                    <div className="w-2 shrink-0"></div>
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
