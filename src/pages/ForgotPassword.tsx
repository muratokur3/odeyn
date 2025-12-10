import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { PhoneInput } from '../components/PhoneInput';
import { checkUserExists } from '../services/auth';

export const ForgotPassword = () => {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [userExists, setUserExists] = useState<boolean | null>(null);

    const handleCheckUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || loading) return;

        setLoading(true);
        try {
            const exists = await checkUserExists(phone);
            setUserExists(exists);
        } catch (error) {
            console.error(error);
            alert("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-xl border border-slate-700">

                <div className="relative mb-6 text-center">
                    <Link to="/login" className="absolute left-0 top-1 text-text-secondary hover:text-text-primary transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-text-primary">Şifremi Unuttum</h1>
                    <p className="text-text-secondary text-sm">Hesabınızı kurtarın</p>
                </div>

                {!userExists ? (
                    <form onSubmit={handleCheckUser} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary ml-1">Telefon Numarası</label>
                            <PhoneInput
                                value={phone}
                                onChange={setPhone}
                                required
                                placeholder="555 123 45 67"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !phone}
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Devam Et"}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl flex gap-3 text-left">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="text-blue-400 font-semibold mb-1">Hesap Bulundu</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    Güvenliğiniz için SMS ile giriş yapmalısınız. Giriş yaptıktan sonra profil ayarlarından şifrenizi yenileyebilirsiniz.
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/login"
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            Giriş Yap sayfasına git
                        </Link>

                        <button
                            onClick={() => setUserExists(null)}
                            className="w-full py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
                        >
                            Farklı bir numara dene
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
