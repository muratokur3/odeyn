import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, MessageSquare, Loader2, ArrowLeft } from 'lucide-react';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth';
import { PhoneInput } from '../components/PhoneInput';
import { loginWithPhoneAndPassword, startPhoneLogin, ensureUserDocument } from '../services/auth';
import { searchUserByPhone } from '../services/db';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';

export const Login = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'PASSWORD' | 'SMS'>('SMS');
    const [loading, setLoading] = useState(false);
    const { showAlert } = useModal();

    // Form Data
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');

    // SMS State
    const [smsStep, setSmsStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        // Initialize Recaptcha for SMS login
        if (!recaptchaVerifier.current) {
            recaptchaVerifier.current = new RecaptchaVerifier(auth, 'login-recaptcha', {
                size: 'invisible',
            });
        }
    }, []);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !password || loading) return;

        setLoading(true);
        try {
            await loginWithPhoneAndPassword(phone, password);
            navigate('/');
        } catch (error) {
            console.error(error);
            showAlert("Giriş Başarısız", "Giriş yapılamadı. Bilgilerinizi kontrol edin.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || loading) return;

        setLoading(true);
        try {
            // Check existence for SMS Login to prevent auto-registration or clarify flow
            const existingUser = await searchUserByPhone(phone);
            if (!existingUser) {
                showAlert("Kayıt Bulunamadı", "Bu numarada bir kayıt yok. Lütfen kayıt olun.", "warning");
                return;
            }

            if (!recaptchaVerifier.current) return;
            const result = await startPhoneLogin(phone, recaptchaVerifier.current);
            setConfirmationResult(result);
            setSmsStep('VERIFY');
        } catch (error) {
            console.error(error);
            showAlert("Hata", "SMS gönderilemedi.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || !confirmationResult || loading) return;

        setLoading(true);
        try {
            const result = await confirmationResult.confirm(otp);
            if (result.user) {
                // Ensure doc exists for SMS-only users
                await ensureUserDocument(result.user);
                navigate('/');
            }
        } catch (error) {
            console.error(error);
            showAlert("Hata", "Hatalı kod girdiniz.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

            <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-xl border border-slate-700">

                {/* Header with Back */}
                <div className="relative mb-6 text-center">
                    <Link to="/" className="absolute left-0 top-1 text-text-secondary hover:text-text-primary transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-text-primary">Giriş Yap</h1>
                    <p className="text-text-secondary text-sm">Hesabınıza erişin</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-background rounded-xl p-1 mb-8 border border-slate-700">
                    <button
                        onClick={() => setActiveTab('SMS')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'SMS'
                                ? "bg-primary text-white shadow-md"
                                : "text-text-secondary hover:text-text-primary hover:bg-surface"
                        )}
                    >
                        <MessageSquare size={16} /> SMS ile
                    </button>
                    <button
                        onClick={() => setActiveTab('PASSWORD')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                            activeTab === 'PASSWORD'
                                ? "bg-primary text-white shadow-md"
                                : "text-text-secondary hover:text-text-primary hover:bg-surface"
                        )}
                    >
                        <Lock size={16} /> Şifre ile
                    </button>
                </div>

                {/* Password Login Form */}
                {activeTab === 'PASSWORD' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary ml-1">Telefon Numarası</label>
                            <PhoneInput
                                value={phone}
                                onChange={setPhone}
                                required
                                placeholder="555 123 45 67"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-secondary ml-1">Şifre</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 text-text-secondary" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••"
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                    required
                                />
                            </div>
                            <div className="text-right">
                                <Link to="/forgot-password" className="text-xs text-primary hover:text-blue-400 font-medium transition-colors">
                                    Şifremi Unuttum
                                </Link>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !phone || !password}
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Giriş Yap"}
                        </button>
                    </form>
                )}

                {/* SMS Login Form */}
                {activeTab === 'SMS' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {smsStep === 'REQUEST' ? (
                            <form onSubmit={handleSendSms} className="space-y-6">
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
                                    {loading ? <Loader2 className="animate-spin" /> : "Kod Gönder"}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifySms} className="space-y-6">
                                <div className="text-center mb-2">
                                    <p className="text-text-secondary text-sm">
                                        {phone} numarasına gelen kodu girin.
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                    placeholder="000000"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 6}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "Doğrula ve Giriş Yap"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSmsStep('REQUEST')}
                                    className="w-full py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
                                >
                                    Numarayı Değiştir
                                </button>
                            </form>
                        )}
                    </div>
                )}

                <div id="login-recaptcha"></div>

                <div className="mt-8 text-center">
                    <p className="text-text-secondary">
                        Hesabınız yok mu?{' '}
                        <Link to="/register" className="text-primary hover:text-blue-400 font-medium transition-colors">
                            Kayıt Ol
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};
