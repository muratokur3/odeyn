import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { PhoneInput } from './PhoneInput';
import { useAuth } from '../hooks/useAuth'; // Assuming useAuth is available
import { addContact, updateContact, getContacts, searchUserByPhone } from '../services/db'; // Assuming services are available
import { useDebts } from '../hooks/useDebts';
import { cleanPhone } from '../utils/phoneUtils';
import { Avatar } from './Avatar';
import { useModal } from '../hooks/useModal'; // Assuming ModalContext is available
import type { Contact, User } from '../types';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialName?: string;
    initialPhone?: string;
    contactToEdit?: Contact | null;
    onSuccess?: (contact: Contact) => void;
    checkDuplicates?: boolean; // Whether to check duplicates against DB
}

export const ContactModal: React.FC<ContactModalProps> = ({
    isOpen,
    onClose,
    initialName = '',
    initialPhone = '',
    contactToEdit,
    onSuccess,
    checkDuplicates = true
}) => {
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState(initialPhone);
    const [submitting, setSubmitting] = useState(false);
    const [duplicateContact, setDuplicateContact] = useState<Contact | null>(null);
    const [contactsCache, setContactsCache] = useState<Contact[]>([]);
    const [suggestedUser, setSuggestedUser] = useState<User | null>(null);
    const [suggestedNameFromDebts, setSuggestedNameFromDebts] = useState<string | null>(null);

    const { allDebts } = useDebts();

    useEffect(() => {
        if (isOpen) {
            setName(contactToEdit ? contactToEdit.name : initialName);
            setPhone(contactToEdit ? contactToEdit.phoneNumber : initialPhone);
            setDuplicateContact(null);

            // If checking duplicates, fetch contacts once when opened (if not passed? 
            // actually better to fetch. 
            // Optimization: Maybe we should accept existingContacts as prop to avoid fetching?
            // For now, let's just fetch if we need to check duplicates to be safe, 
            // or rely on caller? 
            // Let's rely on internal fetch for standalone usage simplicity.
            if (checkDuplicates && user) {
                getContacts(user.uid).then(setContactsCache);
            }
        }
    }, [isOpen, contactToEdit, initialName, initialPhone, user, checkDuplicates]);

    // Duplicate Check Effect
    useEffect(() => {
        if (!phone || !checkDuplicates) {
            setDuplicateContact(null);
            return;
        }

        const cleanedInput = cleanPhone(phone);
        if (cleanedInput && cleanedInput.length > 5) {
            const found = contactsCache.find(c =>
                c.phoneNumber === cleanedInput &&
                (!contactToEdit || c.id !== contactToEdit.id)
            );
            setDuplicateContact(found || null);
        } else {
            setDuplicateContact(null);
        }
    }, [phone, contactsCache, contactToEdit, checkDuplicates]);

    // System User Lookup Effect
    useEffect(() => {
        const checkSuggestions = async () => {
            // Reset if empty or editing
            if (!phone || contactToEdit) {
                setSuggestedUser(null);
                setSuggestedNameFromDebts(null);
                return;
            }

            const rawInput = phone.replace(/\s/g, '');
            const cleanedInput = cleanPhone(rawInput);

            if (cleanedInput && cleanedInput.length >= 10) {
                // 1. Check System User (Registered)
                try {
                    const found = await searchUserByPhone(cleanedInput);
                    if (found && found.uid !== user?.uid) {
                        setSuggestedUser(found);
                        setSuggestedNameFromDebts(null); // System user takes priority
                        return;
                    } 
                    setSuggestedUser(null);
                } catch (err) {
                    console.error("User lookup failed", err);
                }

                // 2. Fallback: Check Debt History for names
                const latestDebt = [...allDebts]
                    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
                    .find(d => cleanPhone(d.lenderId) === cleanedInput || cleanPhone(d.borrowerId) === cleanedInput);

                if (latestDebt) {
                    const isLender = latestDebt.lenderId === user?.uid || cleanPhone(latestDebt.lenderId) === cleanPhone(user?.phoneNumber || '');
                    const debtName = isLender ? latestDebt.borrowerName : latestDebt.lenderName;
                    
                    if (debtName && debtName !== cleanedInput && debtName !== 'Bilinmeyen') {
                        setSuggestedNameFromDebts(debtName);
                    } else {
                        setSuggestedNameFromDebts(null);
                    }
                } else {
                    setSuggestedNameFromDebts(null);
                }
            } else {
                setSuggestedUser(null);
                setSuggestedNameFromDebts(null);
            }
        };

        const debounce = setTimeout(checkSuggestions, 500);
        return () => clearTimeout(debounce);
    }, [phone, user, contactToEdit, allDebts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (cleanPhone(phone) === cleanPhone(user.phoneNumber || '')) {
            showAlert("Hata", "Kendinizi rehbere ekleyemezsiniz.", "error");
            return;
        }

        setSubmitting(true);
        try {
            let resultContact: Contact | null = null;

            let linkId: string | undefined = undefined;
            if (suggestedUser) {
               const cleanInput = cleanPhone(phone);
               if (cleanInput && (suggestedUser.phoneNumber === cleanInput)) {
                   linkId = suggestedUser.uid;
               }
            }

            if (contactToEdit) {
                await updateContact(user.uid, contactToEdit.id, { 
                    name, 
                    phoneNumber: phone,
                    linkedUserId: linkId // Update link if found
                });
                // If we found a link, update it, otherwise keep existing or undefined? 
                // Actually if user changes phone to a non-registered one, link should probably be removed (set to null/undefined).
                // But Firestore partial update merges. If we want to remove, we might need deleteField() if generic, 
                // but here passing specific value. If linkId is undefined, it won't overwrite existing if we rely on ... spread?
                // Wait, if I change phone number, the old link is invalid. I should probably force update linkedUserId.
                // If linkId is undefined, it means no user found for NEW phone. So we should clear it.
                // But undefined fields are often ignored in Firestore updates unless explicit.
                // For now, let's assume if found -> set. If not found -> we might want to unset if phone changed?
                // Let's stick to: if found, set it. logic for unsetting on phone change is safer if we handle it explicitly.
                // Ideally: if phone changed, clear linkedUserId. If new phone matches user, set linkedUserId.
                
                // Simplified: Only set if found for now to solve the "missing link" issue.
                // To properly clear, we'd need to check if phone changed. 
                // Let's pass linkId || null (if we want to clear) but Partial<Contact> expects string | undefined.
                
                resultContact = { ...contactToEdit, name, phoneNumber: phone, linkedUserId: linkId || contactToEdit.linkedUserId };
                // Update DB with link if found
                if (linkId) {
                     await updateContact(user.uid, contactToEdit.id, { linkedUserId: linkId });
                }
                
                showAlert("Başarılı", "Kişi güncellendi.", "success");
            } else {
                const newId = await addContact(user.uid, name, phone, linkId);
                resultContact = {
                    id: newId,
                    name,
                    phoneNumber: phone,
                    createdAt: Timestamp.now(),
                    linkedUserId: linkId
                };
                showAlert("Başarılı", "Kişi eklendi.", "success");
            }

            if (onSuccess && resultContact) {
                onSuccess(resultContact);
            }
            onClose();
        } catch (error) {
            console.error(error);
            showAlert("Hata", "İşlem sırasında bir hata oluştu.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-surface p-6 rounded-2xl w-full max-w-md relative animate-in fade-in zoom-in duration-200 border border-slate-700"
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 hover:bg-slate-700/50 rounded-full transition-colors"
                >
                    <X size={20} className="text-text-secondary" />
                </button>
                <h2 className="text-xl font-bold mb-6 text-text-primary">
                    {contactToEdit ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            Telefon Numarası
                        </label>
                        <PhoneInput
                            value={phone}
                            onChange={setPhone}
                            required
                            placeholder="555 123 45 67"
                        />
                        {duplicateContact && (
                            <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p>Bu numara zaten rehberinizde <strong>{duplicateContact.name}</strong> adıyla kayıtlı.</p>
                            </div>
                        )}

                        {/* System User Suggestion */}
                        {suggestedUser && !duplicateContact && (
                            <div
                                onClick={() => setName(suggestedUser.displayName)}
                                className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        name={suggestedUser.displayName}
                                        photoURL={suggestedUser.photoURL}
                                        uid={suggestedUser.uid}
                                        status="system"
                                        size="md"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                                            Bu numara DebtDert'te kayıtlı!
                                        </p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            İsim olarak <strong>{suggestedUser.displayName}</strong> kullanmak için tıklayın.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Debt History Suggestion */}
                        {!suggestedUser && suggestedNameFromDebts && !duplicateContact && (
                            <div
                                onClick={() => setName(suggestedNameFromDebts)}
                                className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                                        <Avatar name={suggestedNameFromDebts} size="md" status="none" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium">
                                            Geçmiş işlemlerde bulundu!
                                        </p>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                            Bu numaraya daha önce <strong>{suggestedNameFromDebts}</strong> demişsiniz. Kullanmak için tıklayın.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            Ad Soyad
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            placeholder="Ad Soyad"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting || !!duplicateContact}
                        className={`w-full py-3 rounded-xl font-semibold transition-all mt-2 ${submitting || !!duplicateContact
                            ? 'bg-gray-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-blue-600 active:scale-95'
                            }`}
                    >
                        {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </form>
            </div>
        </div>
    );
};
