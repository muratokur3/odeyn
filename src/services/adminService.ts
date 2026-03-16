import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    getCountFromServer,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Feedback } from './feedback';

export interface AdminStats {
    totalUsers: number;
    totalDebts: number;
    activeDebts: number;
    paidDebts: number;
    hiddenDebts: number;
    totalFeedbacks: number;
}

export interface AdminFeedback extends Omit<Feedback, 'createdAt'> {
    id: string;
    createdAt: { seconds: number; nanoseconds: number } | null;
}

export interface AdminDebtSummary {
    id: string;
    lenderName: string;
    borrowerName: string;
    originalAmount: number;
    currency: string;
    status: string;
    createdAt: { seconds: number; nanoseconds: number } | null;
}

export const getAdminStats = async (): Promise<AdminStats> => {
    const [
        usersSnap,
        totalDebtsSnap,
        activeDebtsSnap,
        paidDebtsSnap,
        hiddenDebtsSnap,
        feedbacksSnap,
    ] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'debts')),
        getCountFromServer(query(collection(db, 'debts'), where('status', '==', 'ACTIVE'))),
        getCountFromServer(query(collection(db, 'debts'), where('status', '==', 'PAID'))),
        getCountFromServer(query(collection(db, 'debts'), where('status', '==', 'AUTO_HIDDEN'))),
        getCountFromServer(collection(db, 'feedbacks')),
    ]);

    return {
        totalUsers: usersSnap.data().count,
        totalDebts: totalDebtsSnap.data().count,
        activeDebts: activeDebtsSnap.data().count,
        paidDebts: paidDebtsSnap.data().count,
        hiddenDebts: hiddenDebtsSnap.data().count,
        totalFeedbacks: feedbacksSnap.data().count,
    };
};

export const getRecentFeedbacks = async (maxLimit = 20): Promise<AdminFeedback[]> => {
    const q = query(
        collection(db, 'feedbacks'),
        orderBy('createdAt', 'desc'),
        limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
    })) as AdminFeedback[];
};

export const getRecentDebts = async (maxLimit = 10): Promise<AdminDebtSummary[]> => {
    const q = query(
        collection(db, 'debts'),
        orderBy('createdAt', 'desc'),
        limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            lenderName: data.lenderName,
            borrowerName: data.borrowerName,
            originalAmount: data.originalAmount,
            currency: data.currency,
            status: data.status,
            createdAt: data.createdAt ?? null,
        } as AdminDebtSummary;
    });
};
