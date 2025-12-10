import { useState, useEffect, useRef } from 'react';

import { loginUser, ensureUserDocument } from '../services/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Lock, MessageSquare, Loader2, ArrowLeft } from 'lucide-react';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier | undefined;
    }
}

const COUNTRY_CODES = [
    { code: '+90', label: '🇹🇷 +90' },
    { code: '+1', label: '🇺🇸 +1' },
    { code: '+44', label: '🇬🇧 +44' },
    { code: '+49', label: '🇩🇪 +49' },
    { code: '+33', label: '🇫🇷 +33' },
    { code: '+31', label: '🇳🇱 +31' },
    { code: '+994', label: '🇦🇿 +994' },
    { code: '+7', label: '🇷🇺 +7' },
];

export const Login = () => {
    const [mode, setMode] = useState<'PASSWORD' | 'SMS'>('PASSWORD');
    const [countryCode, setCountryCode] = useState('+90');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'INPUT' | 'VERIFY'>('INPUT');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const recaptchaWrapperRef = useRef<HTMLDivElement>(null);

    // Initialize Recaptcha
    useEffect(() => {
        if (!window.recaptchaVerifier && recaptchaWrapperRef.current) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaWrapperRef.current, {
                'size': 'invisible',
                'callback': () => { }
            });
        }
        return () => {
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = undefined;
            }
        };
    }, [mode, step]);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await loginUser(phoneNumber, password);
            await ensureUserDocument(user);
            navigate('/');
        } catch (err: any) {
            setError('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Combine Country Code + Phone
        const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

        try {
            if (!window.recaptchaVerifier) throw new Error("Recaptcha not initialized");
            const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, window.recaptchaVerifier);
            setConfirmationResult(confirmation);
            setStep('VERIFY');
        } catch (err: any) {
            console.error(err);
            setError('SMS gönderilemedi: ' + err.message);
            if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!confirmationResult) throw new Error("No confirmation result");
            const result = await confirmationResult.confirm(otp);
            const user = result.user;

            // Ensure Firestore Document Exists
            await ensureUserDocument(user);

            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError('Doğrulama kodu hatalı.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-200">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-md border border-border transition-colors duration-200 relative">

                {/* Mode Switcher */}
                {step === 'INPUT' && (
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => setMode('PASSWORD')}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'PASSWORD'
                                ? 'bg-white dark:bg-slate-700 shadow text-primary'
                                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
                                }`}
                        >
                            <Lock size={16} /> Şifre
                        </button>
                        <button
                            onClick={() => setMode('SMS')}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${mode === 'SMS'
                                ? 'bg-white dark:bg-slate-700 shadow text-primary'
                                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
                                }`}
                        >
                            <MessageSquare size={16} /> SMS
                        </button>
                    </div>
                )}

                <h1 className="text-3xl font-bold text-center mb-2 text-text-primary">
                    {step === 'VERIFY' ? 'Doğrulama' : 'Giriş Yap'}
                </h1>
                <p className="text-center text-text-secondary mb-8 text-sm">
                    {step === 'VERIFY' ? 'Telefonunuza gelen kodu giriniz.' : 'Hesabınıza erişmek için bilgilerinizi girin.'}
                </p>

                {error && (
                    <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-500/20">
                        {error}
                    </div>
                )}

                {/* Password Login Form */}
                {mode === 'PASSWORD' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Telefon Numarası</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone size={18} className="text-text-secondary" />
                                </div>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                    placeholder="5551234567"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Şifre</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-text-secondary" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                    placeholder="••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>
                )}

                {/* SMS Login Form */}
                {mode === 'SMS' && step === 'INPUT' && (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Telefon Numarası</label>
                            <div className="flex gap-2">
                                <select
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                    className="px-2 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all appearance-none cursor-pointer min-w-[80px]"
                                >
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.label}</option>
                                    ))}
                                </select>
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Phone size={18} className="text-text-secondary" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                        placeholder="5551234567"
                                        required
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-text-secondary mt-1 ml-1">SMS doğrulama kodu gönderilecektir.</p>
                        </div>

                        <div ref={recaptchaWrapperRef} className="flex justify-center my-2"></div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                        </button>
                    </form>
                )}

                {/* SMS Verify Form */}
                {mode === 'SMS' && step === 'VERIFY' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Doğrulama Kodu</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full text-center tracking-widest text-2xl px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                                placeholder="123456"
                                maxLength={6}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? 'Doğrulanıyor...' : 'Doğrula ve Giriş Yap'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('INPUT');
                                setOtp('');
                            }}
                            className="w-full text-text-secondary text-sm hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                            <ArrowLeft size={14} /> Numarayı Değiştir
                        </button>
                    </form>
                )}

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
