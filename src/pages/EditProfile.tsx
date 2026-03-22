import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/profile';
import { uploadProfileImage } from '../services/storage';
import { Camera, Loader2, Save, ArrowLeft, Building2, User as UserIcon, MapPin, Hash, Briefcase } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../hooks/useModal';

export const EditProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showAlert } = useModal();

    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [userType, setUserType] = useState<'INDIVIDUAL' | 'BUSINESS'>('INDIVIDUAL');
    const [businessName, setBusinessName] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [taxOffice, setTaxOffice] = useState('');
    const [address, setAddress] = useState('');

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || '');
            setUserType(user.userType || 'INDIVIDUAL');
            setBusinessName(user.businessName || '');
            setTaxNumber(user.taxNumber || '');
            setTaxOffice(user.taxOffice || '');
            setAddress(user.address || '');
        }
    }, [user]);

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
        if (displayName.length < 2) {
            showAlert("Uyarı", "İsim en az 2 karakter olmalıdır.", "warning");
            return;
        }

        setLoading(true);
        try {
            await updateUserProfile(user.uid, {
                displayName,
                userType,
                businessName: userType === 'BUSINESS' ? businessName : undefined,
                taxNumber: userType === 'BUSINESS' ? taxNumber : undefined,
                taxOffice: userType === 'BUSINESS' ? taxOffice : undefined,
                address
            });
            await showAlert("Başarılı", "Profil bilgileri güncellendi.", "success");
            navigate(-1);
        } catch (error: any) {
            console.error(error);
            showAlert("Hata", "Hata: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Profili Düzenle</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-8">
                {/* Avatar Section */}
                <div className="flex flex-col items-center pt-8">
                    <div className="relative group">
                        <div className="relative p-1 bg-white dark:bg-slate-800 rounded-full shadow-lg">
                            <Avatar
                                name={displayName || user?.displayName || ''}
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
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                        Ad Soyad
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                        placeholder="Ad Soyad giriniz"
                    />
                </div>

                {/* Account Type Selector */}
                <div className="space-y-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                        Hesap Tipi
                    </label>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
                        <button
                            onClick={() => setUserType('INDIVIDUAL')}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                                userType === 'INDIVIDUAL' 
                                ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' 
                                : 'text-gray-500'
                            }`}
                        >
                            <UserIcon size={18} />
                            Bireysel
                        </button>
                        <button
                            onClick={() => setUserType('BUSINESS')}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                                userType === 'BUSINESS' 
                                ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600' 
                                : 'text-gray-500'
                            }`}
                        >
                            <Building2 size={18} />
                            İşletme
                        </button>
                    </div>
                </div>

                {/* Business Specific Fields */}
                {userType === 'BUSINESS' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                             <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                                <Briefcase size={14} /> İşletme Adı
                             </label>
                             <input
                                type="text"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                placeholder="İşletme resmi adını giriniz"
                             />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Vergi No</label>
                                <input
                                    type="text"
                                    value={taxNumber}
                                    onChange={(e) => setTaxNumber(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                    placeholder="000 000 0000"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Vergi Dairesi</label>
                                <input
                                    type="text"
                                    value={taxOffice}
                                    onChange={(e) => setTaxOffice(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                    placeholder="Daire adı"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Address Field */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                        <MapPin size={14} /> {userType === 'BUSINESS' ? 'İşletme Adresi' : 'Adres'}
                    </label>
                    <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white resize-none"
                        placeholder="Adres bilgilerinizi giriniz"
                    />
                </div>

                {/* Save Button */}
                <div className="pt-8">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-4 rounded-xl font-bold bg-blue-600 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        Kaydet
                    </button>
                </div>
            </main>
        </div>
    );
};
