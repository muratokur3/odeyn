import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { FaEnvelope, FaEdit, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const EmailManager: React.FC = () => {
    const { user } = useAuth();
    const { showAlert } = useModal();
    const [isEditing, setIsEditing] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Get the Firebase Auth user object directly because the custom User type
    // from useAuth doesn't have the methods/properties we need for auth operations (like emailVerified)
    const firebaseUser = auth.currentUser;

    useEffect(() => {
        if (user?.email) {
            setNewEmail(user.email);
        }
    }, [user]);

    const handleUpdate = async () => {
        setError(null);
        setSuccessMsg(null);

        if (!newEmail || !newEmail.includes('@')) {
            setError("Geçerli bir e-posta adresi giriniz.");
            return;
        }

        if (newEmail === user?.email) {
            setIsEditing(false);
            return;
        }

        if (!firebaseUser) {
            setError("Oturum bilgisi alınamadı.");
            return;
        }

        setLoading(true);
        try {
            // verifyBeforeUpdateEmail sends a verification email to the new address
            // and updates the email only after the link is clicked.
            await verifyBeforeUpdateEmail(firebaseUser, newEmail);
            setSuccessMsg(`Doğrulama bağlantısı ${newEmail} adresine gönderildi. Lütfen e-postanızı onaylayın.`);
            setIsEditing(false);
        } catch (err: any) {
            console.error(err);
             if (err.code === 'auth/requires-recent-login') {
                setError("Güvenlik gereği işlem yapmak için yeniden giriş yapmalısınız.");
                showAlert("Güvenlik Uyarısı", "E-posta değişikliği gibi hassas işlemler için yakın zamanda giriş yapmış olmanız gerekmektedir. Lütfen çıkış yapıp tekrar giriniz.", "warning");
            } else if (err.code === 'auth/email-already-in-use') {
                setError("Bu e-posta adresi başka bir hesap tarafından kullanılıyor.");
            } else {
                setError(err.message || "E-posta güncellenemedi.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setNewEmail(user?.email || '');
        setError(null);
        setSuccessMsg(null);
    };

    if (!user) return null;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                        <FaEnvelope size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">E-posta & Kurtarma</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Hesap kurtarma ve bildirimler için kullanılır.
                        </p>
                    </div>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-full hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        title="E-postayı Değiştir"
                    >
                        <FaEdit size={18} />
                    </button>
                )}
            </div>

            {isEditing ? (
                 <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yeni E-posta Adresi</label>
                    <div className="flex flex-col gap-3">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                            placeholder="ornek@email.com"
                            autoFocus
                        />
                         <div className="flex justify-end gap-2">
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                Doğrulama Gönder
                            </button>
                        </div>
                    </div>
                 </div>
            ) : (
                <div className="mt-2 pl-1">
                     <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium break-all">
                        {user.email ? (
                            <>
                                {user.email}
                                {firebaseUser?.emailVerified && <span className="text-green-500" title="Doğrulanmış"><FaCheck size={12}/></span>}
                            </>
                        ) : (
                            <span className="text-gray-400 italic">E-posta adresi eklenmemiş</span>
                        )}
                     </div>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2">
                    <FaExclamationTriangle className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMsg && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-sm flex items-start gap-2">
                    <FaCheck className="mt-0.5 shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}
        </div>
    );
};

export default EmailManager;
