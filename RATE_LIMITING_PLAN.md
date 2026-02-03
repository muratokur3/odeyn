# Rate Limiting Plan - firestore.rules

## Hedef

Spam koruması için Firestore Security Rules'a rate limiting ekle.

## Önerilen Kural

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Debts collection with rate limiting
    match /debts/{debtId} {
      allow read: if request.auth != null &&
                     (resource.data.borrowerId == request.auth.uid ||
                      resource.data.lenderId == request.auth.uid);

      // RATE LIMITING: Max 1 debt creation per 30 seconds
      allow create: if request.auth != null &&
                       request.auth.uid == request.resource.data.createdBy &&
                       (
                         // First debt ever - no rate limit
                         !exists(/databases/$(database)/documents/users/$(request.auth.uid)) ||
                         // Check last debt creation time
                         !exists(/databases/$(database)/documents/users/$(request.auth.uid)/metadata/rateLimit) ||
                         request.time > get(/databases/$(database)/documents/users/$(request.auth.uid)/metadata/rateLimit).data.lastDebtCreated + duration.value(30, 's')
                       );

      allow update: if request.auth != null &&
                       (resource.data.createdBy == request.auth.uid ||
                        resource.data.borrowerId == request.auth.uid ||
                        resource.data.lenderId == request.auth.uid);

      allow delete: if request.auth != null &&
                       resource.data.createdBy == request.auth.uid;
    }
  }
}
```

## Implement Adımları

1. **firestore.rules dosyasını güncelle** (yukarıdaki kural)
2. **Client-side tracking ekle**:
   - Borç oluşturulduğunda `/users/{uid}/metadata/rateLimit` dokümantını güncelle
   - `lastDebtCreated: serverTimestamp()` kaydet

3. **Test**:
   - 30 saniye içinde 2. borç oluşturmayı dene → Red edilmeli
   - 30+ saniye sonra → Başarılı olmalı

## Alternatif: Basit Client-Side Kontrol

Firestore Rules karmaşık geliyorsa, sadece client-side kontrol:

```typescript
// db.ts
export async function canCreateDebt(userId: string): Promise<boolean> {
  const rateLimitDoc = doc(db, `users/${userId}/metadata/rateLimit`);
  const snapshot = await getDoc(rateLimitDoc);

  if (!snapshot.exists()) return true;

  const lastCreated = snapshot.data().lastDebtCreated?.toDate();
  if (!lastCreated) return true;

  const diffSeconds = (Date.now() - lastCreated.getTime()) / 1000;
  return diffSeconds > 30;
}
```

**Öneri:** Client-side basit kontrol yeterli olabilir.
