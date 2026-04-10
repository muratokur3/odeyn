[AI Directive]: Bu dosya, projenin iyileştirme planlarını, hata raporlarını ve gelecekteki özelliklerini içerir.

# Odeyn - İyileştirme ve Geliştirme Manifestosu (Improvement Manifest)

Bu belge, projenin bilinen eksiklerini, planlanan özellikleri ve kritik hata düzeltmelerini içerir.

**Son Güncelleme:** 2026-04-10

---

## 1. Tamamlanan Özellikler (Completed)

### 1.1. Bildirim Sistemi (In-App Notifications) - TAMAMLANDI
*   Firestore `notifications` koleksiyonu ve real-time listener.
*   Bildirim türleri: DEBT_CREATED, PAYMENT_MADE, DEBT_REJECTED, DEBT_EDITED.
*   De-duplication: 30 saniye içinde aynı bildirim engellenir.

### 1.2. Veri Yedekleme ve Dışa Aktarma (Export) - TAMAMLANDI
*   JSON formatında kullanıcı verisi export.
*   GDPR "Veri Taşınabilirliği" hakkı karşılanmaktadır.

### 1.3. Hesap Silme Akışı (Account Deletion) - TAMAMLANDI
*   GDPR uyumlu hesap silme: Kişisel veriler anonimleştirilir.
*   Karşı tarafların borç kayıtları (anonim ID ile) korunur.

### 1.4. Kullanıcı Engelleme (Blocking) - TAMAMLANDI
*   `users/{uid}/blockedUsers` koleksiyonu.
*   Engellenen kullanıcılar arası borç oluşturma AUTO_HIDDEN.

### 1.5. Rate Limiting & Input Validation - TAMAMLANDI
*   Client-side cooldown: Borç oluşturma (5s), ödeme (3s), cari işlem (3s), feedback (30s).
*   Input validation: Amount (0.01 - 10M), description (500 char), XSS sanitization.
*   Firestore rules: Amount > 0, max 10M, description/title length limits.

### 1.6. Veri Tutarlılığı İyileştirmeleri - TAMAMLANDI
*   Ledger transaction atomicity (runTransaction ile race condition fix).
*   Taksit kuruş yuvarlama düzeltmesi (base + remainder pattern).
*   Status transition validation (PAID terminal state).
*   claimLegacyDebts: borrowerName/lenderName güncelleme.
*   usePersonBalance: Çoklu para birimi desteği (TRY, USD, EUR, GOLD, SILVER).
*   Balance sanity check (server vs client mismatch detection).

---

## 2. Planlanan Özellikler (Planned)

### 2.1. FCM Push Notifications (P0 - Kritik)
*   **Durum:** Henüz yapılmadı.
*   **Gereksinim:** Uygulama kapalıyken cihaz bildirimi.
*   **İş:**
    *   `src/services/fcm.ts` - Token alma ve izin isteme.
    *   `public/firebase-messaging-sw.js` - Service Worker.
    *   Cloud Function trigger: Borç/ödeme sonrası push gönderme.
    *   AuthContext'te login sonrası FCM token kaydetme.

### 2.2. Server-Side Rate Limiting (P1 - Yüksek)
*   **Durum:** Client-side cooldown mevcut, server-side eksik.
*   **Gereksinim:** Cloud Functions'da per-user rate limiting.
*   **Neden:** Client-side bypass edilebilir.

### 2.3. Code Splitting (P2 - Orta)
*   **Durum:** Tek chunk 1.29 MB (uyarı).
*   **Çözüm:** React.lazy ile sayfa bazlı dynamic import.

### 2.4. Geri Al / Yinele (P3 - Düşük)
*   **Gereksinim:** Hatalı girişlerde 5 saniyelik "Geri Al" butonu.
*   **Çözüm:** Client-side Undo Stack.

---

## 3. Bilinen Teknik Borç (Technical Debt)

### 3.1. DebtStatus Enum Sadeleştirme
*   9 farklı status var: PENDING, ACTIVE, PAID, REJECTED, HIDDEN, REJECTED_BY_RECEIVER, AUTO_HIDDEN, ARCHIVED, DISPUTED.
*   İdeal: ACTIVE, PAID, ARCHIVED, DISPUTED (4 temel durum).
*   Status transition validation eklendi ama enum sadeleştirmesi yapılmadı.

### 3.2. Ledger Gold pureGold Metrikleri
*   `useLedgerSummary` altın cari hesap işlemlerinde pure metal gram hesaplaması yapmıyor.
*   Dashboard'da sadece regular borçlar için pureGold metrikleri var.

### 3.3. Format Display Tutarlılığı
*   Bazı yerlerde `$1,250` bazı yerlerde `1,250 USD` formatı kullanılıyor.
*   `formatCurrency` kullanımının standardize edilmesi gerekiyor.

---

## 4. Öncelik Listesi (Roadmap)

| Öncelik | Özellik | Durum |
| :--- | :--- | :--- |
| **P0 (Kritik)** | FCM Push Notifications | Planlandı |
| **P1 (Yüksek)** | Server-side Rate Limiting | Planlandı |
| **P2 (Orta)** | Code Splitting, Format Tutarlılığı | Backlog |
| **P3 (Düşük)** | Undo/Redo, Enum Sadeleştirme, Ledger Gold Metrikleri | Backlog |
