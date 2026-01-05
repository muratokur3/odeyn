DebtDert - Proje Manifestosu ve Teknik Anayasa

Bu belge, DebtDert projesinin temel amacını, veri bütünlüğü kurallarını, iş mantığını ve kullanıcı deneyimi standartlarını tanımlar. Bu projede kod yazan tüm AI modelleri ve geliştiriciler bu kurallara uymak zorundadır.

1. Temel Felsefe ve Amaç: İkili Katman (Dual-Layer)
Uygulama artık iki ana katman üzerinde çalışır:
1.  **Akış (Cari):** Günlük basit para alışverişi. Sohbet balonları şeklinde görünür.
2.  **Dosyalar (Özel İşlemler):** Vade, taksit veya detay içeren karmaşık borçlar. Dosya/Kart şeklinde görünür.

2. "1 Saat Kuralı" (The 1-Hour Hard Delete Rule)
Veri bütünlüğü için katı silme kuralı:
*   Bir kayıt SADECE **Oluşturan (Creator)** tarafından silinebilir.
*   Bir kayıt SADECE oluşturulduktan sonraki **1 Saat** içinde silinebilir.
*   **Mantık:** `isDeletable = isCreator && (now - createdAt < 60 minutes)`
*   Süre dolduysa silinemez, ancak karşı işlem (ters kayıt) ile kapatılabilir veya arşivlenebilir.

3. Birleşik Akıllı Giriş (Unified Smart Input)
*   Tek bir "Ekle" (+) butonu vardır.
*   **Basit Mod:** Tutar + Açıklama -> Akışa (Cari) yazar.
*   **Gelişmiş Mod:** Tarih, Taksit seçilirse -> "Özel Dosya"ya dönüşür ve `debts` koleksiyonuna yazar.

4. Veri ve Rehber Mantığı
4.1. Telefon Numarası
*   Tüm numaralar E.164 (+90...) formatında saklanır.
*   Arayüzde formatlı görünür.

4.2. Rehber Mimarisi
*   `users/{userId}/contacts/{contactDocId}` yapısı korunur.

5. Arayüz Standartları
*   **Akış:** Sohbet arayüzü. Sağ (Yeşil/Verdim), Sol (Kırmızı/Aldım). Düz Çizgiler.
*   **Dosyalar:** Kart listesi. Kesik Çizgiler (Sözleşme hissi).
*   **Navigasyon:** İki görünüm arasında Swipe (Kaydırma) ile geçiş.

6. Teknik Altyapı
*   **Akış Verisi:** `debts/{ledgerId}/transactions` (Paylaşımlı Defter)
*   **Dosya Verisi:** `debts` koleksiyonu (Bağımsız Dökümanlar)

7. Özet: AI Modelleri İçin Talimat
Bu projede kod yazarken:
*   Manifestoda belirtilen "İkili Katman" yapısına sadık kal.
*   1 Saat kuralını asla esnetme.
*   Giriş ekranını "Basit" başlat, gerekirse "Karmaşık"a genişlet.
