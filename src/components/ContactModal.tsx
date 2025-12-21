import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { PhoneInput } from './PhoneInput';
import { useAuth } from '../hooks/useAuth'; // Assuming useAuth is available
import { addContact, updateContact, getContacts, searchUserByPhone } from '../services/db'; // Assuming services are available
import { cleanPhone } from '../utils/phoneUtils';
import { Avatar } from './Avatar';
import { useModal } from '../context/ModalContext'; // Assuming ModalContext is available
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
    const [isResolvingUser, setIsResolvingUser] = useState(false);

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
        const checkSystemUser = async () => {
            // Reset if empty or editing
            if (!phone || contactToEdit) {
                setSuggestedUser(null);
                return;
            }

            const rawInput = phone.replace(/\s/g, '');
            const cleanedInput = cleanPhone(rawInput);
            // Check if it's a valid length (e.g. 10 digits w/o country code = 10, or total length 12-13)
            // cleanPhone returns +90..., so length > 10 is reasonable check
            // "10 haneli numara(ülke kodu hariç)" -> usually 10 digits + 2/3 country code = 12/13
            if (cleanedInput && cleanedInput.length >= 10) {
                // Optimization: Don't search if we already found this specific number
                if (suggestedUser && (suggestedUser.phoneNumber === cleanedInput || suggestedUser.primaryPhoneNumber === cleanedInput)) return;

                setIsResolvingUser(true);
                try {
                    const found = await searchUserByPhone(cleanedInput);
                    // Don't suggest self
                    if (found && found.uid !== user?.uid) {
                        setSuggestedUser(found);
                    } else {
                        setSuggestedUser(null);
                    }
                } catch (err) {
                    console.error("User lookup failed", err);
                    setSuggestedUser(null);
                } finally {
                    setIsResolvingUser(false);
                }
            } else {
                setSuggestedUser(null);
            }
        };

        const debounce = setTimeout(checkSystemUser, 500);
        return () => clearTimeout(debounce);
    }, [phone, user, contactToEdit, suggestedUser?.phoneNumber, suggestedUser?.primaryPhoneNumber]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        try {
            let resultContact: Contact | null = null;

            if (contactToEdit) {
                await updateContact(user.uid, contactToEdit.id, { name, phoneNumber: phone });
                resultContact = { ...contactToEdit, name, phoneNumber: phone };
                showAlert("Başarılı", "Kişi güncellendi.", "success");
            } else {
                const newId = await addContact(user.uid, name, phone);
                // Construct the contact object locally since addContact returns ID
                resultContact = {
                    id: newId,
                    name,
                    phoneNumber: phone,
                    createdAt: Timestamp.now(), // Approximation
                    linkedUserId: undefined
                    // We don't know linkedUserId immediately without re-fetching or complex logic,
                    // but for "Create Debt" immediate usage, name and phone are enough.
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface p-6 rounded-2xl w-full max-w-md relative animate-in fade-in zoom-in duration-200 border border-slate-700">
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
                            Ad Soyad
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            placeholder="Ad Soyad"
                            required
                            autoFocus
                        />
                    </div>
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
