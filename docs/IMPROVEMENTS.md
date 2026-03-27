[AI Directive]: Bu dosya, projenin iyileştirme planlarını, hata raporlarını ve gelecekteki özelliklerini içerir.

# Odeyn - İyileştirme ve Geliştirme Manifestosu (Improvement Manifest)

Bu belge, projenin bilinen eksiklerini, planlanan özellikleri ve kritik hata düzeltmelerini içerir.

---

## 1. Kritik İyileştirmeler ve Eksikler (Critical Gaps)

Aşağıdaki özellikler, uygulamanın "Production Ready" olması için tamamlanması gereken **Zorunlu (Must-Have)** maddelerdir.

### 1.1. Bildirim Sistemi (Notification Backend)
*   **Durum:** Sadece frontend mock var, backend yok.
*   **Gereksinim:**
    *   Firestore `notifications` koleksiyonu.
    *   Cloud Functions trigger'ları (Borç oluşturulduğunda, ödeme yapıldığında).
    *   FCM (Firebase Cloud Messaging) entegrasyonu.

### 1.2. Veri Yedekleme ve Dışa Aktarma (Export/Backup)
*   **Durum:** Yok.
*   **Gereksinim:**
    *   Kullanıcıların finansal verilerini JSON veya PDF formatında indirebilmesi.
    *   GDPR "Veri Taşınabilirliği" hakkı için zorunlu.

### 1.3. Hesap Silme Akışı (Account Deletion)
*   **Durum:** Yok.
*   **Gereksinim:**
    *   Kullanıcının hesabını tamamen silebilmesi (GDPR "Unutulma Hakkı").
    *   **Logic:** Kişisel veriler anonimleştirilmeli, ancak karşı taraflar için oluşturulan borç kayıtları (anonim ID ile) korunmalıdır.

### 1.4. Geri Al / Yinele (Undo/Redo)
*   **Gereksinim:** Hatalı girişlerde (örn. yanlış tutar) anında geri alma imkanı.
*   **Çözüm:** Client-side Undo Stack (5 saniyelik "Geri Al" butonu).

---

## 2. Güvenlik ve Dolandırıcılık Önleme (Security & Abuse)

### 2.1. Kullanıcı Engelleme (Blocking)
*   **Senaryo:** "Tacizci Hakan" sürekli sahte borç ekliyor.
*   **Çözüm:**
    *   `users/{uid}/blockedUsers` koleksiyonu.
    *   Engellenen kullanıcı yeni borç ekleyemez.
    *   Mevcut borçlar durur ancak etkileşim (ödeme ekleme vb.) kısıtlanır.

### 2.2. Hız Sınırlama (Rate Limiting)
*   **Hedef:** Spam borç oluşturmayı engelleme.
*   **Kural:** 30 saniyede en fazla 1 borç oluşturulabilir. Firestore Rules ile zorlanmalı.

---

## 3. Bilinen Sorunlar ve Teknik Borç (Technical Debt & Issues)

### 3.1. Kod Kalitesi (QA Report)
*   **DebtStatus Enum:** Spec ile kod arasında uyumsuzluk var. Sadeleştirilmeli (`ACTIVE`, `SETTLED`, `CANCELED`).
*   **Soft Delete:** `isDeleted` alanı kaldırılmalı, 1 saat kuralı içinde Hard Delete, sonrasında değişmezlik uygulanmalı.
*   **Hard Reset:** Kod tarafında `PaymentLogType` içinde eksik.
*   **Phone-First Model:** `participantsPhones`, `creatorPhone`, `lenderPhone`, `borrowerPhone`, `claimStatus`, `claimedByUid` alanları zorunlu hale getirilmeli; UI ve backend buna göre test edilmeli.
*   **Auth Claim On-Login:** `AuthContext` login sırasında `claimLegacyDebts` girilmesi sonsuz döngü olmadan doğrulanmalı.

### 3.2. Debug Notları: Transaction Silme Hatası
*   **Sorun:** Ledger transaction silinirken bazen hata alınıyor.
*   **Çözüm:** `deleteLedgerTransaction` fonksiyonunda detaylı error handling var.
*   **Kontrol:** `createdAt` alanının varlığı ve 1 saat kuralı kontrol edilmeli.

---

## 4. Öncelik Listesi (Roadmap)

| Öncelik | Özellik | Tahmini Süre |
| :--- | :--- | :--- |
| **P0 (Kritik)** | Notification Backend, Rate Limiting | 1 Hafta |
| **P1 (Yüksek)** | Export/Backup, Account Deletion | 2 Hafta |
| **P2 (Orta)** | Enum Temizliği, Engelleme Sistemi | 3 Hafta |
| **P3 (Düşük)** | Soft Delete Temizliği, UI İyileştirmeleri | 4 Hafta |
