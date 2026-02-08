import React, { useState, useEffect, useRef } from 'react';
import { AsYouType } from 'libphonenumber-js';
import { cleanPhone, isValidPhone } from '../utils/phoneUtils';
import { Phone } from 'lucide-react';
import clsx from 'clsx';

interface PhoneInputProps {
    value?: string; // Expecting E.164 or empty
    onChange: (value: string) => void; // Emits E.164
    className?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
    value = '',
    onChange,
    className,
    placeholder = '5 (555) 123 45 67',
    required = false,
    disabled = false
}) => {
    // Internal display value (formatted)
    const [displayValue, setDisplayValue] = useState('');
    const prevValueRef = useRef(value);

    // Sync internal display value when external value changes
    useEffect(() => {
        // Only update if value prop actually changed
        if (value !== prevValueRef.current) {
            if (value) {
                const formatter = new AsYouType('TR');
                const formatted = formatter.input(value);
                setDisplayValue(formatted);
            } else {
                setDisplayValue('');
            }
            prevValueRef.current = value;
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        const formatter = new AsYouType('TR');
        const formatted = formatter.input(input);

        setDisplayValue(formatted);

        // Calculate E.164 to emit
        const number = formatter.getNumber();
        if (number) {
            onChange(number.number as string); // E.164
        } else {
            // If incomplete or invalid, we might still want to emit 'something' or empty?
            // If strict, we only emit valid? No, user needs to type.
            // Emitting the "Best Guess" E.164 or cleaned version.
            const cleaned = cleanPhone(input);
            onChange(cleaned);
        }
    };

    const isValid = value ? isValidPhone(value) : true; // Empty is valid until submitted (required handled by form)

    return (
        <div className={clsx("relative", className)}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={18} className="text-text-secondary" />
            </div>
            <input
                type="tel"
                value={displayValue}
                onChange={handleChange}
                className={clsx(
                    "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:ring-2 outline-none transition-all",
                    isValid ? "focus:border-primary focus:ring-blue-900/50" : "border-red-500 focus:border-red-500 focus:ring-red-900/20",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
            />
        </div>
    );
};
