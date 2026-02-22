import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Debt } from '../types';
import { DebtCard } from './DebtCard';
import { FilterBar, type FilterType } from './FilterBar';
import { DateFilterDropdown, type QuickFilterType } from './DateFilterDropdown';

interface DebtsTabProps {
    debts: Debt[];
}

export const DebtsTab = ({ debts }: DebtsTabProps) => {
    const [filter, setFilter] = useState<FilterType>('all');
    const [dateFilter, setDateFilter] = useState<QuickFilterType>('all');
    const [customDateRange, setCustomDateRange] = useState<{ start?: Date; end?: Date }>({});
    const { user } = useAuth();
    const navigate = useNavigate();

    // Calculate filter counts
    const counts = useMemo(() => {
        return {
            all: debts.length,
            active: debts.filter(d => d.status === 'ACTIVE' || d.status === 'PENDING').length,
            paid: debts.filter(d => d.status === 'PAID').length,
            rejected: debts.filter(d => d.status === 'REJECTED' || d.status === 'REJECTED_BY_RECEIVER').length
        };
    }, [debts]);

    // Filter debts
    const filteredDebts = useMemo(() => {
        if (filter === 'all') return debts;
        if (filter === 'active') return debts.filter(d => d.status === 'ACTIVE' || d.status === 'PENDING');
        if (filter === 'paid') return debts.filter(d => d.status === 'PAID');
        if (filter === 'rejected') return debts.filter(d => d.status === 'REJECTED' || d.status === 'REJECTED_BY_RECEIVER');
        return debts;
    }, [debts, filter]);

    // Apply date filtering
    const dateFilteredDebts = useMemo(() => {
        if (dateFilter === 'all' && !customDateRange.start) return filteredDebts;

        const now = new Date();
        let startDate: Date;

        if (customDateRange.start && customDateRange.end) {
            // Custom range
            return filteredDebts.filter(d => {
                const debtDate = d.createdAt?.toDate();
                if (!debtDate) return false;
                return debtDate >= customDateRange.start! && debtDate <= customDateRange.end!;
            });
        }

        // Quick filters
        switch (dateFilter) {
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
            default:
                return filteredDebts;
        }

        return filteredDebts.filter(d => {
            const debtDate = d.createdAt?.toDate();
            if (!debtDate) return false;
            return debtDate >= startDate;
        }).sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [filteredDebts, dateFilter, customDateRange]);

    const handleDateFilterChange = (filter: QuickFilterType, customStart?: Date, customEnd?: Date) => {
        setDateFilter(filter);
        if (customStart && customEnd) {
            setCustomDateRange({ start: customStart, end: customEnd });
        } else {
            setCustomDateRange({});
        }
    };

    return (
        <div className="space-y-4">
            {/* Filters Row - Status + Date on same line */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                <FilterBar 
                    currentFilter={filter}
                    onFilterChange={setFilter}
                    counts={counts}
                />
                
                <DateFilterDropdown onFilterChange={handleDateFilterChange} />
            </div>

            {/* Debts List */}
            {dateFilteredDebts.length > 0 ? (
                <div className="space-y-3">
                    {dateFilteredDebts.map(debt => (
                        <DebtCard
                            key={debt.id}
                            debt={debt}
                            currentUserId={user?.uid || ''}
                            onClick={() => navigate(`/debt/${debt.id}`)}
                            hideAvatar={false}
                            variant="chat"
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-surface rounded-2xl p-8 text-center border border-dashed border-border">
                    <span className="text-4xl mb-3 block">📋</span>
                    <p className="text-text-secondary font-medium">
                        {filter === 'all' ? 'Henüz borç yok' : 'Bu filtrede borç bulunamadı'}
                    </p>
                    <p className="text-sm text-text-tertiary mt-2">
                        {filter === 'all' && 'İlk borcu eklemek için + butonunu kullanın'}
                    </p>
                </div>
            )}
        </div>
    );
};
