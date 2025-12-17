DebtDert - Proje Manifestosu ve Teknik Anayasa

Bu belge, DebtDert projesinin temel amacını, veri bütünlüğü kurallarını, iş mantığını ve kullanıcı deneyimi standartlarını tanımlar. Bu projede kod yazan tüm AI modelleri ve geliştiriciler bu kurallara uymak zorundadır.

1. Temel Felsefe ve Amaç

DebtDert, kullanıcıların telefon rehberlerindeki kişilerle olan borç/alacak ilişkilerini takip etmelerini sağlayan, telefon numarası odaklı bir finansal kayıt defteridir.

Amaç: Finansal ilişkileri şeffaflaştırmak, unutkanlığı önlemek ve "Network Effect" ile kullanıcıların birbirini davet etmesini sağlamak.

Kimlik: Kullanıcının dijital kimliği Telefon Numarasıdır. E-posta sadece bir kurtarma aracıdır, asla bir kimlik belirleyici (identifier) olarak kullanılamaz.

2. "Tek Gerçek" Kuralı (Single Source of Truth)

Sistemdeki tüm veri eşleştirmeleri, aramalar ve kayıtlar Tek Bir Format üzerinden yürütülür.

2.1. Telefon Numarası Formatı

Veritabanına (Firestore) kaydedilen, aranan veya eşleştirilen TÜM numaralar E.164 Formatında (+905551234567) olmak zorundadır.

Arayüzde kullanıcı 0555, 555, (555) gibi formatlar girebilir. Ancak Service katmanına girmeden önce bu veri mutlaka cleanPhone() fonksiyonundan geçirilmelidir.

Yasak: Veritabanında boşluklu, parantezli veya yerel formatta (0555...) numara saklamak kesinlikle yasaktır.

2.2. E-Posta Yasağı

Borç ekleme, kişi arama, rehber kaydetme gibi iş süreçlerinde E-Posta ASLA kullanılmaz.

Borçlar email üzerinden değil, phoneNumber üzerinden eşleşir.

3. Kullanıcı ve Rehber Mantığı (Contact Logic)

3.1. Kişi Görünüm Hiyerarşisi (Smart Name Display)

Bir kişi kartında veya listede hangi ismin görüneceği şu öncelik sırasına göre belirlenir:

Rehber İsmi (En Yüksek Öncelik): Eğer giriş yapan kullanıcı, karşı tarafı kendi contacts alt koleksiyonuna "Tesisatçı Ali" diye kaydettiyse, ekranda "Tesisatçı Ali" yazar. (Karşı tarafın gerçek adı "Ali Yılmaz" olsa bile).

Sistem İsmi (Registered Name): Rehberde kayıtlı değilse ama karşı taraf sisteme kayıtlıysa, onun displayName'i görünür.

Manuel İsim (Shadow User): Kayıtlı değilse, borç oluşturulurken girilen manuel isim görünür.

Ham Numara: Hiçbiri yoksa formatlı telefon numarası görünür.

3.2. Rehber Mimarisi

Kullanıcı rehberi users dökümanı içinde Array olarak SAKLANMAZ.

Yapı: users/{userId}/contacts/{contactDocId} şeklinde Alt Koleksiyon (Sub-collection) kullanılır.

Herhangi bir yerden (Hızlı İşlem, Yeni Borç vb.) bir kişiye işlem yapıldığında, o kişi otomatik olarak bu alt koleksiyona eklenir/güncellenir.

4. Borç ve Onay Süreci (Transaction Lifecycle)

4.1. Oluşturma (Creation)

Borcu giren kişi (Creator) kaydı oluşturduğu an, kendi listesinde ve bakiyesinde görür.

Karşı taraf (Receiver) kaydı sadece "Gelen İstekler" (Incoming Requests) alanında görür. Bakiyesine yansımaz.

4.2. Onay Mekanizması

PENDING (Bekliyor): Varsayılan durum. Alıcı onaylayana kadar hesaplamalara (Receiver tarafında) dahil edilmez.

ACTIVE (Aktif): Alıcı onayladığında borç resmileşir. İki tarafın da bakiyesine işler.

REJECTED (Red): Alıcı reddederse veya Giren kişi iptal ederse işlem düşer.

PAID/PARTIALLY_PAID: Ödeme yapıldıkça durum güncellenir.

4.3. Veri Sahiplenme (Data Claiming)

Sisteme kayıtlı olmayan bir numaraya (+90555...) borç yazıldığında, bu kayıt "Sahipsiz" (Shadow) olarak bekler.

O numaranın sahibi sisteme kayıt olduğunda, claimPendingDebts fonksiyonu çalışır ve o numaraya ait tüm sahipsiz borçları yeni kullanıcının UIDsi ile eşleştirir.

5. UI/UX Standartları

5.1. Context-Aware Popups (Akıllı Modallar)

Bir kişiye veya borca tıklandığında açılan detay penceresi, kimin kime borçlu olduğunu net göstermelidir.

Kullanıcı "Alacaklı" ise -> Yeşil ağırlıklı, "Tahsil Et / Ödeme Ekle" butonları.

Kullanıcı "Borçlu" ise -> Kırmızı ağırlıklı, "Ödeme Yapıldı Bildir" butonları.

5.2. Tekil Giriş Noktası

Kullanıcı borcu "Hızlı İşlemler"den de eklese, "Rehber"den de eklese, "Ana Sayfa"dan da eklese;

Arka planda DAİMA aynı createDebt servisi çalışır.

Numara her zaman cleanPhone ile temizlenir.

Kişi her zaman addToContacts ile rehbere güncellenir.

6. Özet: AI Modelleri İçin Talimat

Bu projede kod yazarken:

Önce src/utils/phoneUtils.ts dosyasını import etmeden telefon işlemi yapma.

Veritabanı sorgularında email kullanma, phoneNumber kullan.

UI tasarlarken "Yaşlı Dostu" (Büyük fontlar, net renkler, az karmaşa) prensibine sadık kal.

Rehber işlemlerini daima users/{uid}/contacts alt koleksiyonuna yap.