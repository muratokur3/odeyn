import React, { useEffect, useState } from 'react';
import { X, Bell, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export interface ToastNotification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    duration?: number; // ms, default 3000
}

interface NotificationToastProps {
    notification: ToastNotification | null;
    onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (!notification) return;

        const duration = notification.duration || 3000;
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onClose, 300); // Wait for animation
        }, duration);

        return () => clearTimeout(timer);
    }, [notification, onClose]);

    if (!notification) return null;

    const bgColor = {
        success: 'bg-green-900/30 border-green-700',
        warning: 'bg-yellow-900/30 border-yellow-700',
        error: 'bg-red-900/30 border-red-700',
        info: 'bg-blue-900/30 border-blue-700'
    }[notification.type];

    const iconColor = {
        success: 'text-green-400',
        warning: 'text-yellow-400',
        error: 'text-red-400',
        info: 'text-blue-400'
    }[notification.type];

    return (
        <div
            className={clsx(
                'fixed top-4 left-4 right-4 max-w-sm mx-auto z-[9999] transition-all duration-300',
                isExiting ? 'translate-y-0 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100',
                'animate-in fade-in slide-in-from-top-2'
            )}
        >
            <div className={clsx(
                'bg-surface border rounded-xl p-4 shadow-lg flex items-start gap-3',
                bgColor
            )}>
                <Bell size={20} className={clsx('flex-shrink-0 mt-0.5', iconColor)} />
                
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary text-sm">
                        {notification.title}
                    </h3>
                    <p className="text-text-secondary text-xs mt-1 line-clamp-2">
                        {notification.message}
                    </p>
                </div>
                
                <button
                    onClick={() => {
                        setIsExiting(true);
                        setTimeout(onClose, 300);
                    }}
                    className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
