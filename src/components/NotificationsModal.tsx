import React from 'react';
import { X, Bell, Calendar, ArrowRight, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../hooks/useNotifications';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import clsx from 'clsx';

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead?: (notificationId: string) => void;
    onDelete?: (notificationId: string) => void;
    onClearAll?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
    isOpen,
    onClose,
    notifications,
    onMarkAsRead,
    onDelete,
    onClearAll
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    // Show all notifications (unread and read)
    const visibleNotifications = notifications;
    const unreadCount = notifications.filter(n => !n.read).length;

    const handleNotificationClick = (notif: Notification) => {
        // Mark as read immediately (optimistic update)
        if (!notif.read && onMarkAsRead) {
            onMarkAsRead(notif.id);
        }
        // Small delay to show the visual change
        setTimeout(() => {
            navigate(`/debt/${notif.debtId}`);
            onClose();
        }, 200);
    };

    const handleMarkAsRead = (e: React.MouseEvent, notif: Notification) => {
        e.stopPropagation();
        if (onMarkAsRead) {
            onMarkAsRead(notif.id);
        }
    };

    const handleDelete = (e: React.MouseEvent, notifId: string) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(notifId);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in slide-in-from-top-4 border border-slate-700 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Bell size={20} className="text-primary" />
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">Bildirimler</h2>
                            {unreadCount > 0 && (
                                <p className="text-xs text-primary">{unreadCount} okunmamış</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {visibleNotifications.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary">
                            <Bell size={32} className="mx-auto mb-2 opacity-20" />
                            <p>Yeni bildiriminiz yok.</p>
                        </div>
                    ) : (
                        visibleNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={clsx(
                                    "p-3 rounded-xl border cursor-pointer transition-all active:scale-95 group",
                                    notif.read
                                        ? "bg-slate-800/10 border-slate-800/50 opacity-60"
                                        : notif.message.includes('gecikti')
                                            ? "bg-red-900/30 border-red-700"
                                            : "bg-blue-900/20 border-blue-700 shadow-sm shadow-blue-900/10"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2 flex-1" onClick={() => handleNotificationClick(notif)}>
                                        <span className={clsx(
                                            "text-xs font-bold px-2 py-0.5 rounded-full",
                                            notif.type === 'INSTALLMENT_DUE' ? "bg-purple-100 text-purple-700"
                                                : notif.type === 'DEBT_CREATED' ? "bg-green-100 text-green-700"
                                                    : notif.type === 'PAYMENT_MADE' ? "bg-blue-100 text-blue-700"
                                                        : notif.type === 'DEBT_REJECTED' ? "bg-red-100 text-red-700"
                                                            : "bg-orange-100 text-orange-700"
                                        )}>
                                            {notif.type === 'INSTALLMENT_DUE' ? 'Taksit'
                                                : notif.type === 'DEBT_CREATED' ? 'Yeni Borç'
                                                    : notif.type === 'PAYMENT_MADE' ? 'Ödeme'
                                                        : notif.type === 'DEBT_REJECTED' ? 'Red'
                                                            : notif.type === 'DEBT_EDITED' ? 'Düzenleme'
                                                                : 'Vade'}
                                        </span>
                                        {!notif.read && (
                                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-secondary flex items-center gap-1">
                                        <Calendar size={10} />
                                        {format(notif.date, 'd MMM', { locale: tr })}
                                    </span>
                                </div>

                                <p
                                    onClick={() => handleNotificationClick(notif)}
                                    className={clsx("text-sm mb-2", notif.read ? "text-text-secondary" : "text-text-primary font-medium")}
                                >
                                    {notif.message}
                                </p>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-primary flex items-center gap-1">
                                        Detay <ArrowRight size={12} />
                                    </span>

                                    {/* Action Buttons */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notif.read && (
                                            <button
                                                onClick={(e) => handleMarkAsRead(e, notif)}
                                                title="Okundu olarak işaretle"
                                                className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
                                            >
                                                <Eye size={14} className="text-text-secondary hover:text-primary" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(e, notif.id)}
                                            title="Sil"
                                            className="p-1.5 hover:bg-red-700/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} className="text-text-secondary hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700 p-4 flex gap-2">
                    <button
                        onClick={onClearAll}
                        className="flex-1 px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium"
                    >
                        Tüm Bildirimleri Sil
                    </button>
                </div>
            </div>
        </div>
    );
};
