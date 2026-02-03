import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface Tab {
    id: string;
    label: string;
    icon?: ReactNode;
}

interface TabBarProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export const TabBar = ({ tabs, activeTab, onTabChange }: TabBarProps) => {
    return (
        <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1 px-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all duration-200",
                            "relative hover:bg-gray-50 dark:hover:bg-gray-800/50",
                            activeTab === tab.id
                                ? "text-primary"
                                : "text-text-secondary"
                        )}
                    >
                        {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
                        <span>{tab.label}</span>
                        
                        {/* Active indicator */}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
