import React, { useState, useEffect } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface SwipeableItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    leftActionColor?: string;
    leftActionIcon?: React.ReactNode;
    className?: string;
    contentClassName?: string;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    onSwipeLeft,
    leftActionColor = "bg-red-500",
    leftActionIcon = <Trash2 className="text-white" size={20} />,
    className,
    contentClassName = ""
}) => {
    const controls = useAnimation();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleDragEnd = async (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const threshold = 60;

        if (offset < -threshold && onSwipeLeft) {
            // Swipe Left (Delete)
            onSwipeLeft();
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else {
            // Snap back
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        }
    };

    const canDrag = isMobile && !!onSwipeLeft;

    return (
        <div className={clsx("relative overflow-hidden", className)}>
            {/* Background Actions */}
            {isMobile && (
                <div className="absolute inset-0 flex items-center justify-end">
                     {/* Right Background (Delete/Left Swipe) */}
                    <div className={clsx("flex items-center justify-end pr-4 w-full h-full rounded-2xl", leftActionColor)}>
                        {leftActionIcon}
                    </div>
                </div>
            )}

            {/* Foreground Content */}
            <motion.div
                drag={canDrag ? "x" : false}
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={clsx("relative z-10", contentClassName)}
                whileTap={canDrag ? { cursor: "grabbing" } : {}}
                style={{ touchAction: "pan-y" }}
            >
                {children}
            </motion.div>
        </div>
    );
};
