import { Home, User, BookUser, GripHorizontal, Calculator, Plus, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CreateDebtModal } from './CreateDebtModal';
import { createDebt } from '../services/db';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showDebtModal, setShowDebtModal] = useState(false);
    const { user } = useAuth(); // Need auth for creating debt

    const isContacts = location.pathname === '/contacts';

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
        setShowDebtModal(false);
    };

    const navItems = [
        { path: '/', icon: Home, label: 'Anasayfa' },
        { path: '/tools', icon: Calculator, label: 'Araçlar' },
        // Dynamic Center Item
        isContacts
            ? { path: '/dial', icon: GripHorizontal, label: 'Hızlı İşlem', isCenter: true }
            : { path: '#create-debt', icon: Plus, label: 'Yeni Ekle', isCenter: true, onClick: () => setShowDebtModal(true) },
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
                                    <div className="p-4 bg-primary rounded-full shadow-lg shadow-blue-500/40 text-white hover:scale-105 transition-transform active:scale-95 border-4 border-white dark:border-slate-900">
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
            />
        </>
    );
};
