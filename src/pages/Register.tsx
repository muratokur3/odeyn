
import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../services/firebase';
import { startPhoneLogin, linkPasswordToPhone } from '../services/auth';
import { PhoneInput } from '../components/PhoneInput';
import { Loader2, ArrowRight, Check, ShieldCheck, User, Lock, Mail } from 'lucide-react';

type Step = 'PHONE' | 'OTP' | 'DETAILS';

export const Register = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('PHONE');
    const [loading, setLoading] = useState(false);

    // Data
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState(''); // Recovery email

    // Auth Objects
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        // Initialize Recaptcha
        if (!recaptchaVerifier.current) {
            recaptchaVerifier.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            });
        }
    }, []);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || loading) return;

        setLoading(true);
        try {
            if (!recaptchaVerifier.current) return;
            const result = await startPhoneLogin(phone, recaptchaVerifier.current);
            setConfirmationResult(result);
            setStep('OTP');
        } catch (error) {
            console.error(error);
            alert("SMS gönderilemedi. Lütfen numarayı kontrol edin.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || !confirmationResult || loading) return;

        setLoading(true);
        try {
            await confirmationResult.confirm(otp);
            // User is now signed in with Phone Credential
            setStep('DETAILS');
        } catch (error) {
            console.error(error);
            alert("Hatalı kod.");
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName || !password || loading) return;

        setLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No user signed in");

            await linkPasswordToPhone(currentUser, password, displayName, email);
            navigate('/');
        } catch (error) {
            console.error(error);
            alert("Hesap oluşturulurken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-xl border border-slate-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-text-primary mb-2">DebtDert</h1>
                    <p className="text-text-secondary">Yeni Nesil Borç Takibi</p>
                </div>

                {/* Stepper Indicators */}
                <div className="flex justify-between mb-8 px-4">
                    <div className={`flex flex - col items - center gap - 1 ${step === 'PHONE' ? 'text-primary' : 'text-text-secondary'} `}>
                        <div className={`w - 8 h - 8 rounded - full flex items - center justify - center border - 2 ${step === 'PHONE' ? 'border-primary bg-primary/10' : 'border-slate-600'} `}>1</div>
                        <span className="text-xs">Tel</span>
                    </div>
                    <div className={`h - 0.5 flex - 1 mx - 2 my - 4 bg - slate - 700 ${step !== 'PHONE' ? 'bg-primary' : ''} `} />
                    <div className={`flex flex - col items - center gap - 1 ${step === 'OTP' ? 'text-primary' : step === 'DETAILS' ? 'text-primary' : 'text-text-secondary'} `}>
                        <div className={`w - 8 h - 8 rounded - full flex items - center justify - center border - 2 ${step === 'OTP' ? 'border-primary bg-primary/10' : step === 'DETAILS' ? 'border-primary bg-primary' : 'border-slate-600'} `}>
                            {step === 'DETAILS' ? <Check size={16} className="text-white" /> : '2'}
                        </div>
                        <span className="text-xs">Kod</span>
                    </div>
                    <div className={`h - 0.5 flex - 1 mx - 2 my - 4 bg - slate - 700 ${step === 'DETAILS' ? 'bg-primary' : ''} `} />
                    <div className={`flex flex - col items - center gap - 1 ${step === 'DETAILS' ? 'text-primary' : 'text-text-secondary'} `}>
                        <div className={`w - 8 h - 8 rounded - full flex items - center justify - center border - 2 ${step === 'DETAILS' ? 'border-primary bg-primary/10' : 'border-slate-600'} `}>3</div>
                        <span className="text-xs">Bilgi</span>
                    </div>
                </div>

                {/* Step 1: Phone */}
                {step === 'PHONE' && (
                    <form onSubmit={handleSendOtp} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-900/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : (
                                <>
                                    Devam Et <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Step 2: OTP */}
                {step === 'OTP' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-2">
                            <ShieldCheck size={48} className="mx-auto text-primary mb-2 opacity-80" />
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
                            {loading ? <Loader2 className="animate-spin" /> : "Doğrula"}
                        </button>
                    </form>
                )}

                {/* Step 3: Details */}
                {step === 'DETAILS' && (
                    <form onSubmit={handleCompleteRegistration} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-4">
                            <p className="text-green-500 font-medium flex items-center justify-center gap-2">
                                <Check size={18} /> Telefon Doğrulandı
                            </p>
                            <p className="text-text-secondary text-sm mt-1">Hesabınızı güvene almak için şifre belirleyin.</p>
                        </div>

                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-text-secondary" size={20} />
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ad Soyad"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-text-secondary" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Şifre"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                required
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-text-secondary" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="E-posta (Kurtarma için - İsteğe Bağlı)"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 mt-4"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Kaydı Tamamla"}
                        </button>
                    </form>
                )}

                <div id="recaptcha-container"></div>

                <div className="mt-8 text-center">
                    <p className="text-text-secondary">
                        Zaten hesabınız var mı?{' '}
                        <Link to="/login" className="text-primary hover:text-blue-400 font-medium transition-colors">
                            Giriş Yap
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

