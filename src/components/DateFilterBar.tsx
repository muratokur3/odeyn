import { useState } from 'react';
import { Calendar, Filter } from 'lucide-react';
import clsx from 'clsx';

export type QuickFilterType = 'all' | 'today' | 'week' | 'month' | 'quarter';

interface DateFilterBarProps {
    onFilterChange: (filter: QuickFilterType, customStart?: Date, customEnd?: Date) => void;
}

export const DateFilterBar = ({ onFilterChange }: DateFilterBarProps) => {
    const [activeFilter, setActiveFilter] = useState<QuickFilterType>('all');
    const [showDetailedFilter, setShowDetailedFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const quickFilters: { id: QuickFilterType; label: string }[] = [
        { id: 'all', label: 'Tümü' },
        { id: 'today', label: 'Bugün' },
        { id: 'week', label: 'Bu Hafta' },
        { id: 'month', label: 'Bu Ay' },
        { id: 'quarter', label: 'Son 3 Ay' }
    ];

    const handleQuickFilter = (filter: QuickFilterType) => {
        setActiveFilter(filter);
        setShowDetailedFilter(false);
        onFilterChange(filter);
    };

    const handleDetailedFilterApply = () => {
        if (startDate && endDate) {
            setActiveFilter('all'); // Custom range
            onFilterChange('all', new Date(startDate), new Date(endDate));
            setShowDetailedFilter(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Quick Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {quickFilters.map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => handleQuickFilter(filter.id)}
                        className={clsx(
                            "px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all duration-200",
                            "hover:scale-105 active:scale-95",
                            activeFilter === filter.id
                                ? "bg-primary text-white shadow-md"
                                : "bg-gray-100 dark:bg-gray-700 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600"
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
                
                {/* Detailed Filter Toggle */}
                <button
                    onClick={() => setShowDetailedFilter(!showDetailedFilter)}
                    className={clsx(
                        "px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap flex items-center gap-2",
                        "transition-all duration-200 hover:scale-105 active:scale-95",
                        showDetailedFilter
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "bg-gray-100 dark:bg-gray-700 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                >
                    <Filter size={16} />
                    Detaylı
                </button>
            </div>

            {/* Detailed Filter Panel */}
            {showDetailedFilter && (
                <div className="bg-surface border border-border rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                        <Calendar size={16} />
                        <span>Tarih Aralığı Seç</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Başlangıç</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Bitiş</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleDetailedFilterApply}
                        disabled={!startDate || !endDate}
                        className="w-full py-2 bg-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                    >
                        Uygula
                    </button>
                </div>
            )}
        </div>
    );
};
