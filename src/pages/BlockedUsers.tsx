import { useState, useEffect } from 'react';
import { ArrowLeft, UserX, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getBlockedUsers, unblockUser } from '../services/blockService';
import type { BlockRecord } from '../services/blockService';
import { useModal } from '../context/ModalContext';
import { Avatar } from '../components/Avatar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export const BlockedUsers = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useModal();
    const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBlockedUsers();
    }, [user]);

    const loadBlockedUsers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getBlockedUsers(user.uid);
            setBlockedUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (blockedUid: string, name: string) => {
        if (!user) return;
        const confirmed = await showConfirm(
            "Engeli Kaldır",
            `${name} adlı kullanıcının engelini kaldırmak istiyor musunuz?`
        );
        if (confirmed) {
            try {
                await unblockUser(user.uid, blockedUid);
                showAlert("Başarılı", "Engel kaldırıldı.", "success");
                await loadBlockedUsers();
            } catch (error) {
                console.error(error);
                showAlert("Hata", "İşlem başarısız oldu.", "error");
            }
        }
    };

    return (
        <div className="min-h-full bg-background transition-colors duration-200">
            {/* Header */}
            <header className="bg-surface shadow-sm sticky top-0 z-40 transition-colors duration-200">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary hover:bg-background rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-text-primary">Engellenen Kullanıcılar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
                {loading ? (
                    <div className="text-center py-10 text-text-secondary">Yükleniyor...</div>
                ) : blockedUsers.length > 0 ? (
                    <div className="bg-surface rounded-xl shadow-sm border border-border divide-y divide-border overflow-hidden transition-colors duration-200">
                        {blockedUsers.map((record) => (
                            <div
                                key={record.blockedUid}
                                className="p-4 flex items-center justify-between hover:bg-background/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <Avatar
                                        name={record.name || 'Bilinmeyen'}
                                        size="md"
                                        status="none"
                                        className="grayscale opacity-70"
                                    />
                                    <div>
                                        <h3 className="font-semibold text-text-primary">
                                            {record.name || 'Bilinmeyen Kullanıcı'}
                                        </h3>
                                        <p className="text-xs text-text-secondary">
                                            Engellendi: {record.blockedAt ? format(record.blockedAt.toDate(), 'd MMM yyyy', { locale: tr }) : '-'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnblock(record.blockedUid, record.name || 'Bu kullanıcı')}
                                    className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Unlock size={16} /> Engeli Kaldır
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-text-secondary opacity-60">
                        <UserX size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                        <p>Engellenmiş kullanıcı bulunmuyor.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
