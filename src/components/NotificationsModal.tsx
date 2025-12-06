import React from 'react';
import { X, Bell, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../hooks/useNotifications';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import clsx from 'clsx';

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, notifications }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in slide-in-from-top-4 border border-slate-700 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Bell size={20} className="text-primary" />
                        <h2 className="text-lg font-bold text-text-primary">Bildirimler</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {notifications.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary">
                            <Bell size={32} className="mx-auto mb-2 opacity-20" />
                            <p>Yeni bildiriminiz yok.</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => {
                                    navigate(`/debt/${notif.debtId}`);
                                    onClose();
                                }}
                                className={clsx(
                                    "p-3 rounded-xl border cursor-pointer transition-colors active:scale-95",
                                    notif.type === 'REQUEST' ? "bg-blue-900/20 border-blue-800" :
                                        notif.message.includes('gecikti') ? "bg-red-900/20 border-red-800" : "bg-slate-800/50 border-slate-700"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={clsx(
                                        "text-xs font-bold px-2 py-0.5 rounded-full",
                                        notif.type === 'REQUEST' ? "bg-blue-100 text-blue-700" :
                                            notif.type === 'INSTALLMENT_DUE' ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                                    )}>
                                        {notif.type === 'REQUEST' ? 'İstek' :
                                            notif.type === 'INSTALLMENT_DUE' ? 'Taksit' : 'Vade'}
                                    </span>
                                    <span className="text-xs text-text-secondary flex items-center gap-1">
                                        <Calendar size={10} />
                                        {format(notif.date, 'd MMM', { locale: tr })}
                                    </span>
                                </div>
                                <p className="text-sm text-text-primary mb-2">{notif.message}</p>
                                <div className="flex justify-end">
                                    <span className="text-xs text-primary flex items-center gap-1">
                                        Detay <ArrowRight size={12} />
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
