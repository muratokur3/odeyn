import { collection, getDocs, doc as firestoreDoc, getDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Debt, Transaction, User, Contact } from '../types';

/**
 * Export Service - GDPR Compliant Data Export
 *
 * Version 1.1: Optimized with targeted queries for scalability and privacy compliance.
 */

export interface ExportData {
  user: User;
  contacts: Contact[];
  debts: Debt[];
  transactions: Transaction[];
  exportDate: string;
  version: string;
}

/**
 * Export all user data as JSON
 */
export async function exportUserDataAsJSON(userId: string): Promise<string> {
  const exportData: ExportData = {
    user: {} as User,
    contacts: [],
    debts: [],
    transactions: [],
    exportDate: new Date().toISOString(),
    version: '1.1'
  };

  try {
    // 1. Fetch user data (Targeted)
    const userRef = firestoreDoc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      exportData.user = { ...userSnap.data() as User, uid: userId };
    }

    // 2. Fetch contacts (Subcollection)
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    exportData.contacts = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contact));

    // 3. Fetch debts (Targeted Query)
    const debtsRef = collection(db, 'debts');
    const debtsQuery = query(debtsRef, where('participants', 'array-contains', userId));
    const debtsSnapshot = await getDocs(debtsQuery);

    exportData.debts = debtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Debt));

    // 4. Fetch standalone transactions (Legacy/Self)
    // Note: Transactions within debts (Ledger) are typically included in debt logs or subcollections,
    // but the 'transactions' root collection is checked for self-records.
    const transactionsRef = collection(db, 'transactions');
    const txQueryFrom = query(transactionsRef, where('fromUserId', '==', userId));
    const txQueryTo = query(transactionsRef, where('toUserId', '==', userId));

    const [txFromSnap, txToSnap] = await Promise.all([
        getDocs(txQueryFrom),
        getDocs(txQueryTo)
    ]);

    const txMap = new Map<string, Transaction>();
    txFromSnap.forEach(d => txMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
    txToSnap.forEach(d => txMap.set(d.id, { id: d.id, ...d.data() } as Transaction));

    exportData.transactions = Array.from(txMap.values());

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Veri dışa aktarılamadı. Lütfen tekrar deneyin.');
  }
}

/**
 * Download JSON export as file
 */
export function downloadJSON(jsonString: string, filename: string = 'debtdert_export.json') {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export user data and trigger download
 */
export async function exportAndDownloadUserData(userId: string) {
  const jsonData = await exportUserDataAsJSON(userId);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadJSON(jsonData, `debtdert_export_${timestamp}.json`);
}

/**
 * FUTURE: PDF Export (requires additional library like jsPDF)
 * For now, users can print the JSON or use external tools
 */
