import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, User, ArrowRight, Smartphone } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { RecaptchaVerifier } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { startPhoneLogin, finalizeUserRegistration } from '../services/auth';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../hooks/useAuth';
import { PhoneInput } from '../components/PhoneInput';
import { formatPhoneForDisplay } from '../utils/phoneUtils';
import { TermsOfServiceModal, PrivacyPolicyModal } from '../components/LegalModals';

type Step = 'PHONE' | 'OTP' | 'DETAILS';

export const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { showAlert } = useModal();

    // Modals
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

    // Form Data
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [displayName, setDisplayName] = useState('');

    // Step State
    const [step, setStep] = useState<Step>('PHONE');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        // Initialize Recaptcha
        if (!recaptchaVerifier.current) {
            recaptchaVerifier.current = new RecaptchaVerifier(auth, 'login-recaptcha', {
                size: 'invisible',
            });
        }
        return () => {
            if (recaptchaVerifier.current) {
                recaptchaVerifier.current.clear();
                recaptchaVerifier.current = null;
            }
        };
    }, []);

    // Proactive Redirect: If user is already in context, just jump to dashboard
    const { user: contextUser, loading: authLoading } = useAuth();
    useEffect(() => {
        if (contextUser && !authLoading && step === 'PHONE') {
            navigate('/');
        }
    }, [contextUser, authLoading, step, navigate]);

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await startPhoneLogin(phone, recaptchaVerifier.current!);
            setConfirmationResult(result);
            setStep('OTP');
        } catch (err: unknown) {
            const error = err as Error;
            showAlert('SMS Gönderilemedi', error.message || 'Bilinmeyen hata', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult) return;
        setLoading(true);
        try {
            const result = await confirmationResult.confirm(otp);
            const user = result.user;

            // Seamless Check: Does user need to provide a name?
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists() || !userDoc.data()?.displayName || userDoc.data()?.displayName === 'Kullanıcı') {
                setStep('DETAILS');
            } else {
                navigate('/');
            }
        } catch (err: unknown) {
            const error = err as Error;
            showAlert('Doğrulama Başarısız', error.message || 'Bilinmeyen hata', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName || loading) return;

        setLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Oturum açılamadı.");

            await finalizeUserRegistration(currentUser, displayName);
            navigate('/');
        } catch (err: unknown) {
            const error = err as Error;
            showAlert("Hata", `İsim kaydedilemedi: ${error.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-xl border border-slate-700">
                
                <div className="text-center mb-8">
                    <h1
                        className="text-3xl font-extrabold text-text-primary mb-2"
                        style={{ letterSpacing: '0.15em' }}
                    >
                        ODEYN
                    </h1>
                    <p className="text-text-secondary">Güvenli ve Kolay Borç Takibi</p>
                </div>

                <div id="login-recaptcha"></div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {step === 'PHONE' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Smartphone size={32} className="text-primary" />
                                </div>
                                <h2 className="text-2xl font-extrabold text-text-primary">Giriş Yap</h2>
                                <p className="text-text-secondary text-sm mt-1">Telefon numaranızla hemen başlayın</p>
                            </div>
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
                        </div>
                    )}

                    {step === 'OTP' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <ShieldCheck size={48} className="mx-auto text-primary mb-2 opacity-80" />
                                <h2 className="text-xl font-bold text-text-primary">Kodu Doğrula</h2>
                                <div className="text-text-secondary text-sm mt-2">
                                    <div className="font-bold text-text-primary text-base mb-1">
                                        {formatPhoneForDisplay(phone)}
                                    </div>
                                    <div>numarasına gelen kodu girin.</div>
                                </div>
                            </div>
                            <form onSubmit={handleVerifySms} className="space-y-6">
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                    placeholder="000000"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 6}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "Doğrula"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep('PHONE')}
                                    className="w-full py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
                                >
                                    Numarayı Değiştir
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 'DETAILS' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <User size={32} className="text-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-text-primary">Sizi Tanıyalım</h2>
                                <p className="text-text-secondary text-sm">Profilinizi tamamlamak için isminizi girin</p>
                            </div>
                            <form onSubmit={handleCompleteRegistration} className="space-y-6">
                                <div className="relative">
                                    <User className="absolute left-4 top-3.5 text-text-secondary" size={20} />
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Ad Soyad"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary outline-none transition-all"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !displayName}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : (
                                        <>
                                            Başla <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center text-[10px] leading-relaxed text-text-secondary px-4">
                    Devam ederek{' '}
                    <button
                        onClick={() => setIsTermsOpen(true)}
                        className="text-primary hover:underline font-medium"
                    >
                        Kullanım Koşullarını
                    </button>
                    {' '}ve{' '}
                    <button
                        onClick={() => setIsPrivacyOpen(true)}
                        className="text-primary hover:underline font-medium"
                    >
                        Gizlilik Politikasını
                    </button>
                    {' '}kabul etmiş sayılırsınız.
                </div>
            </div>

            <TermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
            <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
        </div>
    );
};
