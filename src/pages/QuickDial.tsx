import { useState, useEffect } from 'react';
import { Delete, UserPlus, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { searchUserByPhone, searchContacts } from '../services/db';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { clsx } from 'clsx';
import type { User, Contact } from '../types';

export const QuickDial = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [searchResults, setSearchResults] = useState<Contact[]>([]);
    const [foundUser, setFoundUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleNumberClick = (num: string) => {
        if (phoneNumber.length < 15) {
            setPhoneNumber(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    // Search logic
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

                // 2. Search Global User (only if looks like phone)
                if (phoneNumber.replace(/\D/g, '').length >= 10) {
                    const globalUser = await searchUserByPhone(phoneNumber);
                    setFoundUser(globalUser);
                } else {
                    setFoundUser(null);
                }
            } catch (error) {
                console.error(error);
            }
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [phoneNumber, user]);

    const handleAction = () => {
        if (!phoneNumber) return;
        setShowCreateModal(true);
    };

    const KeypadButton = ({ num, sub }: { num: string, sub?: string }) => (
        <button
            onClick={() => handleNumberClick(num)}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 active:bg-gray-400 transition-colors flex flex-col items-center justify-center mx-auto"
        >
            <span className="text-2xl sm:text-3xl font-medium text-text-primary">{num}</span>
            {sub && <span className="text-[9px] sm:text-[10px] font-bold text-text-secondary tracking-widest">{sub}</span>}
        </button>
    );

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Display Area */}
            <div className="flex-1 flex flex-col items-center justify-center pb-4 px-6 min-h-0">
                <div className="text-center space-y-6 w-full max-w-md">
                    {/* Add Contact Link - Fixed Height Container to prevent shift */}
                    <div className="h-8 flex items-center justify-center">
                        {phoneNumber.length >= 10 && !searchResults.length && !foundUser && (
                            <button
                                onClick={() => navigate('/contacts')}
                                className="text-blue-500 text-sm font-medium hover:underline animate-in fade-in slide-in-from-bottom-1"
                            >
                                Rehbere Ekle
                            </button>
                        )}
                    </div>

                    {/* Phone Number Display & Delete */}
                    <div className="relative w-full flex items-center justify-center h-20">
                        <h1 className={clsx(
                            "font-medium text-text-primary transition-all truncate w-full text-center px-10",
                            phoneNumber.length > 13 ? "text-3xl sm:text-4xl tracking-tight" :
                                phoneNumber.length > 0 ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl text-text-secondary/30"
                        )}>
                            {phoneNumber || "Numara Girin"}
                        </h1>
                        {phoneNumber.length > 0 && (
                            <button
                                onClick={handleDelete}
                                className="absolute right-0 top-1/2 -translate-y-1/2 p-3 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                            >
                                <Delete size={32} />
                            </button>
                        )}
                    </div>

                    {/* Matched Contact/User Name */}
                    <div className="h-20 flex items-center justify-center w-full">
                        {(searchResults.length > 0 || foundUser) && (
                            <div
                                onClick={() => {
                                    const number = searchResults[0]?.phoneNumber || foundUser?.phoneNumber;
                                    if (number) setPhoneNumber(number);
                                }}
                                className="animate-in fade-in slide-in-from-top-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 p-3 rounded-2xl transition-colors bg-surface/50 border border-transparent hover:border-border w-full"
                            >
                                <h2 className="text-2xl font-bold text-text-primary">
                                    {searchResults[0]?.name || foundUser?.displayName}
                                </h2>
                                <p className="text-sm text-text-secondary font-medium">
                                    {searchResults.length > 0 ? 'Rehberde Kayıtlı' : 'Sistem Kullanıcısı'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Keypad */}
            <div className="px-6 pb-8 max-w-sm mx-auto w-full flex-none">
                <div className="grid grid-cols-3 gap-x-6 gap-y-6 mb-4">
                    <KeypadButton num="1" />
                    <KeypadButton num="2" sub="ABC" />
                    <KeypadButton num="3" sub="DEF" />
                    <KeypadButton num="4" sub="GHI" />
                    <KeypadButton num="5" sub="JKL" />
                    <KeypadButton num="6" sub="MNO" />
                    <KeypadButton num="7" sub="PQRS" />
                    <KeypadButton num="8" sub="TUV" />
                    <KeypadButton num="9" sub="WXYZ" />

                    {/* Add Contact Button */}
                    <div className="flex items-center justify-center">
                        <button
                            onClick={() => navigate('/contacts', { state: { initialPhone: phoneNumber } })}
                            disabled={!phoneNumber || searchResults.length > 0}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 active:scale-95 transition-all flex flex-col items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <UserPlus size={24} />
                            <span className="text-[9px] font-bold mt-1">EKLE</span>
                        </button>
                    </div>

                    <KeypadButton num="0" sub="+" />

                    {/* Create Debt Button */}
                    <div className="flex items-center justify-center">
                        <button
                            onClick={handleAction}
                            disabled={!phoneNumber}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 active:scale-95 transition-all flex flex-col items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Wallet size={24} />
                            <span className="text-[9px] font-bold mt-1">BORÇ</span>
                        </button>
                    </div>
                </div>
            </div>

            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialPhoneNumber={phoneNumber}
                onSubmit={async () => {
                    // This will be handled by the modal's internal logic or passed up
                    // For now we just pass it to a dummy function or reuse Dashboard logic if possible
                    // Ideally we should refactor createDebt logic to a hook or context
                    console.log("Create debt from dial");
                }}
            />
        </div>
    );
};
