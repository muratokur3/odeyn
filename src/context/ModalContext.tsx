import { createContext, useState, useCallback, type ReactNode } from 'react';
import { AlertModal } from '../components/AlertModal';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import type { ModalContextType, ModalType } from './ModalContext.types';

const ModalContext = createContext<ModalContextType | undefined>(undefined);
export { ModalContext };

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    // Alert State
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: ModalType;
        resolve?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    // Confirm State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: ModalType; // Added type
        resolve?: (value: boolean) => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info' // Default
    });

    const showAlert = useCallback((title: string, message: string, type: ModalType = 'info'): Promise<void> => {
        return new Promise((resolve) => {
            setAlertState({ isOpen: true, title, message, type, resolve });
        });
    }, []);

    const showConfirm = useCallback((title: string, message: string, type: ModalType = 'info'): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({ isOpen: true, title, message, type, resolve });
        });
    }, []);

    const handleAlertClose = () => {
        setAlertState(prev => ({ ...prev, isOpen: false }));
        alertState.resolve?.();
    };

    const handleConfirmClose = (result: boolean) => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        confirmState.resolve?.(result);
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertState.isOpen}
                onClose={handleAlertClose}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
            />

            {/* Confirm Modal */}
            <AnimatePresence>
                {confirmState.isOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => handleConfirmClose(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-slate-100 dark:border-slate-800"
                        >
                            <div className="flex flex-col items-center text-center pt-2">
                                <div className={clsx(
                                    "mb-4 p-3 rounded-full",
                                    confirmState.type === 'error' ? "bg-red-50 dark:bg-red-900/20" :
                                        confirmState.type === 'warning' ? "bg-yellow-50 dark:bg-yellow-900/20" :
                                            confirmState.type === 'success' ? "bg-green-50 dark:bg-green-900/20" :
                                                "bg-blue-50 dark:bg-slate-800"
                                )}>
                                    <HelpCircle size={32} className={clsx(
                                        confirmState.type === 'error' ? "text-red-500" :
                                            confirmState.type === 'warning' ? "text-yellow-600" :
                                                confirmState.type === 'success' ? "text-green-500" :
                                                    "text-blue-500"
                                    )} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{confirmState.title}</h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{confirmState.message}</p>

                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => handleConfirmClose(false)}
                                        className="flex-1 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => handleConfirmClose(true)}
                                        className={clsx(
                                            "flex-1 py-3 rounded-xl font-bold text-white transition-colors shadow-lg",
                                            confirmState.type === 'error' ? "bg-red-600 hover:bg-red-700 shadow-red-900/20" :
                                                "bg-blue-600 hover:bg-blue-700 shadow-blue-900/20"
                                        )}
                                    >
                                        Onayla
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalContext.Provider>
    );
};
