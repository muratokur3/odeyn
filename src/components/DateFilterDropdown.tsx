import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export type QuickFilterType = 'all' | 'today' | 'week' | 'month' | 'quarter';

interface DateFilterDropdownProps {
    onFilterChange: (filter: QuickFilterType, customStart?: Date, customEnd?: Date) => void;
}

export const DateFilterDropdown = ({ onFilterChange }: DateFilterDropdownProps) => {
    const [activeFilter, setActiveFilter] = useState<QuickFilterType>('all');
    const [isOpen, setIsOpen] = useState(false);
    const [showDetailedFilter, setShowDetailedFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const quickFilters: { id: QuickFilterType; label: string }[] = [
        { id: 'all', label: 'Tümü' },
        { id: 'today', label: 'Bugün' },
        { id: 'week', label: 'Bu Hafta' },
        { id: 'month', label: 'Bu Ay' },
        { id: 'quarter', label: 'Son 3 Ay' }
    ];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowDetailedFilter(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleQuickFilter = (filter: QuickFilterType) => {
        setActiveFilter(filter);
        setIsOpen(false);
        setShowDetailedFilter(false);
        onFilterChange(filter);
    };

    const handleDetailedFilterApply = () => {
        if (startDate && endDate) {
            setActiveFilter('all'); // Custom range shows as "Özel"
            onFilterChange('all', new Date(startDate), new Date(endDate));
            setIsOpen(false);
            setShowDetailedFilter(false);
        }
    };

    const activeLabel = quickFilters.find(f => f.id === activeFilter)?.label || 'Tümü';

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all whitespace-nowrap",
                    "border border-border bg-surface hover:bg-gray-50 dark:hover:bg-gray-800",
                    isOpen && "ring-2 ring-primary/20"
                )}
            >
                <Calendar className="size-3.5 sm:size-4 text-text-secondary" />
                <span className="text-text-primary">{activeLabel}</span>
                <ChevronDown 
                    className={clsx(
                        "size-3.5 sm:size-4 text-text-secondary transition-transform",
                        isOpen && "rotate-180"
                    )} 
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    {!showDetailedFilter ? (
                        <>
                            {/* Quick Filters */}
                            {quickFilters.map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => handleQuickFilter(filter.id)}
                                    className={clsx(
                                        "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors",
                                        activeFilter === filter.id
                                            ? "bg-primary text-white"
                                            : "text-text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
                            
                            {/* Detailed Filter Toggle */}
                            <div className="border-t border-border">
                                <button
                                    onClick={() => setShowDetailedFilter(true)}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    Detaylı Tarih Seç...
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Detailed Filter Panel */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-text-primary">Tarih Aralığı</span>
                                    <button
                                        onClick={() => setShowDetailedFilter(false)}
                                        className="text-xs text-text-secondary hover:text-text-primary"
                                    >
                                        Geri
                                    </button>
                                </div>
                                
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs text-text-secondary mb-1">Başlangıç</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-text-secondary mb-1">Bitiş</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface"
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
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// Export types
export type { DateFilterDropdownProps };
