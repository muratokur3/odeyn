import React from 'react';
import { User } from 'lucide-react';
import clsx from 'clsx';

interface AvatarProps {
    name?: string;
    photoURL?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    status?: 'none' | 'system' | 'contact';
}

export const Avatar: React.FC<AvatarProps> = ({ name, photoURL, size = 'md', className, status = 'none' }) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-xl'
    };

    const getInitials = (name?: string) => {
        if (!name) return '';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getStatusBorder = () => {
        switch (status) {
            case 'system':
                return 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900'; // Registered -> Blue
            case 'contact':
                return 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900'; // Contact Only -> Orange
            default:
                return 'ring-2 ring-gray-300 dark:ring-gray-700 ring-offset-2 dark:ring-offset-slate-900'; // None -> Gray
        }
    };

    return (
        <div className="relative">
            <div
                className={clsx(
                    "rounded-full flex items-center justify-center overflow-hidden shrink-0 transition-all",
                    sizeClasses[size],
                    !photoURL && "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                    getStatusBorder(),
                    className
                )}
            >
                {photoURL ? (
                    <img
                        src={photoURL}
                        alt={name || 'User'}
                        className="w-full h-full object-cover"
                    />
                ) : name ? (
                    <span className="font-bold tracking-wider">{getInitials(name)}</span>
                ) : (
                    <User size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} />
                )}
            </div>
            {/* Optional Badges could go here */}
        </div>
    );
};
