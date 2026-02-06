# Pamuk Eller (DebtDert)

Arkadaşlarınızla aranızdaki alacak/verecek durumunu takip etmenizi sağlayan modern, kullanıcı dostu bir borç takip uygulaması. "Söz uçar, yazı kalır" prensibini dijitalleştirir.

## 🌟 Özellikler

*   **İkili Katman (Dual-Layer):**
    *   **Akış (Cari):** Günlük küçük harcamalar (Yemek, Taksi) için sohbet benzeri arayüz.
    *   **Dosyalar (Özel):** Vadeli veya taksitli büyük borçlar için resmi kayıt kartları.
*   **Asimetrik Güven:** İşlemler anında karşı tarafa yansır. Onay beklemez, sadece reddedilebilir.
*   **1 Saat Kuralı:** Hatalı girişler ilk 1 saat içinde silinebilir, sonrasında kalıcı hale gelir (Güvenlik).
*   **Çoklu Para Birimi:** TRY, USD, EUR ve Altın (Gram) desteği.
*   **Rehber Entegrasyonu:** Telefon rehberinizdeki kişilerle kolay eşleşme.

## 📚 Dokümantasyon

Projenin tüm detayları `docs/` klasörü altındaki belgelerde toplanmıştır:

| Belge | İçerik |
| :--- | :--- |
| **[PROJECT_MANIFEST.md](docs/PROJECT_MANIFEST.md)** | Projenin kimliği, değişmez kuralları ve manifestosu. |
| **[USER_GUIDE.md](docs/USER_GUIDE.md)** | Son kullanıcılar için kullanım rehberi. |
| **[ANALYSIS.md](docs/ANALYSIS.md)** | Teknik mimari, veri modeli ve iş mantığı (İngilizce). |
| **[SECURITY.md](docs/SECURITY.md)** | Güvenlik kuralları ve spam önleme. |
| **[IMPROVEMENTS.md](docs/IMPROVEMENTS.md)** | Gelecek planları, bilinen hatalar ve iyileştirmeler. |
| **[AI_PROMPTS.md](docs/AI_PROMPTS.md)** | AI asistanları için geliştirme talimatları. |

## 🚀 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

## 🛠️ Teknoloji Stack

*   **Frontend:** React + TypeScript + Vite
*   **Backend:** Firebase (Auth, Firestore, Functions, Storage)
*   **Stil:** Tailwind CSS
*   **Deploy:** Firebase Hosting
