import React, { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp, Calendar, Book } from 'lucide-react';
import { Avatar } from './Avatar';
import { searchUserByPhone, searchContacts, addContact } from '../services/db';
import { formatCurrency } from '../utils/format';
import type { User, Contact, Installment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Timestamp } from 'firebase/firestore';
import clsx from 'clsx';

interface CreateDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (
        borrowerId: string,
        borrowerName: string,
        amount: number,
        type: 'LENDING' | 'BORROWING',
        currency: string,
        note?: string,
        dueDate?: Date,
        installments?: Installment[],
        canBorrowerAddPayment?: boolean
    ) => Promise<void>;
    initialPhoneNumber?: string;
}

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({ isOpen, onClose, onSubmit, initialPhoneNumber }) => {
    const { user } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
    const [amount, setAmount] = useState('');
    const [borrowerName, setBorrowerName] = useState('');

    // Search State
    const [foundUser, setFoundUser] = useState<User | null>(null);
    const [foundContact, setFoundContact] = useState<Contact | null>(null);
    const [searchResults, setSearchResults] = useState<Contact[]>([]);

    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // New Fields
    const [type, setType] = useState<'LENDING' | 'BORROWING'>('LENDING');
    const [currency, setCurrency] = useState('TRY');
    const [note, setNote] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [canBorrowerAddPayment, setCanBorrowerAddPayment] = useState(false);

    // Installment State
    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentCount, setInstallmentCount] = useState(1);

    // Search Effect
    useEffect(() => {
        const search = async () => {
            if (!user || !phoneNumber || phoneNumber.length < 3) {
                setSearchResults([]);
                setFoundUser(null);
                setSearching(false);
                return;
            }

            setSearching(true);
            try {
                // 1. Search Contacts
                const contacts = await searchContacts(user.uid, phoneNumber);
                setSearchResults(contacts);

                // 2. Search System Users (only if full phone number)
                if (phoneNumber.length >= 10) {
                    const sysUser = await searchUserByPhone(phoneNumber);
                    if (sysUser && sysUser.uid !== user.uid) {
                        setFoundUser(sysUser);
                    } else {
                        setFoundUser(null);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setSearching(false);
            }
        };

        const timeoutId = setTimeout(search, 500);
        return () => clearTimeout(timeoutId);
    }, [phoneNumber, user]);

    // Update phone number if initialPhoneNumber changes when modal opens
    useEffect(() => {
        if (isOpen && initialPhoneNumber) {
            setPhoneNumber(initialPhoneNumber);
        }
    }, [isOpen, initialPhoneNumber]);

    if (!isOpen) return null;

    const handleSelectContact = (contact: Contact) => {
        setFoundContact(contact);
        setPhoneNumber(contact.phoneNumber);
        setBorrowerName(contact.name);
        setSearchResults([]);
        setFoundUser(null);
    };

    const handleSelectUser = (sysUser: User) => {
        setFoundUser(sysUser);
        setPhoneNumber(sysUser.phoneNumber);
        setBorrowerName(sysUser.displayName);
        setSearchResults([]);
        setFoundContact(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return;

        // Determine final ID and Name
        let finalBorrowerId = phoneNumber;
        let finalBorrowerName = borrowerName;

        if (foundContact) {
            finalBorrowerId = foundContact.linkedUserId || foundContact.phoneNumber;
            finalBorrowerName = foundContact.name;
        } else if (foundUser) {
            finalBorrowerId = foundUser.uid;
            finalBorrowerName = foundUser.displayName;
        }

        if (!finalBorrowerName) {
            alert("Lütfen bir isim girin veya kayıtlı bir kullanıcı seçin.");
            return;
        }

        setLoading(true);
        try {
            // Generate Installments
            let generatedInstallments: Installment[] | undefined;
            if (isInstallment && installmentCount > 1) {
                generatedInstallments = [];
                const perAmount = numAmount / installmentCount;
                const startDate = dueDate ? new Date(dueDate) : new Date();

                for (let i = 0; i < installmentCount; i++) {
                    const date = new Date(startDate);
                    date.setMonth(date.getMonth() + i);
                    generatedInstallments.push({
                        id: crypto.randomUUID(),
                        dueDate: Timestamp.fromDate(date),
                        amount: perAmount,
                        isPaid: false
                    });
                }
            }

            // 1. Create Debt
            await onSubmit(
                finalBorrowerId,
                finalBorrowerName,
                numAmount,
                type,
                currency,
                note,
                dueDate ? new Date(dueDate) : undefined,
                generatedInstallments,
                canBorrowerAddPayment
            );

            // 2. Auto-add to Contacts if not already a contact
            if (!foundContact) {
                // Check if we should link to a system user
                const linkedId = foundUser ? foundUser.uid : undefined;
                await addContact(user.uid, finalBorrowerName, phoneNumber, linkedId);
            }

            onClose();
            // Reset form
            setPhoneNumber('');
            setAmount('');
            setBorrowerName('');
            setFoundUser(null);
            setFoundContact(null);
            setSearchResults([]);
            setNote('');
            setDueDate('');
            setType('LENDING');
            setCurrency('TRY');
            setShowDetails(false);
            setIsInstallment(false);
            setInstallmentCount(1);
            setCanBorrowerAddPayment(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-text-primary">Yeni İşlem Ekle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ... (Type Toggle and User Search remain same) ... */}
                    {/* Type Toggle */}
                    <div className="flex p-1 bg-background rounded-xl border border-slate-700">
                        <button
                            type="button"
                            onClick={() => setType('LENDING')}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                                type === 'LENDING' ? "bg-surface text-green-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                            )}
                        >
                            Borç Veriyorum
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('BORROWING')}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                                type === 'BORROWING' ? "bg-surface text-red-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                            )}
                        >
                            Borç Alıyorum
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            {type === 'LENDING' ? 'Kime Veriyorsun?' : 'Kimden Alıyorsun?'}
                        </label>

                        {/* Selected User Display */}
                        {(foundContact || foundUser) ? (
                            <div className="relative p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in fade-in zoom-in duration-200">
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        name={foundContact?.name || foundUser?.displayName}
                                        size="md"
                                        status={foundUser ? 'system' : 'contact'}
                                    />
                                    <div>
                                        <p className="font-semibold text-text-primary">
                                            {foundContact?.name || foundUser?.displayName}
                                        </p>
                                        <p className="text-xs text-text-secondary">
                                            {foundContact?.phoneNumber || foundUser?.phoneNumber}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFoundContact(null);
                                        setFoundUser(null);
                                        setPhoneNumber('');
                                        setBorrowerName('');
                                    }}
                                    className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            /* Search Input */
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value);
                                        setFoundContact(null); // Reset selection on type
                                        setFoundUser(null);
                                    }}
                                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                    placeholder="İsim veya Telefon Ara..."
                                    required
                                />
                                {searching && (
                                    <div className="absolute inset-y-0 right-12 pr-3 flex items-center pointer-events-none">
                                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-blue-500 transition-colors"
                                    onClick={() => {
                                        // Focus input for now
                                        const input = document.querySelector<HTMLInputElement>('input[placeholder="İsim veya Telefon Ara..."]');
                                        if (input) {
                                            input.focus();
                                            // Ideally trigger a search or open modal
                                        }
                                    }}
                                >
                                    <Book size={20} />
                                </button>
                            </div>
                        )}

                        {/* Search Results Dropdown */}
                        {!foundContact && !foundUser && (searchResults.length > 0 || (foundUser && !foundContact)) && (
                            <div className="mt-2 bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto absolute w-full max-w-[calc(100%-3rem)] z-20">
                                {searchResults.map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => handleSelectContact(contact)}
                                        className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 border-b border-gray-50 dark:border-slate-800 last:border-0"
                                    >
                                        <Avatar
                                            name={contact.name}
                                            size="sm"
                                            status={contact.linkedUserId ? 'system' : 'contact'}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{contact.name}</p>
                                            <p className="text-xs text-text-secondary">{contact.phoneNumber} (Rehber)</p>
                                        </div>
                                    </div>
                                ))}

                                {foundUser && !searchResults.some(c => c.phoneNumber === (foundUser as User).phoneNumber) && (
                                    <div
                                        onClick={() => handleSelectUser(foundUser as User)}
                                        className="p-3 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer flex items-center gap-3 border-t border-gray-100 dark:border-slate-800"
                                    >
                                        <Avatar
                                            name={(foundUser as User).displayName || ''}
                                            photoURL={(foundUser as User).photoURL || undefined}
                                            size="sm"
                                            status="system"
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{(foundUser as User).displayName}</p>
                                            <p className="text-xs text-green-600 dark:text-green-400">Sistem Kullanıcısı</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {!foundContact && !foundUser && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-medium text-text-secondary mb-1">İsim</label>
                            <input
                                type="text"
                                value={borrowerName}
                                onChange={(e) => setBorrowerName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                placeholder="İsim Giriniz"
                                required={!foundUser && !foundContact}
                            />
                        </div>
                    )}

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Tutar</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={0}
                                step="0.01"
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all text-lg font-semibold"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Para Birimi</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            >
                                <option value="TRY">TRY</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GOLD">Altın (Gr)</option>
                            </select>
                        </div>
                    </div>

                    {/* Installment Toggle */}
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-slate-700">
                        <span className="text-sm font-medium text-text-primary">Taksitlendir</span>
                        <div
                            onClick={() => {
                                setIsInstallment(!isInstallment);
                                if (!isInstallment) setInstallmentCount(2);
                                else setInstallmentCount(1);
                            }}
                            className={clsx(
                                "w-12 h-6 rounded-full p-1 transition-colors cursor-pointer",
                                isInstallment ? "bg-primary" : "bg-slate-700"
                            )}
                        >
                            <div className={clsx(
                                "w-4 h-4 bg-white rounded-full transition-transform",
                                isInstallment ? "translate-x-6" : "translate-x-0"
                            )} />
                        </div>
                    </div>

                    {isInstallment && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Taksit Sayısı</label>
                            <input
                                type="number"
                                value={installmentCount}
                                onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                                min={2}
                                max={24}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            />
                            <p className="text-xs text-text-secondary mt-1">
                                Aylık ödeme: {formatCurrency(parseFloat(amount || '0') / installmentCount, currency)}
                            </p>
                        </div>
                    )}

                    {/* Payment Permission Checkbox */}
                    <div className="flex items-center gap-2 p-3 bg-background rounded-xl border border-slate-700 cursor-pointer" onClick={() => setCanBorrowerAddPayment(!canBorrowerAddPayment)}>
                        <div className={clsx(
                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                            canBorrowerAddPayment ? "bg-primary border-primary" : "border-slate-500"
                        )}>
                            {canBorrowerAddPayment && <X size={14} className="text-white rotate-45" style={{ transform: 'rotate(0deg)' }} />} {/* Using X as checkmark or just empty if not checked. Actually lucide Check is better but I don't have it imported. I'll use a simple div or import Check. Wait, X is imported. I can use X rotated? No, let's just use conditional rendering. I'll just use a simple square. */}
                            {canBorrowerAddPayment && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                        </div>
                        <span className="text-sm text-text-primary select-none">Karşı taraf ödeme ekleyebilsin</span>
                    </div>

                    {/* Expandable Details */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowDetails(!showDetails)}
                            className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors w-full justify-center py-2"
                        >
                            {showDetails ? (
                                <>Daha Az Detay <ChevronUp size={16} /></>
                            ) : (
                                <>Daha Fazla Detay <ChevronDown size={16} /></>
                            )}
                        </button>

                        {showDetails && (
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-border mt-2">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Vade Tarihi</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Not</label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all resize-none"
                                        placeholder="Borç ile ilgili not..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !amount || (!foundUser && !foundContact && !borrowerName)}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'İşleniyor...' : 'Kaydet'}
                    </button>
                </form>
            </div>
        </div>
    );
};
