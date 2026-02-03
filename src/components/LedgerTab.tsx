import { useMemo } from 'react';
import { useLedger } from '../hooks/useLedger';
import { TransactionList } from '../components/TransactionList';
import { useAuth } from '../hooks/useAuth';
import { calculateLedgerBalance } from '../services/transactionService';

interface LedgerTabProps {
    personId: string;
    personName: string;
}

export const LedgerTab = ({ personId, personName }: LedgerTabProps) => {
    const { user } = useAuth();
    
    const { ledgerId, transactions, loading } = useLedger(
        user?.uid,
        user?.displayName,
        personId,
        personName
    );

    const balance = useMemo(() => {
        if (!user) return 0;
        return calculateLedgerBalance(transactions, user.uid);
    }, [transactions, user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-text-secondary">Yükleniyor...</div>
            </div>
        );
    }

    if (!ledgerId) {
        return (
            <div className="bg-surface rounded-2xl p-8 text-center border border-dashed border-border">
                <span className="text-4xl mb-3 block">📒</span>
                <p className="text-text-secondary font-medium">Henüz cari hesap yok</p>
                <p className="text-sm text-text-tertiary mt-2">
                    İlk işlemi eklemek için + butonunu kullanın
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header - Transaction Flow Direction */}
            <div className="text-center py-2">
                <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
                    Cari Hesap İşlemleri
                </h3>
                <p className="text-xs text-text-tertiary mt-1">
                    {balance >= 0 ? '↓ Alacaklarınız' : '↑ Borçlarınız'}
                </p>
            </div>

            {/* Balance Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
                <div className="text-sm font-medium text-text-secondary mb-2 text-center">Cari Hesap Bakiyesi</div>
                <div className="text-3xl font-bold text-center">
                    <span className={balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {new Intl.NumberFormat('tr-TR').format(Math.abs(balance))} TL
                    </span>
                </div>
                <div className="text-sm text-text-secondary mt-1 text-center">
                    {balance > 0 && 'Size borçlu'}
                    {balance < 0 && 'Siz borçlusunuz'}
                    {balance === 0 && 'Bakiye dengede'}
                </div>
            </div>

            {/* Transaction List */}
            <TransactionList ledgerId={ledgerId} transactions={transactions} />
        </div>
    );
};
