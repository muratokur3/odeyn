/**
 * Ledger Service (Shared Cari Hesap)
 * Handles the shared LEDGER debt document and its transactions.
 * Path: debts/{debtId}/transactions
 * 
 * KEY DIFFERENCE: Unlike private contact transactions, LEDGER is a shared
 * debt document visible to BOTH parties with mutual write access.
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
    Timestamp,
    where,
    getDocs,
    updateDoc,
    getDoc,
    limit
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, TransactionDirection, Debt } from '../types';
import { isTransactionEditable } from './db';

// ============= LEDGER DOCUMENT OPERATIONS =============

/**
 * Get or create a LEDGER debt document between two users
 * Returns the ledger debt ID
 */
export const getOrCreateLedger = async (
    currentUserId: string,
    currentUserName: string,
    otherPartyId: string,
    otherPartyName: string
): Promise<string> => {
    // First, try to find an existing active LEDGER
    const debtsRef = collection(db, 'debts');
    
    // Query for existing LEDGER between these two users
    const q = query(
        debtsRef,
        where('participants', 'array-contains', currentUserId),
        where('type', '==', 'LEDGER'),
        where('status', '==', 'ACTIVE')
    );
    
    const snapshot = await getDocs(q);
    
    // Check if any of the results include the other party
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Debt;
        if (data.participants.includes(otherPartyId)) {
            return docSnap.id; // Found existing ledger
        }
    }
    
    // No existing ledger, create a new one
    const newLedger: Omit<Debt, 'id'> = {
        lenderId: currentUserId, // Arbitrary, both have equal rights
        lenderName: currentUserName,
        borrowerId: otherPartyId,
        borrowerName: otherPartyName,
        originalAmount: 0, // Ledger starts at 0
        remainingAmount: 0,
        currency: 'TRY',
        status: 'ACTIVE',
        participants: [currentUserId, otherPartyId],
        createdAt: serverTimestamp() as Timestamp,
        createdBy: currentUserId,
        type: 'LEDGER',
        note: 'Cari Hesap Defteri'
    };
    
    const docRef = await addDoc(debtsRef, newLedger);
    return docRef.id;
};

/**
 * Subscribe to ledger debt document
 */
export const subscribeLedger = (
    ledgerId: string,
    callback: (ledger: Debt | null) => void
): (() => void) => {
    const ledgerRef = doc(db, 'debts', ledgerId);
    
    return onSnapshot(ledgerRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as Debt);
        } else {
            callback(null);
        }
    });
};

/**
 * Find active ledger between two users (without creating)
 */
export const findActiveLedger = async (
    userId: string,
    otherPartyId: string
): Promise<Debt | null> => {
    const debtsRef = collection(db, 'debts');
    
    const q = query(
        debtsRef,
        where('participants', 'array-contains', userId),
        where('type', '==', 'LEDGER'),
        where('status', '==', 'ACTIVE'),
        limit(10) // Get a few to filter
    );
    
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Debt;
        if (data.participants.includes(otherPartyId)) {
            return { ...data, id: docSnap.id };
        }
    }
    
    return null;
};

/**
 * Archive a ledger (close the book)
 */
export const archiveLedger = async (ledgerId: string): Promise<void> => {
    const ledgerRef = doc(db, 'debts', ledgerId);
    await updateDoc(ledgerRef, {
        status: 'ARCHIVED',
        archivedAt: serverTimestamp()
    });
};

// ============= LEDGER TRANSACTION OPERATIONS =============

/**
 * Get the transactions collection reference for a ledger debt
 */
const getLedgerTransactionsRef = (ledgerId: string) => {
    return collection(db, 'debts', ledgerId, 'transactions');
};

/**
 * Add a new transaction to a shared ledger
 */
export const addLedgerTransaction = async (
    ledgerId: string,
    userId: string,
    amount: number,
    direction: TransactionDirection,
    description?: string,
    currency: string = 'TRY'
): Promise<string> => {
    const txRef = getLedgerTransactionsRef(ledgerId);
    
    // Build transaction object without undefined values
    const newTx: Record<string, unknown> = {
        amount,
        direction,
        currency,
        createdAt: serverTimestamp(),
        createdBy: userId,
        type: 'SIMPLE'
    };
    
    // Only add description if it has a value
    if (description && description.trim()) {
        newTx.description = description.trim();
    }

    const docRef = await addDoc(txRef, newTx);
    
    // Update ledger's remainingAmount based on direction
    // Note: We need to update the balance on the ledger document
    await updateLedgerBalance(ledgerId);
    
    return docRef.id;
};

/**
 * Subscribe to transactions for a ledger
 */
export const subscribeLedgerTransactions = (
    ledgerId: string,
    callback: (transactions: Transaction[]) => void
): (() => void) => {
    const txRef = getLedgerTransactionsRef(ledgerId);
    // Order ascending: oldest first (like WhatsApp chat)
    const q = query(txRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const transactions: Transaction[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Transaction));
        callback(transactions);
    });
};

/**
 * Delete a ledger transaction (only by creator)
 * ENFORCES 1-HOUR HARD RULE
 */
export const deleteLedgerTransaction = async (
    ledgerId: string,
    transactionId: string
): Promise<void> => {
    const txDoc = doc(db, 'debts', ledgerId, 'transactions', transactionId);

    // Check 1-Hour Rule
    const txSnap = await getDoc(txDoc);
    if (!txSnap.exists()) return;

    const data = txSnap.data();
    if (!isTransactionEditable(data.createdAt)) {
         throw new Error("Bu kayıt silinemez (1 saat kuralı). Lütfen ters işlem yapın.");
    }

    await deleteDoc(txDoc);
    
    // Recalculate balance
    await updateLedgerBalance(ledgerId);
};

/**
 * Update ledger's remainingAmount based on all transactions
 */
const updateLedgerBalance = async (ledgerId: string): Promise<void> => {
    const txRef = getLedgerTransactionsRef(ledgerId);
    const snapshot = await getDocs(txRef);
    
    // Get ledger to determine perspective
    const ledgerRef = doc(db, 'debts', ledgerId);
    const ledgerSnap = await getDoc(ledgerRef);
    
    if (!ledgerSnap.exists()) return;
    
    const ledger = ledgerSnap.data() as Debt;
    const lenderId = ledger.lenderId;
    
    // Calculate balance from lender's perspective
    let balance = 0;
    snapshot.docs.forEach(docSnap => {
        const tx = docSnap.data() as Transaction;
        if (tx.createdBy === lenderId) {
            // Lender added this
            if (tx.direction === 'OUTGOING') {
                balance += tx.amount; // Lender gave money
            } else {
                balance -= tx.amount; // Lender received money
            }
        } else {
            // Borrower added this (reverse perspective)
            if (tx.direction === 'OUTGOING') {
                balance -= tx.amount; // Borrower gave = Lender received
            } else {
                balance += tx.amount; // Borrower took = Lender gave
            }
        }
    });
    
    await updateDoc(ledgerRef, {
        remainingAmount: balance
    });
};

/**
 * Calculate balance from a specific user's perspective
 * Positive = they owe me, Negative = I owe them
 */
export const calculateLedgerBalance = (
    transactions: Transaction[],
    userId: string
): number => {
    return transactions.reduce((sum, tx) => {
        if (tx.createdBy === userId) {
            // I created this entry
            if (tx.direction === 'OUTGOING') {
                return sum + tx.amount; // I gave, they owe me
            } else {
                return sum - tx.amount; // I took, I owe them
            }
        } else {
            // They created this entry (reverse my perspective)
            if (tx.direction === 'OUTGOING') {
                return sum - tx.amount; // They gave me, I owe them
            } else {
                return sum + tx.amount; // They took from me, they owe me
            }
        }
    }, 0);
};

// ============= LEGACY EXPORTS (for backward compatibility) =============

/**
 * @deprecated Use addLedgerTransaction instead
 */
export const addTransaction = async (
    userId: string,
    contactId: string,
    amount: number,
    direction: TransactionDirection,
    description?: string
): Promise<string> => {
    // This is now deprecated - keeping for migration period
    console.warn('addTransaction is deprecated, use addLedgerTransaction');
    const txRef = collection(db, 'users', userId, 'contacts', contactId, 'transactions');
    
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
 * @deprecated Use subscribeLedgerTransactions instead
 */
export const subscribeToTransactions = (
    userId: string,
    contactId: string,
    callback: (transactions: Transaction[]) => void
): (() => void) => {
    console.warn('subscribeToTransactions is deprecated, use subscribeLedgerTransactions');
    const txRef = collection(db, 'users', userId, 'contacts', contactId, 'transactions');
    const q = query(txRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const transactions: Transaction[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Transaction));
        callback(transactions);
    });
};

/**
 * @deprecated Use deleteLedgerTransaction instead
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
 * @deprecated Use calculateLedgerBalance instead
 */
export const calculateCariBalance = (transactions: Transaction[]): number => {
    return transactions.reduce((sum, tx) => {
        if (tx.direction === 'OUTGOING') {
            return sum + tx.amount;
        } else {
            return sum - tx.amount;
        }
    }, 0);
};
