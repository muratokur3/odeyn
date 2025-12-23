/**
 * PersonStream - WhatsApp-style Transaction Stream
 * Clean chat interface with inverted scroll
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { searchUserByPhone, getContacts, markContactAsRead } from '../services/db';
import { isUserBlocked } from '../services/blockService';
import { Avatar } from '../components/Avatar';
import { TransactionList } from '../components/TransactionList';
import { QuickTransactionModal } from '../components/QuickTransactionModal';
import { formatCurrency } from '../utils/format';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import clsx from 'clsx';
import { useModal } from '../context/ModalContext';
import type { User, Contact } from '../types';
import { useLedger } from '../hooks/useLedger';

export const PersonStream = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { resolveName } = useContactName();
    const { showAlert } = useModal();
    const streamRef = useRef<HTMLDivElement>(null);

    // State
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showQuickModal, setShowQuickModal] = useState(false);
    const [quickDirection, setQuickDirection] = useState<'OUTGOING' | 'INCOMING'>('OUTGOING');

    // Resolve UID
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);

    // Get target UID
    const getTargetUid = () => {
        if (id && id.length > 20) return id;
        if (targetUserObject) {
            if ('uid' in targetUserObject) return targetUserObject.uid;
            if ('linkedUserId' in targetUserObject && targetUserObject.linkedUserId) return targetUserObject.linkedUserId;
        }
        return null;
    };

    // Fetch user/contact info
    useEffect(() => {
        if (!user || !id) return;

        const fetchTarget = async () => {
            const cleanId = cleanPhoneNumber(id);
            
            // Check if it's a UID
            if (id.length > 20) {
                const userDoc = await getDoc(doc(db, 'users', id));
                if (userDoc.exists()) {
                    setTargetUserObject({ uid: userDoc.id, ...userDoc.data() } as User);
                    setResolvedUid(id);
                }
            } else {
                // Phone number - try to find user
                const foundUser = await searchUserByPhone(cleanId);
                if (foundUser) {
                    setTargetUserObject(foundUser);
                    setResolvedUid(foundUser.uid);
                }
            }

            // Find contact
            const contacts = await getContacts(user.uid);
            const contact = contacts.find(c => 
                cleanPhoneNumber(c.phoneNumber) === cleanId || c.id === id
            );
            if (contact) {
                setContactId(contact.id);
                if (!targetUserObject) setTargetUserObject(contact);
            }

            // Check blocked status
            const targetUid = getTargetUid() || id;
            if (targetUid) {
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);
            }
        };

        fetchTarget();
        markContactAsRead(user.uid, id);
    }, [user, id]);

    // Person info
    const personInfo = useMemo(() => {
        const locationState = location.state as { name?: string } | undefined;
        let name = locationState?.name || '';
        let phone = id && id.length > 20 ? '' : cleanPhoneNumber(id || '');

        if (targetUserObject) {
            if ('displayName' in targetUserObject) {
                name = targetUserObject.displayName || name;
            } else if ('name' in targetUserObject) {
                name = targetUserObject.name || name;
            }
            if ('primaryPhoneNumber' in targetUserObject) {
                phone = targetUserObject.primaryPhoneNumber || phone;
            } else if ('phoneNumber' in targetUserObject) {
                phone = targetUserObject.phoneNumber || phone;
            }
        }

        const { displayName } = resolveName(id || '', name);
        return { name: displayName, phone };
    }, [id, targetUserObject, resolveName, location.state]);

    // Ledger hook
    const otherPartyId = getTargetUid() || id;
    const { 
        ledgerId, 
        transactions, 
        loading: txLoading, 
        balance: cariBalance 
    } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    // Scroll to bottom on new transactions
    useEffect(() => {
        if (streamRef.current && transactions.length > 0) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
    }, [transactions]);

    // Open quick modal with direction
    const openQuickAdd = (direction: 'OUTGOING' | 'INCOMING') => {
        setQuickDirection(direction);
        setShowQuickModal(true);
    };

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Minimalist Header - Clickable to Profile */}
            <header 
                onClick={() => navigate(`/person/${id}/profile`, { state: { name: personInfo.name, phone: personInfo.phone } })}
                className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <button 
                    onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                    className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ArrowLeft size={22} />
                </button>

                <Avatar 
                    name={personInfo.name} 
                    photoURL={targetUserObject && 'photoURL' in targetUserObject ? targetUserObject.photoURL : undefined}
                    size="md"
                />

                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-text-primary truncate">{personInfo.name}</h1>
                    <p className={clsx(
                        "text-sm font-medium",
                        cariBalance > 0 ? "text-green-600" : cariBalance < 0 ? "text-red-600" : "text-text-secondary"
                    )}>
                        {cariBalance === 0 ? "Hesap Denk" : (
                            <>
                                {cariBalance > 0 ? "+" : ""}{formatCurrency(cariBalance, 'TRY')}
                            </>
                        )}
                    </p>
                </div>
            </header>

            {/* Blocked Banner */}
            {isBlocked && (
                <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 text-center text-sm text-orange-700 dark:text-orange-300">
                    Bu kullanıcı engellenmiş
                </div>
            )}

            {/* Transaction Stream - Flex column-reverse for bottom anchoring */}
            <div 
                ref={streamRef}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
            >
                {txLoading ? (
                    <div className="flex-1 flex items-center justify-center text-text-secondary">
                        Yükleniyor...
                    </div>
                ) : ledgerId ? (
                    <TransactionList
                        transactions={transactions}
                        ledgerId={ledgerId}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
                        <div className="text-4xl mb-3 opacity-50">💸</div>
                        <p className="font-medium">Henüz işlem yok</p>
                        <p className="text-sm opacity-70">Aşağıdaki butonlarla ilk işlemi ekleyin</p>
                    </div>
                )}
            </div>

            {/* Quick Add Footer */}
            {!isBlocked && (
                <div className="sticky bottom-0 bg-surface border-t border-border px-4 py-3 pb-safe">
                    <div className="flex gap-3">
                        <button
                            onClick={() => openQuickAdd('OUTGOING')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all active:scale-95"
                        >
                            <Plus size={20} />
                            Verdim
                        </button>
                        <button
                            onClick={() => openQuickAdd('INCOMING')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all active:scale-95"
                        >
                            <Minus size={20} />
                            Aldım
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Transaction Modal */}
            <QuickTransactionModal
                isOpen={showQuickModal}
                onClose={() => setShowQuickModal(false)}
                ledgerId={ledgerId}
                contactName={personInfo.name}
                userId={user?.uid}
                userName={user?.displayName}
                otherPartyId={otherPartyId || undefined}
                otherPartyName={personInfo.name}
            />
        </div>
    );
};
