import { ArrowLeft, Download, Trash2, Shield, Info, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../hooks/useModal';
import { useDebts } from '../hooks/useDebts';
import { exportDebtsToCSV } from '../utils/export';
import { initiateAccountDeletion } from '../services/accountDeletionService';
import { useAuth } from '../hooks/useAuth';
import { deleteAuthUser } from '../services/auth';

const PrivacyRow = ({ icon: Icon, title, description, onClick, variant = 'default' }: {
    icon: React.ElementType;
    title: string;
    description?: string;
    onClick?: () => void;
    variant?: 'default' | 'danger';
}) => (
    <div
        onClick={onClick}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors active:bg-gray-100 dark:active:bg-slate-800"
    >
        <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
            <div className={`p-2 rounded-xl ${
                variant === 'danger'
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
            }`}>
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${variant === 'danger' ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                    {title}
                </h3>
                {description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>}
            </div>
        </div>
        <div className="flex-shrink-0">
            <ChevronRight size={18} className="text-gray-400" />
        </div>
    </div>
);

const SectionHeader = ({ title }: { title: string }) => (
    <h2 className="px-4 pb-2 mt-6 text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
        {title}
    </h2>
);

export const PrivacySettings = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();
    const { allDebts } = useDebts();

    const handleExport = () => {
        if (allDebts.length === 0) {
            showAlert('Bilgi', 'Dışa aktarılacak borç bulunamadı.', 'info');
            return;
        }
        exportDebtsToCSV(allDebts);
    };

    const handleDataRequest = () => {
        showAlert(
            "Veri Talebi",
            "Hesap verilerinizin tamamını içeren detaylı bir rapor talep etmek için destek@debtdert.com adresine kayıtlı telefon numaranızla birlikte e-posta gönderebilirsiniz. Talebiniz 30 gün içinde karşılanacaktır.",
            "info"
        );
    };

    const handleDeleteAccount = async () => {
        const confirmed = await showConfirm(
            "Hesabı Kalıcı Olarak Sil",
            "Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz. Borç kayıtlarınız karşı taraflar için anonimleştirilecektir.",
            "error"
        );

        if (confirmed) {
            try {
                if (!user) return;

                // 1. Delete/Anonymize Firestore data
                await initiateAccountDeletion(user.uid);

                // 2. Delete Auth User
                try {
                    await deleteAuthUser();
                    showAlert("Başarılı", "Hesabınız başarıyla silindi.", "success");
                    navigate('/login');
                } catch (authError) {
                    const err = authError as { code?: string };
                    console.error("Auth deletion error:", authError);
                    if (err.code === 'auth/requires-recent-login') {
                        showAlert("Güvenlik Uyarısı", "Hesabınızı silmek için yakın zamanda giriş yapmış olmanız gerekmektedir. Lütfen çıkış yapıp tekrar giriş yaptıktan sonra tekrar deneyin.", "warning");
                    } else {
                        showAlert("Kısmi Başarı", "Verileriniz silindi ancak oturumunuz kapatılamadı. Lütfen manuel olarak çıkış yapın.", "info");
                        navigate('/login');
                    }
                }
            } catch (error) {
                console.error("Account deletion error:", error);
                showAlert("Hata", "Hesap silme işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.", "error");
            }
        }
    };

    return (
        <div className="min-h-full bg-gray-50 dark:bg-black pb-10">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Gizlilik ve Veriler</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <div className="space-y-1">
                    <div className="flex flex-col items-center py-6 mb-2">
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mb-3">
                            <Shield size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center px-4">
                            Veri ve Gizlilik Yönetimi
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 text-center max-w-sm px-4">
                            Kişisel verilerinizi kontrol edin, dışa aktarın veya hesabınızı yönetin.
                        </p>
                    </div>

                    <SectionHeader title="Veri Yönetimi" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <PrivacyRow
                            icon={Download}
                            title="Verilerimi İndir"
                            description="Tüm borç ve işlem geçmişinizi CSV formatında indirin."
                            onClick={handleExport}
                        />
                        <PrivacyRow
                            icon={FileText}
                            title="Hesap Verileri Talebi"
                            description="GDPR kapsamında tüm verilerinizin kopyasını talep edin."
                            onClick={handleDataRequest}
                        />
                    </div>

                    <SectionHeader title="Yasal" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                        <PrivacyRow
                            icon={Info}
                            title="Gizlilik Politikası"
                            description="Verilerinizin nasıl işlendiğini öğrenin."
                            onClick={() => window.open('https://debtdert.com/privacy', '_blank')}
                        />
                    </div>

                    <SectionHeader title="Hesap Yönetimi" />
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                        <PrivacyRow
                            icon={Trash2}
                            title="Hesabı Sil"
                            description="Hesabınızı ve tüm verilerinizi kalıcı olarak silin."
                            onClick={handleDeleteAccount}
                            variant="danger"
                        />
                    </div>

                    <div className="pt-8 px-4">
                        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                            Hesabınızı sildiğinizde, diğer kullanıcılarla olan ortak borç kayıtlarınız
                            karşı tarafların mağdur olmaması adına anonimleştirilerek korunur.
                            Kendi oluşturduğunuz ve sadece size ait olan veriler tamamen silinir.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};
