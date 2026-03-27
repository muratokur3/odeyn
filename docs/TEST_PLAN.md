# TEST PLAN: Phone-First Legacy Debt Claim

## 1) Amaç
- Kayıtsız telefon numarasıyla oluşturulmuş borçlar, kullanıcı aynı numara ile kaydolduğunda otomatik olarak UID'ye bağlansın.
- `participantsPhones` değişmeden kalsın.
- `claimStatus` ve `claimedByUid` doğru şekilde keşfedilsin.

## 2) Gereksinimler
- Firebase Auth + Firestore emulator çalışmalı
- `npm install` ve `npm run dev` tamamlanmış
- Bütün kod değişiklikleri uygulandı (model + servis + context + rules)

## 3) Test Senaryosu
### Adım A: Kayıtsız borç oluşturma
1. Auth olmadan ya da test kullanıcısı `uid_temp` ile oturum açın.
2. Fonksiyon çağrısı:
   - `createDebt('uid_temp', 'Test', '+905551112233', 'Ahmet', 100, 'LENDING', 'TRY', 'Test Notes', undefined, undefined, true, 0)`
3. Firestore `debts/{debtId}` belgesini kontrol:
   - `participantsPhones` içinde `+905551112233`
   - `creatorPhone == '+905551112233'`
   - `claimStatus == 'UNCLAIMED'`

### Adım B: Aynı numarayla kullanıcı kaydı
1. Yeni Auth kullanıcısı oluştur (örneğin `uid_claimage`) ve `phoneNumber: '+905551112233'` ekle.
2. Giriş yap.
3. `AuthContext` login sonrası `claimLegacyDebts('uid_claimage', '+905551112233')` çağrılıyor mu?

### Adım C: Borç durumunu onaylama
1. `debts/{debtId}` belgesini yeniden al.
2. Beklenen sonuç:
   - `claimStatus == 'CLAIMED'`
   - `claimedByUid == 'uid_claimage'`
   - `participants` yeni UID içeriyor
   - `participantsPhones` `['+905551112233']` aynen korunmuş

### Adım D: Kullanıcı ekranında görünürlük
1. `useDebts` sorgusu, hem `participants` hem `participantsPhones` bazlı sonucu getiriyor mu?
2. `usePersonDebts` doğru kişiyi buluyor mu?

## 4) Ek Doğrulamalar
- `firestore.rules` ile `participants`/`participantsPhones` dışındaki erişimler reddediliyor mu?
- `1 saat kuralı` süresi geçmiş entry'leri silmiyor mu?

## 5) Notlar
- Testler sırasında emulator kayıtları sıfırlamak için `firebase emulators:exec "npm run test"` kullanabilirsiniz.
