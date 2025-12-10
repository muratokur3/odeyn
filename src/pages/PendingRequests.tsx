import { useDebts } from '../hooks/useDebts';
import { useAuth } from '../hooks/useAuth';
import { DebtCard } from '../components/DebtCard';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export const PendingRequests = () => {
    const { incomingRequests: debts, loading } = useDebts();
    const { user } = useAuth();
    const navigate = useNavigate();

    const pendingDebts = useMemo(() => {
        if (!user || user.uid.length < 5) return []; // Basic check
        // Rule: Show if I am the counterparty AND status is PENDING
        // Note: The one who APPROVED it (status changes to ACTIVE) is me.

        return debts.filter(d => {
            const isCreator = d.createdBy === user.uid;

            // If I created it, I see it in Dashboard (Trust First). 
            // Here we want to see requests FROM OTHERS.
            if (isCreator) return false;

            return d.status === 'PENDING';
        });
    }, [debts, user]);

    if (loading) return <div className="p-4 text-center">Yükleniyor...</div>;

    return (
        <div className="min-h-full bg-gray-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Onay Bekleyenler</h1>
            </div>

            <main className="p-4 space-y-4">
                {pendingDebts.length > 0 ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
                            Bu işlemler karşı tarafın oluşturduğu ve senin onayını bekleyen kayıtlardır. Onayladığında bakiyene yansır.
                        </div>
                        {pendingDebts.map(debt => (
                            <DebtCard
                                key={debt.id}
                                debt={debt}
                                currentUserId={user?.uid || ''}
                                onClick={() => { }} // Maybe expand details? For now DebtCard handles actions if pending
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-60 text-center">
                        <div className="bg-green-100 dark:bg-green-900/20 p-6 rounded-full mb-4 text-green-600 dark:text-green-400">
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Her Şey Güncel!</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                            Seni bekleyen bir onay isteği bulunmuyor.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};
