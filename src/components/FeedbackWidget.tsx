import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendFeedback } from '../services/feedback';
import { Bug, Send, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export const FeedbackWidget = () => {
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!title.trim() || !description.trim()) {
            setError('Lütfen tüm alanları doldurun.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await sendFeedback(
                user.uid,
                user.displayName || 'İsimsiz Kullanıcı',
                user.phoneNumber || 'Telefon Yok',
                title,
                description
            );
            setIsSuccess(true);
            setTitle('');
            setDescription('');
            setTimeout(() => {
                setIsSuccess(false);
                setIsExpanded(false);
            }, 2000);
        } catch (err) {
            console.error(err);
            setError('Bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="px-4 mt-4 mb-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-all duration-300">
                {/* Header / Collapsed View */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isSuccess ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        )}>
                            {isSuccess ? <CheckCircle size={18} /> : <Bug size={18} />}
                        </div>
                        <div>
                            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm block">
                                {isSuccess ? "Geri bildirim gönderildi!" : "Bir hata mı buldun? Bize bildir."}
                            </span>
                            {!isExpanded && !isSuccess && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
                                    Geliştirmemize yardımcı ol
                                </span>
                            )}
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>

                {/* Expanded Form */}
                <AnimatePresence>
                    {isExpanded && !isSuccess && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-gray-100 dark:border-slate-700"
                        >
                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                {/* Auto-filled Info */}
                                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-700">
                                    <p className="font-medium mb-1">Şu bilgilerle gönderilecek:</p>
                                    <div className="flex justify-between items-center">
                                        <span>{user.displayName || 'İsimsiz'}</span>
                                        <span className="font-mono">{user.phoneNumber}</span>
                                    </div>
                                </div>

                                {/* Inputs */}
                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="feedback-title" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Konu / Başlık
                                        </label>
                                        <input
                                            id="feedback-title"
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Örn: Ödeme ekranı açılmıyor"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="feedback-desc" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Açıklama
                                        </label>
                                        <textarea
                                            id="feedback-desc"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Detayları buraya yazabilirsin..."
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Info Message */}
                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    Geri bildiriminiz, test sürecini iyileştirmek için geliştirici ekibine doğrudan iletilecektir.
                                </p>

                                {/* Error Message */}
                                {error && (
                                    <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                                        {error}
                                    </p>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            Gönder
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
