import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logoutUser } from '../services/auth';
import { updateUserProfile, uploadProfileImage } from '../services/profile';
import { LogOut, Settings, Phone, Camera, Edit2, Loader2, Mail, User as UserIcon, Save } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';

export const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        phoneNumber: ''
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Data Load
    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || ''
            });
        }
    }, [user, isEditing]); // Reset when entering edit mode or user loads

    // Phone Masking Logic
    const formatPhoneNumber = (value: string) => {
        // Remove all non-numeric characters
        const cleaned = ('' + value).replace(/\D/g, '');

        // Format as (5XX) XXX XX XX
        // Matches: 5XX -> (5XX)
        // Matches: 5XXXXX -> (5XX) XXX
        // Matches: 5XXXXXXX -> (5XX) XXX XX
        // Matches: 5XXXXXXXXX -> (5XX) XXX XX XX

        let match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);

        if (match) {
            // If empty, return empty
            if (cleaned.length === 0) return '';

            let formatted = '';
            // Part 1: (XXX)
            if (match[1]) formatted += `(${match[1]}`;
            if (match[2]) formatted += `) ${match[2]}`;
            if (match[3]) formatted += ` ${match[3]}`;
            if (match[4]) formatted += ` ${match[4]}`;

            return formatted;
        }

        return value;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Enforce max length approx (15 chars with spaces/parents)
        const formatted = formatPhoneNumber(e.target.value);
        if (formatted.length <= 15) {
            // We store raw or formatted?
            // Prompt says "Input Masking (Crucial for Phone)"
            // Ideally we store plain numbers in DB, but prompt says "strict format... helper formatPhoneNumber(value) on change"
            // Let's store formatted in UI state, assume we sanitize before DB if needed, 
            // OR prompt "Step 2... update... phoneNumber". Often DB stores E.164.
            // But for now let's store what the user sees to keep it simple as per prompt instructions.
            setFormData(prev => ({ ...prev, phoneNumber: formatted }));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!user) return;

        // Validation
        if (formData.displayName.length < 2) {
            alert("İsim en az 2 karakter olmalıdır.");
            return;
        }
        // Basic Email Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert("Geçerli bir e-posta adresi giriniz.");
            return;
        }
        // Phone length valid? (5XX) XXX XX XX is 15 chars.
        if (formData.phoneNumber.length > 0 && formData.phoneNumber.replace(/\D/g, '').length < 10) {
            alert("Lütfen geçerli bir telefon numarası giriniz.");
            return;
        }

        setLoading(true);
        try {
            let photoURL = user.photoURL || undefined;

            if (selectedFile) {
                photoURL = await uploadProfileImage(user.uid, selectedFile);
            }

            // Sanitize Phone for DB (Optional, but good practice). The prompt didn't specify format in DB.
            // keeping it as is or removing spaces. Let's keep consistent with input.

            await updateUserProfile(user.uid, {
                displayName: formData.displayName,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                photoURL
            });

            alert("Profil başarıyla güncellendi.");
            setIsEditing(false);
            // Ideally notify user or reload context
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Güvenlik gereği e-posta adresini değiştirmek için yeniden giriş yapmalısınız.");
                logoutUser();
            } else if (error.code === 'auth/email-already-in-use') {
                alert("Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.");
            } else {
                alert("Profil güncellenirken bir hata oluştu: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || ''
            });
        }
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const hasChanges = () => {
        if (!user) return false;
        return (
            formData.displayName !== user.displayName ||
            formData.email !== user.email ||
            formData.phoneNumber !== (user.phoneNumber || '') ||
            selectedFile !== null
        );
    };

    return (
        <div className="space-y-6 pt-6 pb-20">
            {/* Header / Avatar */}
            <div className="flex flex-col items-center space-y-4 relative">
                <div className="relative group">
                    <div className="w-28 h-28 flex items-center justify-center">
                        <Avatar
                            name={formData.displayName || user?.displayName || ''}
                            photoURL={previewUrl || user?.photoURL || undefined}
                            size="xl" // Assuming Avatar supports 'xl' or customized size. The prev code used 'xl'.
                            status="system"
                            className="w-28 h-28 text-3xl shadow-lg ring-4 ring-white dark:ring-slate-800"
                        />
                    </div>

                    {isEditing && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
                        >
                            <Camera className="text-white drop-shadow-md" size={32} />
                        </button>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>


            </div>

            {/* Form Section */}
            <div className="mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-2">

                {/* Name Field */}
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                        <UserIcon size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Ad Soyad</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full bg-transparent text-gray-900 dark:text-white font-medium focus:outline-none border-b border-blue-500 pb-1"
                                placeholder="Ad Soyad"
                            />
                        ) : (
                            <p className="text-gray-900 dark:text-white font-medium">{user?.displayName || 'Belirtilmemiş'}</p>
                        )}
                    </div>
                </div>

                {/* Phone Field */}
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400">
                        <Phone size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Telefon</label>
                        {isEditing ? (
                            <input
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={handlePhoneChange}
                                className="w-full bg-transparent text-gray-900 dark:text-white font-medium focus:outline-none border-b border-blue-500 pb-1"
                                placeholder="(5XX) XXX XX XX"
                            />
                        ) : (
                            <p className="text-gray-900 dark:text-white font-medium">{user?.phoneNumber || 'Belirtilmemiş'}</p>
                        )}
                    </div>
                </div>

                {/* Email Field */}
                <div className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                        <Mail size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">E-posta</label>
                        {isEditing ? (
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-transparent text-gray-900 dark:text-white font-medium focus:outline-none border-b border-blue-500 pb-1"
                                placeholder="ornek@email.com"
                            />
                        ) : (
                            <p className="text-gray-900 dark:text-white font-medium">{user?.email}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4">
                {isEditing ? (
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-xl font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !hasChanges()}
                            className="flex-3 flex-grow py-3 px-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            Kaydet
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="w-full py-3 px-4 rounded-xl font-bold bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        <Edit2 size={20} />
                        Profili Düzenle
                    </button>
                )}
            </div>

            {/* Other Actions - Only Show in View Mode */}
            {!isEditing && (
                <div className="mx-4 mt-8 space-y-3">
                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-xl text-gray-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                <Settings size={20} />
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-white">Uygulama Ayarları</span>
                        </div>
                        <Settings className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                    </button>

                    <button
                        onClick={() => logoutUser()}
                        className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center justify-between group hover:border-red-100 dark:hover:border-red-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-xl text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
                                <LogOut size={20} />
                            </div>
                            <span className="font-semibold text-red-600 dark:text-red-500">Çıkış Yap</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
