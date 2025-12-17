import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: AlertType;
}

export const AlertModal = ({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) => {

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 size={32} className="text-green-500" />;
            case 'error': return <AlertCircle size={32} className="text-red-500" />;
            case 'warning': return <AlertCircle size={32} className="text-orange-500" />;
            default: return <AlertCircle size={32} className="text-blue-500" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'warning': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
            default: return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        }
    };

    const getBtnColor = () => {
        switch (type) {
            case 'success': return 'bg-green-600 hover:bg-green-700';
            case 'error': return 'bg-red-600 hover:bg-red-700';
            case 'warning': return 'bg-orange-600 hover:bg-orange-700';
            default: return 'bg-blue-600 hover:bg-blue-700';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className={clsx(
                            "relative w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border",
                            "bg-white dark:bg-slate-900",
                            getColors() // Applies subtle background tint and border
                        )}
                    >
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>

                        <div className="flex flex-col items-center text-center pt-2">
                            <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                                {getIcon()}
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {title}
                            </h3>

                            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                                {message}
                            </p>

                            <button
                                onClick={onClose}
                                className={clsx(
                                    "w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95",
                                    getBtnColor()
                                )}
                            >
                                Tamam
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
