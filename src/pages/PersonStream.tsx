/**
 * PersonStream - Dual-View Transaction Interface
 * Swipeable between Stream (Chat) and Special Files
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDebts } from '../hooks/useDebts';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft, FolderOpen, ChevronRight, ChevronLeft } from 'lucide-react';
import { searchUserByPhone, getContacts, markContactAsRead, createDebt } from '../services/db';
import { isUserBlocked } from '../services/blockService';
import { Avatar } from '../components/Avatar';
import { TransactionList } from '../components/TransactionList';
import { DebtCard } from '../components/DebtCard';
import { CreateDebtModal } from '../components/CreateDebtModal';
import { formatCurrency } from '../utils/format';
import { cleanPhone as cleanPhoneNumber } from '../utils/phoneUtils';
import { doc, getDoc } from 'firebase/firestore';
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
    const { allDebts: debts } = useDebts();
    const { resolveName } = useContactName();
    const { showAlert } = useModal();
    
    // Refs
    const streamRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // State
    const [targetUserObject, setTargetUserObject] = useState<User | Contact | null>(null);
    const [contactId, setContactId] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
    const [activeViewIndex, setActiveViewIndex] = useState(0); // 0 = Stream, 1 = Special Files
    const [resolvedUid, setResolvedUid] = useState<string | null>(null);
    const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);

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
            
            if (id.length > 20) {
                const userDoc = await getDoc(doc(db, 'users', id));
                if (userDoc.exists()) {
                    setTargetUserObject({ uid: userDoc.id, ...userDoc.data() } as User);
                    setResolvedUid(id);
                }
            } else {
                const foundUser = await searchUserByPhone(cleanId);
                if (foundUser) {
                    setTargetUserObject(foundUser);
                    setResolvedUid(foundUser.uid);
                }
            }

            const contacts = await getContacts(user.uid);
            const contact = contacts.find(c => 
                cleanPhoneNumber(c.phoneNumber) === cleanId || c.id === id
            );
            if (contact) {
                setContactId(contact.id);
                setLastReadTimestamp(contact.lastReadAt?.toMillis() || null);
                if (!targetUserObject) setTargetUserObject(contact);
            }

            const targetUid = getTargetUid() || id;
            if (targetUid) {
                const blocked = await isUserBlocked(user.uid, targetUid);
                setIsBlocked(blocked);
            }
        };

        fetchTarget();
        markContactAsRead(user.uid, id);
    }, [user, id]);

    // Listen for Global FAB Trigger from BottomNav
    useEffect(() => {
        const handleFabTrigger = () => {
            if (isBlocked) return;
            setShowCreateDebtModal(true);
        };
        window.addEventListener('trigger-person-fab-action', handleFabTrigger);
        return () => window.removeEventListener('trigger-person-fab-action', handleFabTrigger);
    }, [isBlocked]);

    // Person info
    const personInfo = useMemo(() => {
        const locationState = location.state as { name?: string } | undefined;
        let name = locationState?.name || '';
        let phone = id && id.length > 20 ? '' : cleanPhoneNumber(id || '');

        if (targetUserObject) {
            if ('displayName' in targetUserObject) name = targetUserObject.displayName || name;
            else if ('name' in targetUserObject) name = targetUserObject.name || name;
            if ('primaryPhoneNumber' in targetUserObject) phone = targetUserObject.primaryPhoneNumber || phone;
            else if ('phoneNumber' in targetUserObject) phone = targetUserObject.phoneNumber || phone;
        }

        const { displayName } = resolveName(id || '', name);
        return { name: displayName, phone };
    }, [id, targetUserObject, resolveName, location.state]);

    // Ledger hook
    const otherPartyId = getTargetUid() || id;
    const { ledgerId, transactions, loading: txLoading, balance: cariBalance } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    // Filter special debts (non-LEDGER)
    const personDebts = useMemo(() => {
        if (!debts || !id || !user) return [];
        const cleanId = cleanPhoneNumber(id);

        return debts.filter(d => {
            if (d.type === 'LEDGER') return false;

            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const cleanOtherId = cleanPhoneNumber(otherId);

            const isMatch = otherId === id ||
                cleanOtherId === cleanId ||
                d.participants.includes(id) ||
                (resolvedUid && otherId === resolvedUid);

            if (!isMatch) return false;

            const amICreator = d.createdBy === user.uid;
            if (amICreator) return true;
            if (d.status === 'REJECTED_BY_RECEIVER' || d.status === 'AUTO_HIDDEN') return false;
            return true;
        }).sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeA - timeB;
        });
    }, [debts, id, user, resolvedUid]);

    // Scroll handlers
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const viewWidth = container.offsetWidth;
        const newIndex = Math.round(scrollLeft / viewWidth);
        if (newIndex !== activeViewIndex) setActiveViewIndex(newIndex);
    };

    const scrollToView = (index: number) => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.scrollTo({ left: index * container.offsetWidth, behavior: 'smooth' });
    };

    // Scroll stream to bottom
    useEffect(() => {
        if (streamRef.current && transactions.length > 0 && activeViewIndex === 0) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
    }, [transactions, activeViewIndex]);

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
    }

    return (
        <div className="bg-background flex flex-col h-[calc(100vh-64px)]"> {/* Hard Floor: Anchored to Bottom Nav */}
            {/* Minimalist Header - Clickable to Profile */}
            <header 
                onClick={() => navigate(`/person/${id}/profile`, { state: { name: personInfo.name, phone: personInfo.phone } })}
                className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shrink-0"
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
                        {cariBalance === 0 ? "Hesap Denk" : `${cariBalance > 0 ? "+" : ""}${formatCurrency(cariBalance, 'TRY')}`}
                    </p>
                </div>
            </header>

            {/* Blocked Banner */}
            {isBlocked && (
                <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 text-center text-sm text-orange-700 dark:text-orange-300 shrink-0">
                    Bu kullanıcı engellenmiş
                </div>
            )}

            {/* View Tabs */}
            <div className="flex items-center justify-center gap-4 py-2 border-b border-border bg-surface shrink-0">
                <button
                    onClick={() => scrollToView(0)}
                    className={clsx(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                        activeViewIndex === 0
                            ? "bg-purple-600 text-white"
                            : "text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                >
                    Akış
                    {transactions.length > 0 && (
                        <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded text-xs">{transactions.length}</span>
                    )}
                </button>
                <button
                    onClick={() => scrollToView(1)}
                    className={clsx(
                        "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                        activeViewIndex === 1
                            ? "bg-blue-600 text-white"
                            : "text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                >
                    <FolderOpen size={14} />
                    Özel
                    {personDebts.length > 0 && (
                        <span className="bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded text-xs">{personDebts.length}</span>
                    )}
                </button>
            </div>

            {/* Swipeable Container */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* View 0: Stream */}
                <div className="snap-start shrink-0 w-full h-full overflow-hidden">
                    <div 
                        ref={streamRef}
                        className="h-full overflow-y-auto px-4 py-4"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {txLoading ? (
                            <div className="h-full flex items-center justify-center text-text-secondary">Yükleniyor...</div>
                        ) : ledgerId && transactions.length > 0 ? (
                            <div className="min-h-full flex flex-col justify-end">
                                <TransactionList transactions={transactions} ledgerId={ledgerId} />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                                <div className="text-4xl mb-3 opacity-50">💸</div>
                                <p className="font-medium">Henüz işlem yok</p>
                                <p className="text-sm opacity-70">Aşağıdaki butonlarla ilk işlemi ekleyin</p>
                            </div>
                        )}
                    </div>

                    {/* Swipe Hint */}
                    {personDebts.length > 0 && activeViewIndex === 0 && (
                        <div className="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-blue-500 opacity-50 animate-pulse pointer-events-none">
                            <ChevronRight size={24} />
                            <span className="text-[10px] font-medium rotate-90 origin-center whitespace-nowrap">Özel</span>
                        </div>
                    )}
                </div>

                {/* View 1: Special Files */}
                <div className="snap-start shrink-0 w-full h-full overflow-hidden">
                    <div className="h-full overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
                    {personDebts.length > 0 ? (
                        <div className="min-h-full flex flex-col justify-end">
                            <div className="space-y-2">
                                {personDebts.map(debt => {
                                    const isMyEntry = debt.createdBy === user?.uid;
                                    const isNew = !isMyEntry && lastReadTimestamp && debt.createdAt && debt.createdAt.toMillis() > lastReadTimestamp;
                                    return (
                                        <div key={debt.id} className={clsx("flex w-full", isMyEntry ? "justify-end" : "justify-start")}>
                                            <div className="w-[85%]">
                                                <DebtCard
                                                    debt={debt}
                                                    isNew={!!isNew}
                                                    currentUserId={user?.uid || ''}
                                                    onClick={() => navigate(`/debt/${debt.id}`)}
                                                    disabled={isBlocked}
                                                    variant="chat"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                            <FolderOpen size={32} className="mb-3 opacity-40" />
                            <p className="font-medium">Özel işlem yok</p>
                            <p className="text-sm opacity-70">Taksitli veya karmaşık borçlar burada görünecek</p>
                        </div>
                    )}
                    </div> {/* Close inner scrollable div */}

                    {/* Back Hint */}
                    {activeViewIndex === 1 && (
                        <div className="fixed left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-purple-500 opacity-50 animate-pulse pointer-events-none">
                            <ChevronLeft size={24} />
                            <span className="text-[10px] font-medium -rotate-90 origin-center whitespace-nowrap">Akış</span>
                        </div>
                    )}
                </div>
            </div>


            {/* Create Debt Modal */}
            <CreateDebtModal
                isOpen={showCreateDebtModal}
                onClose={() => setShowCreateDebtModal(false)}
                onSubmit={async (borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, initialPayment) => {
                    if (!user) return;
                    await createDebt(user.uid, user.displayName || 'Bilinmeyen', borrowerId, borrowerName, amount, type, currency, note, dueDate, installments, canBorrowerAddPayment, initialPayment || 0);
                    setShowCreateDebtModal(false);
                }}
                targetUser={targetUserObject}
                initialPhoneNumber={personInfo.phone}
                initialName={personInfo.name}
            />
        </div>
    );
};
