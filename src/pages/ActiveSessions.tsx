import { useState, useEffect } from 'react';
import { ArrowLeft, Smartphone, Laptop, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSessions, revokeSession, type SessionData } from '../services/session';
import { useModal } from '../hooks/useModal';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export const ActiveSessions = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [loading, setLoading] = useState(true);

    const loadSessions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getSessions(user.uid);
            setSessions(data);
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Oturum bilgileri alınamadı.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, [user]);

    const handleRevoke = async (deviceId: string, isCurrent: boolean) => {
        if (!user) return;

        if (isCurrent) {
            showAlert("Uyarı", "Mevcut cihazın oturumunu buradan kapatamazsınız. Ayarlar menüsünden çıkış yapın.", "warning");
            return;
        }

        const confirmed = await showConfirm(
            "Cihazı Kaldır",
            "Bu cihazın oturumunu kapatmak istediğinize emin misiniz?",
            "warning"
        );

        if (confirmed) {
            try {
                await revokeSession(user.uid, deviceId);
                await loadSessions(); // Refresh list
                showAlert("Başarılı", "Cihaz oturumu kapatıldı.", "success");
            } catch (error) {
                console.error(error);
                showAlert("Hata", "İşlem başarısız oldu.", "error");
            }
        }
    };

    const getDeviceIcon = (platform: string) => {
        if (platform === 'web') return <Laptop size={24} />;
        return <Smartphone size={24} />;
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
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Aktif Oturumlar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 max-w-lg">
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 rounded-lg h-fit">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-100 text-sm">Oturum Güvenliği</h3>
                        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
                            Hesabınıza erişimi olan cihazlar aşağıda listelenmiştir. Tanımadığınız bir cihaz görürseniz oturumunu kapatın.
                            90 gün kullanılmayan cihazlar otomatik olarak silinir.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
                ) : (
                    <div className="space-y-4">
                        {sessions.map((session) => (
                            <div
                                key={session.deviceId}
                                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${session.isCurrent
                                        ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                                        : 'border-gray-100 dark:border-slate-800 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className={`p-3 rounded-xl ${session.isCurrent
                                                ? 'bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                                            }`}>
                                            {getDeviceIcon(session.platform)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                                    {session.deviceName}
                                                </h3>
                                                {session.isCurrent && (
                                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                        BU CİHAZ
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Son görülme: {session.lastActiveAt ? formatDistanceToNow(session.lastActiveAt.toDate(), { addSuffix: true, locale: tr }) : 'Bilinmiyor'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-mono mt-1 opacity-70">
                                                ID: {session.deviceId.slice(0, 8)}...
                                            </p>
                                        </div>
                                    </div>

                                    {!session.isCurrent && (
                                        <button
                                            onClick={() => handleRevoke(session.deviceId, !!session.isCurrent)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Oturumu Kapat"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {sessions.length === 0 && (
                            <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                                <AlertCircle size={48} className="text-gray-300 mb-4" />
                                <p>Aktif oturum bulunamadı.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
