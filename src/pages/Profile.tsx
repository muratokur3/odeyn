import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { logoutUser } from '../services/auth';
import { updateUserProfile } from '../services/profile';
import { uploadProfileImage } from '../services/storage';
import { startAddPhoneVerification, confirmAddPhone, finalizeAddPhone, removePhone, setPrimaryPhone } from '../services/identity';
import {
    Settings, Phone, Camera, Loader2, Mail,
    Save, ChevronRight, Moon, Sun,
    ShieldCheck, HelpCircle, Plus, Trash2
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useModal } from '../context/ModalContext';
import { RecaptchaVerifier } from 'firebase/auth'; // Import for type
import { auth } from '../services/firebase'; // Direct import for Recaptcha

export const Profile = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const { showAlert } = useModal();

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
    });

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Phone Management State
    const [isAddingPhone, setIsAddingPhone] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [verificationId, setVerificationId] = useState<any>(null);
    const [phoneLoading, setPhoneLoading] = useState(false);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);
    const appVerifierRef = useRef<RecaptchaVerifier | null>(null);

    // Initial Data Load
    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                email: user.email || user.recoveryEmail || '',
            });
        }
    }, [user, isEditing]);

    // Recaptcha Init
    useEffect(() => {
        if (!appVerifierRef.current && recaptchaContainerRef.current) {
            try {
                appVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
                    'size': 'invisible',
                    'callback': () => { }
                });
            } catch (e) {
                console.error("Recaptcha Init Error:", e);
            }
        }
    }, [isAddingPhone]); // Re-init if modal opens? usually once is enough but container ref matters.

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            try {
                setLoading(true);
                const downloadURL = await uploadProfileImage(file, user.uid);
                await updateUserProfile(user.uid, { photoURL: downloadURL });
                setPreviewUrl(downloadURL);
                showAlert("Başarılı", "Profil resmi güncellendi!", "success");
            } catch (error: any) {
                console.error("Upload error:", error);
                showAlert("Hata", "Resim yüklenirken hata oluştu: " + error.message, "error");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!user) return;
        if (formData.displayName.length < 2) {
            showAlert("Uyarı", "İsim en az 2 karakter olmalıdır.", "warning");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showAlert("Uyarı", "Geçerli bir e-posta adresi giriniz.", "warning");
            return;
        }

        setLoading(true);
        try {
            await updateUserProfile(user.uid, {
                displayName: formData.displayName,
                email: formData.email
            });
            await showAlert("Başarılı", "Profil bilgileri güncellendi.", "success");
            setIsEditing(false);
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                await showAlert("Güvenlik", "Güvenlik gereği işlem yapmak için yeniden giriş yapmalısınız.", "warning");
                logoutUser();
            } else {
                showAlert("Hata", "Hata: " + error.message, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            displayName: user?.displayName || '',
            email: user?.email || '',
        });
        setPreviewUrl(null);
    };

    // --- Phone Management ---

    const handleAddPhoneStart = async () => {
        if (!newPhone) return;
        setPhoneLoading(true);
        try {
            if (!appVerifierRef.current) throw new Error("Recaptcha not ready");
            const result = await startAddPhoneVerification(newPhone, appVerifierRef.current);
            setVerificationId(result);
            showAlert("Onay Kodu", "Telefonuna SMS gönderildi.", "success");
        } catch (error: any) {
            console.error(error);
            showAlert("Hata", error.message || "SMS gönderilemedi.", "error");
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!verificationId || !otpCode || !newPhone) return;
        setPhoneLoading(true);
        try {
            await confirmAddPhone(verificationId, otpCode);
            await finalizeAddPhone(newPhone); // Update DB
            showAlert("Başarılı", "Telefon numarası eklendi!", "success");
            setNewPhone('');
            setOtpCode('');
            setVerificationId(null);
            setIsAddingPhone(false);
            window.location.reload(); // Refresh to show new state
        } catch (error: any) {
            console.error(error);
            showAlert("Hata", error.message || "Doğrulama başarısız.", "error");
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleRemovePhone = async (phone: string) => {
        if (!confirm(`${phone} numarasını silmek istediğinize emin misiniz?`)) return;
        try {
            await removePhone(phone);
            showAlert("Silindi", "Telefon numarası kaldırıldı.", "success");
            window.location.reload();
        } catch (error: any) {
            showAlert("Hata", error.message, "error");
        }
    };

    const handleSetPrimary = async (phone: string) => {
        try {
            await setPrimaryPhone(phone);
            window.location.reload();
        } catch (error: any) {
            showAlert("Hata", error.message, "error");
        }
    };

    const phoneList = user?.phoneNumbers || (user?.phoneNumber ? [user.phoneNumber] : []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 relative">
            {/* Invisible Recaptcha */}
            <div ref={recaptchaContainerRef}></div>

            {/* --- SECTION A: IDENTITY CARD (HEADER) --- */}
            <div className="relative bg-gradient-to-b from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-900/50 pt-12 pb-8 rounded-b-[2.5rem] shadow-sm mb-6">
                <div className="flex flex-col items-center">
                    {/* Avatar Container */}
                    <div className="relative group">
                        <div className="relative p-1 bg-white dark:bg-slate-800 rounded-full shadow-lg">
                            <Avatar
                                name={formData.displayName || user?.displayName || ''}
                                photoURL={previewUrl || user?.photoURL || undefined}
                                size="xl"
                                status="system"
                                className="w-32 h-32 ring-4 ring-white dark:ring-slate-800"
                            />
                        </div>
                        <button
                            disabled={loading}
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-1 right-1 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors border-2 border-white dark:border-slate-800 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* Name & Badge */}
                    <div className="mt-4 text-center space-y-1">
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="text-center bg-transparent border-b-2 border-blue-500 focus:outline-none text-xl font-bold text-gray-900 dark:text-white pb-1"
                                placeholder="Ad Soyad"
                                autoFocus
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {user?.displayName || 'İsimsiz Kullanıcı'}
                            </h1>
                        )}
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Onaylı Hesap</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECTION B: CONTACT INFO LIST --- */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">İletişim Bilgileri</h3>
                    <button
                        onClick={() => setIsAddingPhone(true)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg flex items-center gap-1"
                    >
                        <Plus size={12} />
                        Numara Ekle
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">

                    {/* Phone List */}
                    {phoneList.map((phone, idx) => {
                        const isPrimary = phone === user?.primaryPhoneNumber || (phoneList.length === 1);
                        return (
                            <div key={idx} className="flex items-center p-4 border-b border-gray-50 dark:border-slate-800 last:border-0 relative">
                                <div className={clsx(
                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                    isPrimary ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                                )}>
                                    <Phone size={20} />
                                </div>
                                <div className="ml-4 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {phone}
                                        </span>
                                        {isPrimary && (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                                Ana Numara
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4 mt-1">
                                        {!isPrimary && (
                                            <button
                                                onClick={() => handleSetPrimary(phone)}
                                                className="text-[10px] font-medium text-gray-400 hover:text-blue-500"
                                            >
                                                Ana Numara Yap
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {!isPrimary && (
                                    <button
                                        onClick={() => handleRemovePhone(phone)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* Email Row */}
                    <div className="flex items-center p-4 border-t border-gray-50 dark:border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                            <Mail size={20} />
                        </div>
                        <div className="ml-4 flex-1">
                            <span className="text-xs text-gray-400 block mb-0.5">E-Posta</span>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-transparent border-b border-gray-200 dark:border-slate-700 py-0.5 focus:outline-none focus:border-violet-500 font-medium dark:text-white"
                                    placeholder="email@ornek.com"
                                />
                            ) : (
                                <span className="font-medium text-gray-900 dark:text-white truncate block max-w-[200px]">
                                    {user?.email || user?.recoveryEmail || 'Belirtilmemiş'}
                                </span>
                            )}
                        </div>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-violet-600 font-medium text-sm hover:text-violet-700 ml-2"
                            >
                                Düzenle
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* --- SECTION C: SETTINGS LIST --- */}
            <div className="px-4 mb-8">
                {/* ... (Existing Settings) ... */}
                {/* To save tokens, I'll compress this section if needed, but for replacement accuracy I'll keep it standard */}
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Uygulama Ayarları</h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-50 dark:divide-slate-800">
                    <button onClick={toggleTheme} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-slate-800 flex items-center justify-center text-orange-500 dark:text-slate-400">
                                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">Görünüm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{theme === 'dark' ? 'Karanlık' : 'Aydınlık'}</span>
                            <ChevronRight size={18} className="text-gray-300" />
                        </div>
                    </button>
                    <button onClick={() => navigate('/settings')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 dark:text-slate-400">
                                <Settings size={18} />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">Genel Ayarlar</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-slate-800 flex items-center justify-center text-pink-500 dark:text-slate-400">
                                <HelpCircle size={18} />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">Yardım & Destek</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>
                </div>
            </div>

            {/* --- SECTION D: ACTIONS --- */}
            {isEditing ? (
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-4">
                    <div className="flex gap-3 w-full max-w-md">
                        <button onClick={handleCancel} disabled={loading} className="flex-1 py-4 rounded-xl font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-white shadow-lg border border-gray-100 dark:border-slate-700">İptal</button>
                        <button onClick={handleSave} disabled={loading} className="flex-[2] py-4 rounded-xl font-bold bg-blue-600 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2">
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            Değişiklikleri Kaydet
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-4 pb-8">
                    <button onClick={() => logoutUser()} className="w-full py-4 rounded-xl font-bold text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">Çıkış Yap</button>
                    <p className="text-center text-xs text-gray-300 dark:text-slate-700 mt-4">v1.0.5 • DebtDert Inc.</p>
                </div>
            )}

            {/* --- MODAL: ADD PHONE --- */}
            {isAddingPhone && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-center dark:text-white">Numara Ekle</h2>

                        {!verificationId ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 text-center">Ekleyeceğiniz numaranın size ait olduğunu doğrulamamız gerekiyor.</p>
                                <input
                                    type="tel"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    placeholder="+90 555 123 4567"
                                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setIsAddingPhone(false)} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 dark:bg-slate-800 rounded-xl">İptal</button>
                                    <button
                                        onClick={handleAddPhoneStart}
                                        disabled={!newPhone || phoneLoading}
                                        className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl flex justify-center items-center"
                                    >
                                        {phoneLoading ? <Loader2 className="animate-spin" /> : "SMS Gönder"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 text-center">{newPhone} numarasına gönderilen kodu giriniz.</p>
                                <input
                                    type="text"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    placeholder="123456"
                                    maxLength={6}
                                    className="w-full p-3 text-center text-2xl tracking-widest rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => { setVerificationId(null); setOtpCode(''); }} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 dark:bg-slate-800 rounded-xl">Geri</button>
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={otpCode.length < 6 || phoneLoading}
                                        className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-xl flex justify-center items-center"
                                    >
                                        {phoneLoading ? <Loader2 className="animate-spin" /> : "Doğrula"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
