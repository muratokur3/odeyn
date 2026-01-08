import React, { useState, useEffect } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import clsx from 'clsx';

export interface SwipeAction {
    key: string;
    icon: React.ReactNode;
    label?: string; // Optional label
    color: string; // bg color class
    onClick: () => void;
}

interface SwipeableItemProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];  // Actions revealed on Left (Swipe Right) -> Reverse Swipe
    rightActions?: SwipeAction[]; // Actions revealed on Right (Swipe Left) -> Normal Swipe
    isOpen: 'left' | 'right' | null;
    onOpen: (direction: 'left' | 'right') => void;
    onClose: () => void;
    className?: string;
    contentClassName?: string;
    actionWidth?: number; // Width of each action button
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    leftActions = [],
    rightActions = [],
    isOpen,
    onOpen,
    onClose,
    className,
    contentClassName = "",
    actionWidth = 80 // Default width per button
}) => {
    const controls = useAnimation();
    const [isMobile, setIsMobile] = useState(false);

    // Derived widths
    const leftWidth = leftActions.length * actionWidth;
    const rightWidth = rightActions.length * actionWidth;

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024); // Tablet/Mobile
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Sync animation with external isOpen prop
    useEffect(() => {
        if (isOpen === 'left') {
            controls.start({ x: leftWidth, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else if (isOpen === 'right') {
            controls.start({ x: -rightWidth, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else {
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        }
    }, [isOpen, controls, leftWidth, rightWidth]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        const threshold = 60;

        // Current X position (approx)
        // We can't easily get current X from controls without ref, but drag offset gives hint

        // Determine direction
        if (offset < -threshold || (offset < 0 && velocity < -500)) {
            // Swipe Left -> Reveal Right Actions
            if (rightActions.length > 0) {
                onOpen('right');
            } else {
                onClose();
            }
        } else if (offset > threshold || (offset > 0 && velocity > 500)) {
            // Swipe Right -> Reveal Left Actions
            if (leftActions.length > 0) {
                onOpen('left');
            } else {
                onClose();
            }
        } else {
            // Snap back
            onClose();
        }
    };

    if (!isMobile && leftActions.length === 0 && rightActions.length === 0) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div className={clsx("relative overflow-hidden touch-pan-y", className)}>
            {/* Background Actions Layer */}
            <div className="absolute inset-0 flex justify-between items-stretch">

                {/* Left Actions (Revealed when swiping Right) */}
                <div
                    className="flex justify-start items-stretch h-full"
                    style={{ width: leftWidth }}
                >
                    {leftActions.map((action, index) => (
                        <button
                            key={action.key}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                                onClose(); // Close after action? Usually yes.
                            }}
                            className={clsx(
                                "flex flex-col items-center justify-center h-full text-white transition-opacity active:opacity-80",
                                action.color
                            )}
                            style={{ width: actionWidth }}
                        >
                            <div className="mb-1">{action.icon}</div>
                            {action.label && (
                                <span className="text-[10px] font-bold leading-none">{action.label}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Right Actions (Revealed when swiping Left) */}
                <div
                    className="flex justify-end items-stretch h-full ml-auto"
                    style={{ width: rightWidth }}
                >
                    {rightActions.map((action, index) => (
                        <button
                            key={action.key}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                                onClose();
                            }}
                            className={clsx(
                                "flex flex-col items-center justify-center h-full text-white transition-opacity active:opacity-80",
                                action.color
                            )}
                            style={{ width: actionWidth }}
                        >
                            <div className="mb-1">{action.icon}</div>
                            {action.label && (
                                <span className="text-[10px] font-bold leading-none">{action.label}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Foreground Content */}
            <motion.div
                drag={isMobile ? "x" : false}
                dragConstraints={{ left: -rightWidth, right: leftWidth }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={clsx("relative z-10 bg-background", contentClassName)} // Ensure bg is set to cover buttons
                whileTap={isMobile ? { cursor: "grabbing" } : undefined}
                style={{ x: 0 }} // Managed by controls
            >
                {children}
            </motion.div>
        </div>
    );
};
