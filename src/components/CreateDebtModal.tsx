import React, { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Avatar } from './Avatar';
import { SelectedUserCard } from './SelectedUserCard'; // Import moved to top

import { searchUserByPhone, searchContacts, fetchLastUsedName } from '../services/db';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay } from '../utils/phoneUtils'; // Added import
import type { User, Contact, Installment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Toggle } from './Toggle';
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
    initialName?: string; // New prop
}

import { useModal } from '../context/ModalContext';

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({ isOpen, onClose, onSubmit, initialPhoneNumber, targetUser, initialName: propInitialName }) => {
    const { user } = useAuth();
    const { showAlert } = useModal();

    // Derived state for initialization
    const derivedInitialName = targetUser
        ? ('displayName' in targetUser ? targetUser.displayName : targetUser.name)
        : (propInitialName || '');

    // ... [rest unchanged]

    const initialPhone = targetUser
        ? ('uid' in targetUser
            ? (targetUser.primaryPhoneNumber || targetUser.phoneNumbers?.[0] || targetUser.phoneNumber || '')
            : targetUser.phoneNumber)
        : (initialPhoneNumber || '');

    const [phoneNumber, setPhoneNumber] = useState(initialPhone);
    const [amount, setAmount] = useState('');
    const [borrowerName, setBorrowerName] = useState(derivedInitialName);

    // Search State
    const [foundUser, setFoundUser] = useState<User | null>(
        targetUser && 'uid' in targetUser ? (targetUser as User) : null
    );
    const [foundContact, setFoundContact] = useState<Contact | null>(
        targetUser && !('uid' in targetUser) ? (targetUser as Contact) : null
    );
    const [searchResults, setSearchResults] = useState<Contact[]>([]);

    const [loading, setLoading] = useState(false);

    // Flow State
    const [step, setStep] = useState<'SEARCH' | 'DETAILS'>('SEARCH');
    const [isShadowUser, setIsShadowUser] = useState(false);

    // const [isManualSearch, setIsManualSearch] = useState(false); // Removed in favor of step

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
            setBorrowerName(derivedInitialName);
            // setIsManualSearch(false); 

            if (targetUser) {
                setStep('DETAILS');
                setIsShadowUser(false);
                if ('uid' in targetUser) {
                    setFoundUser(targetUser as User);
                    setFoundContact(null);
                } else {
                    setFoundContact(targetUser as Contact);
                    setFoundUser(null);
                }
            } else if (propInitialName && initialPhone) {
                // Shadow User Case from PersonDetail (Raw Phone)
                setStep('DETAILS');
                setIsShadowUser(true);
                setFoundContact(null);
                setFoundUser(null);
            } else {
                setStep('SEARCH');
                setIsShadowUser(false);
            }

            // Initialize requestApproval to false (user can manually check if needed)
            // ...

            // Initialize canBorrowerAddPayment from preference
            if (user?.preferences?.defaultAllowPaymentAddition) {
                setCanBorrowerAddPayment(true);
            } else {
                setCanBorrowerAddPayment(false);
            }
            setDownPayment('');
        }
    }, [isOpen, initialPhoneNumber, targetUser, user, propInitialName]);

    // Search Effect - Disable if NOT in SEARCH step
    useEffect(() => {
        if (step !== 'SEARCH') return;

        const search = async () => {
            if (!user || !phoneNumber || phoneNumber.length < 3) {
                setSearchResults([]);
                setFoundUser(null);

                return;
            }


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
        setStep('DETAILS');
        setIsShadowUser(false);
    };

    const handleSelectUser = (sysUser: User) => {
        setFoundUser(sysUser);
        setPhoneNumber(sysUser.primaryPhoneNumber || sysUser.phoneNumbers?.[0] || sysUser.phoneNumber || '');
        setBorrowerName(sysUser.displayName || '');
        setSearchResults([]);
        setFoundContact(null);
        setStep('DETAILS');
        setIsShadowUser(false);
    };

    const handleSelectNewNumber = async (rawPhone: string) => {
        // Ghost Memory Logic
        // We use the raw input for locking
        // User prompt says: "Create new record for [Formatted Phone]"

        setPhoneNumber(rawPhone); // Keep input for now, will be cleaned on submit
        setFoundContact(null);
        setFoundUser(null);
        setSearchResults([]);

        setStep('DETAILS');
        setIsShadowUser(true);
        setLoading(true);

        // Fetch Last Used Name
        if (user) {
            const ghostName = await fetchLastUsedName(user.uid, rawPhone);
            if (ghostName) {
                setBorrowerName(ghostName);
            } else {
                setBorrowerName('');
            }
        }
        setLoading(false);
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
        let finalBorrowerId: string = phoneNumber || '';
        let finalBorrowerName = borrowerName;

        if (foundContact) {
            finalBorrowerId = foundContact.linkedUserId || foundContact.phoneNumber;
            // Allow name override: IF user edited the name field, usage logic?
            // Usually we trust the object, BUT user wants to edit displayed name.
            // So if borrowerName is set, use it.
            finalBorrowerName = borrowerName || foundContact.name;
        } else if (foundUser) {
            finalBorrowerId = foundUser.uid;
            finalBorrowerName = borrowerName || foundUser.displayName;
        }

        // Fallback: If name empty, use formatted phone or raw phone
        if (!finalBorrowerName) {
            finalBorrowerName = formatPhoneForDisplay(finalBorrowerId);
        }

        /* Validation Removed per user request
        if (!finalBorrowerName) {
            showAlert("Bilgi", "Lütfen bir isim girin veya kayıtlı bir kullanıcı seçin.", "warning");
            return;
        }
        const digits = finalBorrowerName.replace(/\D/g, '');
        if (digits.length > 7 && (digits.length / finalBorrowerName.length > 0.5)) {
             showAlert("Uyarı", "İsim alanı telefon numarası olamaz. Lütfen gerçek bir isim giriniz.", "warning");
             return;
        }
        */

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

            // 2. Auto-add to Contacts is now handled inside createDebt service globally.
            // Redundant call removed to prevent duplicates.

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm pb-20 md:pb-4">
            <div className="bg-surface rounded-3xl w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200 h-auto max-h-[85dvh] flex flex-col border border-slate-700/50">
                <div className="flex justify-between items-center p-6 pb-4 flex-none border-b border-slate-800/50">
                    <h2 className="text-2xl font-bold text-text-primary">Yeni İşlem</h2>
                    <button onClick={onClose} className="p-3 hover:bg-slate-700/50 rounded-full transition-colors active:scale-95">
                        <X size={24} className="text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <form id="create-debt-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Type Toggle */}
                        <div className="flex p-1.5 bg-background rounded-2xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setType('LENDING')}
                                className={clsx(
                                    "flex-1 py-3.5 rounded-xl text-base font-semibold transition-all active:scale-95",
                                    type === 'LENDING' ? "bg-surface text-green-500 shadow-sm ring-1 ring-black/5" : "text-text-secondary hover:text-text-primary"
                                )}
                            >
                                Borç Verdim
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('BORROWING')}
                                className={clsx(
                                    "flex-1 py-3.5 rounded-xl text-base font-semibold transition-all active:scale-95",
                                    type === 'BORROWING' ? "bg-surface text-red-500 shadow-sm ring-1 ring-black/5" : "text-text-secondary hover:text-text-primary"
                                )}
                            >
                                Borç Aldım
                            </button>
                        </div>

                        {/* Type Toggle */}

                        {/* Flow Control */}
                        {step === 'DETAILS' ? (
                            <SelectedUserCard
                                name={foundContact?.name || foundUser?.displayName || (isShadowUser ? borrowerName : '')}
                                phoneNumber={phoneNumber}
                                status={foundUser ? 'system' : (foundContact ? 'contact' : 'none')}
                                uid={foundUser ? foundUser.uid : foundContact?.linkedUserId}
                                onClear={() => {
                                    setFoundContact(null);
                                    setFoundUser(null);
                                    setPhoneNumber('');
                                    setBorrowerName('');
                                    setStep('SEARCH');
                                    setIsShadowUser(false);
                                }}
                            />
                        ) : (
                            /* Unified Search Input */
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value);
                                        // Reset outcomes
                                        setFoundContact(null);
                                        setFoundUser(null);
                                    }}
                                    className="w-full pl-11 pr-4 py-4 rounded-xl border border-slate-700 bg-background text-text-primary text-base focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all placeholder:text-slate-500"
                                    placeholder="Kişi veya Telefon Ara..."
                                    autoFocus
                                />

                                {/* Search Results Dropdown */}
                                {(searchResults.length > 0 || foundUser || (phoneNumber.replace(/\D/g, '').length >= 3)) && (
                                    <div className="mt-2 bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto absolute w-full z-20">
                                        {/* Contacts */}
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
                                                    uid={contact.linkedUserId}
                                                />
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{contact.name}</p>
                                                    <p className="text-xs text-text-secondary">{contact.phoneNumber} (Rehber)</p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* System User Match */}
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

                                        {/* Create New Entry Row */}
                                        {phoneNumber.replace(/\D/g, '').length >= 10 && !foundUser && !searchResults.some(c => c.phoneNumber.includes(phoneNumber.replace(/\D/g, ''))) && (
                                            <div
                                                onClick={() => handleSelectNewNumber(phoneNumber)}
                                                className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 border-t border-gray-100 dark:border-slate-800"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-text-secondary">
                                                    <Plus size={16} /> {/* Need to import Plus */}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">Yeni Kişi Oluştur</p>
                                                    <p className="text-xs text-text-secondary">{formatPhoneForDisplay(phoneNumber)}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Empty State */}
                                        {searchResults.length === 0 && !foundUser && phoneNumber.length > 0 && phoneNumber.replace(/\D/g, '').length < 10 && (
                                            <div className="p-4 text-center text-text-secondary text-sm">
                                                Sonuç bulunamadı. Yeni numara için en az 10 hane girin.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}


                        <div className="flex flex-col sm:flex-row gap-5">
                            <div className="flex-1">
                                <label className="block text-base font-semibold text-text-secondary mb-2 ml-1">Tutar</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        min={0}
                                        step="0.01"
                                        className="w-full px-4 py-4 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-xl font-bold tracking-wide placeholder:font-normal placeholder:text-slate-600"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="w-full sm:w-1/3">
                                <label className="block text-base font-semibold text-text-secondary mb-2 ml-1">Para Birimi</label>
                                <div className="relative">
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full px-4 py-4 rounded-xl border border-slate-700 bg-background text-text-primary text-base font-medium focus:border-primary focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                                    >
                                        <option value="TRY">TRY (₺)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GOLD">Altın (Gr)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-text-secondary">
                                        <ChevronDown size={20} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Note Field */}
                        <div>
                            <label className="block text-base font-semibold text-text-secondary mb-2 ml-1">Not (Opsiyonel)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-4 rounded-xl border border-slate-700 bg-background text-text-primary text-base focus:border-primary focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none placeholder:text-slate-600"
                                placeholder="Örn: Yemek ücreti..."
                            />
                        </div>


                        {/* Expandable Details */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-blue-600 dark:text-blue-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                            >
                                <span>Detaylı Ayarlar</span>
                                {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>

                            {showDetails && (
                                <div className="space-y-5 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Installment Toggle */}
                                    <div className={clsx(
                                        "p-5 rounded-2xl border transition-all",
                                        isInstallment ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" : "bg-background border-slate-700"
                                    )}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-semibold text-text-primary">Taksitlendir</span>
                                            <Toggle
                                                checked={isInstallment}
                                                onChange={(val) => {
                                                    setIsInstallment(val);
                                                    if (val) setInstallmentCount(2);
                                                    else setInstallmentCount(1);
                                                }}
                                                label=""
                                            />
                                        </div>

                                        {isInstallment && (
                                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-1 border-t border-slate-200 dark:border-slate-700 pt-4">
                                                {/* Down Payment */}
                                                <div>
                                                    <label className="block text-sm font-semibold text-text-secondary mb-2">Peşinat (Opsiyonel)</label>
                                                    <input
                                                        type="number"
                                                        value={downPayment}
                                                        onChange={(e) => setDownPayment(e.target.value)}
                                                        min={0}
                                                        max={parseFloat(amount) || 0}
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-surface/50 text-text-primary text-base focus:border-primary outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-semibold text-text-secondary mb-2">Taksit Sayısı</label>
                                                        <input
                                                            type="number"
                                                            value={installmentCount}
                                                            onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                                                            min={2}
                                                            max={24}
                                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-surface/50 text-text-primary text-base focus:border-primary outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-semibold text-text-secondary mb-2">İlk Taksit Tarihi</label>
                                                        <input
                                                            type="date"
                                                            value={dueDate}
                                                            onChange={(e) => setDueDate(e.target.value)}
                                                            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-surface/50 text-text-primary text-base focus:border-primary outline-none"
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
                                    <div className="flex items-center justify-between p-5 bg-background rounded-2xl border border-slate-700">
                                        <span className="text-base font-semibold text-text-primary">Karşı taraf ödeme ekleyebilir</span>
                                        <Toggle
                                            checked={canBorrowerAddPayment}
                                            onChange={setCanBorrowerAddPayment}
                                            label=""
                                        />
                                    </div>

                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-slate-800/50 bg-surface rounded-b-3xl flex-none z-10 w-full pb-8 md:pb-6">
                    <button
                        type="submit"
                        form="create-debt-form"
                        disabled={loading || !amount || (!foundUser && !foundContact && !borrowerName)}
                        className="w-full bg-primary text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                        {loading ? 'İşleniyor...' : 'Kaydet'}
                    </button>
                </div>
            </div >
        </div >
    );
};
