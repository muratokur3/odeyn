import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { unmuteUser } from '../services/db';
import { Avatar } from '../components/Avatar';
import { formatPhoneForDisplay } from '../utils/phoneUtils';
import type { User } from '../types';
import { useModal } from '../context/ModalContext';

interface MutedUserDisplay {
    uid: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
}

export const MutedUsers = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showConfirm, showAlert } = useModal();
    const [mutedList, setMutedList] = useState<MutedUserDisplay[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Subscribe to user document to get real-time mutedCreators list
        const unsub = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as User;
                const mutedIds = data.mutedCreators || [];

                if (mutedIds.length === 0) {
                    setMutedList([]);
                    setLoading(false);
                    return;
                }

                // Resolve User Details
                const resolvedUsers: MutedUserDisplay[] = [];
                for (const uid of mutedIds) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) {
                            const uData = userDoc.data() as User;
                            resolvedUsers.push({
                                uid: uData.uid,
                                displayName: uData.displayName,
                                photoURL: uData.photoURL,
                                phoneNumber: uData.primaryPhoneNumber || uData.phoneNumber
                            });
                        } else {
                            // User deleted or not found? Show ID?
                            resolvedUsers.push({
                                uid,
                                displayName: 'Bilinmeyen Kullanıcı',
                            });
                        }
                    } catch (e) {
                        console.error("Error resolving muted user", e);
                    }
                }
                setMutedList(resolvedUsers);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user?.uid]);

    const handleUnmute = async (targetUser: MutedUserDisplay) => {
        const confirmed = await showConfirm(
            "Sessize Almayı Kaldır",
            `${targetUser.displayName} adlı kullanıcının sessize alma durumunu kaldırmak istiyor musunuz? Artık eklediği borçları görebileceksiniz.`,
            "info"
        );

        if (confirmed && user) {
            try {
                await unmuteUser(user.uid, targetUser.uid);
                showAlert("Başarılı", "Kullanıcı başarıyla listeden çıkarıldı.", "success");
            } catch (error) {
                console.error(error);
                showAlert("Hata", "İşlem sırasında bir hata oluştu.", "error");
            }
        }
    };

    return (
        <div className="min-h-full bg-gray-50 dark:bg-black pb-10">
            <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4 max-w-2xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-900 dark:text-white"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sessize Alınanlar</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <div className="mb-6 p-4 bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        Sessize aldığınız kullanıcılar size borç eklediğinde, kayıtlar <strong>Otomatik Gizli (Auto-Hidden)</strong> olarak oluşturulur.
                        Siz görmezsiniz, bakiyenize yansımaz, ancak karşı taraf normal şekilde eklediğini sanar.
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
                ) : mutedList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <UserX size={48} className="mb-4 opacity-50" />
                        <p>Listeniz boş.</p>
                        <p className="text-xs mt-2">Kullanıcıları sessize almak için rehberden işlem yapabilirsiniz (Gelecek Özellik).</p>
                        {/* Currently, Muting is handled... well, we need a way to mute people! 
                           The Prompt said "Settings: Add Muted Users list". But how to ADD?
                           Usually via Profile or Contact list. 
                           "Action: User B (Receiver) sees the debt and clicks 'Sil/Reddet'". -> This handles specific debts.
                           "Goal: Allow users to stop receiving debts from specific people...".
                           I should probably add a way to ADD people here or in Contact Details.
                           For MVP, let's add a "Search & Add" button here?
                           Prompt didn't specify where to add, just "Settings -> Muted Users".
                           I will add a simple Search/Add User logic here? Or maybe just rely on Profile?
                           Let's check PersonDetail for "Block". I can add "Mute" there too?
                           But sticking to the plan: "Implement UI in Settings to manage mutedCreators".
                           So I should allow removing and viewing.
                           Wait, how does a user MUTE someone initially? 
                           "Check User B's mutedCreators list".
                           I should add a "Add User" FAB or input here effectively.
                       */}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
                        {mutedList.map((mUser) => (
                            <div key={mUser.uid} className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        name={mUser.displayName}
                                        photoURL={mUser.photoURL}
                                        uid={mUser.uid}
                                        size="md"
                                    />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{mUser.displayName}</h3>
                                        <p className="text-xs text-gray-500">{mUser.phoneNumber ? formatPhoneForDisplay(mUser.phoneNumber) : ''}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnmute(mUser)}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                                >
                                    Kaldır
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
