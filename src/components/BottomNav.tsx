import { Home, BookUser, GripHorizontal, Calculator, Plus, Settings, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CreateDebtModal } from './CreateDebtModal';
import { ContactModal } from './ContactModal';
import { createDebt } from '../services/db';
import { useContactName } from '../hooks/useContactName';
import { useContacts } from '../hooks/useContacts';
import { cleanPhone } from '../utils/phoneUtils';
import type { Contact, User } from '../types';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const { user } = useAuth(); // Need auth for creating debt
    const { contactsMap, contacts } = useContacts();

    const isContacts = location.pathname === '/contacts';

    // Check for Context: Debt Detail Page
    const debtMatch = location.pathname.match(/^\/debt\/([^/]+)$/);
    const isDebtDetail = !!debtMatch;

    // Check for Context: User Detail Page
    // Using regex match on location.pathname provided by useLocation hook
    const personMatch = location.pathname.match(/^\/person\/([^/]+)$/);
    const isPersonDetail = !!personMatch;
    const personId = personMatch ? personMatch[1] : undefined;

    // Resolve Person Name for Context
    const { resolveName } = useContactName();
    const locationState = location.state as { name?: string } | undefined;

    let personName = '';
    let targetUserObject: Contact | User | null = null;

    if (isPersonDetail && personId) {
        // ... (Existing logic) ...
        // ...
    }

    // Submit handler for CreateDebtModal
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
        isDebtDetail
            ? {
                path: '#add-payment-context',
                icon: Wallet,
                label: 'Ödeme Ekle',
                isCenter: true,
                isPaymentAction: true, // Green styling
                onClick: () => window.dispatchEvent(new Event('trigger-fab-action'))
            }
            : (isPersonDetail
                ? {
                    path: '#create-transaction-context',
                    icon: Plus,
                    label: 'İşlem Ekle',
                    isCenter: true,
                    isContextAction: true, // Purple styling
                    onClick: () => window.dispatchEvent(new Event('trigger-person-fab-action'))
                }
                : (isContacts
                    ? {
                        path: '#add-contact',
                        icon: Plus,
                        label: 'Kişi Ekle',
                        isCenter: true,
                        isContactAction: true, // Orange styling
                        onClick: () => setShowContactModal(true)
                    }
                    : { path: '#create-debt', icon: Plus, label: 'Yeni Ekle', isCenter: true, onClick: () => setShowDebtModal(true) }
                )
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
                        const isActive = location.pathname === item.path;
                        // @ts-ignore
                        const isCenter = item.isCenter;

                        if (isCenter) {
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => {
                                        // @ts-ignore
                                        if (item.onClick) item.onClick();
                                        else navigate(item.path);
                                    }}
                                    className="flex flex-col items-center justify-center -mt-8"
                                >
                                    <div className={clsx(
                                        "p-4 rounded-full shadow-lg shadow-blue-500/40 text-white hover:scale-105 transition-transform active:scale-95 border-4 border-white dark:border-slate-900",
                                        // @ts-ignore
                                        item.isContextAction
                                            ? "bg-purple-600 shadow-purple-500/40"
                                            : (
                                                // @ts-ignore
                                                item.isContactAction
                                                    ? "bg-orange-500 shadow-orange-500/40"
                                                    : (
                                                        // @ts-ignore
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
                initialPhoneNumber={personId}
                initialName={personName}
                targetUser={targetUserObject}
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
