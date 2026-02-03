import { collection, getDocs, deleteDoc, doc as firestoreDoc, updateDoc } from 'firebase/firestore';
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
      primaryPhoneNumber: '[REDACTED]',
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

    // 3. Anonymize debts where user is involved
    const debtsSnapshot = await getDocs(collection(db, 'debts'));
    for (const debtDoc of debtsSnapshot.docs) {
      const data = debtDoc.data();
      const needsUpdate = data.borrowerId === userId || data.lenderId === userId;

      if (needsUpdate) {
        const updates: any = {};
        
        if (data.borrowerId === userId) {
          updates.borrowerName = '[Silinmiş Kullanıcı]';
        }
        if (data.lenderId === userId) {
          updates.lenderName = '[Silinmiş Kullanıcı]';
        }

        await updateDoc(debtDoc.ref, updates);
        result.anonymizedDebts++;
      }
    }

    // 4. Delete user's own transactions (not shared with others)
    const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
    for (const txDoc of transactionsSnapshot.docs) {
      const data = txDoc.data();
      // Only delete if both parties are the same user (self-transactions)
      if (data.fromUserId === userId && data.toUserId === userId) {
        await deleteDoc(txDoc.ref);
        result.deletedItems.ownTransactions++;
      }
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
  // 2. Send confirmation email
  // 3. Wait 30 days
  // 4. Then call deleteUserAccount()
  
  // For now, direct deletion:
  await deleteUserAccount(userId);
}
