import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logoutUser } from '../services/auth';
import { updateUserProfile, uploadProfileImage } from '../services/profile';
import { LogOut, Settings, Phone, Camera, Edit2, Check, X as XIcon, Loader2 } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNavigate } from 'react-router-dom';

export const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            let photoURL = user.photoURL || undefined;

            if (selectedFile) {
                photoURL = await uploadProfileImage(user.uid, selectedFile);
            }

            await updateUserProfile(user.uid, displayName, photoURL);
            setIsEditing(false);
            // Ideally, we should update the local user state here or rely on Auth listener to update it
            window.location.reload(); // Simple reload to reflect changes for now
        } catch (error) {
            console.error(error);
            alert("Profil güncellenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setDisplayName(user?.displayName || '');
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    return (
        <div className="space-y-6 pt-6">
            <div className="flex flex-col items-center space-y-4 relative">
                <div className="relative group">
                    <div className="w-24 h-24 flex items-center justify-center">
                        <Avatar
                            name={user?.displayName || ''}
                            photoURL={previewUrl || user?.photoURL || undefined}
                            size="xl"
                            status="system"
                            className="w-24 h-24 text-2xl"
                        />
                    </div>

                    {isEditing && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            <Camera className="text-white" size={24} />
                        </button>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="text-center w-full max-w-xs">
                    {isEditing ? (
                        <div className="flex items-center gap-2 justify-center">
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="bg-surface border border-border rounded-lg px-3 py-1 text-center text-text-primary font-bold outline-none focus:border-primary w-full"
                                placeholder="İsim Giriniz"
                            />
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold text-text-primary flex items-center justify-center gap-2">
                            {user?.displayName || 'Kullanıcı'}
                            <button onClick={() => {
                                setDisplayName(user?.displayName || '');
                                setIsEditing(true);
                            }} className="text-text-secondary hover:text-primary transition-colors">
                                <Edit2 size={16} />
                            </button>
                        </h2>
                    )}
                    <p className="text-text-secondary text-sm">{user?.email}</p>
                </div>

                {isEditing && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="p-2 rounded-full bg-surface border border-border text-text-secondary hover:text-red-500 transition-colors"
                        >
                            <XIcon size={20} />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="p-2 rounded-full bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-xl overflow-hidden shadow-sm border border-border mx-4">
                <div className="p-4 border-b border-border flex items-center gap-3">
                    <Phone className="text-secondary" size={20} />
                    <div>
                        <p className="text-sm text-text-secondary">Telefon</p>
                        <p className="text-text-primary">{user?.phoneNumber || 'Belirtilmemiş'}</p>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/settings')}
                    className="w-full p-4 border-b border-border flex items-center gap-3 hover:bg-background transition-colors text-left"
                >
                    <Settings className="text-secondary" size={20} />
                    <span className="text-text-primary">Ayarlar</span>
                </button>

                <button
                    onClick={() => logoutUser()}
                    className="w-full p-4 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left text-red-500"
                >
                    <LogOut size={20} />
                    <span>Çıkış Yap</span>
                </button>
            </div>
        </div>
    );
};
