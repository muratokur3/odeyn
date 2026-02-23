import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, FileText } from 'lucide-react';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon: React.ElementType;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, title, children, icon: Icon }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-surface border border-slate-700 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-surface/50 sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Icon className="text-primary" size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-text-primary">{title}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-full text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto text-text-secondary leading-relaxed space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
                            {children}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-800 flex justify-end bg-surface/50">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/20"
                            >
                                Anladım
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export const TermsOfServiceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <LegalModal isOpen={isOpen} onClose={onClose} title="Kullanım Koşulları" icon={FileText}>
        <div className="space-y-4 text-sm">
            <section>
                <h3 className="font-bold text-text-primary mb-2">1. Taraflar</h3>
                <p>Bu Kullanım Koşulları, DebtDert uygulamasını ("Uygulama") kullanan kişi ("Kullanıcı") ile Uygulama geliştiricileri arasındadır.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">2. Hizmetin Tanımı</h3>
                <p>DebtDert, kullanıcıların şahsi borç ve alacak kayıtlarını dijital ortamda tutmalarına olanak sağlayan bir takip platformudur. Uygulama, finansal bir danışmanlık, bankacılık veya ödeme hizmeti sunmaz.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">3. Kullanım Şartları</h3>
                <p>Uygulamayı kullanarak, girdiğiniz tüm verilerin doğruluğundan bizzat sorumlu olduğunuzu kabul edersiniz. Uygulama, kullanıcılar arasındaki borç ilişkilerinde bir arabulucu veya şahitlik rolü üstlenmez.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">4. Veri Sorumluluğu</h3>
                <p>Kaydedilen borçların takibi, vadesi ve tahsili tamamen kullanıcının insiyatifindedir. Uygulama üzerinde yapılan hatalı girişlerden veya veri kayıplarından doğabilecek zararlardan Uygulama geliştiricileri sorumlu tutulamaz.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">5. Yasaklı Kullanım</h3>
                <p>Uygulama yasa dışı ticari faaliyetler, kara para aklama veya tefecilik gibi yasal olmayan işler için kullanılamaz. Bu tür kullanımların tespiti durumunda hesap askıya alınabilir.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">6. Değişiklikler</h3>
                <p>Uygulama geliştiricileri, bu kullanım koşullarını dilediği zaman güncelleme hakkına sahiptir. Kullanıcılar, Uygulamayı kullanmaya devam ederek güncel koşulları kabul etmiş sayılırlar.</p>
            </section>
        </div>
    </LegalModal>
);

export const PrivacyPolicyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <LegalModal isOpen={isOpen} onClose={onClose} title="Gizlilik Politikası" icon={Shield}>
        <div className="space-y-4 text-sm">
            <section>
                <h3 className="font-bold text-text-primary mb-2">1. Toplanan Veriler</h3>
                <p>Kimlik doğrulaması yapabilmek için telefon numaranız ve profil oluştururken verdiğiniz isim verileri toplanmaktadır. Ayrıca, Uygulama içinde oluşturduğunuz borç kayıtları (miktar, tarih, açıklama, karşı taraf bilgisi) sistemlerimizde saklanır.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">2. Veri Kullanım Amacı</h3>
                <p>Toplanan veriler, sadece Uygulama'nın temel işlevlerini (borç takibi, bildirimler, hesap yönetimi) yerine getirmek amacıyla kullanılır. Verileriniz reklam amacıyla üçüncü taraflarla paylaşılmaz.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">3. Veri Saklama ve Güvenlik</h3>
                <p>Verileriniz, Google Firebase altyapısı kullanılarak yüksek güvenlikli bulut sunucularında şifrelenmiş olarak saklanır. Güvenliğiniz için SMS doğrulama sistemi kullanılmaktadır.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">4. Rehber Erişimi</h3>
                <p>Uygulama, borç kaydı oluştururken kişilerinizi kolayca seçebilmeniz için rehber erişim izni isteyebilir. Rehber verileriniz sunucularımıza kopyalanmaz, sadece Uygulama içerisinde yerel olarak gösterim ve eşleştirme amaçlı kullanılır.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">5. Veri Silme Hakları</h3>
                <p>Kullanıcılar, diledikleri zaman hesaplarını ve tüm geçmiş verilerini Uygulama ayarları üzerinden kalıcı olarak silebilirler. Silinen veriler geri getirilemez.</p>
            </section>
            <section>
                <h3 className="font-bold text-text-primary mb-2">6. İletişim</h3>
                <p>Gizlilik politikamızla ilgili her türlü sorunuz için uygulama içi destek bölümünden bize ulaşabilirsiniz.</p>
            </section>
        </div>
    </LegalModal>
);
