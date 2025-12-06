import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, XCircle, Clock } from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { restoreDebt, permanentlyDeleteDebt } from '../services/db';
import { DebtCard } from '../components/DebtCard';
import clsx from 'clsx';

export const Settings = () => {
    const navigate = useNavigate();
    const { debts: deletedDebts, loading } = useDebts(true);
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'TRASH'>('GENERAL');

    const handleRestore = async (debtId: string) => {
        if (confirm("Bu kaydı geri yüklemek istediğinize emin misiniz?")) {
            await restoreDebt(debtId);
        }
    };

    const handleDelete = async (debtId: string) => {
        if (confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
            await permanentlyDeleteDebt(debtId);
        }
    };

    const checkAutoDelete = async (days: number) => {
        if (!deletedDebts.length) return;

        const now = new Date();
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        let deletedCount = 0;

        for (const debt of deletedDebts) {
            // Assuming deletedAt is when it was moved to trash (soft deleted)
            if (debt.deletedAt && debt.deletedAt.toDate() < cutoffDate) {
                await permanentlyDeleteDebt(debt.id);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            alert(`${deletedCount} adet süresi dolmuş kayıt silindi.`);
            // Refresh list handled by useDebts hook usually, but we might need to trigger reload if it doesn't listen to real-time changes for hard deletes effectively or if we want immediate feedback.
            // Since useDebts listens to collection, hard delete should trigger update.
        }
    };

    return (
        <div className="min-h-full bg-gray-50">
            <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">Ayarlar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Tabs */}
                <div className="flex p-1 bg-gray-200 rounded-xl">
                    <button
                        onClick={() => setActiveTab('GENERAL')}
                        className={clsx(
                            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                            activeTab === 'GENERAL' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Genel
                    </button>
                    <button
                        onClick={() => setActiveTab('TRASH')}
                        className={clsx(
                            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                            activeTab === 'TRASH' ? "bg-white shadow-sm text-red-600" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Çöp Kutusu
                    </button>
                </div>

                {activeTab === 'GENERAL' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Clock size={20} className="text-blue-500" />
                                Otomatik Silme
                            </h2>
                            <select
                                value={localStorage.getItem('autoDeleteDuration') || 'OFF'}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    localStorage.setItem('autoDeleteDuration', value);
                                    // Force re-render
                                    setActiveTab('TRASH');
                                    setTimeout(() => setActiveTab('GENERAL'), 0);

                                    if (value !== 'OFF') {
                                        // Trigger cleanup check
                                        checkAutoDelete(parseInt(value));
                                    }
                                }}
                                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
                            >
                                <option value="OFF">Kapalı</option>
                                <option value="30">30 Gün</option>
                                <option value="60">60 Gün</option>
                                <option value="90">90 Gün</option>
                            </select>
                        </div>
                        <p className="text-sm text-gray-500">
                            Çöp kutusundaki kayıtlar, seçilen süre sonunda otomatik olarak kalıcı silinir.
                        </p>
                    </div>
                )}

                {activeTab === 'TRASH' && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-10">Yükleniyor...</div>
                        ) : deletedDebts.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <Trash2 size={48} className="mx-auto mb-2 opacity-20" />
                                <p>Çöp kutusu boş.</p>
                            </div>
                        ) : (
                            deletedDebts.map(debt => (
                                <div key={debt.id} className="relative group">
                                    <div className="opacity-50 pointer-events-none">
                                        <DebtCard debt={debt} currentUserId="" onClick={() => { }} />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center gap-4 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                        <button
                                            onClick={() => handleRestore(debt.id)}
                                            className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                                            title="Geri Yükle"
                                        >
                                            <RotateCcw size={24} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(debt.id)}
                                            className="p-3 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                            title="Kalıcı Sil"
                                        >
                                            <XCircle size={24} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
