/**
 * Push Notification Service (Capacitor Native)
 * FCM token alma, push listener'ları yönetme
 */

import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * FCM token'ı Firestore'a kaydet
 */
export async function saveFcmToken(userId: string, token: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token),
        lastTokenUpdate: serverTimestamp()
    });
}

/**
 * Push notification sistemini başlat (sadece native platformlarda)
 */
export async function initPushNotifications(
    userId: string,
    onNotificationReceived?: (title: string, body: string, data: Record<string, string>) => void
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { PushNotifications } = await import('@capacitor/push-notifications');

    // İzin iste
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
        console.warn('[Push] Bildirim izni reddedildi.');
        return;
    }

    // FCM'e kayıt ol
    await PushNotifications.register();

    // Token alındığında Firestore'a kaydet
    PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] FCM Token:', token.value);
        try {
            await saveFcmToken(userId, token.value);
        } catch (err) {
            console.warn('[Push] Token kaydetme hatası:', err);
        }
    });

    // Token alma hatası
    PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Kayıt hatası:', error);
    });

    // Uygulama açıkken gelen bildirim
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Bildirim alındı:', notification);
        if (onNotificationReceived) {
            onNotificationReceived(
                notification.title || 'Odeyn',
                notification.body || '',
                (notification.data || {}) as Record<string, string>
            );
        }
    });

    // Kullanıcı bildirime tıkladığında
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Bildirime tıklandı:', action);
        const data = action.notification.data as Record<string, string> | undefined;
        const debtId = data?.debtId;
        if (debtId) {
            // İlgili borç sayfasına yönlendir
            window.location.href = `/debt/${debtId}`;
        }
    });
}

/**
 * Push notification dinleyicilerini temizle
 */
export async function removePushListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
}
