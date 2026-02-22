import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/profile';
import { uploadProfileImage } from '../services/storage';
import { Camera, Loader2, Save, ArrowLeft, ShieldCheck, ChevronRight } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../context/ModalContext';
import ManagePhones from '../components/ManagePhones';

export const AccountSettings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showAlert } = useModal();

    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || '');
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

    const handleSaveProfile = async () => {
        if (!user) return;
        if (displayName.length < 2) {
            showAlert("Uyarı", "İsim en az 2 karakter olmalıdır.", "warning");
            return;
        }

        setLoading(true);
        try {
            await updateUserProfile(user.uid, {
                displayName: displayName
            });
            await showAlert("Başarılı", "Profil bilgileri güncellendi.", "success");
        } catch (error: any) {
            console.error(error);
            showAlert("Hata", "Hata: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const SectionTitle = ({ title }: { title: string }) => (
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider opacity-80 mt-8 first:mt-0">
            {title}
        </h2>
    );

    return (
        <div className="min-h-full bg-gray-50 dark:bg-black pb-10">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button onClick={() => navigate('/settings')} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Hesap Ayarları</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <div className="space-y-8">
                    {/* Identity Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
                        <SectionTitle title="Kimlik Bilgileri" />

                        <div className="flex flex-col items-center mb-8">
                            <div className="relative group">
                                <div className="relative p-1 bg-white dark:bg-slate-800 rounded-full shadow-md">
                                    <Avatar
                                        name={displayName || user?.displayName || ''}
                                        photoURL={previewUrl || user?.photoURL || undefined}
                                        size="xl"
                                        status="system"
                                        className="w-28 h-28"
                                    />
                                </div>
                                <button
                                    disabled={loading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors border-2 border-white dark:border-slate-800"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
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

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">
                                    Görünecek İsim
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                                        placeholder="Ad Soyad"
                                    />
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={loading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[3rem]"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
                        <SectionTitle title="İletişim Bilgileri" />
                        <div className="space-y-6">
                            <ManagePhones user={user} />
                        </div>
                    </div>

                    {/* Security Section Link */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                        <div
                            onClick={() => navigate('/settings/sessions')}
                            className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Oturum Güvenliği</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        Aktif cihazları ve giriş geçmişini yönet
                                    </p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-gray-400" />
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};
