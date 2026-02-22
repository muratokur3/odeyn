import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Notification } from '../services/notificationService';

interface NotificationToastProps {
    notification: Notification | null;
    onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
    // Auto close after 5 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClose]);

    if (!notification) return null;

    const iconMap = {
        DEBT_CREATED: <CheckCircle2 size={20} className="text-emerald-500" />,
        PAYMENT_MADE: <Info size={20} className="text-blue-500" />,
        DEBT_EDITED: <Info size={20} className="text-blue-500" />,
        DEBT_REJECTED: <AlertCircle size={20} className="text-rose-500" />,
        DUE_SOON: <AlertTriangle size={20} className="text-amber-500" />,
        INSTALLMENT_DUE: <AlertTriangle size={20} className="text-amber-500" />
    };

    const typeStyles = {
        DEBT_CREATED: 'border-emerald-500/20 bg-emerald-500/5',
        PAYMENT_MADE: 'border-blue-500/20 bg-blue-500/5',
        DEBT_EDITED: 'border-blue-500/20 bg-blue-500/5',
        DEBT_REJECTED: 'border-rose-500/20 bg-rose-500/5',
        DUE_SOON: 'border-amber-500/20 bg-amber-500/5',
        INSTALLMENT_DUE: 'border-amber-500/20 bg-amber-500/5'
    };

    const titleMap = {
        DEBT_CREATED: 'Yeni Kayıt',
        PAYMENT_MADE: 'Ödeme Alındı',
        DEBT_EDITED: 'Kayıt Güncellendi',
        DEBT_REJECTED: 'Kayıt Reddedildi',
        DUE_SOON: 'Vadesi Yaklaşıyor',
        INSTALLMENT_DUE: 'Taksit Hatırlatması'
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-4 left-4 right-4 max-w-sm mx-auto z-[9999]"
            >
                <div className={clsx(
                    'bg-surface border rounded-2xl p-4 shadow-xl flex items-start gap-3 backdrop-blur-md',
                    typeStyles[notification.type]
                )}>
                    <div className="flex-shrink-0 mt-0.5">
                        {iconMap[notification.type]}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-text-primary text-sm leading-tight">
                            {titleMap[notification.type]}
                        </h3>
                        <p className="text-text-secondary text-xs mt-1 line-clamp-2 leading-relaxed">
                            {notification.message}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex-shrink-0 -mt-1 -mr-1 p-1 text-text-secondary hover:text-text-primary hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
