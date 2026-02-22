import { useState, useEffect } from 'react';
import { UserPlus, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { searchUserByPhone, searchContacts, createDebt } from '../services/db';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { Avatar } from '../components/Avatar';
import { formatPhoneForDisplay } from '../utils/phoneUtils';
import { clsx } from 'clsx';
import type { User, Contact } from '../types';

export const QuickDial = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [searchResults, setSearchResults] = useState<Contact[]>([]);
    const [foundUser, setFoundUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [selectedUser, setSelectedUser] = useState<Contact | User | null>(null);

    // Formatting Helper - Use global utility
    const formattedPhone = (phone: string) => formatPhoneForDisplay(phone);

    // Card Display Data
    // Merged Results
    const allMatches = [...searchResults];
    // Check duplication with foundUser
    // Note: searchResults are Contacts (have phoneNumber). foundUser is User (has phoneNumber).
    // Simple check:
    if (foundUser) {
        const userPhone = foundUser.primaryPhoneNumber || foundUser.phoneNumbers?.[0] || foundUser.phoneNumber || '';
        const isAlreadyInContacts = searchResults.some(c =>
            c.phoneNumber.replace(/\D/g, '') === userPhone.replace(/\D/g, '')
        );
        if (!isAlreadyInContacts) {
            allMatches.push(foundUser as any);
        }
    }

    // Limit to 3
    const displayMatches = allMatches.slice(0, 3);



    // Smart Search Logic
    useEffect(() => {
        const search = async () => {
            if (!user || phoneNumber.length < 3) {
                setSearchResults([]);
                setFoundUser(null);
                return;
            }

            try {
                // 1. Search Contacts (Clean query)
                const cleanQuery = phoneNumber.replace(/\s/g, '');
                const contacts = await searchContacts(user.uid, cleanQuery);
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
            initialPayment || 0
        );
        setShowCreateModal(false);
        setPhoneNumber('');
    };



    return (
        <div className="h-full flex flex-col bg-background overflow-hidden relative">

            {/* TOP: DISPLAY AREA */}
            <div className="flex-1 flex flex-col items-center justify-start pt-12 p-6 min-h-0 relative space-y-8">

                {/* 1. Raw Phone Number (ALWAYS VISIBLE) */}
                {/* 1. Phone Number Input */}
                <div className="text-center w-full px-4 break-all min-h-[4rem] flex items-center justify-center">
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={formattedPhone(phoneNumber)}
                        onChange={(e) => {
                            // Keep user typing flexible, but store raw
                            // Allow + for country code
                            const raw = e.target.value.replace(/[^\d+]/g, '');
                            if (raw.length <= 15) {
                                setPhoneNumber(raw);
                            }
                        }}
                        className="w-full bg-transparent text-center font-light text-text-primary outline-none placeholder:text-text-secondary/20 transition-all leading-none"
                        style={{ fontSize: phoneNumber.length > 10 ? '2.25rem' : '3rem' }} // Custom sizing
                        placeholder="Numara Girin"
                        autoFocus
                    />
                </div>

                {/* 2. Action Card (Visible when typing) */}
                {/* 2. Action Cards / Results */}
                <div className={clsx(
                    "w-full max-w-sm flex flex-col gap-3 transition-all duration-300",
                    (phoneNumber.length >= 3 || displayMatches.length > 0) ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-8 invisible"
                )}>
                    {displayMatches.length > 0 ? (
                        displayMatches.map((match, idx) => {
                            const isContact = 'name' in match;
                            const name = isContact ? (match as Contact).name : (match as User).displayName;
                            const phone = 'phoneNumber' in match ? (match as Contact).phoneNumber : ((match as User).primaryPhoneNumber || (match as User).phoneNumbers?.[0] || (match as User).phoneNumber || '');
                            const photo = 'photoURL' in match ? (match as any).photoURL : undefined;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setPhoneNumber(phone);
                                        setSelectedUser(match as (User | Contact));
                                        setShowCreateModal(true);
                                    }}
                                    className="w-full bg-surface rounded-3xl p-4 shadow-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-4 transition-colors"
                                >
                                    <Avatar
                                        name={name || 'Kullanıcı'}
                                        size="md"
                                        status={isContact ? 'contact' : 'system'}
                                        photoURL={photo}
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <h2 className="text-lg font-bold text-text-primary truncate">{name || 'İsimsiz'}</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-text-secondary truncate">{formattedPhone(phone)}</span>
                                            <span className={clsx(
                                                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                                isContact
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            )}>
                                                {isContact ? 'Rehberde' : 'Sistemde'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
                                        <Wallet size={20} />
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        // No Match -> Add to Contacts Option
                        <div
                            onClick={handleAddToContacts}
                            className="w-full bg-surface rounded-3xl p-4 shadow-md border border-dashed border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-4 group"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <UserPlus size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-base font-semibold text-text-primary">Rehbere Ekle</h2>
                                <p className="text-sm text-text-secondary">{formattedPhone(phoneNumber)}</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>



            <CreateDebtModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialPhoneNumber={phoneNumber}
                targetUser={selectedUser} // Pass the full object if found
                onSubmit={handleCreateDebtSubmit}
            />
        </div>
    );
};
