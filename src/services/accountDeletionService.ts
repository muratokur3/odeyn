import {
    collection,
    getDocs,
    doc as firestoreDoc,
    updateDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Account Deletion Service - GDPR Compliant
 * 
 * Strategy: Anonymize user profile but keep debt records for counterparties
 * by redacting Personal Identifiable Information (PII).
 */

export interface DeletionResult {
  success: boolean;
  message: string;
  deletedItems: {
    user: boolean;
    contacts: number;
    sessions: number;
    notifications: number;
    notificationReadStatus: number;
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
      sessions: 0,
      notifications: 0,
      notificationReadStatus: 0
    },
    anonymizedDebts: 0
  };

  try {
    // 1. Fetch User Data to get Phone (for later redaction)
    const userRef = firestoreDoc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let userPhone = '';

    if (userSnap.exists()) {
        userPhone = userSnap.data().phoneNumber;
    }

    // 2. Anonymize user in main users collection
    await updateDoc(userRef, {
      displayName: '[Silinmiş Kullanıcı]',
      email: null,
      photoURL: null,
      phoneNumber: '[REDACTED]',
      phoneNumbers: [],
      deletedAt: serverTimestamp(),
      isAnonymized: true,
      preferences: {},
      settings: {}
    });
    result.deletedItems.user = true;

    // Use Batch for efficient deletions
    const deletionBatch = writeBatch(db);

    // 3. Delete personal sub-collections
    // Contacts
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    contactsSnapshot.docs.forEach(doc => {
        deletionBatch.delete(doc.ref);
        result.deletedItems.contacts++;
    });

    // Sessions
    const sessionsSnapshot = await getDocs(collection(db, `users/${userId}/sessions`));
    sessionsSnapshot.docs.forEach(doc => {
        deletionBatch.delete(doc.ref);
        result.deletedItems.sessions++;
    });

    // Notification Read Status
    const readStatusSnapshot = await getDocs(collection(db, `users/${userId}/notificationReadStatus`));
    readStatusSnapshot.docs.forEach(doc => {
        deletionBatch.delete(doc.ref);
        result.deletedItems.notificationReadStatus++;
    });

    // 4. Delete notifications addressed to this user
    const notificationsSnapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)));
    notificationsSnapshot.docs.forEach(doc => {
        deletionBatch.delete(doc.ref);
        result.deletedItems.notifications++;
    });

    await deletionBatch.commit();

    // 5. Anonymize debts where user is involved (Targeted Query)
    const debtsQuery = query(collection(db, 'debts'), where('participants', 'array-contains', userId));
    const debtsSnapshot = await getDocs(debtsQuery);

    for (const debtDoc of debtsSnapshot.docs) {
      const data = debtDoc.data();
      const debtBatch = writeBatch(db);

      const debtUpdates: Record<string, unknown> = {
          updatedAt: serverTimestamp()
      };

      let debtChanged = false;

      if (data.borrowerId === userId) {
        debtUpdates.borrowerName = '[Silinmiş Kullanıcı]';
        debtChanged = true;
      }
      if (data.lenderId === userId) {
        debtUpdates.lenderName = '[Silinmiş Kullanıcı]';
        debtChanged = true;
      }

      // Redact locked phone number if it matches the deleted user's phone
      if (userPhone && data.lockedPhoneNumber === userPhone) {
          debtUpdates.lockedPhoneNumber = '[REDACTED]';
          debtChanged = true;
      }

      if (debtChanged) {
        debtBatch.update(debtDoc.ref, debtUpdates);
        result.anonymizedDebts++;
      }

      // 6. Anonymize Logs for this debt
      const logsSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/logs`));
      logsSnapshot.docs.forEach(logDoc => {
          const logData = logDoc.data();
          if (logData.performedBy === userId) {
              debtBatch.update(logDoc.ref, {
                  note: logData.note ? '[Kullanıcı Silindi] ' + logData.note.replace(/[0-9+]{8,}/g, '[PHONE]') : '[Kullanıcı Silindi]',
                  auditMeta: {
                      ...logData.auditMeta,
                      actorId: '[REDACTED]'
                  }
              });
          }
      });

      // 7. Anonymize Transactions for Ledgers
      if (data.type === 'LEDGER') {
          const txSnapshot = await getDocs(collection(db, `debts/${debtDoc.id}/transactions`));
          txSnapshot.docs.forEach(txDoc => {
              const txData = txDoc.data();
              if (txData.createdBy === userId) {
                  debtBatch.update(txDoc.ref, {
                      description: txData.description ? '[Silinmiş] ' + txData.description.replace(/[0-9+]{8,}/g, '[PHONE]') : '[Silinmiş İşlem]',
                      auditMeta: {
                          ...txData.auditMeta,
                          actorId: '[REDACTED]'
                      }
                  });
              }
          });
      }

      await debtBatch.commit();
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
 * Initiates the account deletion process.
 * In a production environment, this might involve a grace period or additional verification.
 */
export async function initiateAccountDeletion(userId: string): Promise<void> {
  await deleteUserAccount(userId);
}
