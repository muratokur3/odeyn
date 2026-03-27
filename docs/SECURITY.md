[AI Directive]: Bu dosya, projenin güvenlik protokolleri ve spam önleme mekanizmaları hakkında bilgi verir.

# Odeyn - Güvenlik ve Erişim Manifestosu (Security Manifest)

Bu belge, uygulamanın veri güvenliği, erişim kontrolü ve kötüye kullanım (spam) önleme stratejilerini tanımlar.

---

## 1. Firestore Erişim Kuralları (Access Control)

Güvenlik modeli "En Az Ayrıcalık" (Least Privilege) prensibine dayanır.

### 1.1. Kullanıcı Verileri
*   **Yol:** `users/{userId}`
*   **Kural:** Kullanıcılar sadece **kendi** profil ve ayar dokümanlarını okuyabilir/yazabilir.
*   **Rehber:** `users/{userId}/contacts` koleksiyonu tamamen özeldir, başka kullanıcılar erişemez.

### 1.2. Borç Verileri (Shared Ledger)
*   **Yol:** `debts/{debtId}`
*   **Okuma:** Dokümanın `participants` (katılımcılar) dizisinde UID'si bulunan kullanıcılar okuyabilir.
*   **Yazma (Oluşturma):** Sadece kimliği doğrulanmış kullanıcılar.
*   **Güncelleme/Silme:**
    *   Sadece oluşturan kişi (`createdBy == auth.uid`).
    *   Sadece oluşturulma tarihinden itibaren **1 saat** içinde (`request.time < resource.data.createdAt + 1h`).

### 1.3. Denetim İzi (Audit Logs)
*   **Yol:** `debts/{debtId}/logs/{logId}`
*   **Kural:** Sadece Ekleme (Append-Only). Asla silinemez veya düzenlenemez.

---

## 2. Spam Önleme ve Hız Sınırlama (Rate Limiting)

Kötü niyetli kullanıcıların veya botların sistemi manipüle etmesini ve diğer kullanıcıları taciz etmesini önlemek için hız sınırları uygulanır.

### 2.1. Teknik Kural (Firestore Security Rules)
Her kullanıcı için borç oluşturma sıklığı sınırlandırılmıştır.

```javascript
match /debts/{debtId} {
  allow create: if request.auth != null &&
                   request.auth.uid == request.resource.data.createdBy &&
                   (
                     // İlk borç (rate limit verisi yoksa)
                     !exists(/databases/$(database)/documents/users/$(request.auth.uid)/metadata/rateLimit) ||
                     // Son işlemden 30 saniye geçmiş olmalı
                     request.time > get(/databases/$(database)/documents/users/$(request.auth.uid)/metadata/rateLimit).data.lastDebtCreated + duration.value(30, 's')
                   );
}
```

### 2.2. İstemci Kontrolü (Client-Side)
*   Kullanıcı arayüzünde, peş peşe işlem yapıldığında "Lütfen bekleyiniz" uyarısı gösterilir.
*   Spam tespiti durumunda (örn. 5 dakikada 20 istek) hesap geçici olarak dondurulur (Future Feature).

---

## 3. Veri Bütünlüğü ve Denetim

*   **1 Saat Kuralı:** Finansal verilerin geçmişe dönük değiştirilmesini engeller.
*   **Hard Reset:** Ciddi hatalarda, kayıt silinip yeniden oluşturulmaz; "Sıfırlama Kaydı" (Log) girilerek tutar güncellenir. Bu sayede tüm değişikliklerin tarihçesi korunur.
