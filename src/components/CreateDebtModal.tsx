import React, { useState, useEffect } from 'react';
import { X, FileText, ChevronDown, ChevronUp, Search, Ban, RefreshCw, AlertTriangle, Calendar } from 'lucide-react';
import { Avatar } from './Avatar';
import { SelectedUserCard } from './SelectedUserCard';

import { searchUserByPhone, searchContacts, createDebt, updateDebtHardReset } from '../services/db';
import { getOrCreateLedger, addLedgerTransaction } from '../services/transactionService';
import { formatCurrency, formatAmountToWords, safeParseFloat, CURRENCIES } from '../utils/format';
import { formatPhoneForDisplay, cleanPhone } from '../utils/phoneUtils';
import type { User, Contact, Installment, Debt, GoldDetail } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useContactSync } from '../hooks/useContactSync';
import { Toggle } from './Toggle';
import { AmountInput } from './AmountInput';
import { Timestamp } from 'firebase/firestore';
import clsx from 'clsx';
import { useModal } from '../hooks/useModal';
import { GOLD_TYPES, GOLD_CATEGORIES, SILVER_CATEGORIES, BILEZIK_MODELS, TAKI_TYPES, GOLD_CARATS, getGoldType } from '../utils/goldConstants';
import { MetalSelectionFields } from './MetalSelectionFields';

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
            ? (targetUser.phoneNumber || '')
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

    // New Fields
    const [type, setType] = useState<'LENDING' | 'BORROWING'>('LENDING');
    const [currency, setCurrency] = useState('TRY');

    // Gold State
    const [goldCategory, setGoldCategory] = useState<string>('GRAM');
    const [goldTypeId, setGoldTypeId] = useState<string>('GRAM_24');
    const [goldSubType, setGoldSubType] = useState<string>('');
    const [goldWeightPerUnit, setGoldWeightPerUnit] = useState<string>('');
    const [goldCustomCarat, setGoldCustomCarat] = useState<number>(22);

    // Sync Metal Type ID
    useEffect(() => {
        if (currency === 'GOLD' && (goldCategory === 'BILEZIK' || goldCategory === 'TAKI')) {
            const model = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType);
            const effectiveCarat = model?.fixedCarat || goldCustomCarat;
            const targetType = `${goldCategory}_${effectiveCarat}`;
            if (GOLD_TYPES.some(t => t.id === targetType)) {
                setGoldTypeId(targetType);
            } else {
                setGoldTypeId(`${goldCategory}_22`); // Fallback
            }
        } else if (currency === 'SILVER') {
            // Silver currently only has one category but let's be safe
            if (goldCategory === 'SILVER') {
                // Default to 999 for silver if not set
                if (!goldTypeId.startsWith('SILVER_')) {
                    setGoldTypeId('SILVER_999');
                }
            }
        }
    }, [currency, goldCategory, goldSubType, goldCustomCarat, goldTypeId]);

    const [note, setNote] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [canBorrowerAddPayment, setCanBorrowerAddPayment] = useState(true);

    // Installment State
    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentCount, setInstallmentCount] = useState(1);
    const [downPayment, setDownPayment] = useState('');

    // Custom Rate
    const [manualRate, setManualRate] = useState('');
    const [useManualRate, setUseManualRate] = useState(false);

    // Blocked check
    const [isTargetBlocked, setIsTargetBlocked] = useState(false);
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

                // Gold prefill
                if (initialData.currency === 'GOLD' && initialData.goldDetail) {
                    const type = getGoldType(initialData.goldDetail.type);
                    if (type) {
                        setGoldCategory(type.category);
                    }
                    setGoldTypeId(initialData.goldDetail.type);
                    setGoldSubType(initialData.goldDetail.subTypeLabel || '');
                    setGoldWeightPerUnit(initialData.goldDetail.weightPerUnit?.toString() || '');
                    setGoldCustomCarat(initialData.goldDetail.carat || 22);
                }

                // If targetId is a UID (User) and we don't have a locked phone, fetch accurate phone from User Profile
                if (!initialData.lockedPhoneNumber && targetId.length > 20) {
                     (async () => {
                         try {
                             const { doc, getDoc } = await import('firebase/firestore');
                             const { db } = await import('../services/firebase');
                             const snap = await getDoc(doc(db, 'users', targetId));
                             if (snap.exists()) {
                                 const u = snap.data() as User;
                                 const realPhone = u.phoneNumber || '';
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
                setCanBorrowerAddPayment(!!initialData.canBorrowerAddPayment);

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


                if (isSpecialDebt || initialData.installments || initialData.dueDate) {
                     setShowDetails(true);
                }

                return;
            }

            // CREATE MODE INITIALIZATION
            setPhoneNumber(initialPhone);
            setBorrowerName(derivedInitialName);
            setShowDetails(false); // Hide details by default for a cleaner UI

            if (targetUser) {
                setStep('DETAILS');
                if ('uid' in targetUser) {
                    setFoundUser(targetUser as User);
                    setFoundContact(null);
                } else {
                    setFoundContact(targetUser as Contact);
                    setFoundUser(null);
                }
            } else if (initialPhoneNumber && initialPhoneNumber.length > 20) {
                // UID provided but no user object and NO name yet.
                setIsResolvingInitial(true);
                setStep('SEARCH');
            } else {
                setStep('SEARCH');
            }

            if (user?.preferences?.defaultAllowPaymentAddition !== undefined) {
                setCanBorrowerAddPayment(user.preferences.defaultAllowPaymentAddition);
            } else {
                setCanBorrowerAddPayment(true);
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
            setCanBorrowerAddPayment(true);
            setDownPayment('');
            setStep('SEARCH');
            setIsResolvingInitial(false);
        }
    }, [isOpen, editMode, initialData]); // 🎯 Optimized: Only re-run when modal opens or edit data changes

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
                        setPhoneNumber(userData.phoneNumber || '');
                        setBorrowerName(userData.displayName || '');
                        setStep('DETAILS');
                        setIsResolvingInitial(false);
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
    };

    const handleSelectUser = (sysUser: User) => {
        setFoundUser(sysUser);
        setPhoneNumber(sysUser.phoneNumber || '');
        setBorrowerName(sysUser.displayName || '');
        setSearchResults([]);
        setFoundContact(null);
        setStep('DETAILS');
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Prevent Self-Debt
        if ((foundUser && foundUser.uid === user.uid) || cleanPhone(phoneNumber) === cleanPhone(user.phoneNumber || '')) {
            showAlert("Hata", "Kendinize borç ekleyemezsiniz.", "error");
            return;
        }

        if (isTargetBlocked) {
            showAlert("Engellendi", "Engellediğiniz bir kullanıcıya işlem yapamazsınız.", "error");
            return;
        }

        const numAmount = safeParseFloat(amount) || 0;
        const numDownPayment = safeParseFloat(downPayment) || 0;
        const customRate = useManualRate ? safeParseFloat(manualRate) : undefined;

        if (numAmount <= 0) {
            showAlert("Hata", "Lütfen geçerli bir tutar girin.", "error");
            return;
        }
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

        // Resolve phone to UID if necessary (for unregistered users)
        if (finalBorrowerId.length < 20) {
            try {
                const { resolvePhoneToUid } = await import('../services/identity');
                const resolved = await resolvePhoneToUid(finalBorrowerId);
                if (resolved) {
                    finalBorrowerId = resolved;
                }
                // If not resolved, it stays as phone number (shadow user - will be claimed later)
            } catch (error) {
                console.error('Failed to resolve phone to UID:', error);
            }
        }

        setLoading(true);
        try {
            let goldDetail: Debt['goldDetail'] | undefined;
            if (currency === 'GOLD' || currency === 'SILVER') {
                const typeData = getGoldType(goldTypeId);
                const selectedModel = (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType);

                goldDetail = {
                    type: goldTypeId,
                    label: typeData?.label || goldTypeId,
                    ...(goldSubType && { subTypeLabel: goldSubType }),
                    carat: selectedModel?.fixedCarat || (typeData?.fixedCarat ? typeData.defaultCarat : goldCustomCarat),
                    ...(goldWeightPerUnit && { weightPerUnit: safeParseFloat(goldWeightPerUnit) }),
                };
            }

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
                await updateDebtHardReset(
                    initialData.id,
                    user.uid,
                    {
                        originalAmount: numAmount,
                        currency,
                        note,
                        goldDetail,
                        customExchangeRate: customRate,
                        ...(dueDate ? { dueDate: Timestamp.fromDate(new Date(dueDate)) } : { dueDate: undefined }),
                        ...(generatedInstallments ? { installments: generatedInstallments } : { installments: undefined }),
                        canBorrowerAddPayment,
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
                    numDownPayment,
                    goldDetail,
                    customRate
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
                    currency,
                    goldDetail,
                    customRate
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className={clsx(
                "bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200 h-auto max-h-[90dvh] flex flex-col border-2 border-slate-700 transition-all shadow-lg"
            )}>
                <div className="flex justify-between items-center p-6 pb-2 flex-none rounded-t-2xl">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                        {editMode ? (
                            <>
                            <FileText size={24} className="text-orange-500" />
                            Kaydı Düzenle
                            </>
                        ) : (
                            <>
                             <FileText size={24} className="text-blue-600 dark:text-blue-400" />
                             Borç Ekle
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {/* Contact Sync Suggestion */}
                    {isSupported && !userInfo?.settings?.lastSyncAt && !editMode && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                    <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-blue-900 dark:text-blue-100">Rehberini Bağla</p>
                                    <p className="text-[10px] text-blue-700 dark:text-blue-300">Arkadaşlarını daha kolay bulabilirsin.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => syncContacts()}
                                disabled={isSyncing}
                                className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
                            >
                                {isSyncing ? 'Bağlanıyor...' : 'Şimdi Bağla'}
                            </button>
                        </div>
                    )}

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


                        {/* Flow Control */}
                        {isResolvingInitial ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="text-sm text-text-secondary">Kullanıcı aranıyor...</p>
                            </div>
                        ) : step === 'DETAILS' ? (
                            <SelectedUserCard
                                name={foundContact?.name || foundUser?.displayName || ''}
                                phoneNumber={phoneNumber}
                                status={foundContact ? 'contact' : (foundUser ? 'system' : 'none')}
                                uid={foundUser ? foundUser.uid : foundContact?.linkedUserId}
                                onClear={editMode ? () => {} : () => { // Provide empty function for editMode
                                    setFoundContact(null);
                                    setFoundUser(null);
                                    setPhoneNumber('');
                                    setBorrowerName('');
                                    setStep('SEARCH');
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
                                        {/* Contacts (from Rehber) */}
                                        {searchResults.map(contact => (
                                            <div
                                                key={contact.id}
                                                onClick={() => handleSelectContact(contact)}
                                                className="p-3 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer flex items-center justify-between border-b border-gray-50 dark:border-slate-800 last:border-0 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={contact.name}
                                                        size="sm"
                                                        status="contact"
                                                        uid={contact.linkedUserId}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-bold text-text-primary group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{contact.name}</p>
                                                        <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wider font-bold">Rehberimde</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-text-secondary">{formatPhoneForDisplay(contact.phoneNumber)}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* System User Match (Not in Rehber) */}
                                        {foundUser && !searchResults.some(c => c.phoneNumber === (foundUser as User).phoneNumber) && (
                                            <div
                                                onClick={() => handleSelectUser(foundUser as User)}
                                                className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer flex items-center justify-between border-t border-gray-100 dark:border-slate-800 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={(foundUser as User).displayName || ''}
                                                        photoURL={(foundUser as User).photoURL || undefined}
                                                        size="sm"
                                                        status="system"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-bold text-text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{(foundUser as User).displayName}</p>
                                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold">DebtDert Kullanıcısı</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-text-secondary">{formatPhoneForDisplay((foundUser as User).phoneNumber || '')}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* No dynamic creation anymore */}
                                        {searchResults.length === 0 && !foundUser && phoneNumber.length > 0 && (
                                            <div className="p-4 text-center text-text-secondary text-sm">
                                                Sonuç bulunamadı. Lütfen rehberinize ekleyin veya geçerli bir numara/isim girin.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}


                        <div className="space-y-1">
                        <div className="flex items-start gap-4 w-full">
                            <div className="flex-[2] min-w-0">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Döviz</label>
                                <select
                                    value={currency}
                                    onChange={(e) => {
                                        const newCurr = e.target.value;
                                        setCurrency(newCurr);
                                        if (newCurr === 'SILVER') {
                                            setGoldCategory('SILVER');
                                            setGoldTypeId('SILVER_999');
                                        } else if (newCurr === 'GOLD') {
                                            setGoldCategory('GRAM');
                                            setGoldTypeId('GRAM_24');
                                        }
                                    }}
                                    disabled={isTargetBlocked}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed h-[46px]"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-[3] min-w-0">
                                <AmountInput
                                    label={currency === 'GOLD' ? (getGoldType(goldTypeId)?.category === 'GRAM' ? 'Gram' : 'Adet') : 'Tutar'}
                                    value={amount}
                                    onChange={setAmount}
                                    disabled={isTargetBlocked}
                                    required
                                    allowDecimals={currency === 'SILVER' || (currency === 'GOLD' && getGoldType(goldTypeId)?.category === 'GRAM')}
                                    hideCommaSuffix={currency === 'GOLD' && getGoldType(goldTypeId)?.category !== 'GRAM'}
                                />
                            </div>
                        </div>

                            {/* Metal Sub-selection */}
                            {(currency === 'GOLD' || currency === 'SILVER') && (
                                <MetalSelectionFields
                                    metal={currency as 'GOLD' | 'SILVER'}
                                    goldCategory={goldCategory}
                                    setGoldCategory={setGoldCategory}
                                    goldTypeId={goldTypeId}
                                    setGoldTypeId={setGoldTypeId}
                                    goldSubType={goldSubType}
                                    setGoldSubType={setGoldSubType}
                                    goldWeightPerUnit={goldWeightPerUnit}
                                    setGoldWeightPerUnit={setGoldWeightPerUnit}
                                    goldCustomCarat={goldCustomCarat}
                                    setGoldCustomCarat={setGoldCustomCarat}
                                />
                            )}
                            {amount && (
                                <p className="text-[10px] text-text-secondary italic text-left animate-in fade-in slide-in-from-top-1 px-1 mt-0.5">
                                    {formatAmountToWords(amount, currency, (currency === 'GOLD' || currency === 'SILVER') ? {
                                        type: goldTypeId,
                                        label: getGoldType(goldTypeId)?.label || '',
                                        subTypeLabel: goldSubType,
                                        weightPerUnit: safeParseFloat(goldWeightPerUnit),
                                        carat: (goldCategory === 'BILEZIK' ? BILEZIK_MODELS : TAKI_TYPES).find(m => m.id === goldSubType)?.fixedCarat || (getGoldType(goldTypeId)?.fixedCarat ? getGoldType(goldTypeId)?.defaultCarat : goldCustomCarat)
                                    } : undefined)}
                                </p>
                            )}
                        </div>

                        {/* Custom Rate Input */}
                        {currency !== 'TRY' && (
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800 animate-in fade-in transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-orange-700 dark:text-orange-300">Özel Kur Kullan</label>
                                    <Toggle 
                                        checked={useManualRate} 
                                        onChange={setUseManualRate}
                                    />
                                </div>
                                {useManualRate && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-text-secondary">
                                            1 {(currency === 'GOLD' || currency === 'SILVER') ? (getGoldType(goldTypeId)?.label || (currency === 'GOLD' ? 'Altın' : 'Gümüş')) : currency} =
                                        </span>
                                        <input
                                            type="number"
                                            value={manualRate}
                                            onChange={(e) => setManualRate(e.target.value)}
                                            step="0.01"
                                            className="flex-1 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-800 text-sm font-bold text-text-primary outline-none focus:ring-1 focus:ring-orange-500"
                                            placeholder="Örn: 34.50"
                                        />
                                        <span className="text-sm text-text-secondary">TRY</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Note */}
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
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Calendar size={18} className="text-gray-400" />
                                                </div>
                                                <input
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={(e) => setDueDate(e.target.value)}
                                                    disabled={isTargetBlocked}
                                                    placeholder="GG.AA.YYYY"
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
                                                />
                                            </div>
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
                                                    if (val) {
                                                        setInstallmentCount(2);
                                                        // Set default due date to 1 month from now
                                                        const date = new Date();
                                                        date.setMonth(date.getMonth() + 1);
                                                        setDueDate(date.toISOString().split('T')[0]);
                                                    } else {
                                                        setInstallmentCount(1);
                                                    }
                                                }}
                                                label=""
                                            />
                                        </div>

                                        {isInstallment && (
                                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                {/* Down Payment */}
                                                <AmountInput
                                                    label="Peşinat (Opsiyonel)"
                                                    value={downPayment}
                                                    onChange={setDownPayment}
                                                    className="!py-2 !text-sm"
                                                />

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
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                                                <Calendar size={14} className="text-gray-400" />
                                                            </div>
                                                            <input
                                                                type="date"
                                                                value={dueDate}
                                                                onChange={(e) => setDueDate(e.target.value)}
                                                                placeholder="GG.AA.YYYY"
                                                                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-600 bg-surface/50 text-text-primary text-base font-semibold focus:border-primary outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                    <p className="text-xs text-blue-800 dark:text-blue-200 flex justify-between">
                                                        <span>Kalan Tutar:</span>
                                                        <span className="font-bold">{formatCurrency((safeParseFloat(amount) || 0) - (safeParseFloat(downPayment) || 0), currency)}</span>
                                                    </p>
                                                    <p className="text-xs text-blue-800 dark:text-blue-200 flex justify-between mt-1">
                                                        <span>Aylık Taksit:</span>
                                                        <span className="font-bold">{formatCurrency(((safeParseFloat(amount) || 0) - (safeParseFloat(downPayment) || 0)) / installmentCount || 0, currency)}</span>
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
                                            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                                {borrowerName || 'Karşı taraf'} bu borç üzerinde ekleme veya ödeme girişi yapabilsin
                                            </span>
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

        </div >
    );
};
