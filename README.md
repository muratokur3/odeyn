# Pamuk Eller (DebtDert)

Arkadaşlarınızla aranızdaki alacak/verecek durumunu takip etmenizi sağlayan modern, kullanıcı dostu bir borç takip uygulaması.

## Özellikler
- **Kişiler arası borç takibi:** Alacak ve verecekleri tek ekrandan yönetin.
- **Çoklu Para Birimi:** TRY, USD, EUR, Altın gibi farklı birimlerle işlem yapın.
- **gölge Kullanıcılar:** Uygulamayı kullanmayan arkadaşlarınızı rehberden ekleyip takip edebilirsiniz.
- **Onay Mekanizması:** Karşı taraf uygulamayı kullanıyorsa işlemler onaydan geçer.

## Son Güncellemeler (v0.1.0)

### 🎨 Arayüz ve Tasarım
- **Kişi Detay Sayfası:** Başlık alanı WhatsApp tarzı modern bir görünüme kavuşturuldu.
- **Araçlar Sayfası:** Header alanı küçültülerek ve gereksiz boşluklar alınarak minimalist hale getirildi.
- **Avatar Sistemi:** 
    - Varsayılan baş harfler yerine modern ikonlar eklendi.
    - Sistem kullanıcıları ve rehber kişileri için renkli durum halkaları eklendi.

### 🛠️ Düzeltmeler ve İyileştirmeler
- **Avatar Görünürlüğü (Global Fix):**
    - Anasayfa, Rehber, Kişi Detay ve Onay Bekleyenler sayfalarında; sistem kullanıcısı olan kişilerin profil fotoğraflarının görünmemesi sorunu çözüldü.
    - Arka planda UID/Telefon eşleşme mantığı ("Reverse Lookup") geliştirildi.
- **Kişi Ekleme:** 
    - Gölge kullanıcı oluştururken isim girme zorunluluğu kaldırıldı (Rehber ismini veya telefonu kullanır).
    - "Hayalet Bellek" özelliği ile daha önce işlem yapılan numaranın ismi hatırlandı.
- **Çöp Kutusu:** Silinen kayıtların filtreleme hatası giderildi.
- **Mobil Uyumluluk:** Modal pencerelerin (Borç Ekle vb.) mobilde klavye açılınca oluşan kayma sorunları giderildi.

## Kurulum

\`\`\`bash
npm install
npm run dev
\`\`\`

## Teknoloji Stack
- React + TypeScript + Vite
- Firebase (Auth, Firestore)
- Tailwind CSS
