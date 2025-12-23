/**
 * Transaction Service (Cari Hesap)
 * Handles simple money flow transactions between contacts.
 * Path: users/{userId}/contacts/{contactId}/transactions
 */

import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, TransactionDirection } from '../types';

/**
 * Get the transactions collection reference for a specific contact
 */
const getTransactionsRef = (userId: string, contactId: string) => {
    return collection(db, 'users', userId, 'contacts', contactId, 'transactions');
};

/**
 * Add a new transaction (Cari entry)
 */
export const addTransaction = async (
    userId: string,
    contactId: string,
    amount: number,
    direction: TransactionDirection,
    description?: string
): Promise<string> => {
    const txRef = getTransactionsRef(userId, contactId);
    
    const newTx: Omit<Transaction, 'id'> = {
        amount,
        direction,
        description: description || undefined,
        createdAt: serverTimestamp() as Timestamp,
        createdBy: userId,
        type: 'SIMPLE'
    };

    const docRef = await addDoc(txRef, newTx);
    return docRef.id;
};

/**
 * Subscribe to transactions for a specific contact
 */
export const subscribeToTransactions = (
    userId: string,
    contactId: string,
    callback: (transactions: Transaction[]) => void
): (() => void) => {
    const txRef = getTransactionsRef(userId, contactId);
    const q = query(txRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const transactions: Transaction[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Transaction));
        callback(transactions);
    });
};

/**
 * Delete a transaction
 */
export const deleteTransaction = async (
    userId: string,
    contactId: string,
    transactionId: string
): Promise<void> => {
    const txDoc = doc(db, 'users', userId, 'contacts', contactId, 'transactions', transactionId);
    await deleteDoc(txDoc);
};

/**
 * Calculate net Cari balance from transactions
 * OUTGOING = I gave money (positive for me as lender)
 * INCOMING = I received money (negative, I owe)
 */
export const calculateCariBalance = (transactions: Transaction[]): number => {
    return transactions.reduce((sum, tx) => {
        if (tx.direction === 'OUTGOING') {
            return sum + tx.amount; // I gave, they owe me
        } else {
            return sum - tx.amount; // I took, I owe them
        }
    }, 0);
};
