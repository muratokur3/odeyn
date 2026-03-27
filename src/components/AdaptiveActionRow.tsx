import React, { useState, useEffect } from 'react';
import { SwipeableItem, type SwipeAction } from './SwipeableItem';
import { MoreVertical } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import clsx from 'clsx';

interface AdaptiveActionRowProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    isOpen: 'left' | 'right' | null;
    onOpen: (direction: 'left' | 'right') => void;
    onClose: () => void;
    className?: string;
    contentClassName?: string;
    disableDesktopMenu?: boolean;
}

export const AdaptiveActionRow: React.FC<AdaptiveActionRowProps> = ({
    children,
    leftActions = [],
    rightActions = [],
    isOpen,
    onOpen,
    onClose,
    className,
    contentClassName,
    disableDesktopMenu = false
}) => {
    // Media Query: Desktop is defined as >= 1024px (matches SwipeableItem internal check)
    // Actually, user prompt says "Desktop (Mouse Device)" and mentions "Mobile/Tablet (Touch)".
    // Usually 1024px is a safe bet for "Desktop" layout, but user might want tablet to swipe.
    // The prompt says "IF Mobile/Tablet (Touch Device): Render Swipe-to-Reveal".
    // "IF Desktop (Mouse Device): Disable Swipe".
    // I'll stick to 1024px for now as it aligns with the "isMobile" check I saw in SwipeableItem.
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const [menuOpen, setMenuOpen] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);

    // Combine all actions for the menu
    const allActions = [...leftActions, ...rightActions];

    useEffect(() => {
        if (menuOpen) {
            const handleGlobalClick = () => setMenuOpen(false);
            window.addEventListener('click', handleGlobalClick);
            return () => window.removeEventListener('click', handleGlobalClick);
        }
    }, [menuOpen]);

    if (isDesktop) {
        // Desktop View: Render content + Three-Dot Menu
        // If no actions or menu disabled, just render children
        if (allActions.length === 0 || disableDesktopMenu) {
            return <div className={className}>{children}</div>;
        }

        return (
            <div className={clsx("relative group flex items-center", menuOpen ? "z-50" : "z-auto", className)}>
                <div className="flex-1 min-w-0">
                    {children}
                </div>

                {/* Three-Dot Menu Button (Visible on Hover/Always? Prompt says "Three-Dot Menu Button aligned to the far right") */}
                <div className="ml-2 relative shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            // If less than 200px below, open upwards
                            setOpenUpwards(spaceBelow < 200);
                            setMenuOpen(!menuOpen);
                        }}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors"
                    >
                        <MoreVertical size={20} />
                    </button>

                    {/* Dropdown Menu */}
                    {menuOpen && (
                        <div className={clsx(
                            "absolute right-0 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100",
                            openUpwards ? "bottom-full mb-1" : "top-full mt-1"
                        )}>
                            {allActions.map((action) => (
                                <button
                                    key={action.key}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        action.onClick();
                                        setMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                                >
                                    <div className={clsx("p-1.5 rounded-full",
                                        action.color.includes("red") ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                        action.color.includes("blue") ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                    )}>
                                        {/* Cast to ReactElement to satisfy type checker for cloneElement with props */}
                                        {React.isValidElement(action.icon) ? React.cloneElement(action.icon as React.ReactElement<any>, { size: 16 }) : action.icon}
                                    </div>
                                    <span className={clsx(
                                        action.color.includes("red") ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"
                                    )}>
                                        {action.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Mobile View: Render SwipeableItem
    return (
        <SwipeableItem
            leftActions={leftActions}
            rightActions={rightActions}
            isOpen={isOpen}
            onOpen={onOpen}
            onClose={onClose}
            className={className}
            contentClassName={contentClassName}
        >
            {children}
        </SwipeableItem>
    );
};
