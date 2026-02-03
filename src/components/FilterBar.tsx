import clsx from 'clsx';

export type FilterType = 'all' | 'active' | 'paid' | 'rejected';

interface FilterChipProps {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}

const FilterChip = ({ label, count, active, onClick }: FilterChipProps) => {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap",
                "hover:scale-105 active:scale-95",
                active 
                    ? "bg-primary text-white shadow-md" 
                    : "bg-gray-100 dark:bg-gray-700 text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
        >
            {label} ({count})
        </button>
    );
};

interface FilterBarProps {
    currentFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    counts: {
        all: number;
        active: number;
        paid: number;
        rejected: number;
    };
}

export const FilterBar = ({ currentFilter, onFilterChange, counts }: FilterBarProps) => {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <FilterChip
                label="Tümü"
                count={counts.all}
                active={currentFilter === 'all'}
                onClick={() => onFilterChange('all')}
            />
            <FilterChip
                label="Aktif"
                count={counts.active}
                active={currentFilter === 'active'}
                onClick={() => onFilterChange('active')}
            />
            <FilterChip
                label="Ödendi"
                count={counts.paid}
                active={currentFilter === 'paid'}
                onClick={() => onFilterChange('paid')}
            />
            {counts.rejected > 0 && (
                <FilterChip
                    label="Reddedildi"
                    count={counts.rejected}
                    active={currentFilter === 'rejected'}
                    onClick={() => onFilterChange('rejected')}
                />
            )}
        </div>
    );
};
