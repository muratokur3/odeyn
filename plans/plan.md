# Yayına Alım Öncesi Kritik Aksiyon Planı

Bu belge, Odeyn projesinin "Production Ready" (Yayına Hazır) hale gelmesi için tamamlanması gereken en kritik 3 aksiyonu içermektedir.

## 1. Gerçek SMS Gateway Entegrasyonu
*   **Mevcut Durum:** Telefon doğrulama sistemi şu an `functions/src/index.ts` içerisinde sadece loglara kod basan bir mock yapıdadır.
*   **Aksiyon:** Twilio, MessageBird veya yerel bir SMS operatörü API'si entegre edilerek gerçek kullanıcılara doğrulama kodu gönderilmesi sağlanmalıdır.
*   **Neden:** Kullanıcıların gerçekliğini doğrulamak ve güvenli onboarding sağlamak için zorunludur.

## 2. Push Bildirimleri (Firebase Cloud Messaging - FCM)
*   **Mevcut Durum:** Bildirimler sadece uygulama içindeyken Firestore üzerinden takip edilmektedir.
*   **Aksiyon:** Uygulama kapalıyken veya arka plandayken borç/ödeme bildirimlerinin kullanıcıya ulaşması için FCM entegrasyonu tamamlanmalıdır.
*   **Neden:** Kullanıcı etkileşimini artırmak ve anlık finansal hareketlerden haberdar etmek projenin temel değer önerisidir.

## 3. Hız Sınırlama (Rate Limiting) ve Güvenlik Sıkılaştırma
*   **Mevcut Durum:** Firestore kuralları temel düzeydedir, ancak seri borç oluşturma gibi spam hareketlerine karşı backend seviyesinde bir engel yoktur.
*   **Aksiyon:** Firebase Cloud Functions veya Firestore Security Rules kullanılarak (örneğin 30 saniyede en fazla 1 işlem) hız sınırlaması getirilmelidir.
*   **Neden:** Platformun kötüye kullanımını önlemek ve spam borç kayıtları ile veritabanının şişmesini engellemek için gereklidir.
