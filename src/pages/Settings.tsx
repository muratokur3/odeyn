import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, XCircle, Clock, CheckCircle2, UserX, ChevronRight, RefreshCw, Wallet } from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { restoreDebt, permanentlyDeleteDebt, updateUserPreferences } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';
import { DebtCard } from '../components/DebtCard';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';

// --- Internal Components ---

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={clsx(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            checked ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-700"
        )}
    >
        <span
            className={clsx(
                "inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 shadow ring-0",
                checked ? "translate-x-6" : "translate-x-1"
            )}
        />
    </button>
);

const SettingsRow = ({ icon: Icon, title, description, action, onClick }: {
    icon: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
    onClick?: () => void;
}) => (
    <div
        onClick={onClick}
        className={clsx(
            "flex items-center justify-between p-4",
            onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors active:bg-gray-100" : ""
        )}
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
    const { showAlert, showConfirm } = useModal();
    const { allDebts: deletedDebts, loading } = useDebts(true);

    const [activeTab, setActiveTab] = useState<'GENERAL' | 'TRASH'>('GENERAL');

    // Local State
    const [autoApprove, setAutoApprove] = useState(false);
    const [syncContacts, setSyncContacts] = useState(false);
    const [defaultAllowPayment, setDefaultAllowPayment] = useState(false);
    const [autoDeleteDuration, setAutoDeleteDuration] = useState('OFF');

    // Load Settings
    useEffect(() => {
        if (user) {
            const prefs = user.preferences || {};
            setAutoApprove(prefs.autoApproveDebt ?? false);
            setSyncContacts(prefs.syncContacts ?? false);
            setDefaultAllowPayment(prefs.defaultAllowPaymentAddition ?? false);
        }
        setAutoDeleteDuration(localStorage.getItem('autoDeleteDuration') || 'OFF');
    }, [user]);

    // Persist Helpers
    const toggleSetting = async (key: keyof NonNullable<User['preferences']>, value: boolean, setter: (val: boolean) => void) => {
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

    const handleAutoDeleteChange = (val: string) => {
        setAutoDeleteDuration(val);
        localStorage.setItem('autoDeleteDuration', val);
        if (val !== 'OFF') checkAutoDelete(parseInt(val));
    };

    // Trash Logic (Real-time updates via useDebts)
    const handleRestore = async (debtId: string) => {
        if (!user) return;
        const confirmed = await showConfirm("Geri Yükle", "Bu kaydı geri yüklemek istediğinize emin misiniz?");
        if (confirmed) {
            await restoreDebt(debtId);
            showAlert("Başarılı", "Kayıt geri yüklendi.", "success");
        }
    };

    const handlePermanentDelete = async (debtId: string) => {
        if (!user) return;
        const confirmed = await showConfirm(
            "Kalıcı Silme",
            "Bu kayıt kalıcı olarak silinecek. Geri alınamaz!",
            "error" // Danger type
        );
        if (confirmed) {
            await permanentlyDeleteDebt(debtId, user.uid);
            // await loadDeletedDebts(); // Real-time update handles this
            showAlert("Silindi", "Kayıt kalıcı olarak silindi.", "success");
        }
    };

    const handleCleanDeleted = async () => {
        if (!deletedDebts.length || !user) return; // check user

        const confirmed = await showConfirm("Temizlik", "Çöp kutusundaki tüm kayıtları kalıcı olarak silmek istiyor musunuz?", "warning");
        if (!confirmed) return;

        let deletedCount = 0;
        for (const debt of deletedDebts) {
            await permanentlyDeleteDebt(debt.id, user.uid);
            deletedCount++;
        }

        if (deletedCount > 0) showAlert("Temizlik Tamamlandı", `${deletedCount} adet kayıt kalıcı olarak silindi.`, "success");
        else showAlert("Bilgi", "Silinecek kayıt bulunamadı.", "info");
    };

    const checkAutoDelete = async (days: number) => {
        if (!deletedDebts.length || !user) return; // check user
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        for (const debt of deletedDebts) {
            if (debt.deletedAt && debt.deletedAt.toDate() < cutoffDate) {
                await permanentlyDeleteDebt(debt.id, user.uid);
                deletedCount++;
            }
        }
        if (deletedCount > 0) showAlert("Otomatik Temizlik", `${deletedCount} adet süresi dolmuş kayıt silindi.`, "info");
    };

    return (
        <div className="min-h-full bg-gray-50 dark:bg-black pb-10">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Ayarlar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                {/* Tabs */}
                <div className="flex p-1 bg-gray-200 dark:bg-slate-800 rounded-xl mb-6">
                    <button
                        onClick={() => setActiveTab('GENERAL')}
                        className={clsx(
                            "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                            activeTab === 'GENERAL' ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                        )}
                    >
                        Genel
                    </button>
                    <button
                        onClick={() => setActiveTab('TRASH')}
                        className={clsx(
                            "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                            activeTab === 'TRASH' ? "bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                        )}
                    >
                        Çöp Kutusu
                    </button>
                </div>

                {activeTab === 'GENERAL' && (
                    <div className="space-y-1">

                        {/* Group A: Approvals */}
                        <SectionHeader title="Borç Yönetimi" />
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                            <SettingsRow
                                icon={CheckCircle2}
                                title="Gelen Kayıtları Onayla"
                                description="Rehberimdeki kişilerin eklediği borçlar otomatik olarak onaylansın."
                                action={<Switch checked={autoApprove} onChange={(v) => toggleSetting('autoApproveDebt', v, setAutoApprove)} />}
                            />
                            <SettingsRow
                                icon={Wallet}
                                title="Ödeme Ekleme İzni"
                                description="Eklediğim borçlarda varsayılan olarak karşı taraf ödeme girebilsin."
                                action={<Switch checked={defaultAllowPayment} onChange={(v) => toggleSetting('defaultAllowPaymentAddition', v, setDefaultAllowPayment)} />}
                            />
                        </div>

                        {/* Group B: Privacy */}
                        <SectionHeader title="Gizlilik & Senkronizasyon" />
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">

                            <SettingsRow
                                icon={RefreshCw}
                                title="Rehber Senkronizasyonu"
                                description="Kişileri eşleştirmek için rehber periyodik olarak taransın."
                                action={<Switch checked={syncContacts} onChange={(v) => toggleSetting('syncContacts', v, setSyncContacts)} />}
                            />
                        </div>

                        {/* Group C: Blocked */}
                        <SectionHeader title="Kişiler" />
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <SettingsRow
                                icon={UserX}
                                title="Engellenen Kullanıcılar"
                                description="Engellenmiş kişi listesini yönet."
                                onClick={() => showAlert("Yakında", "Engellenen kullanıcılar sayfası yakında eklenecek.", "info")}
                            />
                        </div>

                        {/* Group D: Storage */}
                        <SectionHeader title="Depolama" />
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <SettingsRow
                                icon={Clock}
                                title="Çöp Kutusu Temizliği"
                                description="Silinen kayıtlar bu süreden sonra kalıcı olarak kaldırılır."
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

                        {/* Version Info */}
                        <div className="pt-8 pb-4 text-center">
                            <p className="text-xs text-gray-400 font-medium">DebtDert v0.1.0 (Beta)</p>
                        </div>
                    </div>
                )}

                {activeTab === 'TRASH' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 min-h-[50vh]">
                        {loading ? (
                            <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
                        ) : deletedDebts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                <Trash2 size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">Çöp kutusu boş</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Silinen {deletedDebts.length} Kayıt</span>
                                    <button
                                        onClick={handleCleanDeleted}
                                        className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                                    >
                                        Hepsini Temizle
                                    </button>
                                </div>
                                {deletedDebts.map(debt => (
                                    <div key={debt.id} className="relative group rounded-xl overflow-hidden border border-red-100 dark:border-red-900/30">
                                        <div className="opacity-60 pointer-events-none grayscale">
                                            <DebtCard debt={debt} currentUserId="" onClick={() => { }} />
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-white/90 dark:bg-slate-900/90 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                            <button
                                                onClick={() => handleRestore(debt.id)}
                                                className="flex flex-col items-center gap-1 text-green-600 hover:scale-110 transition-transform"
                                                title="Geri Yükle"
                                            >
                                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                                    <RotateCcw size={24} />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase">Geri Al</span>
                                            </button>
                                            <div className="w-px h-12 bg-gray-200 dark:bg-slate-700" />
                                            <button
                                                onClick={() => handlePermanentDelete(debt.id)}
                                                className="flex flex-col items-center gap-1 text-red-600 hover:scale-110 transition-transform"
                                                title="Kalıcı Sil"
                                            >
                                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                                                    <XCircle size={24} />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase">Sil</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
