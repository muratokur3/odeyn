DebtDert - Borç ve Ödeme Manifestosu (Debt Logic)

1. Borç Yaşam Döngüsü (Lifecycle)

1.1. Oluşturma (Creation)

Görünürlük: Borcu giren kişi (Creator), kaydı anında "Hesap Defterim"de görür ve bakiyesine yansır.

Karşı Taraf: Karşı taraf (Receiver), kaydı sadece "Gelen İstekler" kutusunda görür. Onaylayana kadar bakiyesine yansımaz.

Zorunlu Alanlar: Tutar, Para Birimi, Karşı Taraf (Telefon), Borç Tipi (Alacak/Verecek).

1.2. Onay Mekanizması (Approval)

Onay (ACTIVE): Karşı taraf onaylarsa borç resmileşir. İki tarafın da bakiyesinde görünür.

Red (REJECTED): Karşı taraf reddederse, Creator'a bildirim gider. Kayıt "İptal Edildi" statüsüne geçer (Silinmez, tarihçede kalır).

1.3. Ödeme Süreci (Payments)

Kim Ödeme Ekleyebilir?

Alacaklı (Lender): Ödeme eklerse işlem anında onaylanır ve bakiye düşer.

Borçlu (Borrower): Ödeme eklerse bu bir "Ödeme Bildirimi"dir. Alacaklı onaylayana kadar bakiye düşmez (Güvenlik Kuralı).

Kısmi Ödeme: Borçlar parça parça ödenebilir.

remainingAmount asla originalAmounttan büyük olamaz.

remainingAmount 0 olduğunda statü otomatik PAID (Kapandı) olur.

3. Borç Görünüm ve Silme Kuralları (Display & Integrity)

3.1. İsim Gösterim Hiyerarşisi (Smart Display Priority)
Borç listesinde ismin nasıl görüneceği şu sırayla belirlenir (Sistem yukarıdan aşağıya tarar):

1.  **Canlı Rehber Kaydı:** `users/{uid}/contacts` içinde bu E.164 numarasıyla eşleşen bir isim var mı? (Varsa -> "Ahmet Abi")
2.  **Sistem Kullanıcısı:** Bu numara kayıtlı bir `User` ise onun `displayName`'i. (Varsa -> "Ahmet Yılmaz")
3.  **Snapshot İsim:** Borç oluşturulurken girilen yedek isim. (Varsa -> "Ahmet")
4.  **Ham Numara:** Hiçbiri yoksa E.164 formatlı telefon no. (+90 555...)

3.2. Silme ve Veri Bütünlüğü (Data Integrity)

*   **Rehberden Silme Etkisizliği:** Rehberden kişi silmek, borcu etkilemez. Borç "Yetim" (Orphan) kalır ama var olmaya devam eder.
*   **Çöp Kutusu (Soft Delete):** Finansal veri asla Hard Delete yapılmaz. `isDeleted: true` işareti alır.

3.3. Kim Silebilir?

PENDING durumunda: Sadece oluşturan (Creator) silebilir.

ACTIVE durumunda: Silme işlemi yapılamaz. Sadece "Borç Kapatıldı" (Ödendi) yapılabilir veya "İptal" edilebilir.

REJECTED durumunda: Oluşturan kişi arşivleyebilir.

3. Taksitlendirme (Installments)

Borç girilirken "Taksitli" seçeneği seçilirse;

Ana borç tek bir kayıt (Debt) olarak tutulur.

Altına installments array'i eklenir.

Ödeme yapıldıkça, vadesi en yakın olan taksitten düşülür.