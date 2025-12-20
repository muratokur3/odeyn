
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, XCircle } from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { restoreDebt, permanentlyDeleteDebt } from '../services/db';
import { useAuth } from '../hooks/useAuth';
import { DebtCard } from '../components/DebtCard';
import { useModal } from '../context/ModalContext';

export const Trash = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const { allDebts, loading } = useDebts(true);
    const deletedDebts = allDebts.filter(d => d.isDeleted);

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
            "error"
        );
        if (confirmed) {
            await permanentlyDeleteDebt(debtId, user.uid);
            showAlert("Silindi", "Kayıt kalıcı olarak silindi.", "success");
        }
    };

    const handleCleanDeleted = async () => {
        if (!deletedDebts.length || !user) return;

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
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Çöp Kutusu</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
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
                                        <DebtCard debt={debt} currentUserId="" onClick={() => {}} />
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
            </main>
        </div>
    );
};
