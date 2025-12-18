import React from 'react';
import { X } from 'lucide-react';
import { Avatar } from './Avatar';

interface SelectedUserCardProps {
    name: string;
    phoneNumber: string;
    onClear: () => void;
    status: 'system' | 'contact' | 'none';
}

export const SelectedUserCard: React.FC<SelectedUserCardProps> = ({ name, phoneNumber, onClear, status }) => {
    return (
        <div className="relative p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
                <Avatar
                    name={name}
                    size="md"
                    status={status}
                />
                <div>
                    <p className="font-semibold text-text-primary">
                        {name}
                    </p>
                    <p className="text-xs text-text-secondary">
                        {phoneNumber}
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={onClear}
                className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
            >
                <X size={20} />
            </button>
        </div>
    );
};
