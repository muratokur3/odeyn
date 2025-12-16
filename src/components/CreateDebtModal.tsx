import React, { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp, Book } from 'lucide-react';
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
        canBorrowerAddPayment?: boolean,
        requestApproval?: boolean,
        initialPayment?: number
    ) => Promise<void>;
    initialPhoneNumber?: string;
    targetUser?: User | Contact | null;
}

import { useModal } from '../context/ModalContext';

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({ isOpen, onClose, onSubmit, initialPhoneNumber, targetUser }) => {
    const { user } = useAuth();
    const { showAlert } = useModal();

    // Derived state for initialization
    const initialName = targetUser
        ? ('displayName' in targetUser ? targetUser.displayName : targetUser.name)
        : '';

    // ... [rest unchanged]

    const initialPhone = targetUser
        ? targetUser.phoneNumber
        : (initialPhoneNumber || '');

    const [phoneNumber, setPhoneNumber] = useState(initialPhone);
    const [amount, setAmount] = useState('');
    const [borrowerName, setBorrowerName] = useState(initialName);

    // Search State
    const [foundUser, setFoundUser] = useState<User | null>(
        targetUser && 'uid' in targetUser ? (targetUser as User) : null
    );
    const [foundContact, setFoundContact] = useState<Contact | null>(
        targetUser && !('uid' in targetUser) ? (targetUser as Contact) : null
    );
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
    const [downPayment, setDownPayment] = useState('');

    // Reset/Init when opening
    useEffect(() => {
        if (isOpen) {
            setPhoneNumber(initialPhone);
            setBorrowerName(initialName);
            if (targetUser) {
                if ('uid' in targetUser) {
                    setFoundUser(targetUser as User);
                    setFoundContact(null);
                } else {
                    setFoundContact(targetUser as Contact);
                    setFoundUser(null);
                }
                setFoundContact(null);
            }
            // Initialize requestApproval to false (user can manually check if needed)
            // Previous behavior: Default was strictly logic-based.
            // We default to false so Auto-Approve works by default unless overridden.


            // Initialize canBorrowerAddPayment from preference
            if (user?.preferences?.defaultAllowPaymentAddition) {
                setCanBorrowerAddPayment(true);
            } else {
                setCanBorrowerAddPayment(false);
            }
            setDownPayment('');
        }
    }, [isOpen, initialPhoneNumber, targetUser, user]);

    // Search Effect - Disable if targetUser is set
    useEffect(() => {
        if (targetUser) return; // Skip search if locked to a user

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
    }, [phoneNumber, user, targetUser]);

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
        const numDownPayment = parseFloat(downPayment) || 0;

        if (isNaN(numAmount) || numAmount <= 0) return;
        if (numDownPayment >= numAmount) {
            showAlert("Hata", "Peşinat tutarı toplam tutardan büyük veya eşit olamaz.", "error");
            return;
        }

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
            showAlert("Bilgi", "Lütfen bir isim girin veya kayıtlı bir kullanıcı seçin.", "warning");
            return;
        }

        setLoading(true);
        try {
            // Generate Installments
            let generatedInstallments: Installment[] | undefined;
            if (isInstallment && installmentCount > 1) {
                generatedInstallments = [];
                const remainingToInstallment = numAmount - numDownPayment;
                const perAmount = remainingToInstallment / installmentCount;
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
                canBorrowerAddPayment,
                true, // Always request approval
                numDownPayment // Pass Initial Payment
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
            setDownPayment(''); // Reset down payment

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200 h-[85vh] flex flex-col border border-slate-700">
                <div className="flex justify-between items-center p-6 pb-2 flex-none">
                    <h2 className="text-xl font-bold text-text-primary">Yeni İşlem Ekle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <form id="create-debt-form" onSubmit={handleSubmit} className="space-y-4">
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
                                    {!targetUser && (
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
                                    )}
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
                                            const input = document.querySelector<HTMLInputElement>('input[placeholder="İsim veya Telefon Ara..."]');
                                            if (input) input.focus();
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

                        {/* Note Field - Moved Here */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Not</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all resize-none"
                                placeholder="Borç ile ilgili not..."
                            />
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
                                    <>Taksit, Vade ve Diğer Detaylar <ChevronDown size={16} /></>
                                )}
                            </button>

                            {showDetails && (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200 mt-2">
                                    {/* Installment Toggle */}
                                    <div className={clsx(
                                        "p-4 rounded-xl border transition-all",
                                        isInstallment ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" : "bg-background border-slate-700"
                                    )}>
                                        <div className="flex items-center justify-between">
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
                                                    "w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                                    isInstallment ? "translate-x-6" : "translate-x-0"
                                                )} />
                                            </div>
                                        </div>

                                        {isInstallment && (
                                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                {/* Down Payment */}
                                                <div>
                                                    <label className="block text-xs font-medium text-text-secondary mb-1">Peşinat (Opsiyonel)</label>
                                                    <input
                                                        type="number"
                                                        value={downPayment}
                                                        onChange={(e) => setDownPayment(e.target.value)}
                                                        min={0}
                                                        max={parseFloat(amount) || 0}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-surface/50 text-text-primary text-sm focus:border-primary outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-text-secondary mb-1">Taksit Sayısı</label>
                                                        <input
                                                            type="number"
                                                            value={installmentCount}
                                                            onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                                                            min={2}
                                                            max={24}
                                                            className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-surface/50 text-text-primary text-sm focus:border-primary outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-text-secondary mb-1">İlk Taksit Tarihi</label>
                                                        <input
                                                            type="date"
                                                            value={dueDate}
                                                            onChange={(e) => setDueDate(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-surface/50 text-text-primary text-sm focus:border-primary outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                    <p className="text-xs text-blue-800 dark:text-blue-200 flex justify-between">
                                                        <span>Kalan Tutar:</span>
                                                        <span className="font-bold">{formatCurrency(parseFloat(amount || '0') - (parseFloat(downPayment) || 0), currency)}</span>
                                                    </p>
                                                    <p className="text-xs text-blue-800 dark:text-blue-200 flex justify-between mt-1">
                                                        <span>Aylık Taksit:</span>
                                                        <span className="font-bold">{formatCurrency(((parseFloat(amount || '0') - (parseFloat(downPayment) || 0)) / installmentCount) || 0, currency)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Permission Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-slate-700">
                                        <span className="text-sm font-medium text-text-primary">Karşı taraf ödeme ekleyebilsin</span>
                                        <div
                                            onClick={() => setCanBorrowerAddPayment(!canBorrowerAddPayment)}
                                            className={clsx(
                                                "w-12 h-6 rounded-full p-1 transition-colors cursor-pointer",
                                                canBorrowerAddPayment ? "bg-primary" : "bg-slate-700"
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                                canBorrowerAddPayment ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-slate-800 bg-surface rounded-b-2xl flex-none z-10 w-full">
                    <button
                        type="submit"
                        form="create-debt-form"
                        disabled={loading || !amount || (!foundUser && !foundContact && !borrowerName)}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {loading ? 'İşleniyor...' : 'Kaydet'}
                    </button>
                </div>
            </div >
        </div >
    );
};
