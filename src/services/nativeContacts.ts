/**
 * Platform-Aware Contacts Service
 * Web: Contact Picker API (navigator.contacts)
 * Native (Capacitor): @capacitor-community/contacts plugin
 */

import { Capacitor } from '@capacitor/core';

export interface DeviceContact {
    name: string;
    phones: string[];
}

/**
 * Cihaz rehberinden kişileri al.
 * Platform'a göre doğru API'yi kullanır.
 */
export async function getDeviceContacts(): Promise<DeviceContact[]> {
    if (Capacitor.isNativePlatform()) {
        return getNativeContacts();
    } else {
        return getWebContacts();
    }
}

/**
 * Platform'da rehber erişiminin desteklenip desteklenmediğini kontrol eder.
 */
export function isContactsSupported(): boolean {
    if (Capacitor.isNativePlatform()) {
        return true; // Native'de her zaman desteklenir
    }
    return 'contacts' in navigator && 'ContactsManager' in window;
}

// --- Native (Capacitor) ---

async function getNativeContacts(): Promise<DeviceContact[]> {
    const { Contacts } = await import('@capacitor-community/contacts');

    const permission = await Contacts.requestPermissions();
    if (permission.contacts !== 'granted') {
        throw new Error('Rehber erişim izni reddedildi.');
    }

    const result = await Contacts.getContacts({
        projection: {
            name: true,
            phones: true
        }
    });

    return (result.contacts || [])
        .filter(c => c.phones && c.phones.length > 0)
        .map(c => ({
            name: c.name?.display || c.name?.given || '',
            phones: (c.phones || []).map(p => p.number || '').filter(Boolean)
        }));
}

// --- Web (Contact Picker API) ---

async function getWebContacts(): Promise<DeviceContact[]> {
    if (!('contacts' in navigator) || !('ContactsManager' in window)) {
        throw new Error('Bu tarayıcıda rehber erişimi desteklenmiyor.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const contacts = await nav.contacts.select(['name', 'tel'], { multiple: true });

    return contacts.map((c: { name?: string[]; tel?: string[] }) => ({
        name: c.name?.[0] || '',
        phones: c.tel || []
    }));
}
