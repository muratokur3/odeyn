import React, { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp, Plus, Ban, RefreshCw } from 'lucide-react';
import { Avatar } from './Avatar';
import { SelectedUserCard } from './SelectedUserCard'; // Import moved to top

import { searchUserByPhone, searchContacts, fetchLastUsedName } from '../services/db';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay } from '../utils/phoneUtils'; // Added import
import type { User, Contact, Installment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useContactSync } from '../hooks/useContactSync';
import { Toggle } from './Toggle';
import { Timestamp } from 'firebase/firestore';
import clsx from 'clsx';
import { ContactModal } from './ContactModal';

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
    const { user, blockedUsers } = useAuth();
    const { showAlert } = useModal();
    const { syncContacts, dismissSuggestion, userInfo, isSyncing, isSupported } = useContactSync();

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

    // Blocked check
    const [isTargetBlocked, setIsTargetBlocked] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [isResolvingInitial, setIsResolvingInitial] = useState(false);

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
                // Shadow/Optimistic User Case 
                // Whether it's a raw phone or a UID with a known name (Optimistic System User)
                setStep('DETAILS');
                setIsShadowUser(true); // Treat as shadow until resolved
                setFoundContact(null);
                setFoundUser(null);
            } else if (initialPhoneNumber && initialPhoneNumber.length > 20) {
                // UID provided but no user object and NO name yet.
                // Must resolve before showing UI to avoid empty card.
                setIsResolvingInitial(true);
                setStep('SEARCH');
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

    // Check blocked status whenever foundUser or foundContact changes
    useEffect(() => {
        let targetUid = '';
        if (foundUser) {
            targetUid = foundUser.uid;
        } else if (foundContact && foundContact.linkedUserId) {
            targetUid = foundContact.linkedUserId;
        }

        if (targetUid && blockedUsers.some(b => b.blockedUid === targetUid)) {
            setIsTargetBlocked(true);
        } else {
            setIsTargetBlocked(false);
        }
    }, [foundUser, foundContact, blockedUsers]);

    // Fetch User by UID if initialPhoneNumber looks like a UID
    useEffect(() => {
        if (initialPhoneNumber && initialPhoneNumber.length > 20 && !targetUser && isOpen) {
            const fetchUser = async () => {
                // Only block UI if we don't have a name to show optimistically
                if (!borrowerName) {
                    setIsResolvingInitial(true);
                }

                try {
                    // We need to import getDoc and doc and db. Since they might not be imported yet, 
                    // I will assume they need to be imported or used from services/db if available, 
                    // or use the direct firebase import. 
                    // PersonDetail uses: import { doc, getDoc } from 'firebase/firestore'; import { db } from '../services/firebase';
                    // Let's use the same.
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../services/firebase');

                    const userDoc = await getDoc(doc(db, 'users', initialPhoneNumber));
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as User;
                        setFoundUser(userData);
                        setPhoneNumber(userData.primaryPhoneNumber || userData.phoneNumbers?.[0] || userData.phoneNumber || '');
                        setBorrowerName(userData.displayName || '');
                        setStep('DETAILS');
                        setIsShadowUser(false);
                    }
                } catch (e) {
                    console.error("Failed to fetch user by UID in Modal", e);
                } finally {
                    setIsResolvingInitial(false);
                }
            };
            fetchUser();
        }
    }, [initialPhoneNumber, targetUser, isOpen, borrowerName]); // Added borrowerName dep


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
                // Filter out blocked users if they are linked?
                // The requirements say: "Filter out users present in the blockedUsers collection. They should NOT appear in the autocomplete list"
                // However, contacts are local. Linked users are the issue.
                // We should probably show them but marked as blocked?
                // "Filter out users present in the blockedUsers collection" implies strict filtering from the list.
                // Let's filter linked blocked users from the list if possible, or mark them.
                // But let's follow the requirement: Filter OUT.

                const filteredContacts = contacts.filter(c =>
                    !c.linkedUserId || !blockedUsers.some(b => b.blockedUid === c.linkedUserId)
                );

                setSearchResults(filteredContacts);

                // 2. Search System Users (only if full phone number)
                if (phoneNumber.length >= 10) {
                    const sysUser = await searchUserByPhone(phoneNumber);
                    if (sysUser && sysUser.uid !== user.uid) {
                        // Check if blocked
                        if (blockedUsers.some(b => b.blockedUid === sysUser.uid)) {
                            setFoundUser(null); // Don't show blocked system users
                        } else {
                            setFoundUser(sysUser);
                        }
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
    }, [phoneNumber, user, targetUser, blockedUsers]);

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

    const handleSelectNewNumber = (rawPhone: string) => {
        setPhoneNumber(rawPhone);
        setShowContactModal(true);
    };

    const handleContactCreated = (contact: Contact) => {
        setFoundContact(contact);
        setPhoneNumber(contact.phoneNumber);
        setBorrowerName(contact.name);
        setSearchResults([]);
        setFoundUser(null);
        setStep('DETAILS');
        setIsShadowUser(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Final Block Check before submission
        if (isTargetBlocked) {
            showAlert("Engellendi", "Engellediğiniz bir kullanıcıya işlem yapamazsınız.", "error");
            return;
        }

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
            finalBorrowerName = borrowerName || foundContact.name;
        } else if (foundUser) {
            finalBorrowerId = foundUser.uid;
            finalBorrowerName = borrowerName || foundUser.displayName;
        }

        // Fallback: If name empty, use formatted phone or raw phone
        if (!finalBorrowerName) {
            finalBorrowerName = formatPhoneForDisplay(finalBorrowerId);
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
            if (error instanceof Error) {
                if (error.message.includes("blocked")) {
                    showAlert("İşlem Başarısız", "Bu kullanıcı gizlilik ayarları nedeniyle işlem kabul etmiyor.", "error");
                } else {
                    showAlert("Hata", "İşlem kaydedilirken bir hata oluştu.", "error");
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200 h-auto max-h-[90dvh] flex flex-col border border-slate-700">
                <div className="flex justify-between items-center p-6 pb-2 flex-none">
                    <h2 className="text-xl font-bold text-text-primary">Yeni İşlem Ekle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {/* Blocked Warning */}
                    {isTargetBlocked && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                            <Ban className="text-red-600" size={18} />
                            <p className="text-sm text-red-700 dark:text-red-300 font-medium">Bu kullanıcı engellendiği için işlem yapılamaz.</p>
                        </div>
                    )}

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


                        {/* Sync Banner */}
                        {step === 'SEARCH' && isSupported && !userInfo?.settings?.contactSyncEnabled && !userInfo?.settings?.suppressSyncSuggestion && (
                            <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full text-indigo-600 dark:text-indigo-400">
                                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                                    </div>
                                    <p className="text-sm text-indigo-900 dark:text-indigo-200 font-medium">
                                        Arkadaşlarını kolayca bulmak için rehberini eşle.
                                    </p>
                                </div>
                                <div className="flex gap-2 pl-9">
                                    <button
                                        type="button"
                                        onClick={syncContacts}
                                        disabled={isSyncing}
                                        className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSyncing ? 'Eşleniyor...' : 'Eşle'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={dismissSuggestion}
                                        disabled={isSyncing}
                                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 px-2 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 rounded-lg transition-colors"
                                    >
                                        Bir Daha Sorma
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Flow Control */}
                        {isResolvingInitial ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="text-sm text-text-secondary">Kullanıcı aranıyor...</p>
                            </div>
                        ) : step === 'DETAILS' ? (
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
                                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                    placeholder="İsim veya Telefon Ara..."
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


                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Tutar</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min={0}
                                    step="0.01"
                                    disabled={isTargetBlocked}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="w-1/3">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Para Birimi</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    disabled={isTargetBlocked}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                disabled={isTargetBlocked}
                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Borç ile ilgili not..."
                            />
                        </div>


                        {/* Expandable Details */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowDetails(!showDetails)}
                                disabled={isTargetBlocked}
                                className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors w-full justify-center py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div className="p-4 border-t border-slate-800 bg-surface rounded-b-2xl flex-none z-10 w-full">
                    <button
                        type="submit"
                        form="create-debt-form"
                        disabled={loading || !amount || (!foundUser && !foundContact && !borrowerName) || isTargetBlocked}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {loading ? 'İşleniyor...' : 'Kaydet'}
                    </button>
                </div>
            </div >

            <ContactModal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                initialPhone={phoneNumber}
                onSuccess={handleContactCreated}
                checkDuplicates={false} // Already checked in search, plus we want flow 
            />
        </div >
    );
};
