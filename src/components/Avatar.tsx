import React, { useEffect, useState } from 'react';
import { User, ShieldCheck, BookUser } from 'lucide-react';
import clsx from 'clsx';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AvatarProps {
    name?: string;
    photoURL?: string;
    uid?: string; // Added for live fetch
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    status?: 'none' | 'system' | 'contact';
}

export const Avatar: React.FC<AvatarProps> = ({ name, photoURL, uid, size = 'md', className, status = 'none' }) => {
    const [livePhotoURL, setLivePhotoURL] = useState<string | undefined>(photoURL);

    // Live Fetch Logic
    useEffect(() => {
        // Always prefer local prop initially to prevent flash
        setLivePhotoURL(photoURL);

        if (!uid) return;

        const fetchLivePhoto = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (data.photoURL) {
                        setLivePhotoURL(data.photoURL);
                    }
                }
            } catch (error) {
                // cloud fail, ignore
            }
        };
        fetchLivePhoto();
    }, [uid, photoURL]);


    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-20 h-20' // Increased XL size slightly for profile headers
    };

    const iconSizes = {
        sm: 16,
        md: 20,
        lg: 24,
        xl: 32
    };

    // Style Logic based on Status (Dashboard Rules)
    let borderClass = '';
    let defaultBgClass = 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500';

    switch (status) {
        case 'system':
            borderClass = 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900';
            defaultBgClass = 'bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-300';
            break;
        case 'contact':
            borderClass = 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900';
            defaultBgClass = 'bg-orange-100 dark:bg-orange-900/50 text-orange-500 dark:text-orange-300';
            break;
        default:
            borderClass = 'ring-2 ring-gray-200 dark:ring-gray-700 ring-offset-2 dark:ring-offset-slate-900';
            defaultBgClass = 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500';
            break;
    }

    return (
        <div className="relative inline-block">
            <div
                className={clsx(
                    "rounded-full flex items-center justify-center overflow-hidden shrink-0 transition-all",
                    sizeClasses[size],
                    !livePhotoURL && defaultBgClass,
                    borderClass,
                    className
                )}
            >
                {livePhotoURL ? (
                    <img
                        src={livePhotoURL}
                        alt={name || 'User'}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <User size={iconSizes[size]} strokeWidth={2.5} fill="currentColor" className="opacity-80" />
                )}
            </div>
            {/* Optional Status Badge could be added here if needed, but usually handled by parent container. 
                However, to make it fully self-contained like visual hierarchy requests:
            */}
            {status === 'system' && size !== 'sm' && (
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-800">
                    <ShieldCheck size={size === 'xl' ? 16 : 10} strokeWidth={3} />
                </div>
            )}
            {status === 'contact' && size !== 'sm' && (
                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-800">
                    <BookUser size={size === 'xl' ? 16 : 10} strokeWidth={3} />
                </div>
            )}
        </div>
    );
};
