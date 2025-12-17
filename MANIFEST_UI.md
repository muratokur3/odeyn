DebtDert - Arayüz ve Deneyim Manifestosu (UI/UX)

1. Tasarım Dili: "Yaşlı Dostu & Modern"

Fontlar: Asla 14px'den küçük ana metin kullanılmaz. Bakiyeler Bold ve büyük puntoludur.

Renk Kodları (Traffic Light Protocol):

🟢 Yeşil/Teal: Alacak, Gelir, Onay, Başarılı.

🔴 Kırmızı/Rose: Borç, Gider, Red, Hata.

🟡 Sarı/Amber: Bekleyen, Uyarı.

🔵 Mavi: Bilgi, Nötr, Sistem Mesajı.

Dokunma Hedefleri: Tüm butonlar ve liste elemanları en az 48px yüksekliğinde olmalıdır.

2. Navigasyon ve Düzen

Bottom Navigation: Mobil deneyimde ana menü her zaman altta sabittir (fixed bottom-0). Klavye açıldığında davranışı yönetilmelidir.

Header & Theme: Üst bar (Header); marka logosunu, Tema Değiştiriciyi (Dark/Light Toggle) ve Bildirim Merkezini (Zil İkonu) içerir.

Safe Area: iPhone çentiği (Notch) ve alt çubuğu (Home Indicator) için pt-safe ve pb-safe boşlukları zorunludur.

3. Modallar ve Pop-uplar

Context-Aware: Bir borca tıklandığında açılan detay modalı, kullanıcının o borçtaki rolüne (Alacaklı mı Borçlu mu?) göre şekillenmelidir.

Alacaklı ise: "Ödeme Alındı Ekle", "Hatırlat" butonları önde olur.

Borçlu ise: "Ödeme Yaptım Bildir" butonu önde olur.

3.3. Seçim Kartı (SelectedUserCard)
    Kullanıcı bir kişi seçtiğinde arama inputu yerine beliren standart bileşendir.

    Görünüm: Seçilen kişinin Avatarı, Adı ve Telefon numarasını mavi (veya dark mode uyumlu) bir kart içinde gösterir.
    Etkileşim: Her zaman bir "X" (kapatma) butonu içerir. Bu tıklandığında seçim sıfırlanır ve arama moduna dönülür.
    Kural: Seçim aktifken, manuel isim giriş alanı gizlenir. Sadece arama/seçim yapılmadığında manuel giriş aktiftir.

4. Akıllı Inputlar

Telefon: Kullanıcı yazarken otomatik formatlanır (5XX) .... Ülke kodu seçilebilir.

Para: Kullanıcı 1000 yazar, sistem 1.000 ₺ gösterir.

Tarih: Tarih seçici (DatePicker) mobil uyumlu (Native) olmalıdır.

5. Bildirim Merkezi (In-App Notifications)

    Kullanıcı onayları, reddedilen borçlar ve ödeme bildirimleri, sağ üstteki 'Zil' ikonu altında toplanır.
    Okunmamış bildirimler kırmızı bir rozet (badge) ile gösterilir.
    Bildirimler modal içinde listelenir ve tıklandığında ilgili borcun detayına veya işlem ekranına yönlendirir.