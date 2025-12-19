import React from 'react';
import { UserPlus, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from './Avatar';
import type { DisplayProfile } from '../types';

interface UserAvatarItemProps {
    profile: DisplayProfile;
    onClick?: () => void;
    actionButton?: React.ReactNode;
    className?: string;
}

export const UserAvatarItem: React.FC<UserAvatarItemProps> = React.memo(({ profile, onClick, actionButton, className }) => {
    const { isSystemUser, isContact, displayName, secondaryText, photoURL, uid } = profile;

    // determine visual status
    const status = isSystemUser ? 'system' : isContact ? 'contact' : 'none';
    const opacityClass = (isSystemUser || isContact) ? 'opacity-100' : 'opacity-80';

    return (
        <div
            onClick={onClick}
            className={clsx(
                "flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer relative group",
                !isSystemUser && !isContact && "hover:opacity-100",
                className
            )}
        >
            {/* SMART AVATAR (Handles Fetch, Colors, Icons) */}
            <div className={opacityClass}>
                <Avatar
                    name={displayName}
                    photoURL={photoURL}
                    uid={uid}
                    size="lg" // UserAvatarItem uses Lg (12/12 = 3rem = 48px)
                    status={status}
                    className={ // Reset explicit border here as Avatar has it, but UserAvatarItem had specific logic?
                        // Actually Avatar logic is now Standard.
                        // However, UserAvatarItem had "Selectable" visual states.
                        // Let's rely on standard Avatar, but checking sizes.
                        // UserAvatarItem old size was w-12 h-12 = 48px. 
                        // Avatar lg is w-12 h-12. Perfect.
                        ""
                    }
                />
            </div>

            {/* TEXT CONTENT */}
            <div className={clsx("flex-1 min-w-0 flex flex-col justify-center", opacityClass)}>
                <div className="flex items-center gap-1.5">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base leading-tight">
                        {displayName}
                    </h4>
                    {/* Inline Verification Check for System Users */}
                    {isSystemUser && (
                        <ShieldCheck size={14} className="text-blue-500 shrink-0" fill="currentColor" stroke="white" />
                    )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">
                    {secondaryText}
                </p>
            </div>

            {/* ACTION BUTTON / STATUS TEXT */}
            <div className="shrink-0">
                {actionButton ? (
                    actionButton
                ) : (
                    // Default Actions based on state
                    !isSystemUser && !isContact && (
                        <button className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                            <UserPlus size={18} />
                        </button>
                    )
                )}
            </div>
        </div>
    );
});

// Add display name for debugging
UserAvatarItem.displayName = 'UserAvatarItem';
