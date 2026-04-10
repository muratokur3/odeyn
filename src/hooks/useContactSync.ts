import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { batchAddContacts } from '../services/db';
import { cleanPhone } from '../utils/phoneUtils';
import { useModal } from '../context/ModalContext';
import { getDeviceContacts, isContactsSupported } from '../services/nativeContacts';

export const useContactSync = () => {
    const { user } = useAuth();
    const { showAlert } = useModal();
    const [isSyncing, setIsSyncing] = useState(false);

    const isSupported = isContactsSupported();

    const syncContacts = useCallback(async () => {
        if (!user) return;

        if (!isSupported) {
            showAlert(
                'Desteklenmeyen Tarayıcı',
                'Tarayıcınız bu özelliği desteklemiyor. Bu özellik sadece modern mobil tarayıcılarda (örn: Android için Chrome) çalışır.',
                'warning'
            );
            return;
        }

        setIsSyncing(true);
        try {
            // Platform-aware: Native veya Web Contact Picker
            const selectedContacts = await getDeviceContacts();

            if (!selectedContacts || selectedContacts.length === 0) {
                setIsSyncing(false);
                return;
            }

            const validContacts: { name: string; phoneNumber: string }[] = [];
            const processedNumbers = new Set<string>();

            for (const contact of selectedContacts) {
                const name = contact.name;
                const phones = contact.phones || [];

                if (!name || phones.length === 0) continue;

                for (const tel of phones) {
                    const clean = cleanPhone(tel);
                    if (!clean || clean.length < 8) continue;
                    if (processedNumbers.has(clean)) continue;

                    processedNumbers.add(clean);
                    validContacts.push({ name, phoneNumber: clean });
                }
            }

            if (validContacts.length > 0) {
                await batchAddContacts(user.uid, validContacts);

                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    settings: {
                        contactSyncEnabled: true,
                        contactAccessGranted: true,
                        suppressSyncSuggestion: true,
                        lastSyncAt: serverTimestamp()
                    }
                }, { merge: true });

                showAlert("Başarılı", `${validContacts.length} kişi rehberinizle eşlendi.`, "success");
            }

        } catch (error) {
            console.error("Sync error:", error);
            showAlert("Hata", "Rehber eşlenirken bir sorun oluştu.", "error");
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSupported, showAlert]);

    const dismissSuggestion = useCallback(async () => {
        if (!user) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                settings: {
                    suppressSyncSuggestion: true
                }
            }, { merge: true });
        } catch (e) {
            console.error("Failed to dismiss suggestion", e);
        }
    }, [user]);

    return {
        isSyncing,
        isSupported,
        syncContacts,
        dismissSuggestion,
        userInfo: user
    };
};
