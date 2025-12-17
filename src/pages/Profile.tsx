import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { logoutUser } from '../services/auth';
import { updateUserProfile } from '../services/profile';
import { uploadProfileImage } from '../services/storage';
import {
    Settings, Phone, Camera, Loader2, Mail,
    Save, ChevronRight, Moon, Sun,
    ShieldCheck, HelpCircle, CheckCircle2
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';

// Helper for masking phone (preserving existing logic)
const formatPhoneNumber = (value: string) => {
    const cleaned = ('' + value).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (match) {
        if (cleaned.length === 0) return '';
        let formatted = '';
        if (match[1]) formatted += `(${match[1]}`;
        if (match[2]) formatted += `) ${match[2]}`;
        if (match[3]) formatted += ` ${match[3]}`;
        if (match[4]) formatted += ` ${match[4]}`;
        return formatted;
    }
    return value;
};

export const Profile = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        phoneNumber: ''
    });

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Data Load
    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                email: user.email || user.recoveryEmail || '',
                phoneNumber: user.phoneNumber || ''
            });
        }
    }, [user, isEditing]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        if (formatted.length <= 15) {
            setFormData(prev => ({ ...prev, phoneNumber: formatted }));
        }
    };

    // Unused but kept for structure if needed or remove
    // const handleFileSelect = ... (This comes next in file)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];

            // Immediate Upload flow
            try {
                setLoading(true);
                // 1. Upload
                const downloadURL = await uploadProfileImage(file, user.uid);

                // 2. Update Profile
                await updateUserProfile(user.uid, {
                    photoURL: downloadURL
                });

                // 3. Update Local State
                setPreviewUrl(downloadURL);
                alert("Profil resmi güncellendi!");

                // Reload to refresh auth state if needed, though onSnapshot in useAuth handles it mostly
                // window.location.reload(); 
            } catch (error: any) {
                console.error("Upload error:", error);
                alert("Resim yüklenirken hata oluştu: " + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!user) return;

        // Validation
        if (formData.displayName.length < 2) {
            alert("İsim en az 2 karakter olmalıdır.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert("Geçerli bir e-posta adresi giriniz.");
            return;
        }

        setLoading(true);
        try {
            // Only update text fields here, photo is handled separately now
            await updateUserProfile(user.uid, {
                displayName: formData.displayName,
                email: formData.email,
                phoneNumber: formData.phoneNumber
            });

            alert("Profil bilgileri güncellendi.");
            setIsEditing(false);
            window.location.reload(); // Force refresh to sync strict auth state
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Güvenlik gereği işlem yapmak için yeniden giriş yapmalısınız.");
                logoutUser();
            } else {
                alert("Hata: " + error.message);
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
            phoneNumber: user?.phoneNumber || ''
        });

        setPreviewUrl(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-32">

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
                                status="system" // Keeping existing status logic
                                className="w-32 h-32 ring-4 ring-white dark:ring-slate-800"
                            />
                        </div>

                        {/* Camera Button - Always visible or effectively triggers upload */}
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
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">İletişim Bilgileri</h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">

                    {/* Phone Row */}
                    <div className="flex items-center p-4 border-b border-gray-50 dark:border-slate-800 last:border-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Phone size={20} />
                        </div>
                        <div className="ml-4 flex-1">
                            <span className="text-xs text-gray-400 block mb-0.5">Telefon</span>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={handlePhoneChange}
                                    className="w-full bg-transparent border-b border-gray-200 dark:border-slate-700 py-0.5 focus:outline-none focus:border-emerald-500 font-medium dark:text-white"
                                    placeholder="(5XX) XXX XX XX"
                                />
                            ) : (
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {user?.phoneNumber || 'Belirtilmemiş'}
                                </span>
                            )}
                        </div>
                        {!isEditing && user?.phoneNumber && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                                <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Doğrulandı</span>
                            </div>
                        )}
                    </div>

                    {/* Email Row */}
                    <div className="flex items-center p-4">
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
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Uygulama Ayarları</h3>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-50 dark:divide-slate-800">

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
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

                    {/* General Settings */}
                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 dark:text-slate-400">
                                <Settings size={18} />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">Genel Ayarlar</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>

                    {/* Support */}
                    <button
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
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

            {/* --- SECTION D: ACTIONS (FOOTER) --- */}
            {isEditing ? (
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-4">
                    <div className="flex gap-3 w-full max-w-md">
                        <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="flex-1 py-4 rounded-xl font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-white shadow-lg border border-gray-100 dark:border-slate-700"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-[2] py-4 rounded-xl font-bold bg-blue-600 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            Değişiklikleri Kaydet
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-4 pb-8">
                    <button
                        onClick={() => logoutUser()}
                        className="w-full py-4 rounded-xl font-bold text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Çıkış Yap
                    </button>
                    <p className="text-center text-xs text-gray-300 dark:text-slate-700 mt-4">
                        v1.0.4 • DebtDert Inc.
                    </p>
                </div>
            )}

        </div>
    );
};
