import { collection, getDocs, deleteDoc, doc as firestoreDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Account Deletion Service - GDPR Compliant
 * 
 * Strategy: Anonymize user but keep debt records for counterparties
 */

export interface DeletionResult {
  success: boolean;
  message: string;
  deletedItems: {
    user: boolean;
    contacts: number;
    ownTransactions: number;
  };
  anonymizedDebts: number;
}

/**
 * Delete user account while preserving counterparty data integrity
 */
export async function deleteUserAccount(userId: string): Promise<DeletionResult> {
  const result: DeletionResult = {
    success: false,
    message: '',
    deletedItems: {
      user: false,
      contacts: 0,
      ownTransactions: 0
    },
    anonymizedDebts: 0
  };

  try {
    // 1. Anonymize user in main users collection
    const userRef = firestoreDoc(db, 'users', userId);
    await updateDoc(userRef, {
      displayName: '[Silinmiş Kullanıcı]',
      email: null,
      photoURL: null,
      phoneNumber: '[REDACTED]',
      phoneNumbers: [],
      deletedAt: new Date(),
      isAnonymized: true
    });
    result.deletedItems.user = true;

    // 2. Delete user's contacts subcollection
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    for (const doc of contactsSnapshot.docs) {
      await deleteDoc(doc.ref);
      result.deletedItems.contacts++;
    }

    // 3. Process debts where user is involved (anonymize names and clean up sub-collections)
    const debtsQuery = query(collection(db, 'debts'), where('participants', 'array-contains', userId));
    const debtsSnapshot = await getDocs(debtsQuery);

    for (const debtDoc of debtsSnapshot.docs) {
      const data = debtDoc.data();
      const updates: Record<string, string> = {};
      let needsAnonymization = false;

      if (data.borrowerId === userId) {
        updates.borrowerName = '[Silinmiş Kullanıcı]';
        needsAnonymization = true;
      }
      if (data.lenderId === userId) {
        updates.lenderName = '[Silinmiş Kullanıcı]';
        needsAnonymization = true;
      }

      if (needsAnonymization) {
        await updateDoc(debtDoc.ref, updates);
        result.anonymizedDebts++;
      }

      // Cleanup sub-collections for this debt
      // Transactions (Anonymize instead of delete to preserve balance)
      const txSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/transactions`));
      for (const txDoc of txSnapshot.docs) {
        const txData = txDoc.data();
        if (txData.createdBy === userId) {
          // Redact PII but keep amount for financial integrity
          await updateDoc(txDoc.ref, {
            description: '[Gizlenmiş]',
            auditMeta: {
              actorId: '[SILINMIS_KULLANICI]',
              timestamp: txData.auditMeta?.timestamp || new Date()
            }
          });
          result.deletedItems.ownTransactions++;
        }
      }

      // Payment Logs (anonymize)
      const logsSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/logs`));
      for (const logDoc of logsSnapshot.docs) {
        const logData = logDoc.data();
        if (logData.performedBy === userId) {
          await updateDoc(logDoc.ref, { performedBy: '[Silinmiş Kullanıcı]' });
        }
      }
    }

    // 4. Delete user-specific metadata sub-collections (Safe to delete as they don't affect others)
    const sessionSnapshot = await getDocs(collection(db, `users/${userId}/sessions`));
    for (const sDoc of sessionSnapshot.docs) {
      await deleteDoc(sDoc.ref);
    }

    const notifReadSnapshot = await getDocs(collection(db, `users/${userId}/notificationReadStatus`));
    for (const nrDoc of notifReadSnapshot.docs) {
      await deleteDoc(nrDoc.ref);
    }

    // 5. Delete notifications targeted to the user
    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
    const notificationsSnapshot = await getDocs(notificationsQuery);
    for (const nDoc of notificationsSnapshot.docs) {
      await deleteDoc(nDoc.ref);
    }

    result.success = true;
    result.message = 'Hesabınız başarıyla silindi. Borç kayıtlarınız karşı taraflar için anonimleştirildi.';
    return result;

  } catch (error) {
    console.error('Account deletion failed:', error);
    result.message = 'Hesap silme işlemi başarısız oldu. Lütfen tekrar deneyin.';
    throw error;
  }
}

/**
 * IMPORTANT: This should be called after user confirms deletion
 * and potentially after a grace period (e.g., 30 days)
 */
export async function initiateAccountDeletion(userId: string): Promise<void> {
  // In production, this might:
  // 1. Mark account for deletion
  // 2. Notify person via SMS/Push
  // 3. Wait 30 days
  // 4. Then call deleteUserAccount()
  
  // For now, direct deletion:
  await deleteUserAccount(userId);
}
