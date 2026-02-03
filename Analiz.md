# DebtDert - Kapsamlı Teknik Şartname

**Doküman Versiyonu:** 2.0  
**Tarih:** 2026-02-03  
**Durum:** Yaşayan Doküman  
**Sınıflandırma:** Dahili - Mühendislik Referansı  
**Amaç:** Mimari, İş Mantığı ve Uygulama için Tek Doğruluk Kaynağı (Single Source of Truth)

---

## İçindekiler

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Temel Mimari](#2-temel-mimari)
3. [Veri Modeli Şartnamesi](#3-veri-modeli-şartnamesi)
4. [İş Mantığı ve Kısıtlamalar](#4-is-mantığı-ve-kısıtlamalar)
5. [Durum Makineleri ve Geçişler](#5-durum-makineleri-ve-gecisler)
6. [Kullanıcı İş Akışları](#6-kullanıcı-is-akısları)
7. [Ekran Şartnameleri](#7-ekran-sartnameleri)
8. [Güvenlik ve Erişim Kontrolü](#8-güvenlik-ve-erisim-kontrolü)
9. [Performans ve Ölçeklenebilirlik](#9-performans-ve-ölçeklenebilirlik)
10. [Uç Durumlar ve Hata Yönetimi](#10-uç-durumlar-ve-hata-yönetimi)

---

## 1. Yönetici Özeti

### 1.1 Ürün Tanımı

DebtDert bir ödeme işlemcisi, para transferi servisi veya finansal işlem platformu **değildir**. Aşağıdaki özellikleri sunan **işbirlikçi bir borç defteridir**:

- Bireyler arasındaki borç/alacak yükümlülüklerini **kaydeder**.
- Finansal pozisyonları tanıdık bir sohbet tarzı arayüz üzerinden **temsil eder**.
- Karşılıklı görünürlük ve denetim izleri ile tutarsızlıkları **uzlaştırır**.
- Güven ve anlaşmazlık çözümü için değişmez geçmişi **korur**.

### 1.2 Temel Felsefe

**"Defter Netliği için Sohbet Kullanıcı Deneyimi (UX)"**  
Sohbet arayüzü dekoratif değildir; paylaşılan finansal kayıtlarda "kim ne yaptı" şeklindeki temel UX problemini çözer. Mesajlaşma uygulamalarını taklit ederek kullanıcılar şunları anında anlar:

- Akış yönü (gelen/giden balonlar)
- Aktör atfı (ben vs. onlar)
- Zamansal sıra (kronolojik akış)

### 1.3 Kritik Değişmezler (Invariants)

1. **Telefon Numarası Kimliktir**: E.164 telefon numaraları değişmez güven çapasıdır. E-posta, `displayName` ve hatta Firebase `UID` ikincil metadatalardır.
2. **Esneklik Payından Sonra Değişmezlik**: Finansal kayıtlar, geçmişle oynanmasını önlemek için 60 dakika sonra sadece eklenebilir (append-only) hale gelir.
3. **Çift Katmanlı Mimari**: "Yumuşak" akış (cari hesap), "Sert" yükümlülüklerle (resmi borçlar/taksitler) yan yana bulunur.
4. **Cihaz Duyarlı UX**: Mobil ve Masaüstü etkileşimleri açıkça ayrılmıştır—hibrit desenler bulunmaz.

---

## 2. Temel Mimari

### 2.1 Teknoloji Yığını

| Katman         | Teknoloji                           | Amaç                       |
| -------------- | ----------------------------------- | -------------------------- |
| **Frontend**   | React 18 + TypeScript               | Tip-güvenli UI bileşenleri |
| **Durum**      | React Context API                   | Global yetki ve görünüm    |
| **Backend**    | Firebase (Auth, Firestore, Storage) | Sunucusuz altyapı          |
| **Yetki**      | Firebase Phone Auth (SMS OTP)       | Kimlik doğrulama           |
| **Veritabanı** | Firestore (NoSQL)                   | Doküman odaklı depolama    |
| **Doğrulama**  | Zod                                 | Çalışma zamanı şeması      |

### 2.2 Çift Katmanlı Finansal Model

```
┌─────────────────────────────────────────────────┐
│              KULLANICI ARAYÜZÜ                  │
├─────────────────────────────────────────────────┤
│ Üç Durumlu Görünüm: [AKIŞ] | [ÖZEL] | [TOPLAM]  │
├──────────────────┬──────────────────────────────┤
│ YUMUŞAK KATMAN   │       SERT KATMAN            │
│ (Cari/Akış)      │    (Resmi Yükümlülükler)     │
├──────────────────┼──────────────────────────────┤
│ Transaction[]    │ Debt[]                       │
│ - Esnek girişler │ - Yapısal kayıtlar           │
│ - Sohbet UX      │ - Taksit desteği             │
│ - Düzenlenebilir │ - Denetim izi (loglar)       │
│ - Onay gerekmez  │ - Durum iş akışı             │
└──────────────────┴──────────────────────────────┘
         ↓                    ↓
    Net Bakiye Hesaplama (Aggregated)
```

**Temel Fark:**

- **Yumuşak Katman (Soft Layer)**: Kayıt dışı "sana 50 TL verdim" girişleri. Örn: yemek hesabını bölüşmek.
- **Sert Katman (Hard Layer)**: Sözleşmeli "bana 6 taksitte 10.000 TL borcun var" kayıtları. Örn: araba peşinatı için borç vermek.

---

## 3. Veri Modeli Şartnamesi

### 3.1 Kullanıcı Varlığı (User Entity)

**Koleksiyon Yolu:** `users/{uid}`  
**Birincil İndeks:** `primaryPhoneNumber` (benzersiz)  
**Güvenlik:** Kullanıcı sadece kendi dokümanını okuyabilir/yazabilir.

#### Şema

```typescript
interface User {
  // === KİMLİK (Değişmez Çekirdek) ===
  uid: string; // Firebase Auth UID
  phoneNumbers: string[]; // E.164 doğrulanmış numaralar (çoklu numara desteği)
  primaryPhoneNumber: string; // *** KRİTİK GÜVEN ÇAPASI ***

  // === PROFİL (Değişebilir) ===
  displayName: string; // Herkese açık takma ad (düzenlenebilir)
  photoURL?: string; // Avatar (Firebase Storage URL)
  email?: string; // İsteğe bağlı (auth için kullanılmaz)
  recoveryEmail?: string; // Sadece hesap kurtarma için

  // === TERCİHLER ===
  preferences?: {
    autoApproveDebt?: boolean; // @deprecated (onay akışı kaldırıldı)
    requireApproval?: boolean; // @deprecated
    defaultAllowPaymentAddition?: boolean;
  };

  settings?: {
    contactSyncEnabled: boolean; // Cihaz rehberini Firestore ile eşitle
    contactAccessGranted: boolean; // İşletim sistemi izin durumu
    suppressSyncSuggestion: boolean; // "rehberi eşitle" banner'ını gizle
    lastSyncAt?: Timestamp; // Son başarılı eşitleme
  };

  // === MODERASYON ===
  mutedCreators?: string[]; // Borçları otomatik gizlenen kullanıcıların UID'leri

  // === DENETİM ===
  createdAt: Timestamp; // Hesap oluşturma tarihi
}
```

#### Telefon Numarası Neden Kimliktir?

**Problem:** Geleneksel kimlik sistemleri (e-posta, kullanıcı adı):

- Unutulabilir (insanlar kendi e-postalarını unutur)
- Değiştirilebilir (kullanıcılar e-posta değiştirmek ister)
- Evrensel değildir (herkesin e-postası yoktur)

**Çözüm:** Telefon numaraları:

- **Akılda Kalıcıdır**: Kullanıcılar kendi numaralarını bilir.
- **Doğrulanabilirdir**: SMS OTP sahipliği kanıtlar.
- **Sabittir**: İnsanlar nadiren numara değiştirir (geçiş maliyeti yüksektir).
- **Evrenseldir**: Hesap oluşturma için gereklidir.
- **Taşınabilirdir**: Yeni cihazlara aktarılabilir.

**Uygulama:**

- `primaryPhoneNumber`, **E.164 formatında** saklanır (`+905551234567`).
- Firestore Güvenlik Kuralları `primaryPhoneNumber` benzersizliğini denetler.
- Kullanıcının Firebase `UID`'si değişse bile (hesap taşıma), telefon numarası ana çapa olarak kalır.

#### Doğrulama Kuralları

```typescript
const UserSchema = z.object({
  uid: z.string().min(1),
  phoneNumbers: z.array(z.string().regex(/^\+[1-9]\d{10,14}$/)), // E.164
  primaryPhoneNumber: z.string().regex(/^\+[1-9]\d{10,14}$/),
  displayName: z.string().min(1).max(50),
  photoURL: z.string().url().optional(),
});
```

**Kısıtlamalar:**

- `displayName`: 1-50 karakter, özel regex yok (uluslararası isimlere izin verir).
- `phoneNumbers`: E.164 formatında olmalı, kullanıcı başına en fazla 3 numara.
- `primaryPhoneNumber`: `phoneNumbers` dizisinde mevcut olmalı.

---

### 3.2 Kişi Varlığı (Contact Entity)

**Koleksiyon Yolu:** `users/{uid}/contacts/{contactId}`  
**Amaç:** Her kullanıcı için yerel adres defteri (özeldir, paylaşılmaz).

#### Şema

```typescript
interface Contact {
  id: string; // Otomatik oluşturulan doküman ID'si
  name: string; // Kullanıcının yerel takma adı ("Annem", "Ali Bey")
  phoneNumber: string; // E.164 formatı
  linkedUserId?: string; // Bu numara kayıtlı bir kullanıcıyla eşleşirse UID

  // === AKTİVİTE TAKİBİ ===
  lastActivityMessage?: string; // Önizleme metni ("100 TL ödedi")
  lastActivityAt?: Timestamp; // Sıralama için (en yeni en üstte)
  lastActorId?: string; // Son işlemi gerçekleştirenin UID'si

  // === OKUNMAMIŞ GÖSTERGESİ ===
  hasUnreadActivity?: boolean; // Hesaplanan: lastActivityAt > lastReadAt
  lastReadAt?: Timestamp; // Kullanıcı bu kişinin detay sayfasını en son ne zaman açtı

  createdAt: Timestamp;
}
```

#### Bağlantı Çözümleme Mantığı (Link Resolution)

Bir kullanıcı `+905551234567` numaralı bir kişiyi eklediğinde:

1. `users` koleksiyonunda `primaryPhoneNumber == '+905551234567'` olan dokümanı **sorgula**.
2. **Bulunursa**: `linkedUserId` alanını o kullanıcının UID'sine ayarla → Gerçek zamanlı senkronizasyonu etkinleştir.
3. **Bulunmazsa**: `linkedUserId` alanını `null` bırak → Kişi "kayıtsız" olarak kalır.

**Avantajlar:**

- Kayıtlı kullanıcılar şunları alır: Gerçek zamanlı güncellemeler, avatarlar, görünen adlar.
- Kayıtsız kişiler hala çalışır: Gelecekteki eşleşmeler için telefon numarasıyla saklanır.

---

### 3.3 Borç Varlığı (Debt Entity - Sert Katman)

**Koleksiyon Yolu:** `debts/{debtId}`  
**Erişim:** Hem `lenderId` (borç veren) hem de `borrowerId` (borç alan) tarafından görülebilir.

#### Şema

```typescript
interface Debt {
  id: string;

  // === TİP VE DURUM ===
  type: "ONE_TIME" | "INSTALLMENT"; // Ödeme yapısı
  status: DebtStatus; // Bkz. Durum Makinesi (Bölüm 5)

  // === TARAFLAR ===
  lenderId: string; // UID veya E.164 (kayıtsız ise)
  lenderName: string; // Önbelleğe alınmış görünen ad
  borrowerId: string; // UID veya E.164
  borrowerName: string; // Önbelleğe alınmış görünen ad
  participants: string[]; // Sorgular için [lenderId, borrowerId]

  // === FİNANSAL ===
  originalAmount: number; // İlk ana para (oluşturulduktan sonra değişmez)
  remainingAmount: number; // Mevcut kalan tutar (ödemelerle güncellenir)
  currency: string; // ISO 4217 (TRY, USD, EUR) + GOLD (Altın)

  // === TAKSİTLER (İsteğe bağlı) ===
  installments?: Installment[]; // Sadece tip === 'INSTALLMENT' ise

  // === ZAMANLAMA ===
  dueDate?: Timestamp; // Son ödeme tarihi (tavsiye niteliğinde)
  createdAt: Timestamp; // *** 1 SAAT KURALI İÇİN KRİTİK ***
  createdBy: string; // Oluşturanın UID'si (izinler için)

  // === METADATA ===
  note?: string; // Opsiyonel açıklama
  lockedPhoneNumber?: string; // Değişmez telefon çapası (borç alan kayıtsız ise)

  // === YUMUŞAK SİLME ===
  isDeleted?: boolean; // Çöp kutusu (sadece ilk 1 saat içinde)
  deletedAt?: Timestamp;

  // === İZİNLER ===
  canBorrowerAddPayment?: boolean; // Karşı tarafın ödeme kaydetmesine izin ver
  allow_counterparty_edit?: boolean; // @deprecated

  // === REDDETME ===
  rejectedAt?: Timestamp; // Alıcının borcu reddettiği zaman
  isMuted?: boolean; // Otomatik gizle (gönderene bildirmeden)
}

interface Installment {
  id: string; // UUID
  dueDate: Timestamp; // Bu taksitin son ödeme tarihi
  amount: number; // Ödeme tutarı (ara ödemelerde yeniden hesaplanır)
  isPaid: boolean; // Ödeme durumu
  paidAt?: Timestamp; // Ödendiği zaman
}
```

#### Borç Durumları (Debt Status Enum)

```typescript
type DebtStatus =
  | "PENDING" // @deprecated
  | "ACTIVE" // Mevcut açık borç
  | "PARTIALLY_PAID" // Bazı taksitler ödendi
  | "PAID" // Tamamen kapandı (remainingAmount ≈ 0)
  | "REJECTED" // @deprecated
  | "REJECTED_BY_RECEIVER" // Borç alan reddetti
  | "AUTO_HIDDEN" // Alıcı tarafından susturuldu (sessiz reddetme)
  | "ARCHIVED" // @deprecated
  | "HIDDEN"; // @deprecated
```

**Aktif Durumlar:** `ACTIVE`, `PARTIALLY_PAID`, `PAID`  
**Terminal (Son) Durumlar:** `PAID`, `REJECTED_BY_RECEIVER`, `AUTO_HIDDEN`

---

### 3.4 İşlem Varlığı (Transaction Entity - Yumuşak Katman)

**Koleksiyon Yolu:** Kişiye özel defterde saklanır (uygulama detayı).

#### Şema

```typescript
interface Transaction {
  id: string;
  amount: number; // Pozitif değer
  currency?: string; // Varsayılan: TRY
  description?: string; // Opsiyonel not
  direction: "INCOMING" | "OUTGOING"; // Mevcut kullanıcının perspektifi
  createdAt: Timestamp;
  createdBy: string; // UID
  type: "SIMPLE";
}
```

**Yön Mantığı:**

- `OUTGOING` (Giden): "Bu kişiye para verdim" → UI'da Kırmızı/Negatif
- `INCOMING` (Gelen): "Bu kişiden para aldım" → UI'da Yeşil/Pozitif

---

### 3.5 Ödeme Kaydı Varlığı (PaymentLog Entity - Denetim İzi)

**Koleksiyon Yolu:** `debts/{debtId}/logs/{logId}`  
**Amaç:** Borç üzerindeki tüm değişikliklerin değişmez, sadece eklenebilir kaydı.

#### Şema

```typescript
interface PaymentLog {
  id: string;
  type: PaymentLogType;
  timestamp: Timestamp;
  performedBy: string; // İşlemi yapanın UID'si

  // === FİNANSAL ALANLAR (PAYMENT tipi için) ===
  amountPaid?: number;
  previousRemaining: number; // İşlemden önceki tutar
  newRemaining: number; // İşlemden sonraki tutar
  installmentId?: string; // Belirli bir taksit ödendiyse
}

type PaymentLogType =
  | "INITIAL_CREATION" // Borç oluşturuldu
  | "PAYMENT" // Ödeme yapıldı
  | "NOTE_ADDED" // Not eklendi
  | "PAYMENT_DECLARATION" // Asenkron ödeme bildirimi
  | "HARD_RESET"; // Özel sıfırlama olayı
```

---

## 4. İş Mantığı ve Kısıtlamalar

### 4.1 "1 Saat Kuralı" (Zamansal Değişmezlik)

**Problem:** Finansal kayıtların sınırsız düzenlenmesine izin vermek güveni yok eder. Alice Bob'a ödeme yaptıktan sonra Bob tutarı değiştirirse Alice'in itiraz hakkı kalmaz.

**Çözüm:** 60 dakikalık esneklik payı, hataları düzeltme ile (typo) hesap verebilirliği (dolandırıcılığı önleme) dengeler.

**60 Dakika Sonra:**

- Düzenleme/Silme butonları kaybolur.
- Sadece "Ödeme Ekle" veya "Not Ekle" işlemleri kalır.
- Orijinal kayıt değişmez geçmişin bir parçası olur.

---

### 4.2 Sert Sıfırlama Mantığı (Hard Reset - Hata Düzeltme)

**Senaryo:** Kullanıcı yanlış parametrelerle 12 taksitli bir borç oluşturur. 5 dakika sonra fark eder ve tamamen düzeltmek ister.

**Doğru Yaklaşım (Hard Reset):**

1. Bir `HARD_RESET` log girişi ekle.
2. Borcu yeni değerlerle güncelle ve **`createdAt` değerini sıfırla**.

**İpucu:** `createdAt` değerini sıfırlayarak, 1 saatlik kural saati yeniden başlar ve kullanıcıya kalan hataları düzeltmek için yeni bir şans verir. Denetim izi ise geçmişi saklar.

---

### 4.3 Üç Durumlu Görünüm Mantığı (Tri-State View)

**Problem:** Kullanıcıların aynı kişiyle hem "gayri resmi alacak-verecekleri" hem de "resmi sözleşmeleri" olabilir. Bunları karıştırmak kafa karışıklığına yol açar.

**Çözüm:** Net ayrım sunan üç farklı görünüm.

| Mod        | Gösterilen      | Hesaplama                     | Kullanım Durumu               |
| ---------- | --------------- | ----------------------------- | ----------------------------- |
| **AKIŞ**   | Sadece İşlemler | `Σ(GELEN) - Σ(GİDEN)`         | "Elden ne kadar nakit çıktı?" |
| **ÖZEL**   | Sadece Borçlar  | `Σ(kalanTutar)`               | "Hangi resmi borçlar var?"    |
| **TOPLAM** | Birleşik        | `Akış Bakiyesi + Özel Bakiye` | "Net durumumuz nedir?"        |

---

### 4.4 Taksit Ödeme Mantığı

#### Ara Ödeme (Kısmi Ödeme)

1. `remainingAmount` değerinden düş.
2. Ödenmemiş tüm taksitleri eşit olarak **yeniden hesapla**.

#### Belirli Taksit Ödemesi

1. İlgili taksiti `isPaid = true` olarak işaretle.
2. Taksit tutarını `remainingAmount` değerinden düş.
3. Diğer taksitleri **yeniden hesaplama**.

---

### 4.5 Duyarlı Etkileşim Modeli (Cihaz Ayrımı)

**Mobil (<1024px):** Kaydırma (Swipe) hareketleri birincil etkileşimdir. Satır içi butonlar (çöp kutusu vb.) yasaktır.  
**Masaüstü (≥1024px):** Üzerine gelme (Hover) ile "Üç Nokta Menüsü" açılır. Kaydırma hareketleri yasaktır.

---

## 5. Durum Makineleri ve Geçişler

### 5.1 Borç Yaşam Döngüsü

```
[OLUŞTURULDU] → ACTIVE
    ↓
  [ÖDEME YAPILDI]
    ↓
  PARTIALLY_PAID
    ↓
  [SON ÖDEME]
    ↓
  PAID (Son Durum)
```

---

## 6. Kullanıcı İş Akışları

### 6.1 Kimlik Doğrulama Akışı

1. Telefon Numarası Girilir (`+90 XXX XXXXXXX`).
2. Firebase SMS OTP gönderir.
3. Kullanıcı 6 haneli kodu girer.
4. Doğrulama başarılıysa: Kullanıcı varsa veriler yüklenir, yoksa profil oluşturmaya yönlendirilir.

---

## 7. Ekran Şartnameleri

### 7.1 Panel (Dashboard)

- **Net Durum Özeti**: Tüm kişilerden `Σ(Bana borçlu olunan) - Σ(Benim borcum)` hesabı.
- **Kişi Kartları**: Avatar, İsim, Telefon, Net bakiye, Son mesaj.
- **Okunmamış Göstergesi**: Yeni aktivite varsa yeşil nokta.

---

## 8. Güvenlik ve Erişim Kontrolü

### 8.1 Firestore Güvenlik Kuralları

- Kullanıcılar sadece kendi profillerini ve rehberlerini okuyabilir/yazabilir.
- Borçlar her iki taraf (`participants`) için görünürdür.
- Loglar sadece eklenebilir (create), güncelleme ve silme yasaktır.
- Düzenleme işlemleri sadece `createdAt + 1 saat` süresince geçerlidir.

---

## 9. Performans ve Ölçeklenebilirlik

### 9.1 Sorgu Optimizasyonu

Paneldeki kişilerin hızlı yüklenmesi için `lastActivityAt` (azalan) ve `__name__` üzerinde bileşik indeks (composite index) kullanılır.

---

## 10. Uç Durumlar ve Hata Yönetimi

### 10.1 Telefon Numarası Değişikliği

Kullanıcı yeni numarayla giriş yaptığında yeni bir hesap oluşturulur. Eski verilerin taşınması destek ekibi tarafından manuel yapılır (Gelecekte "Numara Taşıma" özelliği eklenecektir).

### 10.2 Çakışan Ödemeler

Her iki taraf aynı anda ödeme kaydederse, Firestore işlemleri (transactions) ve iyimser kilitleme (optimistic locking) ile veri bütünlüğü korunur.

---

**ŞARTNAME SONU**

---

## Ekler

### A. Sözlük

- **Cari:** Günlük para akışlarının tutulduğu gayri resmi defter.
- **Taksit:** Bölünmüş ödeme parçası.
- **Peşinat:** Borç başlangıcında ödenen tutar.
- **Vade:** Son ödeme tarihi.
- **E.164:** Uluslararası telefon numarası formatı.

---

### C. Değişiklik Günlüğü (Changelog)

| Versiyon | Tarih      | Değişiklikler                                                        |
| -------- | ---------- | -------------------------------------------------------------------- |
| 1.0      | 2026-01-15 | İlk taslak                                                           |
| 2.0      | 2026-02-03 | Durum makineleri, uç durumlar ve doğrulama kurallarıyla tam revizyon |
