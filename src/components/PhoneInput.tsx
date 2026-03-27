import React, { useState, useEffect, useRef } from 'react';
import { AsYouType } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { isValidPhone } from '../utils/phoneUtils';
import { Phone, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface CountryInfo {
    code: CountryCode;
    label: string;
    dialCode: string;
}

const COUNTRIES: CountryInfo[] = [
    { code: 'TR' as CountryCode, label: '🇹🇷 Türkiye', dialCode: '+90' },
    { code: 'AZ' as CountryCode, label: '🇦🇿 Azerbaycan', dialCode: '+994' },
    { code: 'US' as CountryCode, label: '🇺🇸 USA', dialCode: '+1' },
    { code: 'DE' as CountryCode, label: '🇩🇪 Germany', dialCode: '+49' },
    { code: 'GB' as CountryCode, label: '🇬🇧 UK', dialCode: '+44' },
    { code: 'NL' as CountryCode, label: '🇳🇱 Netherlands', dialCode: '+31' },
    { code: 'FR' as CountryCode, label: '🇫🇷 France', dialCode: '+33' },
    { code: 'AE' as CountryCode, label: '🇦🇪 UAE', dialCode: '+971' },
    { code: 'SA' as CountryCode, label: '🇸🇦 Saudi Arabia', dialCode: '+966' },
    { code: 'RU' as CountryCode, label: '🇷🇺 Russia', dialCode: '+7' },
];

interface PhoneInputProps {
    value?: string; // Expecting E.164
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
    value = '',
    onChange,
    className,
    placeholder = '555 123 45 67',
    required = false,
    disabled = false
}) => {
    const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(COUNTRIES[0]);
    const [localNumber, setLocalNumber] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial Sync: Split E.164 into Country + Local if value is provided
    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue) {
        setPrevValue(value);
        if (value && value.startsWith('+')) {
            const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
            const match = sortedCountries.find(c => value.startsWith(c.dialCode));
            
            if (match) {
                setSelectedCountry(match);
                const local = value.replace(match.dialCode, '');
                setLocalNumber(new AsYouType(match.code).input(local));
            } else {
                setLocalNumber(value);
            }
        } else {
            // Support plain digit strings as initial local number
            setLocalNumber(value);
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/\D/g, ''); // Digits only
        const formatter = new AsYouType(selectedCountry.code);
        const formatted = formatter.input(input);
        
        setLocalNumber(formatted);
        
        // Emit E.164
        const e164 = selectedCountry.dialCode + input;
        onChange(e164);
    };

    const handleCountrySelect = (country: CountryInfo) => {
        setSelectedCountry(country);
        setShowDropdown(false);
        // Recalculate and emit with new country
        const digits = localNumber.replace(/\D/g, '');
        onChange(country.dialCode + digits);
    };

    const isValid = value ? isValidPhone(value) : true;

    return (
        <div className={clsx("relative flex gap-2", className)}>
            {/* Country Selector */}
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-1 h-full px-3 rounded-xl border border-slate-700 bg-background text-text-primary hover:border-slate-500 transition-all min-w-[90px] justify-between"
                >
                    <span className="text-sm font-bold">{selectedCountry.dialCode}</span>
                    <ChevronDown size={14} className={clsx("transition-transform", showDropdown && "rotate-180")} />
                </button>

                {showDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-surface border border-slate-700 rounded-xl shadow-2xl z-50 py-2 max-h-60 overflow-y-auto">
                        {COUNTRIES.map((c) => (
                            <button
                                key={c.code}
                                type="button"
                                onClick={() => handleCountrySelect(c)}
                                className={clsx(
                                    "w-full px-4 py-2 text-left text-sm hover:bg-primary/10 flex justify-between items-center transition-colors",
                                    selectedCountry.code === c.code ? "text-primary font-bold" : "text-text-primary"
                                )}
                            >
                                <span>{c.label}</span>
                                <span className="text-text-secondary text-xs">{c.dialCode}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Local Number Input */}
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={16} className="text-text-secondary" />
                </div>
                <input
                    type="tel"
                    inputMode="tel"
                    value={localNumber}
                    onChange={handleNumberChange}
                    disabled={disabled}
                    required={required}
                    className={clsx(
                        "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:ring-2 outline-none transition-all",
                        isValid ? "focus:border-primary focus:ring-blue-900/50" : "border-red-500 focus:border-red-500 focus:ring-red-900/20",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
};
