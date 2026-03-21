import { collection, getDocs, doc as firestoreDoc, query, where, writeBatch } from 'firebase/firestore';
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
    subTransactions: number;
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
      ownTransactions: 0,
      subTransactions: 0
    },
    anonymizedDebts: 0
  };

  try {
    let batch = writeBatch(db);
    let batchCount = 0;

    const commitBatchIfNeeded = async () => {
      if (batchCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    };

    // 1. Anonymize user in main users collection
    const userRef = firestoreDoc(db, 'users', userId);
    batch.update(userRef, {
      displayName: '[Silinmiş Kullanıcı]',
      email: null,
      photoURL: null,
      phoneNumber: '[REDACTED]',
      phoneNumbers: [],
      deletedAt: new Date(),
      isAnonymized: true
    });
    batchCount++;
    result.deletedItems.user = true;

    // 2. Delete user's contacts subcollection
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    for (const doc of contactsSnapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      await commitBatchIfNeeded();
      result.deletedItems.contacts++;

      // Delete subTransactions for this contact if they exist (legacy structure)
      const contactTxSnapshot = await getDocs(collection(db, `users/${userId}/contacts/${doc.id}/transactions`));
      for (const txDoc of contactTxSnapshot.docs) {
        batch.delete(txDoc.ref);
        batchCount++;
        await commitBatchIfNeeded();
        result.deletedItems.subTransactions++;
      }
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

      if (needsAnonymization && Object.keys(updates).length > 0) {
        batch.update(debtDoc.ref, updates);
        batchCount++;
        await commitBatchIfNeeded();
        result.anonymizedDebts++;
      }

      // Cleanup sub-collections for this debt
      // Transactions (Anonymize instead of delete to preserve balance)
      const txSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/transactions`));
      for (const txDoc of txSnapshot.docs) {
        const txData = txDoc.data();
        if (txData.createdBy === userId) {
          // Redact PII but keep amount for financial integrity
          batch.update(txDoc.ref, {
            description: '[Gizlenmiş]',
            auditMeta: {
              actorId: '[SILINMIS_KULLANICI]',
              timestamp: txData.auditMeta?.timestamp || new Date()
            }
          });
          batchCount++;
          await commitBatchIfNeeded();
          result.deletedItems.ownTransactions++;
          result.deletedItems.subTransactions++;
        }
      }

      // Payment Logs (anonymize)
      const logsSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/logs`));
      for (const logDoc of logsSnapshot.docs) {
        const logData = logDoc.data();
        if (logData.performedBy === userId) {
          batch.update(logDoc.ref, { performedBy: '[Silinmiş Kullanıcı]' });
          batchCount++;
          await commitBatchIfNeeded();
        }
      }
    }

    // 4. Delete user-specific metadata sub-collections (Safe to delete as they don't affect others)
    const sessionSnapshot = await getDocs(collection(db, `users/${userId}/sessions`));
    for (const sDoc of sessionSnapshot.docs) {
      batch.delete(sDoc.ref);
      batchCount++;
      await commitBatchIfNeeded();
    }

    const notifReadSnapshot = await getDocs(collection(db, `users/${userId}/notificationReadStatus`));
    for (const nrDoc of notifReadSnapshot.docs) {
      batch.delete(nrDoc.ref);
      batchCount++;
      await commitBatchIfNeeded();
    }

    // 5. Delete notifications targeted to the user
    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
    const notificationsSnapshot = await getDocs(notificationsQuery);
    for (const nDoc of notificationsSnapshot.docs) {
      batch.delete(nDoc.ref);
      batchCount++;
      await commitBatchIfNeeded();
    }

    // 6. Delete phone_registry entries
    const phoneRegistryQuery = query(collection(db, 'phone_registry'), where('uid', '==', userId));
    const phoneRegistrySnapshot = await getDocs(phoneRegistryQuery);
    for (const pDoc of phoneRegistrySnapshot.docs) {
      batch.delete(pDoc.ref);
      batchCount++;
      await commitBatchIfNeeded();
    }

    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
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
