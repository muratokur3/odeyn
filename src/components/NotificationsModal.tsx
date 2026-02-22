import React from 'react';
import { X, Bell, Calendar, ArrowRight, Trash2, Eye, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../services/notificationService';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead?: (notificationId: string) => void;
    onDelete?: (notificationId: string) => void;
    onMarkAllAsRead?: () => void;
    onClearAll?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
    isOpen,
    onClose,
    notifications,
    onMarkAsRead,
    onDelete,
    onMarkAllAsRead,
    onClearAll
}) => {
    const navigate = useNavigate();

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleNotificationClick = (notif: Notification) => {
        if (!notif.isRead && onMarkAsRead) {
            onMarkAsRead(notif.id);
        }
        setTimeout(() => {
            if (notif.debtId) {
                navigate(`/debt/${notif.debtId}`);
            }
            onClose();
        }, 150);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-surface rounded-[2rem] w-full max-w-md shadow-2xl border border-border flex flex-col overflow-hidden max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-6 pb-4 border-b border-border flex justify-between items-center bg-surface/50 sticky top-0 z-10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Bell size={24} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-primary">Bildirimler</h2>
                            {unreadCount > 0 ? (
                                <p className="text-xs font-medium text-primary">{unreadCount} yeni mesaj</p>
                            ) : (
                                <p className="text-xs text-text-secondary">Tümü okundu</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-text-secondary"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 overscroll-contain px-4 py-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                <Bell size={32} className="text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-text-secondary font-medium">Henüz bir bildirim yok.</p>
                            <p className="text-xs text-text-secondary opacity-60 mt-1 px-10">
                                Borç kayıtları ve ödemelerle ilgili güncellemeler burada görünecek.
                            </p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={clsx(
                                    "p-4 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer group relative",
                                    notif.isRead
                                        ? "bg-surface border-transparent opacity-60"
                                        : "bg-primary/5 border-primary/10 shadow-sm shadow-primary/5"
                                )}
                            >
                                {!notif.isRead && (
                                    <div className="absolute top-4 left-2 w-1.5 h-1.5 bg-primary rounded-full" />
                                )}

                                <div className="flex justify-between items-start mb-2 ml-1">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider",
                                            notif.type === 'INSTALLMENT_DUE' ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                : notif.type === 'DEBT_CREATED' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : notif.type === 'PAYMENT_MADE' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                        : notif.type === 'DEBT_REJECTED' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {notif.type === 'INSTALLMENT_DUE' ? 'Taksit'
                                                : notif.type === 'DEBT_CREATED' ? 'Yeni Kayıt'
                                                    : notif.type === 'PAYMENT_MADE' ? 'Ödeme'
                                                        : notif.type === 'DEBT_REJECTED' ? 'Red'
                                                            : notif.type === 'DEBT_EDITED' ? 'Güncelleme'
                                                                : 'Hatırlatma'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-text-secondary flex items-center gap-1 font-medium opacity-60">
                                        <Calendar size={10} />
                                        {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'd MMMM', { locale: tr }) : ''}
                                    </span>
                                </div>

                                <p className={clsx(
                                    "text-sm mb-3 ml-1 leading-relaxed",
                                    notif.isRead ? "text-text-secondary" : "text-text-primary font-semibold"
                                )}>
                                    {notif.message}
                                </p>

                                <div className="flex justify-between items-center ml-1">
                                    <div className="flex items-center text-[11px] text-primary font-bold gap-1 group-hover:gap-2 transition-all">
                                        Detayı Görüntüle <ArrowRight size={12} />
                                    </div>

                                    <div className="flex gap-1">
                                        {!notif.isRead && (
                                            <button
                                                onClick={(e) => handleMarkAsRead(e, notif)}
                                                className="p-2 hover:bg-primary/10 rounded-xl transition-colors text-primary"
                                                title="Okundu"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(e, notif.id)}
                                            className="p-2 hover:bg-rose-500/10 rounded-xl transition-colors text-rose-500"
                                            title="Sil"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                {notifications.length > 0 && (
                    <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={onMarkAllAsRead}
                                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-border text-text-primary hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-all text-xs font-bold flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                Tümü Okundu
                            </button>
                        )}
                        <button
                            onClick={onClearAll}
                            className="flex-1 px-4 py-3 bg-rose-500/5 border border-rose-500/10 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            Tümünü Sil
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};
