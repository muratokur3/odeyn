import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/profile';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../context/ModalContext';
import { ArrowLeft, Coins, Info, Loader2 } from 'lucide-react';

export const ExchangeRates = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showAlert } = useModal();

    const [loading, setLoading] = useState(false);
    const [usdRate, setUsdRate] = useState('');
    const [eurRate, setEurRate] = useState('');
    const [goldRate, setGoldRate] = useState('');

    useEffect(() => {
        if (user) {
            const rates = user.customExchangeRates || {};
            setUsdRate(rates['USD']?.toString() || '');
            setEurRate(rates['EUR']?.toString() || '');
            setGoldRate(rates['GOLD']?.toString() || '');
        }
    }, [user]);

    const handleSaveRates = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const customExchangeRates: Record<string, number> = {};
            if (usdRate) customExchangeRates['USD'] = parseFloat(usdRate);
            if (eurRate) customExchangeRates['EUR'] = parseFloat(eurRate);
            if (goldRate) customExchangeRates['GOLD'] = parseFloat(goldRate);

            await updateUserProfile(user.uid, {
                customExchangeRates
            });
            await showAlert("Başarılı", "Döviz kurları güncellendi.", "success");
        } catch (error: any) {
            console.error(error);
            showAlert("Hata", "Kurlar kaydedilirken hata oluştu.", "error");
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
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Döviz Kurları</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <div className="space-y-8">
                    {/* Exchange Rates Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                            <SectionTitle title="Özel Döviz Kurları" />
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-lg text-blue-600 dark:text-blue-400">
                                <Coins size={20} />
                            </div>
                        </div>
                        
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-3 mb-6">
                            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                                Burada tanımladığınız kurlar, sistemdeki otomatik kurlar yerine <b>tüm borç ve alacaklarınızın TRY karşılığını</b> hesaplamak için kullanılır.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 items-center">
                                <span className="text-sm font-semibold text-text-primary">1 USD =</span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={usdRate}
                                        onChange={(e) => setUsdRate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-right font-bold"
                                        placeholder="Aktif Kur"
                                        step="0.01"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary font-black">TRY</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 items-center">
                                <span className="text-sm font-semibold text-text-primary">1 EUR =</span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={eurRate}
                                        onChange={(e) => setEurRate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-right font-bold"
                                        placeholder="Aktif Kur"
                                        step="0.01"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary font-black">TRY</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 items-center">
                                <span className="text-sm font-semibold text-text-primary">1 Gram Altın =</span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={goldRate}
                                        onChange={(e) => setGoldRate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-right font-bold"
                                        placeholder="Aktif Kur"
                                        step="0.01"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary font-black">TRY</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveRates}
                                disabled={loading}
                                className="w-full py-3 mt-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    'Kurları Sabitle'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
