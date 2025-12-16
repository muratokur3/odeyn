DebtDert - Kimlik ve Rehber Manifestosu (Identity)

1. Kişi Tanımlama ve Görünüm (Smart Display Name)

Sistemde bir kişinin isminin nasıl görüneceği şu katı hiyerarşiye bağlıdır:

Kişisel Rehber İsmi (Private Contact Name):

Eğer ben o numarayı rehberime "Tesisatçı Ali" diye kaydettiysem, her yerde (borç listesinde, detayda) öyle görürüm.

Sistem İsmi (Public Display Name):

Rehberimde yoksa ama kişi DebtDert üyesi ise, onun kendi profilinde belirlediği isim ("Ali Yılmaz") görünür.

Manuel İsim (Shadow Name):

Üye değilse ve rehberimde yoksa, borcu ilk oluştururken girdiğim isim ("Ali") görünür.

Ham Numara:

Hiçbiri yoksa +90 555... görünür.

3. Rehber Mimarisi (Decoupled Contact Architecture)

**Felsefe:** "Kişi" (Contact) sadece bir **Görünüm Katmanıdır** (View Layer). "Borç" (Debt) ise **Varlık Katmanıdır** (Asset Layer). İkisi birbirinden ayrılmıştır.

1.  **Bağlantı (Decoupling):**
    *   Bir Borç kaydı, asla bir `Contact ID`'ye bağlanmaz.
    *   Borç kaydı, değişmez bir `Phone Number (E.164)`'a bağlanır.
    *   İsim gösterimi anlık olarak (Live Resolution) yapılır.

2.  **Otomatik Kayıt (Auto-Save Rule):**
    *   Kullanıcı telefon numarası girerek yeni bir borç oluşturduğunda, sistem arka planda:
        *   Bu numara rehberde var mı? -> Yoksa
        *   Otomatik olarak `users/{uid}/contacts` altına yeni bir Kişi Kartı oluşturur.
    *   **Hedef:** Her borçlusunun rehberde bir karşılığı olmalıdır.

3.  **Güvenli Silme (Orphan Logic):**
    *   Kullanıcı rehberinden "Ahmet"i sildiğinde:
        *   Sadece `contacts` koleksiyonundaki kart silinir.
        *   Borç kayıtları (`debts`) **ASLA SİLİNMEZ**.
        *   Borç listesinde isim yerine, borcu oluştururken girilen "Snapshot Name" (Yedek İsim) gösterilir veya numara görünür.

4.  **Dirilme (Resurrection Rule):**
    *   Kullanıcı sildiği "Ahmet"i (+90555...) tekrar "Ahmet Abi" olarak kaydederse:
        *   Sistem E.164 numarasını eşleştirir.
        *   **Anında:** Geçmişteki 5 yıllık tüm borç kayıtlarında isim "Ahmet Abi" olarak güncellenir. Çünkü arayüz canlı olarak rehberden okuma yapar.

5.  Gölge Kullanıcı ve Veri Sahiplenme (Data Claiming)

Gölge Kullanıcı (Shadow User): Sisteme henüz kayıt olmamış ama üzerine borç yazılmış telefon numarasıdır.

Sahiplenme (Claiming):

Bir kullanıcı kayıt olduğunda (Register), sistem debts tablosunu tarar.

Kullanıcının telefon numarasına (+90...) yazılmış ama uidsi boş olan kayıtları bulur.

Bu kayıtları yeni kullanıcının uidsi ile günceller.

Böylece kullanıcı ilk girişinde geçmiş borçlarını görür.

4. Profil Kuralları

Kullanıcı telefon numarasını değiştiremez (Kimliktir).

E-posta adresini değiştirebilir (Sadece iletişim içindir).

Profil fotoğrafı yükleyebilir (Firebase Storage).