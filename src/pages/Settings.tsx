import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX, ChevronRight, RefreshCw, User, Moon, Sun, LogOut, Coins, Shield } from 'lucide-react';
import { updateUserPreferences } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import type { User as UserType } from '../types';
import { Toggle } from '../components/Toggle';
import { useModal } from '../context/ModalContext';
import { Avatar } from '../components/Avatar';
import { useTheme } from '../context/ThemeContext';
import { logoutUser } from '../services/auth';



const SettingsRow = ({ icon: Icon, title, description, action, onClick }: {
    icon: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
    onClick?: () => void;
}) => (
    <div
        onClick={onClick}
        className={`flex items-center justify-between p-4 ${onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors active:bg-gray-100" : ""
            }`}
    >
        <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                {description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>}
            </div>
        </div>
        <div className="flex-shrink-0">
            {action || (onClick && <ChevronRight size={18} className="text-gray-400" />)}
        </div>
    </div>
);

const SectionHeader = ({ title }: { title: string }) => (
    <h2 className="px-4 pb-2 mt-6 text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
        {title}
    </h2>
);

// --- Main Component ---

export const Settings = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Get current user
    const { showConfirm } = useModal();
    const { theme, toggleTheme } = useTheme();

    // Local State
    const [syncContacts, setSyncContacts] = useState(false);
    const userSyncPref = user?.preferences?.syncContacts;
    
    // Pattern to sync state from props (derived state)
     
    const [prevPref, setPrevPref] = useState(userSyncPref);
    
    if (userSyncPref !== prevPref) {
        setPrevPref(userSyncPref);
        if (userSyncPref !== undefined) {
            setSyncContacts(userSyncPref);
        }
    }

    // Persist Helpers
    const toggleSetting = async (key: keyof NonNullable<UserType['preferences']>, value: boolean, setter: (val: boolean) => void) => {
        setter(value); // Optimistic update
        if (user) {
            try {
                // Update Firestore
                await updateUserPreferences(user.uid, {
                    ...user.preferences,
                    [key]: value
                });
            } catch (error) {
                console.error("Failed to update setting", error);
                // Revert? For now, we assume success or user retries.
            }
        }
    };

    const handleLogout = async () => {
        const confirmed = await showConfirm("Çıkış Yap", "Hesabınızdan çıkış yapmak istediğinize emin misiniz?", "warning");
        if (confirmed) {
            await logoutUser();
            navigate('/login');
        }
    };

    return (
        <div className="min-h-full bg-gray-50 dark:bg-black pb-10">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white"
                        aria-label="Geri dön"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Ayarlar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <div className="space-y-1">

                    {/* User Profile Summary (Static) */}
                    <div className="flex flex-col items-center py-8 mb-4">
                        <Avatar
                            name={user?.displayName || ''}
                            photoURL={user?.photoURL || undefined}
                            uid={user?.uid}
                            size="xl"
                            className="w-24 h-24 mb-4 shadow-md"
                            status={user?.phoneNumber ? 'system' : 'none'}
                        />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {user?.displayName || 'Kullanıcı'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                            {user?.phoneNumber || ''}
                        </p>
                    </div>

                    {/* Group A: General */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={User}
                            title="Hesap"
                            description="Telefon numarası, Oturumlar ve Güvenlik"
                            onClick={() => navigate('/settings/account')}
                        />
                        <SettingsRow
                            icon={Coins}
                            title="Döviz Kurları"
                            description="Özel döviz kurlarını ayarla"
                            onClick={() => navigate('/settings/exchange-rates')}
                        />
                    </div>


                    {/* Group C: Synchronization */}
                    <SectionHeader title="Rehber & Senkronizasyon" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={RefreshCw}
                            title="Rehber Senkronizasyonu"
                            description="Kişileri eşleştirmek için rehber periyodik olarak taransın."
                            action={<Toggle checked={syncContacts} onChange={(v) => toggleSetting('syncContacts', v, setSyncContacts)} />}
                        />
                    </div>

                    {/* Group D: Blocked */}
                    <SectionHeader title="Kişiler" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={UserX}
                            title="Engellenen Kullanıcılar"
                            description="Engellenmiş kişi listesini yönet."
                            onClick={() => navigate('/settings/blocked')}
                        />
                    </div>

                    {/* Group E: Privacy */}
                    <SectionHeader title="Veri ve Gizlilik" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={Shield}
                            title="Gizlilik ve Veri Yönetimi"
                            description="Verileri dışa aktar, hesap silme ve gizlilik seçenekleri"
                            onClick={() => navigate('/settings/privacy')}
                        />
                    </div>


                    {/* Group F: Appearance */}
                    <SectionHeader title="Görünüm" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                        <SettingsRow
                            icon={theme === 'dark' ? Moon : Sun}
                            title="Tema"
                            description={theme === 'dark' ? 'Karanlık mod aktif' : 'Aydınlık mod aktif'}
                            action={<Toggle checked={theme === 'dark'} onChange={toggleTheme} />}
                        />
                    </div>

                    {/* Logout Button */}
                    <div className="pt-4">
                        <button
                            onClick={handleLogout}
                            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} />
                            Çıkış Yap
                        </button>
                    </div>

                    {/* Version Info */}
                    <div className="pt-8 pb-4 text-center">
                        <p className="text-xs text-gray-400 font-medium">DebtDert v0.1.0 (Beta)</p>
                    </div>
                </div>
            </main>
        </div>
    );
};
