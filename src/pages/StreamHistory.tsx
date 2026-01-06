import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContactName } from '../hooks/useContactName';
import { ArrowLeft } from 'lucide-react';
import { TransactionList } from '../components/TransactionList';
import { Avatar } from '../components/Avatar';
import { useLedger } from '../hooks/useLedger';
import { cleanPhone as cleanPhoneNumber, formatPhoneForDisplay as formatPhoneNumber } from '../utils/phoneUtils';
import { useMemo, useRef, useEffect } from 'react';

export const StreamHistory = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { resolveName } = useContactName();
    const scrollRef = useRef<HTMLDivElement>(null);

    const personInfo = useMemo(() => {
        const { displayName } = resolveName(id || '', '');
        return {
            name: displayName,
            phone: id && id.length <= 15 ? cleanPhoneNumber(id) : ''
        };
    }, [id, resolveName]);

    // Ledger hook
    const otherPartyId = id;
    const { ledgerId, transactions, loading: txLoading } = useLedger(
        user?.uid,
        user?.displayName,
        otherPartyId || undefined,
        personInfo.name
    );

    // Scroll to bottom on load
    useEffect(() => {
        if (scrollRef.current && transactions.length > 0) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transactions]);

    if (!user) return null;

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <ArrowLeft size={22} />
                </button>

                <div className="flex items-center gap-3">
                    <Avatar
                        name={personInfo.name}
                        size="sm"
                        uid={id && id.length > 20 ? id : undefined}
                    />
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-text-primary truncate leading-tight">{personInfo.name}</h1>
                        <p className="text-xs text-text-secondary">Akış Geçmişi</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
            >
                {txLoading ? (
                    <div className="h-full flex items-center justify-center text-text-secondary">Yükleniyor...</div>
                ) : ledgerId && transactions.length > 0 ? (
                    <div className="min-h-full flex flex-col justify-end">
                        <TransactionList transactions={transactions} ledgerId={ledgerId} />
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                        <div className="text-4xl mb-3 opacity-50">💬</div>
                        <p className="font-medium">Henüz akış kaydı yok</p>
                    </div>
                )}
            </div>
        </div>
    );
};
