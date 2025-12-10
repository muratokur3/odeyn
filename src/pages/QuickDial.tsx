import { useState, useEffect } from 'react';
import { Delete, UserPlus, Wallet, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { searchUserByPhone, searchContacts, createDebt } from '../services/db';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { Avatar } from '../components/Avatar';
import { clsx } from 'clsx';
import type { User, Contact } from '../types';

export const QuickDial = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [searchResults, setSearchResults] = useState<Contact[]>([]);
    const [foundUser, setFoundUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Derived: Current Search Match
    const activeMatch = searchResults[0] || foundUser;

    // Formatting Helper
    function formattedPhone(phone: string) {
        if (!phone) return '';
        return phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }

    // Card Display Data
    const displayData = {
        name: activeMatch
            ? (('name' in activeMatch) ? activeMatch.name : (activeMatch as User).displayName)
            : 'Yeni İşlem',
        subtext: activeMatch
            ? formattedPhone('phoneNumber' in activeMatch ? activeMatch.phoneNumber : (activeMatch as User).phoneNumber)
            : 'Rehberde Kayıtlı Değil',
        isMatch: !!activeMatch,
        type: activeMatch
            ? (('name' in activeMatch) ? 'Rehberde' : 'Sistemde')
            : 'Bilinmeyen'
    };

    const handleNumberClick = (num: string) => {
        if (phoneNumber.length < 15) {
            setPhoneNumber(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    // Smart Search Logic
    useEffect(() => {
        const search = async () => {
            if (!user || phoneNumber.length < 3) {
                setSearchResults([]);
                setFoundUser(null);
                return;
            }

            try {
                // 1. Search Contacts
                const contacts = await searchContacts(user.uid, phoneNumber);
                setSearchResults(contacts);

                // 2. Search Global User (only if full phone number)
                if (phoneNumber.replace(/\D/g, '').length >= 10) {
                    const globalUser = await searchUserByPhone(phoneNumber);
                    if (globalUser && globalUser.uid !== user.uid) {
                        setFoundUser(globalUser);
                    } else {
                        setFoundUser(null);
                    }
                } else {
                    setFoundUser(null);
                }
            } catch (error) {
                console.error(error);
            }
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [phoneNumber, user?.uid]);


    const handleCardClick = () => {
        if (!phoneNumber) return;
        setShowCreateModal(true);
    };

    const handleAddToContacts = () => {
        navigate('/contacts', { state: { initialPhone: phoneNumber } });
    };

    const handleCreateDebtSubmit = async (
        borrowerId: string,
        borrowerName: string,
        amount: number,
        type: 'LENDING' | 'BORROWING',
        currency: string,
        note?: string,
        dueDate?: Date,
        installments?: any[],
        canBorrowerAddPayment?: boolean,
        requestApproval?: boolean,
        initialPayment?: number
    ) => {
        if (!user) return;
        await createDebt(
            user.uid,
            user.displayName || 'Bilinmeyen',
            borrowerId,
            borrowerName,
            amount,
            type,
            currency,
            note,
            dueDate,
            installments,
            canBorrowerAddPayment,
            requestApproval,
            initialPayment || 0
        );
        setShowCreateModal(false);
        setPhoneNumber('');
    };

    const KeypadButton = ({ num, sub, onClick, className, destructive }: { num: React.ReactNode, sub?: string, onClick?: () => void, className?: string, destructive?: boolean }) => (
        <button
            onClick={onClick || (() => typeof num === 'string' && handleNumberClick(num))}
            className={clsx(
                "w-full h-16 sm:h-20 rounded-2xl transition-all active:scale-95 flex flex-col items-center justify-center select-none shadow-sm",
                destructive
                    ? "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-500 border border-transparent"
                    : (className || "bg-surface hover:bg-gray-100 dark:hover:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600 border border-slate-200 dark:border-slate-800")
            )}
        >
            <span className={clsx("font-medium", typeof num === 'string' ? "text-2xl sm:text-3xl text-text-primary" : "")}>{num}</span>
            {sub && <span className="text-[10px] uppercase font-bold text-text-secondary mt-0.5 tracking-wider">{sub}</span>}
        </button>
    );

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden relative">

            {/* TOP: DISPLAY AREA */}
            <div className="flex-1 flex flex-col items-center justify-start pt-12 p-6 min-h-0 relative space-y-8">

                {/* 1. Raw Phone Number (ALWAYS VISIBLE) */}
                <div className="text-center w-full px-4 break-all min-h-[4rem] flex items-center justify-center">
                    {!phoneNumber ? (
                        <span className="text-text-secondary/20 text-4xl font-light">Numara Girin</span>
                    ) : (
                        <span className={clsx(
                            "font-light text-text-primary transition-all leading-none",
                            phoneNumber.length > 10 ? "text-4xl" : "text-5xl sm:text-6xl"
                        )}>
                            {formattedPhone(phoneNumber)}
                        </span>
                    )}
                </div>

                {/* 2. Action Card (Visible when typing) */}
                <div
                    onClick={handleCardClick}
                    className={clsx(
                        "w-full max-w-sm bg-surface rounded-3xl p-4 shadow-xl border border-slate-200 dark:border-slate-700 transform transition-all duration-300 cursor-pointer hover:scale-105 active:scale-100 flex items-center gap-4",
                        (phoneNumber.length >= 3 || activeMatch) ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-8 invisible"
                    )}
                >
                    {/* Avatar / Icon */}
                    {displayData.isMatch ? (
                        <Avatar
                            name={displayData.name}
                            size="md"
                            status={displayData.type === 'Rehberde' ? 'contact' : 'system'}
                            photoURL={activeMatch && 'photoURL' in activeMatch ? (activeMatch as unknown as User).photoURL : undefined}
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-text-secondary">
                            <UserIcon size={24} />
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 overflow-hidden">
                        <h2 className="text-lg font-bold text-text-primary truncate">{displayData.name}</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-text-secondary truncate">{displayData.subtext}</span>
                            {displayData.isMatch && (
                                <span className={clsx(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                    displayData.type === 'Rehberde'
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                )}>
                                    {displayData.type}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Arrow / Action Icon */}
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
                        <Wallet size={20} />
                    </div>
                </div>

            </div>

            {/* BOTTOM: KEYPAD */}
            <div className="flex-none p-6 pb-8 safe-area-bottom w-full max-w-sm mx-auto z-20">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <KeypadButton num="1" />
                    <KeypadButton num="2" sub="ABC" />
                    <KeypadButton num="3" sub="DEF" />
                    <KeypadButton num="4" sub="GHI" />
                    <KeypadButton num="5" sub="JKL" />
                    <KeypadButton num="6" sub="MNO" />
                    <KeypadButton num="7" sub="PQRS" />
                    <KeypadButton num="8" sub="TUV" />
                    <KeypadButton num="9" sub="WXYZ" />

                    {/* ACTION: Add Contact */}
                    <KeypadButton
                        num={<UserPlus size={28} />}
                        sub="KAYDET"
                        onClick={handleAddToContacts}
                        className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-transparent"
                    />

                    <KeypadButton num="0" sub="+" onClick={() => handleNumberClick('0')} />

                    {/* ACTION: DELETE (Replaced Wallet) */}
                    <KeypadButton
                        num={<Delete size={28} />}
                        sub="SİL"
                        onClick={handleDelete}
                        destructive
                    />
                </div>
            </div>

            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialPhoneNumber={phoneNumber}
                targetUser={activeMatch} // Pass the full object if found
                onSubmit={handleCreateDebtSubmit}
            />
        </div>
    );
};
