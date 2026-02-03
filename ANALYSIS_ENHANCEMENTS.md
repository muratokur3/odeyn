## 11. KRİTİK İYİLEŞTİRMELER (Geliştirici Perspektifi)

### 11.3 Eksik: Geri Al/Yinele Sistemi

**Sorun:** Kullanıcılar hata yapar. 1 saat kuralı yardımcı olur ama ikilidir (düzenlenebilir / düzenlenemez). Gerçek dünyanın ihtiyacı:

- "Bekle, 500 yerine 5000 girdim" → anında düzeltmeye ihtiyaç var.
- "Dün ödeme yaptım ama kaydetmeyi unuttum" → geçmişe dönük girişe ihtiyaç var.

**Çözüm: Geri Al Yığını (İstemci Tarafı)**

```typescript
interface UndoAction {
  id: string;
  type: "CREATE_DEBT" | "MAKE_PAYMENT" | "EDIT_AMOUNT";
  timestamp: Timestamp;
  undo(): Promise<void>; // İşlemi tersine çevirir
  redo(): Promise<void>; // İşlemi yeniden uygular
}

class UndoManager {
  private stack: UndoAction[] = [];
  private maxSize = 10; // Son 10 işlemi tut

  async undo() {
    const action = this.stack.pop();
    await action?.undo();
  }
}
```

**UI:**

- Herhangi bir işlemden sonra 5 saniye boyunca yüzen "Geri Al" butonu görünür.
- Klavye kısayolu: Ctrl+Z / Cmd+Z.
- Esneklik payı içindeki işlemlerle sınırlıdır.

---

## 12. Dolandırıcılık Önleme ve Suistimal

### 12.1 Hız Sınırlama (Spam Önleme)

**Tehdit:** Kötü niyetli kullanıcı, mağduru taciz etmek için 100 sahte borç oluşturur.

**Çözüm: Firestore Kuralları + İstemci Tarafı Kısıtlaması**

```javascript
// Firestore Güvenlik Kuralları
match /debts/{debtId} {
  allow create: if request.auth.uid == request.resource.data.createdBy
                && request.time > resource.data.lastDebtCreated + duration.value(30, 's');
                // ^ 30 saniyede en fazla 1 borç
}
```

**Ek Limitler:**

- 30 saniyede 1 borç.
- Saatte 20 borç.
- Kullanıcı başına günlük 100 borç.

---

### 12.2 Şüpheli Aktivite Tespiti

**İşaretlenecek Desenler:**

1. **Hızlı Borç Oluşturma**
   - 5 dakika içinde 5+ borç → Otomatik gizle + mağdura e-posta gönder.
2. **Yeni Hesaplardan Büyük Tutarlar**
   - uyarı göster, eklemeyi bir müddet engelle.

---

## 14. Basitleştirme Fırsatları

### 14.1 Kaldır: Yumuşak Silme / Çöp Kutusu

**Mevcut:** `isDeleted` bayrağı 1 saat içinde "yumuşak silme"ye izin verir.

**Sorun:** Sorguları karmaşıklaştırır ve kullanıcı kafasını karıştırır.

**Basitleştirme:** Esneklik payı içindeyse kalıcı olarak silin. Pay dolduysa silme butonunu kaldırın (zaten değişmezdir).

---

### 14.2 Birleştir: Durum Enum Temizliği

**Mevcut:** 9 farklı durum (çoğu kullanım dışı).
**Basitleştirilmiş:** AKTİF, ÇÖZÜLDÜ (SETTLED), İPTAL (CANCELED).

---

## 15. Eksik Özellikler (Olmazsa Olmaz)

### 15.1 Bildirim Sistemi

Kullanıcılar; aleyhlerine borç oluşturulduğunda, bir ödeme kaydedildiğinde veya vade yaklaştığında anında haber almalıdır (Push).

### 15.2 Dışa Aktar ve Yedekle

Kullanıcılar finansal kayıtlarını vergi veya yasal nedenlerle JSON veya PDF olarak yerel cihazlarına kaydedebilmelidir.

### 15.3 Hesap Silme Akışı

GDPR uyumluluğu için "Unutulma Hakkı". Hesap silindiğinde kullanıcı verileri anonimleştirilmeli, ancak karşı taraflar için borç kayıtları (anonim isimle) korunmalıdır.

### 15.5 Çoklu Para Birimi Otomatik Dönüştürme

USD olarak kaydedilen bir borcun TRY karşılığını anlık kurlarla görebilme.

---

**KRİTİK İYİLEŞTİRMELERİN SONU**

---
