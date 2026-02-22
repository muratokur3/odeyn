/**
 * TransactionList
 * Chat-style list of Cari transactions
 */

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Trash2, Edit2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { deleteLedgerTransaction } from '../services/transactionService';
import { isTransactionEditable } from '../services/db'; // New helper
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import clsx from 'clsx';
import type { Transaction, User, Contact, Debt } from '../types';
import { AdaptiveActionRow } from './AdaptiveActionRow';
import { type SwipeAction } from './SwipeableItem';
import { CreateDebtModal } from './CreateDebtModal';
import { Avatar } from './Avatar';

interface TransactionListProps {
    transactions: Transaction[];
    ledgerId: string;
    targetUser?: User | Contact | null;
    onRefresh?: () => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    ledgerId,
    targetUser,
    onLoadMore,
    hasMore,
    loadingMore
}) => {
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [openRowId, setOpenRowId] = useState<string | null>(null);

    // Infinite Scroll Intersection Observer
    useEffect(() => {
        if (!onLoadMore || !hasMore || loadingMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                onLoadMore();
            }
        }, { threshold: 0.1 });

        const loader = document.getElementById('infinite-scroll-trigger');
        if (loader) observer.observe(loader);

        return () => observer.disconnect();
    }, [onLoadMore, hasMore, loadingMore, transactions.length]);

    // Auto-Reset: Click anywhere else closes row
    useEffect(() => {
        const handleClickOutside = () => {
            if (openRowId) setOpenRowId(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openRowId]);


    const handleDelete = async (txId: string) => {
        if (!user) return;

        const confirmed = await showConfirm(
            "Kaydı Sil",
            "Bu işlem geri alınamaz. Kayıt tamamen silinecek. Emin misin?",
            "warning"
        );

        if (confirmed) {
            try {
                await deleteLedgerTransaction(ledgerId, txId, user.uid);
                showAlert("Silindi", "Kayıt başarıyla silindi.", "success");
            } catch (error) {
                console.error(error);
                showAlert("Hata", "Silme işlemi başarısız.", "error");
            }
        }
    };

    const handleEdit = (tx: Transaction) => {
        setEditingTx(tx);
    };

    if (transactions.length === 0 && !loadingMore) {
        return (
            <div className="text-center py-12 text-text-secondary">
                <div className="text-4xl mb-3 opacity-50">💸</div>
                <p className="font-medium">Henüz işlem yok</p>
                <p className="text-sm mt-1 opacity-70">Aşağıdaki + butonuyla ilk işlemi ekleyin</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4 pb-32">
            {(() => {
                const getGroupTitle = (date: Date) => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                    if (checkDate.getTime() === today.getTime()) return 'Bugün';
                    if (checkDate.getTime() === yesterday.getTime()) return 'Dün';

                    const diffTime = Math.abs(today.getTime() - checkDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < 7) return format(date, 'EEEE', { locale: tr });
                    return format(date, 'd MMMM yyyy', { locale: tr });
                };

                return transactions.map((tx, index) => {
                    const isMine = tx.createdBy === user?.uid;
                    const isOutgoing = tx.direction === 'OUTGOING';
                    // Perspective-aware coloring: Green if I gave (+) or They took (+)
                    const isAlacak = isMine === isOutgoing;

                    const createdAt = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date();
                    const dateTitle = getGroupTitle(createdAt);

                    // Grouping Logic for DESC order: 
                    // Show separator if it's the FIRST (top) item OR if its date differs from the PREVIOUS item (which is newer)
                    // Actually, in DESC order (Newest -> Oldest), we show separator when the date CHANGED compared to the item ABOVE it.
                    let showSeparator = false;
                    if (index === 0) {
                        showSeparator = true;
                    } else {
                        const prevTx = transactions[index - 1]; // Item ABOVE (newer)
                        const prevCreatedAt = prevTx.createdAt?.toDate ? prevTx.createdAt.toDate() : new Date();
                        const prevDateTitle = getGroupTitle(prevCreatedAt);
                        if (dateTitle !== prevDateTitle) {
                            showSeparator = true;
                        }
                    }

                    const isEditable = isMine && isTransactionEditable(createdAt);
                    const rightActions: SwipeAction[] = [];
                    if (isEditable) {
                        rightActions.push({
                            key: 'edit',
                            icon: <Edit2 size={20} />,
                            label: 'Düzenle',
                            color: 'bg-blue-500',
                            onClick: () => handleEdit(tx)
                        });
                        rightActions.push({
                            key: 'delete',
                            icon: <Trash2 size={20} />,
                            label: 'Sil',
                            color: 'bg-red-500',
                            onClick: () => handleDelete(tx.id)
                        });
                    }

                    const content = (
                        <div className={clsx(
                            "flex items-end gap-3 px-1 py-1 w-full",
                            isMine ? "flex-row-reverse" : "flex-row"
                        )}>
                            {/* Avatar */}
                            <Avatar
                                uid={isMine ? user?.uid : (targetUser && 'uid' in targetUser ? targetUser.uid : (targetUser && 'linkedUserId' in targetUser ? targetUser.linkedUserId : undefined))}
                                photoURL={!isMine && targetUser && 'photoURL' in targetUser ? targetUser.photoURL : undefined}
                                name={!isMine && targetUser ? ('displayName' in targetUser ? targetUser.displayName : targetUser.name) : 'Ben'}
                                size="sm"
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mb-0.5"
                                status={!isMine ? (targetUser && ('uid' in targetUser || ('linkedUserId' in targetUser && targetUser.linkedUserId)) ? 'system' : 'contact') : 'none'}
                            />

                            {/* Bubble */}
                            <div className={clsx(
                                "p-3 rounded-2xl shadow-sm border max-w-[80%] min-w-[120px] relative group transition-colors",
                                isAlacak
                                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
                                isMine ? "rounded-tr-sm" : "rounded-tl-sm"
                            )}>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-baseline justify-between gap-4">
                                        <p className={clsx(
                                            "text-lg font-bold leading-none",
                                            isAlacak ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                        )}>
                                            {formatCurrency(tx.amount, tx.currency || 'TRY', tx.goldDetail)}
                                        </p>
                                        <div className="text-[10px] text-text-secondary opacity-70 whitespace-nowrap">
                                            {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'HH:mm', { locale: tr }) : ''}
                                        </div>
                                    </div>
                                    {tx.description && (
                                        <p className="text-sm text-text-primary leading-snug break-words">{tx.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );

                    return (
                        <React.Fragment key={tx.id}>
                            {showSeparator && (
                                <div className="flex justify-center my-4 sticky top-16 z-10 pointer-events-none">
                                    <span className="bg-slate-200 dark:bg-slate-700 text-text-secondary text-[11px] font-bold px-3 py-1 rounded-full shadow-sm opacity-90 backdrop-blur-sm uppercase tracking-wide">
                                        {dateTitle}
                                    </span>
                                </div>
                            )}
                            <AdaptiveActionRow
                                leftActions={[]}
                                rightActions={rightActions}
                                onOpen={(dir) => setOpenRowId(`${tx.id}_${dir}`)}
                                onClose={() => setOpenRowId(null)}
                                isOpen={openRowId === `${tx.id}_left` ? 'left' : (openRowId === `${tx.id}_right` ? 'right' : null)}
                            >
                                {content}
                            </AdaptiveActionRow>
                        </React.Fragment>
                    );
                });
            })()}

            {/* Load More Indicator */}
            {hasMore && (
                <div id="infinite-scroll-trigger" className="flex justify-center py-6">
                    {loadingMore ? (
                        <div className="flex items-center gap-2 text-text-secondary">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-medium">Eski işlemler yükleniyor...</span>
                        </div>
                    ) : (
                        <div className="h-4" />
                    )}
                </div>
            )}

            {!hasMore && transactions.length > 10 && (
                <div className="text-center py-8 text-text-secondary opacity-40">
                    <p className="text-[10px] font-bold uppercase tracking-widest">Daha eski işlem bulunamadı</p>
                </div>
            )}

            {/* Edit Modal (Reusing CreateDebtModal) */}
            {editingTx && (
                <CreateDebtModal
                    isOpen={!!editingTx}
                    onClose={() => setEditingTx(null)}
                    editMode={true}
                    targetUser={targetUser}
                    initialData={{
                        id: editingTx.id,
                        lenderId: editingTx.direction === 'OUTGOING' ? (user?.uid || '') : (targetUser && 'uid' in targetUser ? targetUser.uid : ''),
                        borrowerId: editingTx.direction === 'INCOMING' ? (user?.uid || '') : (targetUser && 'uid' in targetUser ? targetUser.uid : ''),
                        lenderName: editingTx.direction === 'OUTGOING' ? (user?.displayName || 'Ben') : (targetUser && 'name' in targetUser ? targetUser.name : (targetUser as User)?.displayName || ''),
                        borrowerName: editingTx.direction === 'INCOMING' ? (user?.displayName || 'Ben') : (targetUser && 'name' in targetUser ? targetUser.name : (targetUser as User)?.displayName || ''),
                        originalAmount: editingTx.amount,
                        remainingAmount: editingTx.amount,
                        currency: editingTx.currency || 'TRY',
                        goldDetail: editingTx.goldDetail,
                        note: editingTx.description,
                        createdAt: editingTx.createdAt,
                        createdBy: editingTx.createdBy,
                        status: 'ACTIVE',
                        participants: []
                    } as Debt}
                />
            )}
        </div>
    );
};
