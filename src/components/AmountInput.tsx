import React from 'react';
import { clsx } from 'clsx';
import { formatAmountToWords } from '../utils/format';

interface AmountInputProps {
    value: string; // The numeric string value (e.g., "1250")
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    autoFocus?: boolean;
    label?: string;
    allowDecimals?: boolean;
    hideCommaSuffix?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
    value,
    onChange,
    placeholder = '0',
    className,
    disabled = false,
    required = false,
    autoFocus = false,
    label,
    allowDecimals = false,
    hideCommaSuffix = false,
}) => {
    const formatDots = (val: string) => {
        if (!val) return '';
        
        if (allowDecimals) {
            const parts = val.split(',');
            // Thousand separator only for integer part
            const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
        }

        // Strip everything but digits, then add dots every 3 chars from the end
        const digits = val.replace(/\D/g, '');
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const displayValue = value ? formatDots(value) : '';

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;
        
        if (allowDecimals) {
            // Convert dot to comma for consistency
            raw = raw.replace('.', ',');
            
            // Allow only digits and one comma
            const cleaned = raw.replace(/[^\d,]/g, '');
            const parts = cleaned.split(',');
            
            // Strictly one comma allowed
            let finalValue = parts[0];
            if (parts.length > 1) {
                finalValue += ',' + parts[1].slice(0, 2); // Limit to 2 decimal places
            }

            if (finalValue !== value) {
                // Ensure it's not exceeding limit (1 Billion)
                const numVal = parseFloat(finalValue.replace(',', '.'));
                if (!isNaN(numVal) && numVal >= 1000000000) return;
                
                onChange(finalValue);
            }
            return;
        }

        const digits = raw.replace(/\D/g, '');
        
        // Limit: Strictly less than 1 Billion
        if (digits.length > 0 && Number(digits) >= 1000000000) {
            return;
        }

        if (digits !== value) {
            onChange(digits);
        }
    };

    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-text-secondary mb-1">
                    {label}
                </label>
            )}
            <div className={clsx(
                "flex items-center w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-background transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-900/50",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}>
                <input
                    id={`amount-input-${label}`}
                    type="text"
                    inputMode={allowDecimals ? "decimal" : "numeric"}
                    value={displayValue}
                    onChange={handleInput}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    autoFocus={autoFocus}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary text-right text-base font-bold p-0"
                />
                {!allowDecimals && !hideCommaSuffix && (
                    <span className="ml-0.5 text-text-primary/60 font-bold text-base select-none">,00</span>
                )}
            </div>
        </div>
    );
};
