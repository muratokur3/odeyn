[AI Directive]: Bu dosya, projenin kimliği, kuralları ve manifestosu hakkında kesin bilgi kaynağıdır.

# DebtDert - Proje Manifestosu (Project Manifest)

Bu belge, DebtDert projesinin temel amacını, veri bütünlüğü kurallarını, iş mantığını ve kullanıcı deneyimi standartlarını tanımlar. Bu projede kod yazan tüm AI modelleri ve geliştiriciler bu kurallara uymak zorundadır.

---

## 1. Proje Kimliği (Project Identity)

**DebtDert**, bireyler arası borç/alacak takibini sağlayan, telefon numarası tabanlı bir finansal kayıt defteridir.

*   **Vizyon:** "Söz uçar, yazı kalır" prensibini dijitalleştirmek. Finansal ilişkileri şeffaf ve gerilimsiz hale getirmek.
*   **Hedef Kitle:** Teknolojiyle arası çok iyi olmayan kullanıcılar (yaşlılar) dahil herkes.
*   **Temel Felsefe:**
    *   **İkili Katman (Dual-Layer):**
        1.  **Akış (Cari):** Günlük basit para alışverişi. Sohbet balonları şeklinde görünür (Yeşil/Kırmızı).
        2.  **Dosyalar (Özel İşlemler):** Vade, taksit veya detay içeren karmaşık borçlar. Dosya/Kart şeklinde görünür.
    *   **Asimetrik Güven (Asymmetric Trust):** Borç girildiği anda **ACTIVE** (Geçerli) durumdadır. "Onay Bekliyor" (Pending) statüsü yoktur. Karşı taraf sadece "Reddet/Sil" (Opt-Out) yapabilir.

---

## 2. Değiştirilemez Teknik Kurallar (The Iron Rules)

1.  **Tekil Kimlik (Phone ID):** Sistemdeki yegane kimlik belirleyici **Telefon Numarasıdır**.
    *   **Format:** E.164 (`+905551234567`). Veritabanına asla `0555` veya `(555)` formatında kayıt yapılamaz.
    *   **Source of Truth:** E.164 formatı, Kullanıcı (Auth), Rehber (Contact) ve Borç (Debt) arasındaki tek ve değişmez bağlantı anahtarıdır.
    *   E-posta, sadece şifre kurtarma ve bildirim aracıdır; işlem anahtarı değildir.

2.  **"1 Saat Kuralı" (The 1-Hour Hard Delete Rule):**
    *   Bir kayıt SADECE **Oluşturan (Creator)** tarafından silinebilir.
    *   Bir kayıt SADECE oluşturulduktan sonraki **1 Saat** içinde silinebilir.
    *   **Mantık:** `isDeletable = isCreator && (now - createdAt < 60 minutes)`
    *   Süre dolduysa silinemez, ancak karşı işlem (ters kayıt) ile kapatılabilir veya arşivlenebilir.
    *   Finansal veri asla Hard Delete yapılmaz (1 saat sonrası).

3.  **Veri Sahipliği:**
    *   Veriyi giren (Creator) her zaman verinin sahibidir.
    *   Veri adına girilen (Receiver) işlemi engelleyemez, sadece tek taraflı olarak reddedebilir/silebilir (Opt-Out). Bu işlem, kaydı sadece kendi ekranından kaldırır.

4.  **Mimari Standartlar:**
    *   **Frontend:** React + Vite + Tailwind CSS.
    *   **Backend:** Firebase (Firestore, Auth, Functions, Storage).
    *   **State:** React Context API (Global Alert/Confirm için `ModalContext`). Redux yasaktır.
    *   **Mobil Strateji:** PWA öncelikli. Tüm div yapıları mobil uyumlu (flex, touch-target) olmalıdır.

---

## 3. Veri Modeli ve İş Mantığı (Data & Business Logic)

### 3.1. Borç Yaşam Döngüsü
*   **Oluşturma:** Borcu giren kişi (Creator) kaydı anında görür. Karşı taraf (Receiver) da anında görür (Asimetrik Güven).
*   **Ödeme:**
    *   **Alacaklı (Lender):** Ödeme eklerse işlem anında onaylanır.
    *   **Borçlu (Borrower):** Ödeme eklerse işlem anında yansır (Alacaklının reddetme hakkı saklıdır).
*   **Taksitlendirme:** Borç girilirken "Taksitli" seçilirse, ana borç tek kayıt olarak tutulur, altına `installments` array'i eklenir. Ödemeler vadesi en yakın taksitten düşülür.

### 3.2. Kimlik ve Rehber Mimarisi
**İsim Gösterim Hiyerarşisi (Smart Display Priority):**
1.  **Canlı Rehber Kaydı:** `users/{uid}/contacts` içinde bu numara ile eşleşen isim ("Ahmet Abi").
2.  **Sistem Kullanıcısı:** Kayıtlı `User` ise onun `displayName`'i ("Ahmet Yılmaz").
3.  **Snapshot İsim:** Borç oluşturulurken girilen yedek isim ("Ahmet").
4.  **Ham Numara:** Hiçbiri yoksa E.164 (+90 555...).

**Rehber Mantığı:**
*   `Contact` (Kişi) sadece bir Görünüm Katmanıdır. `Debt` (Borç) Varlık Katmanıdır.
*   Rehberden kişi silmek borcu etkilemez (Yetim/Orphan kalır ama veri durur).
*   Bir kullanıcı kayıt olduğunda (Register), sistem telefon numarasına yazılmış ama UID'si boş olan kayıtları bulur ve eşleştirir (Sahiplenme/Claiming).

### 3.3. Birleşik Akıllı Giriş (Unified Smart Input)
*   Tek bir "Ekle" (+) butonu vardır.
*   **Basit Mod:** Tutar + Açıklama -> Akışa (Cari) yazar.
*   **Gelişmiş Mod:** Tarih, Taksit seçilirse -> "Özel Dosya"ya dönüşür ve `debts` koleksiyonuna yazar.

---

## 4. Arayüz Standartları (UI/UX)

### 4.1. Tasarım Dili
*   **Renk Kodları (Traffic Light Protocol):**
    *   🟢 **Yeşil/Teal:** Alacak, Gelir, Onay.
    *   🔴 **Kırmızı/Rose:** Borç, Gider, Red.
    *   🟡 **Sarı/Amber:** Bekleyen, Uyarı.
*   **Fontlar:** Asla 14px'den küçük ana metin kullanılmaz. Bakiyeler Bold ve büyüktür.
*   **Görünüm:**
    *   **Akış:** Sohbet arayüzü. Sağ (Yeşil/Verdim), Sol (Kırmızı/Aldım). Düz Çizgiler.
    *   **Dosyalar:** Kart listesi. Kesik Çizgiler (Sözleşme hissi).

### 4.2. Navigasyon
*   **Bottom Navigation:** Mobil deneyimde ana menü altta sabittir.
    *   Ana Sayfa, Araçlar, Hızlı İşlem (FAB), Rehber, Ayarlar.
*   **Ayarlar Ekranı:** Profil, Hesap, Tercihler ve Çöp Kutusu tek çatı altında toplanmıştır.
*   **Safe Area:** iPhone çentiği (Notch) ve alt çubuğu için `pt-safe` ve `pb-safe` boşlukları zorunludur.

### 4.3. Etkileşimler
*   **Navigasyon:** İki görünüm (Akış/Dosyalar) arasında Swipe (Kaydırma) ile geçiş yoktur (Sekme kullanılır).
*   **Modallar:** Borç detayları ve geçmişi Chat (Sohbet) arayüzü şeklinde listelenir. Oluşturan SAĞDA, Karşı taraf SOLDA.
*   **Seçim Kartı (SelectedUserCard):** Kişi seçildiğinde arama inputu yerine beliren, "X" ile kapatılabilen standart bileşen.
