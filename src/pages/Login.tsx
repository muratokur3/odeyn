import { useState } from 'react';
import { loginUser } from '../services/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Phone } from 'lucide-react';

export const Login = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await loginUser(phoneNumber, password);
            navigate('/');
        } catch (err: any) {
            setError('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-200">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-md border border-border transition-colors duration-200">
                <h1 className="text-3xl font-bold text-center mb-8 text-text-primary">
                    Giriş Yap
                </h1>

                {error && (
                    <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-500/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Telefon Numarası</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Phone size={18} className="text-text-secondary" />
                            </div>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setPhoneNumber(val);
                                }}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                placeholder="5551234567"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Şifre</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'İşleniyor...' : 'Giriş Yap'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link
                        to="/register"
                        className="text-primary hover:underline text-sm font-medium"
                    >
                        Hesabın yok mu? Kayıt ol
                    </Link>
                </div>
            </div>
        </div>
    );
};
