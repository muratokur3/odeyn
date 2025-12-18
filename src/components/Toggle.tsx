import React from 'react';
import { clsx } from 'clsx';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false, className }) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!disabled) onChange(!checked);
        }
    };

    return (
        <div
            className={clsx(
                "flex items-center gap-3",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group",
                className
            )}
            onClick={() => !disabled && onChange(!checked)}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onKeyDown={handleKeyDown}
                onClick={(e) => {
                    e.stopPropagation(); // Prevent double triggering if parent has click handler
                    if (!disabled) onChange(!checked);
                }}
                className={clsx(
                    "relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    checked ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"
                )}
            >
                <span
                    className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm",
                        checked ? "translate-x-7" : "translate-x-1"
                    )}
                />
            </button>
            {label && (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">
                    {label}
                </span>
            )}
        </div>
    );
};
