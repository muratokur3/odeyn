import { collection, getDocs, doc as firestoreDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Debt, Transaction, User, Contact } from '../types';

/**
 * Export Service - GDPR Compliant Data Export
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
    version: '1.0'
  };

  try {
    // Fetch user data
    const userDoc = await getDocs(collection(db, 'users'));
    const userData = userDoc.docs.find(d => d.id === userId)?.data() as User;
    if (userData) {
      exportData.user = { ...userData, uid: userId };
    }

    // Fetch contacts
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    exportData.contacts = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contact));

    // Fetch debts
    const debtsSnapshot = await getDocs(collection(db, 'debts'));
    exportData.debts = debtsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.borrowerId === userId || data.lenderId === userId;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Debt));

    // Fetch transactions
    const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
    exportData.transactions = transactionsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.fromUserId === userId || data.toUserId === userId;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));

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
