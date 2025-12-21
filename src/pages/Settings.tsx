import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX, ChevronRight, RefreshCw, Wallet, Users, User, Moon, Sun, LogOut, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { updateUserPreferences } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import type { User as UserType } from '../types';
import { Toggle } from '../components/Toggle';
import { useModal } from '../context/ModalContext';
import { Avatar } from '../components/Avatar';
import ManagePhones from '../components/ManagePhones';
import EmailManager from '../components/EmailManager';
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
    const [autoApprove, setAutoApprove] = useState(false);
    const [syncContacts, setSyncContacts] = useState(false);
    const [defaultAllowPayment, setDefaultAllowPayment] = useState(false);
    const [autoDeleteDuration, setAutoDeleteDuration] = useState('OFF');

    // Load Settings
    useEffect(() => {
        if (user) {
            const prefs = user.preferences || {};
            setAutoApprove((prev) => prefs.autoApproveDebt ?? prev);
            setSyncContacts((prev) => prefs.syncContacts ?? prev);
            setDefaultAllowPayment((prev) => prefs.defaultAllowPaymentAddition ?? prev);
        }
        const duration = localStorage.getItem('autoDeleteDuration') || 'OFF';
        setAutoDeleteDuration((prev) => duration !== prev ? duration : prev);
    }, [user]);

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

    const [contactAccessEnabled, setContactAccessEnabled] = useState(true);

    useEffect(() => {
        const savedContacts = localStorage.getItem('contact_access_enabled');
        if (savedContacts !== null) {
            const val = JSON.parse(savedContacts);
            setContactAccessEnabled((prev) => val !== prev ? val : prev);
        }
    }, []);

    const handleContactAccessToggle = (val: boolean) => {
        setContactAccessEnabled(val);
        localStorage.setItem('contact_access_enabled', JSON.stringify(val));
    };

    const handleAutoDeleteChange = (val: string) => {
        setAutoDeleteDuration(val);
        localStorage.setItem('autoDeleteDuration', val);
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

                    {/* User Profile Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden p-6 mb-6">
                        <div className="flex items-center gap-4 mb-6">
                            <Avatar
                                name={user?.displayName || ''}
                                photoURL={user?.photoURL || undefined}
                                uid={user?.uid}
                                size="xl"
                                className="w-20 h-20"
                                status={user?.phoneNumbers && user.phoneNumbers.length > 0 ? 'system' : 'none'}
                            />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                    {user?.displayName || 'Kullanıcı'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    {user?.primaryPhoneNumber || user?.phoneNumber || ''}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/profile')}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <User size={18} />
                            Profili Düzenle
                        </button>

                        {/* Account Management */}
                        <div className="mt-6 space-y-4">
                            <ManagePhones user={user} />
                            <EmailManager />
                        </div>
                    </div>

                    {/* Group A: Approvals */}
                    <SectionHeader title="Borç Yönetimi" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={CheckCircle2}
                            title="Gelen Kayıtları Onayla"
                            description="Rehberimdeki kişilerin eklediği borçlar otomatik olarak onaylansın."
                            action={<Toggle checked={autoApprove} onChange={(v) => toggleSetting('autoApproveDebt', v, setAutoApprove)} />}
                        />
                        <SettingsRow
                            icon={Wallet}
                            title="Ödeme Ekleme İzni"
                            description="Eklediğim borçlarda varsayılan olarak karşı taraf ödeme girebilsin."
                            action={<Toggle checked={defaultAllowPayment} onChange={(v) => toggleSetting('defaultAllowPaymentAddition', v, setDefaultAllowPayment)} />}
                        />
                    </div>

                    {/* Group B: Privacy */}
                    <SectionHeader title="Gizlilik & Senkronizasyon" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">

                        <SettingsRow
                            icon={RefreshCw}
                            title="Rehber Senkronizasyonu"
                            description="Kişileri eşleştirmek için rehber periyodik olarak taransın."
                            action={<Toggle checked={syncContacts} onChange={(v) => toggleSetting('syncContacts', v, setSyncContacts)} />}
                        />
                        <SettingsRow
                            icon={Users}
                            title="Rehber Erişimi"
                            description="Rehberden kişi içe aktarma özelliğini aç/kapat."
                            action={<Toggle checked={contactAccessEnabled} onChange={handleContactAccessToggle} />}
                        />
                    </div>

                    {/* Group C: Blocked */}
                    <SectionHeader title="Kişiler" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={UserX}
                            title="Engellenen Kullanıcılar"
                            description="Engellenmiş kişi listesini yönet."
                            onClick={() => navigate('/settings/blocked')}
                        />
                    </div>

                    {/* Group D: Storage */}
                    <SectionHeader title="Depolama" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <SettingsRow
                            icon={Trash2}
                            title="Çöp Kutusu"
                            description="Silinen kayıtları görüntüle ve yönet."
                            onClick={() => navigate('/trash')}
                        />
                        <SettingsRow
                            icon={Clock}
                            title="Otomatik Temizlik"
                            description="Çöp kutusundaki kayıtlar bu süreden sonra kalıcı olarak kaldırılır."
                            action={
                                <select
                                    value={autoDeleteDuration}
                                    onChange={(e) => handleAutoDeleteChange(e.target.value)}
                                    className="bg-gray-50 dark:bg-slate-800 border-none text-sm font-semibold text-blue-600 dark:text-blue-400 focus:ring-0 rounded-lg py-1 pl-2 pr-8 cursor-pointer"
                                >
                                    <option value="OFF">Kapat</option>
                                    <option value="30">30 Gün</option>
                                    <option value="60">60 Gün</option>
                                    <option value="90">90 Gün</option>
                                </select>
                            }
                        />
                    </div>

                    {/* Group E: Appearance */}
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
