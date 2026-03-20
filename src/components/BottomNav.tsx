/* eslint-disable @typescript-eslint/no-explicit-any */
import { Home, BookUser, Calculator, Plus, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CreateDebtModal } from './CreateDebtModal';
import { ContactModal } from './ContactModal';
import { createDebt, searchUserByPhone } from '../services/db';
import { useContactName } from '../hooks/useContactName';
import { useContacts } from '../hooks/useContacts';
import { cleanPhone } from '../utils/phoneUtils';
import { checkBlockStatus } from '../services/blockService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Contact, User, Installment } from '../types';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const { user } = useAuth(); // Need auth for creating debt
    const { contactsMap } = useContacts();

    const isContacts = location.pathname === '/contacts';

    // Check for Context: User Detail Page
    const personMatch = location.pathname.match(/^\/person\/([^/]+)/);
    const personId = personMatch ? personMatch[1] : undefined;

    // Check for Context: Debt Detail Page
    const debtMatch = location.pathname.match(/^\/debt\/([^/]+)$/);
    const debtId = debtMatch ? debtMatch[1] : undefined;

    const isPersonContext = !!personId || !!debtId;

    // Resolve Person Name for Context
    const { resolveName } = useContactName();
    const locationState = location.state as { name?: string } | undefined;

    const [contextPersonName, setContextPersonName] = useState('');
    const [contextTargetUser, setContextTargetUser] = useState<Contact | User | null>(null);
    const [isContextBlocked, setIsContextBlocked] = useState(false);

    // Context Resolution Effect
    useEffect(() => {
        const resolveContext = async () => {
            if (!user) return;
            
            let targetId = personId;
            let targetObject: Contact | User | null = null;

            // 1. If we have a debtId, we need to find the OTHER party
            if (debtId) {
                const debtDoc = await getDoc(doc(db, 'debts', debtId));
                if (debtDoc.exists()) {
                    const d = debtDoc.data();
                    targetId = d.lenderId === user.uid ? d.borrowerId : d.lenderId;
                }
            }

            if (!targetId) {
                setContextPersonName('');
                setContextTargetUser(null);
                return;
            }

            // 2. Resolve targetObject
            const cleanTargetId = cleanPhone(targetId);
            if (targetId.length > 20) {
                const userDoc = await getDoc(doc(db, 'users', targetId));
                if (userDoc.exists()) targetObject = { uid: userDoc.id, ...userDoc.data() } as User;
            } else {
                const foundUser = await searchUserByPhone(cleanTargetId);
                if (foundUser) targetObject = foundUser;
            }

            // 3. Fallback to contactsMap if not system user
            if (!targetObject) {
                targetObject = contactsMap.get(targetId) || contactsMap.get(cleanTargetId) || null;
            }

            setContextTargetUser(targetObject);

            // 4. Resolve Name
            const { displayName } = resolveName(targetId, targetObject ? ('displayName' in targetObject ? targetObject.displayName : targetObject.name) : (locationState?.name || ''));
            setContextPersonName(displayName);

            // 5. Block Check
            if (targetId.length > 20) {
                const blocked = await checkBlockStatus(user.uid, targetId);
                setIsContextBlocked(blocked);
            }
        };

        resolveContext();
    }, [personId, debtId, user, contactsMap, resolveName, location.state]);

    // Submit handler for CreateDebtModal
    const handleCreateDebtSubmit = async (
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
        setShowDebtModal(false);
    };

    type NavItem = {
        path: string;
        icon: any;
        label: string;
        isCenter?: boolean;
        isContextAction?: boolean;
        isPaymentAction?: boolean;
        isContactAction?: boolean;
        onClick?: () => void;
    };


    const navItems: NavItem[] = [
        { path: '/', icon: Home, label: 'Anasayfa' },
        { path: '/tools', icon: Calculator, label: 'Araçlar' },
        // Dynamic Center Item
        isPersonContext
            ? {
                path: '#context-action',
                icon: Plus,
                label: 'İşlem Ekle',
                isCenter: true,
                isContextAction: true,
                onClick: () => {
                   if (isContextBlocked) return;
                   setShowDebtModal(true);
                }
            }
            : (isContacts
                ? {
                    path: '#add-contact',
                    icon: Plus,
                    label: 'Kişi Ekle',
                    isCenter: true,
                    isContactAction: true,
                    onClick: () => setShowContactModal(true)
                }
                : { path: '#create-debt', icon: Plus, label: 'Yeni Ekle', isCenter: true, onClick: () => setShowDebtModal(true) }
            ),
        { path: '/contacts', icon: BookUser, label: 'Rehber' },
        { path: '/settings', icon: Settings, label: 'Ayarlar' },
    ];

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 pb-safe">
                <div className="w-full max-w-3xl mx-auto flex justify-around items-center h-16 px-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isCenterItem = item.isCenter;

                        if (isCenterItem) {
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => {
                                        if (item.onClick) item.onClick();
                                        else navigate(item.path);
                                    }}
                                    className="flex flex-col items-center justify-center -mt-8"
                                >
                                    <div className={clsx(
                                        "p-4 rounded-full shadow-lg shadow-blue-500/40 text-white hover:scale-105 transition-transform active:scale-95 border-4 border-white dark:border-slate-900",
                                        item.isContextAction
                                            ? "bg-purple-600 shadow-purple-500/40"
                                            : (
                                                item.isContactAction
                                                    ? "bg-orange-500 shadow-orange-500/40"
                                                    : (
                                                        item.isPaymentAction
                                                            ? "bg-emerald-500 shadow-emerald-500/40"
                                                            : "bg-primary shadow-blue-500/40"
                                                    )
                                            )
                                    )}>
                                        <Icon size={28} />
                                    </div>
                                </button>
                            );
                        }

                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors active:scale-95",
                                    isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                                )}
                            >
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            <CreateDebtModal
                isOpen={showDebtModal}
                onClose={() => setShowDebtModal(false)}
                onSubmit={handleCreateDebtSubmit}
                initialPhoneNumber={contextTargetUser ? ('phoneNumber' in contextTargetUser ? contextTargetUser.phoneNumber : (contextTargetUser as User).phoneNumber) : (personId || undefined)}
                initialName={contextPersonName}
                targetUser={contextTargetUser}
            />

            <ContactModal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSuccess={() => {
                    // Maybe refresh contacts or just close?
                    // Contacts page auto-listens so it should update.
                }}
            />
        </>
    );
};
