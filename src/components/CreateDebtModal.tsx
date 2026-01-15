import React, { useState, useEffect } from 'react';
import { X, FileText, ChevronDown, ChevronUp, Plus, Search, Ban, RefreshCw, MessageCircle, AlertTriangle } from 'lucide-react';
import { Avatar } from './Avatar';
import { SelectedUserCard } from './SelectedUserCard';

import { searchUserByPhone, searchContacts, createDebt, updateDebtHardReset } from '../services/db';
import { getOrCreateLedger, addLedgerTransaction } from '../services/transactionService';
import { formatCurrency } from '../utils/format';
import { formatPhoneForDisplay } from '../utils/phoneUtils';
import type { User, Contact, Installment, Debt } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useContactSync } from '../hooks/useContactSync';
import { Toggle } from './Toggle';
import { Timestamp } from 'firebase/firestore';
import clsx from 'clsx';
import { ContactModal } from './ContactModal';
import { useModal } from '../context/ModalContext';

interface CreateDebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    // onSubmit is effectively replaced by logic inside but kept for signature compatibility if needed
    onSubmit?: (
        borrowerId: string,
        borrowerName: string,
        amount: number,
        type: 'LENDING' | 'BORROWING',
        currency: string,
        note?: string,
        dueDate?: Date,
        installments?: Installment[],
        canBorrowerAddPayment?: boolean,
        initialPayment?: number
    ) => Promise<void>;
    initialPhoneNumber?: string;
    targetUser?: User | Contact | null;
    initialName?: string;
    // New Props for Editing
    editMode?: boolean;
    initialData?: Debt;
}

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({
    isOpen,
    onClose,
    // onSubmit, // Removed unused variable
    initialPhoneNumber,
    targetUser,
    initialName: propInitialName,
    editMode = false,
    initialData
}) => {
    const { user, blockedUsers } = useAuth();
    const { showAlert } = useModal();
    const { syncContacts, dismissSuggestion, userInfo, isSyncing, isSupported } = useContactSync();

    // Derived state for initialization
    const derivedInitialName = targetUser
        ? ('displayName' in targetUser ? targetUser.displayName : targetUser.name)
        : (propInitialName || '');

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

    // Special Debt Logic: If ANY complex field is used, it's a "File" (Debt), otherwise "Stream" (Transaction)
    const isSpecialDebt = isInstallment || (dueDate && dueDate.length > 0) || (showDetails && (canBorrowerAddPayment));

    // Reset/Init when opening
    useEffect(() => {
        if (isOpen) {
            // EDIT MODE INITIALIZATION
            if (editMode && initialData) {
                // Determine Counterparty Name/Phone
                // If I am the creator, I look at the other person.
                const amILender = initialData.lenderId === user?.uid;
                // If I am lender, target is Borrower.
                const targetId = amILender ? initialData.borrowerId : initialData.lenderId;
                const targetName = amILender ? initialData.borrowerName : initialData.lenderName;

                // Determine Type
                // If I created it:
                // If I am Lender -> 'LENDING' (Asset)
                // If I am Borrower -> 'BORROWING' (Liability)
                // Wait, type is perspective based.
                // If I created it, and I am Lender -> I lent money.
                const newType = initialData.lenderId === initialData.createdBy ? 'LENDING' : 'BORROWING';

                setType(newType);
                setAmount(initialData.originalAmount.toString());
                setCurrency(initialData.currency);
                setNote(initialData.note || '');
                setPhoneNumber(initialData.lockedPhoneNumber || targetId); // Use locked phone if available
                setBorrowerName(targetName);

                // If targetId is a UID (User) and we don't have a locked phone, fetch accurate phone from User Profile
                if (!initialData.lockedPhoneNumber && targetId.length > 20) {
                     (async () => {
                         try {
                             const { doc, getDoc } = await import('firebase/firestore');
                             const { db } = await import('../services/firebase');
                             const snap = await getDoc(doc(db, 'users', targetId));
                             if (snap.exists()) {
                                 const u = snap.data() as User;
                                 const realPhone = u.primaryPhoneNumber || u.phoneNumber || '';
                                 if (realPhone) {
                                     setPhoneNumber(realPhone);
                                 }
                                 setFoundUser(u);
                             }
                         } catch (e) {
                             console.error("Failed to fetch user in Edit Mode", e);
                         }
                     })();
                }

                // Details
                if (initialData.dueDate) {
                    setDueDate(initialData.dueDate.toDate().toISOString().split('T')[0]);
                }
                if (initialData.canBorrowerAddPayment) {
                    setCanBorrowerAddPayment(true);
                }

                // Installments
                if (initialData.installments && initialData.installments.length > 0) {
                    setIsInstallment(true);
                    setInstallmentCount(initialData.installments.length);
                    // Try to guess down payment? Or leave empty?
                    // Recalculation logic will overwrite anyway.
                    // Let's assume user re-enters or we just don't prefill down payment for edit?
                    // "Sanki yeniden oluşturulmuş gibi" -> User modifies parameters.
                }

                setStep('DETAILS');

                // Resolving User/Contact Object for display card?
                // We have names, so we can set shadow user state or try to resolve.
                // Let's assume shadow for speed unless targetUser prop was passed.
                if (!targetUser) {
                    setIsShadowUser(true);
                }

                if (isSpecialDebt || initialData.installments || initialData.dueDate) {
                     setShowDetails(true);
                }

                return;
            }

            // CREATE MODE INITIALIZATION
            setPhoneNumber(initialPhone);
            setBorrowerName(derivedInitialName);

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
                setStep('DETAILS');
                setIsShadowUser(true);
                setFoundContact(null);
                setFoundUser(null);
            } else if (initialPhoneNumber && initialPhoneNumber.length > 20) {
                // UID provided but no user object and NO name yet.
                setIsResolvingInitial(true);
                setStep('SEARCH');
            } else {
                setStep('SEARCH');
                setIsShadowUser(false);
            }

            if (user?.preferences?.defaultAllowPaymentAddition) {
                setCanBorrowerAddPayment(true);
            } else {
                setCanBorrowerAddPayment(false);
            }
            setDownPayment('');
        } else {
            // Reset when closed
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
            setDownPayment('');
            setStep('SEARCH');
            setIsResolvingInitial(false);
        }
    }, [isOpen, initialPhoneNumber, targetUser, user, propInitialName, editMode, initialData, derivedInitialName, initialPhone, isSpecialDebt]);

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
        if (initialPhoneNumber && initialPhoneNumber.length > 20 && !targetUser && isOpen && !editMode) {
            const fetchUser = async () => {
                if (!borrowerName) {
                    setIsResolvingInitial(true);
                }

                try {
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
    }, [initialPhoneNumber, targetUser, isOpen, borrowerName, editMode]);

    // Search Effect - Disable if NOT in SEARCH step
    useEffect(() => {
        if (step !== 'SEARCH' || editMode) return;

        const search = async () => {
            if (!user || !phoneNumber || phoneNumber.length < 3) {
                setSearchResults([]);
                setFoundUser(null);
                return;
            }

            try {
                const contacts = await searchContacts(user.uid, phoneNumber);
                const filteredContacts = contacts.filter(c =>
                    !c.linkedUserId || !blockedUsers.some(b => b.blockedUid === c.linkedUserId)
                );
                setSearchResults(filteredContacts);

                if (phoneNumber.length >= 10) {
                    const sysUser = await searchUserByPhone(phoneNumber);
                    if (sysUser && sysUser.uid !== user.uid) {
                        if (blockedUsers.some(b => b.blockedUid === sysUser.uid)) {
                            setFoundUser(null);
                        } else {
                            setFoundUser(sysUser);
                        }
                    } else {
                        setFoundUser(null);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        };

        const timeoutId = setTimeout(search, 500);
        return () => clearTimeout(timeoutId);
    }, [phoneNumber, user, targetUser, blockedUsers, step, editMode]);

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

        let finalBorrowerId: string = phoneNumber || '';
        let finalBorrowerName = borrowerName;

        if (foundContact) {
            finalBorrowerId = foundContact.linkedUserId || foundContact.phoneNumber;
            finalBorrowerName = borrowerName || foundContact.name;
        } else if (foundUser) {
            finalBorrowerId = foundUser.uid;
            finalBorrowerName = borrowerName || foundUser.displayName;
        }

        if (!finalBorrowerName) {
            finalBorrowerName = formatPhoneForDisplay(finalBorrowerId);
        }

        setLoading(true);
        try {
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

            // --- EDIT MODE LOGIC ---
            if (editMode && initialData) {
                // For editing, we reuse the existing participants from initialData usually.
                // But we allow updating note, amount, installments.
                // We do NOT allow changing the person for now (complex validation),
                // but if we did, we'd need to re-validate block status etc.
                // We assume person is same.

                // Construct Update Object
                // If it's becoming a transaction (Stream) vs File (Debt)
                // "Hard Reset" treats everything as a Debt Document Update.
                // Even simple transactions are stored as Debt docs in this architecture
                // (except Ledger specialized ones? No, createDebt covers both usually if we look at db.ts?
                // Ah, createDebt creates a debt doc. Ledger is different service?
                // The existing code has `getOrCreateLedger`...
                // If the original item was a Ledger Transaction, `initialData` probably won't be a `Debt` object?
                // Or we unify them.
                // If initialData is passed, it implies it's a Debt object (from Firestore 'debts').

                await updateDebtHardReset(
                    initialData.id,
                    user.uid,
                    {
                        originalAmount: numAmount,
                        currency,
                        note,
                        ...(dueDate ? { dueDate: Timestamp.fromDate(new Date(dueDate)) } : { dueDate: undefined }),
                        ...(generatedInstallments ? { installments: generatedInstallments } : { installments: undefined }),
                        canBorrowerAddPayment,
                        // Update status logic handled in service based on remaining
                    },
                    numDownPayment
                );

                onClose();
                setLoading(false);
                return;
            }

            // --- CREATE MODE LOGIC ---

            if (isSpecialDebt) {
                // SPECIAL DEBT (Complex) -> Uses standard Debt collection
                await createDebt(
                    user.uid,
                    user.displayName || 'İsimsiz',
                    finalBorrowerId,
                    finalBorrowerName,
                    numAmount,
                    type,
                    currency,
                    note,
                    dueDate ? new Date(dueDate) : undefined,
                    generatedInstallments,
                    canBorrowerAddPayment,
                    numDownPayment
                );
            } else {
                // NORMAL FLOW (Ledger Transaction) -> Uses Ledger system
                const ledgerId = await getOrCreateLedger(
                    user.uid,
                    user.displayName || 'İsimsiz',
                    finalBorrowerId,
                    finalBorrowerName
                );

                const direction = type === 'LENDING' ? 'OUTGOING' : 'INCOMING';

                await addLedgerTransaction(
                    ledgerId,
                    user.uid,
                    numAmount,
                    direction,
                    note,
                    currency
                );
            }

            onClose();

        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                if (error.message.includes("blocked")) {
                    showAlert("İşlem Başarısız", "Bu kullanıcı gizlilik ayarları nedeniyle işlem kabul etmiyor.", "error");
                } else if (error.message.includes("1 saat")) {
                    showAlert("Süre Doldu", error.message, "error");
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
            <div className={clsx(
                "rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200 h-auto max-h-[90dvh] flex flex-col border-2 transition-all",
                isSpecialDebt 
                    ? "bg-surface border-dashed border-purple-500 shadow-purple-500/10"
                    : "bg-surface border-solid border-slate-700 shadow-lg"
            )}>
                <div className={clsx(
                    "flex justify-between items-center p-6 pb-2 flex-none rounded-t-2xl transition-colors",
                    isSpecialDebt ? "bg-purple-500/5" : ""
                )}>
                    <h2 className={clsx(
                        "text-xl font-bold flex items-center gap-2",
                        isSpecialDebt ? "text-purple-600 dark:text-purple-300" : "text-text-primary"
                    )}>
                        {editMode ? (
                            <>
                            <FileText size={24} className="text-orange-500" />
                            Kaydı Düzenle
                            </>
                        ) : (
                            <>
                            {isSpecialDebt ? <FileText size={24} className="text-purple-600 dark:text-purple-400" /> : <MessageCircle size={24} className="text-blue-600 dark:text-blue-400" />}
                            {isSpecialDebt ? 'Özel Borç Ekle' : 'Hızlı Akış Ekle'}
                            </>
                        )}
                    </h2>
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

                    {/* Hard Reset Warning */}
                    {editMode && (
                        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 flex items-start gap-2">
                             <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={16} />
                             <div className="text-xs text-orange-800 dark:text-orange-200">
                                 <span className="font-bold block mb-1">Dikkat: Sıfırdan Hesaplama</span>
                                 Bu işlem kaydı tamamen silip yeni bilgilerle tekrar oluşturur. Geçmiş ödemeler ve notlar silinecektir.
                             </div>
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
                                {editMode && type === 'LENDING' ? 'Vermiştim' : 'Veriyorum'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('BORROWING')}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                                    type === 'BORROWING' ? "bg-surface text-red-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                                )}
                            >
                                {editMode && type === 'BORROWING' ? 'Almıştım' : 'Alıyorum'}
                            </button>
                        </div>


                        {/* Sync Banner - Hide in Edit Mode */}
                        {!editMode && step === 'SEARCH' && isSupported && !userInfo?.settings?.contactSyncEnabled && !userInfo?.settings?.suppressSyncSuggestion && (
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
                                onClear={editMode ? () => {} : () => { // Provide empty function for editMode
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
                                placeholder="İşlem ile ilgili not..."
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
                                    <>Detay, Vade veya Taksit Ekle ▾ <ChevronDown size={16} /></>
                                )}
                            </button>

                            {showDetails && (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200 mt-2">
                                    {/* Due Date Field - Hidden when installments enabled */}
                                    {!isInstallment && (
                                        <div>
                                            <label className="block text-sm font-medium text-text-secondary mb-1">Vade Tarihi</label>
                                            <input
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                                disabled={isTargetBlocked}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    )}

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

                                    {/* Payment Permission Toggle (Only for Special Debt) */}
                                    {isSpecialDebt && (
                                        <div className={clsx(
                                            "flex items-center justify-between p-4 rounded-xl border animate-in fade-in slide-in-from-top-2",
                                            "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800"
                                        )}>
                                            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Karşı taraf ödeme ekleyebilsin</span>
                                            <Toggle
                                                checked={canBorrowerAddPayment}
                                                onChange={setCanBorrowerAddPayment}
                                                label=""
                                            />
                                        </div>
                                    )}

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
                        className={clsx(
                            "w-full py-3 rounded-xl font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg",
                            editMode
                                ? "bg-orange-600 text-white shadow-orange-500/20"
                                : isSpecialDebt
                                    ? "bg-purple-600 text-white shadow-purple-500/20"
                                    : "bg-primary text-white shadow-blue-500/20"
                        )}
                    >
                        {loading ? 'İşleniyor...' : (editMode ? 'Güncelle (Sıfırla)' : (isSpecialDebt ? 'Özel Borç Oluştur' : 'Akışa Ekle'))}
                    </button>
                </div>
            </div >

            <ContactModal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                initialPhone={phoneNumber}
                onSuccess={handleContactCreated}
                checkDuplicates={false}
            />
        </div >
    );
};
