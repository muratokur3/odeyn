DebtDert - Çekirdek Manifesto (Core)

1. Proje Kimliği

DebtDert, bireyler arası borç/alacak takibini sağlayan, telefon numarası tabanlı bir finansal kayıt defteridir.

Vizyon: "Söz uçar, yazı kalır" prensibini dijitalleştirmek. Finansal ilişkileri şeffaf ve gerilimsiz hale getirmek.

Hedef Kitle: Teknolojiyle arası çok iyi olmayan kullanıcılar (yaşlılar) dahil herkes.

2. Değiştirilemez Teknik Kurallar (The Iron Rules)

Tekil Kimlik (Phone ID): Sistemdeki yegane kimlik belirleyici Telefon Numarasıdır.

Format: E.164 (+905551234567).

*   Veritabanına asla `0555` veya `(555)` formatında kayıt yapılamaz.
*   **Source of Truth:** E.164 formatı, Kullanıcı (Auth), Rehber (Contact) ve Borç (Debt) arasındaki tek ve değişmez bağlantı anahtarıdır.

E-posta, sadece şifre kurtarma ve bildirim aracıdır; işlem anahtarı değildir.

Veri Sahipliği:

Veriyi giren (Creator) her zaman verinin sahibidir.

Veri adına girilen (Receiver) sadece onay/red hakkına sahiptir.

Para Birimi:

Sistem çoklu para birimini (TRY, USD, EUR, Gold) destekler.

Kur dönüşümleri sadece "Bilgilendirme" amaçlıdır (Dashboard özeti). Borçlar girildiği para birimi cinsinden saklanır ve ödenir.

3. Teknoloji Yığını Sınırları

Frontend: React + Vite + Tailwind CSS.

Backend: Firebase (Firestore, Auth, Functions, Storage).

Mobil Strateji: PWA ve ileride React Native (Expo). Bu yüzden tüm div yapıları mobil uyumlu (flex, touch-target) olmalıdır.

4. Mimari Standartlar (Global State)

Auth, Theme ve Modal yönetimi için React Context API kullanılır. Redux vb. harici kütüphaneler yasaktır.

Global Modal Sistemi: Uygulama genelinde başarı, hata ve onay mesajları için `ModalContext` (Global Alert/Confirm) yapısı zorunludur. Ad-hoc `window.alert` kullanımı yasaktır.