import { collection, getDocs, doc as firestoreDoc, getDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Debt, Transaction, User, Contact, PaymentLog } from '../types';

/**
 * Export Service - GDPR Compliant Data Export
 */

export interface ExportData {
  user: User;
  contacts: Contact[];
  debts: (Debt & { transactions?: Transaction[], logs?: PaymentLog[] })[];
  exportDate: string;
  version: '1.1';
}

/**
 * Export all user data as JSON
 */
export async function exportUserDataAsJSON(userId: string): Promise<string> {
  const exportData: ExportData = {
    user: {} as User,
    contacts: [],
    debts: [],
    exportDate: new Date().toISOString(),
    version: '1.1'
  };

  try {
    // Fetch user data directly
    const userRef = firestoreDoc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      exportData.user = { ...userSnap.data(), uid: userId } as User;
    }

    // Fetch contacts
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    exportData.contacts = contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contact));

    // Fetch debts using efficient query
    const debtsQuery = query(collection(db, 'debts'), where('participants', 'array-contains', userId));
    const debtsSnapshot = await getDocs(debtsQuery);

    for (const debtDoc of debtsSnapshot.docs) {
      const debtData = {
        id: debtDoc.id,
        ...debtDoc.data()
      } as Debt & { transactions?: Transaction[], logs?: PaymentLog[] };

      // Fetch sub-collections for each debt
      const txSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/transactions`));
      debtData.transactions = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      const logsSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/logs`));
      debtData.logs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentLog));

      exportData.debts.push(debtData);
    }

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
