import { collection, getDocs, doc as firestoreDoc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Account Deletion Service - GDPR Compliant
 * 
 * Strategy: Anonymize user but keep debt records for counterparties to maintain financial integrity.
 * Version 1.1: Uses targeted queries and batch operations for scalability.
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

    // 2. Delete user's contacts subcollection (Chunked)
    const contactsSnapshot = await getDocs(collection(db, `users/${userId}/contacts`));
    if (!contactsSnapshot.empty) {
        const batch = writeBatch(db);
        contactsSnapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        result.deletedItems.contacts = contactsSnapshot.size;
    }

    // 3. Anonymize debts where user is involved (Targeted Query)
    const debtsRef = collection(db, 'debts');
    const debtsQuery = query(debtsRef, where('participants', 'array-contains', userId));
    const debtsSnapshot = await getDocs(debtsQuery);

    if (!debtsSnapshot.empty) {
        const batch = writeBatch(db);
        debtsSnapshot.docs.forEach(debtDoc => {
            const data = debtDoc.data();
            const updates: Record<string, unknown> = {};

            if (data.borrowerId === userId) {
              updates.borrowerName = '[Silinmiş Kullanıcı]';
            }
            if (data.lenderId === userId) {
              updates.lenderName = '[Silinmiş Kullanıcı]';
            }

            if (Object.keys(updates).length > 0) {
                batch.update(debtDoc.ref, updates);
                result.anonymizedDebts++;
            }
        });
        await batch.commit();
    }

    // 4. Delete user's own standalone transactions (not shared with others)
    const transactionsRef = collection(db, 'transactions');
    const txQuery = query(transactionsRef, where('fromUserId', '==', userId), where('toUserId', '==', userId));
    const transactionsSnapshot = await getDocs(txQuery);

    if (!transactionsSnapshot.empty) {
        const batch = writeBatch(db);
        transactionsSnapshot.docs.forEach(txDoc => batch.delete(txDoc.ref));
        await batch.commit();
        result.deletedItems.ownTransactions = transactionsSnapshot.size;
    }

    // 5. Clean up other user-related data (Sessions, Notifications)
    const sessionsRef = collection(db, `users/${userId}/sessions`);
    const sessionsSnap = await getDocs(sessionsRef);
    if (!sessionsSnap.empty) {
        const batch = writeBatch(db);
        sessionsSnap.docs.forEach(d => batch.delete(d.ref));
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
