import React, { useState, useEffect } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';
import clsx from 'clsx';

interface SwipeableItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    leftActionColor?: string;
    leftActionIcon?: React.ReactNode;
    onSwipeRight?: () => void;
    rightActionColor?: string;
    rightActionIcon?: React.ReactNode;
    className?: string;
    contentClassName?: string;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    onSwipeLeft,
    leftActionColor = "bg-red-500",
    leftActionIcon = <Trash2 className="text-white" size={20} />,
    onSwipeRight,
    rightActionColor = "bg-orange-500",
    rightActionIcon = <Edit2 className="text-white" size={20} />,
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
        } else if (offset > threshold && onSwipeRight) {
            // Swipe Right (Edit)
            onSwipeRight();
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else {
            // Snap back
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        }
    };

    const canDrag = isMobile && (!!onSwipeLeft || !!onSwipeRight);

    return (
        <div className={clsx("relative overflow-hidden", className)}>
            {/* Background Actions */}
            {isMobile && (
                <div className="absolute inset-0 flex items-center justify-between">
                    {/* Left Background (Edit/Right Swipe) - Visible when dragging Right */}
                    <div className={clsx("flex items-center justify-start pl-4 w-full h-full absolute left-0 rounded-2xl", rightActionColor)}>
                        {rightActionIcon}
                    </div>
                    {/* Right Background (Delete/Left Swipe) - Visible when dragging Left */}
                    <div className={clsx("flex items-center justify-end pr-4 w-full h-full absolute right-0 rounded-2xl", leftActionColor)}>
                        {leftActionIcon}
                    </div>
                </div>
            )}

            {/* Foreground Content */}
            <motion.div
                drag={canDrag ? "x" : false}
                dragConstraints={{ left: onSwipeLeft ? -100 : 0, right: onSwipeRight ? 100 : 0 }}
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
