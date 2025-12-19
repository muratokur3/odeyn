import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    initiatePhoneVerification,
    confirmPhoneVerification
} from '../services/verification';
import { removePhone } from '../services/identity';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { User } from '../types';
import { FaTrash, FaPlus, FaTimes } from 'react-icons/fa';

const ManagePhones: React.FC = () => {
    const { user } = useAuth();
    const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
    const [primaryPhone, setPrimaryPhone] = useState<string>('');
    const [isAdding, setIsAdding] = useState(false);

    // Form State
    const [newPhone, setNewPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [step, setStep] = useState<'INPUT' | 'VERIFY'>('INPUT');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as User;
                setPhoneNumbers(data.phoneNumbers || []);
                setPrimaryPhone(data.primaryPhoneNumber || '');
            }
        });

        return () => unsub();
    }, [user]);

    const handleSendCode = async () => {
        setError(null);
        setSuccessMsg(null);

        // Basic Validation
        const cleaned = newPhone.replace(/\s/g, '');
        if (cleaned.length < 10) {
            setError("Geçerli bir telefon numarası giriniz.");
            return;
        }

        setLoading(true);
        try {
            await initiatePhoneVerification(cleaned);
            setStep('VERIFY');
            setSuccessMsg("Doğrulama kodu gönderildi. (Mock: Console'a bakınız)");
        } catch (err: any) {
            setError(err.message || "Kod gönderilemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setError(null);
        setLoading(true);
        try {
            await confirmPhoneVerification(newPhone, verificationCode);
            setSuccessMsg("Numara başarıyla eklendi!");
            resetForm();
        } catch (err: any) {
            setError(err.message || "Doğrulama başarısız.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (phone: string) => {
        if (!confirm(`${phone} numarasını silmek istediğinize emin misiniz?`)) return;

        try {
            await removePhone(phone);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const resetForm = () => {
        setIsAdding(false);
        setNewPhone('');
        setVerificationCode('');
        setStep('INPUT');
        setError(null);
        setSuccessMsg(null);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bağlı Telefon Numaraları</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Bu telefon numaraları ile ilişkilendirilmiş borçlar hesabınızda görünür.
            </p>

            {/* List of Numbers */}
            <div className="space-y-3">
                {phoneNumbers.map((phone) => (
                    <div key={phone} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <div>
                            <span className="text-gray-900 dark:text-white font-medium">{phone}</span>
                            {phone === primaryPhone && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    Ana Hesap
                                </span>
                            )}
                        </div>

                        {phone !== primaryPhone && (
                            <button
                                onClick={() => handleDelete(phone)}
                                className="text-red-500 hover:text-red-700 p-2"
                                title="Numarayı Kaldır"
                            >
                                <FaTrash />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Add New Section */}
            {!isAdding ? (
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
                >
                    <FaPlus className="mr-2" /> Yeni Numara Ekle
                </button>
            ) : (
                <div className="border border-gray-200 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Numara Ekle</h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                            <FaTimes />
                        </button>
                    </div>

                    {step === 'INPUT' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Telefon Numarası</label>
                                <input
                                    type="tel"
                                    placeholder="+90555..."
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={handleSendCode}
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
                            >
                                {loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                             <p className="text-sm text-gray-600 dark:text-gray-400">
                                {newPhone} numarasına gönderilen kodu giriniz.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Doğrulama Kodu</label>
                                <input
                                    type="text"
                                    placeholder="123456"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={handleVerify}
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
                            >
                                {loading ? 'Doğrulanıyor...' : 'Doğrula ve Ekle'}
                            </button>
                        </div>
                    )}

                    {error && (
                        <p className="mt-2 text-sm text-red-600">{error}</p>
                    )}
                    {successMsg && (
                        <p className="mt-2 text-sm text-green-600">{successMsg}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManagePhones;
