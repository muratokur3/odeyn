import React, { useState, useEffect } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';
import clsx from 'clsx';

interface SwipeableItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Delete (Trailing)
    onSwipeRight?: () => void; // Edit (Leading)
    className?: string;
    editColor?: string;
    deleteColor?: string;
    EditIcon?: React.ElementType;
    DeleteIcon?: React.ElementType;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    className,
    editColor = "bg-orange-500", // Default to Orange for Edit
    deleteColor = "bg-red-500",
    EditIcon = Edit2,
    DeleteIcon = Trash2
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
        const threshold = 80;

        if (offset < -threshold && onSwipeLeft) {
            // Swipe Left (Delete)
            await controls.start({ x: -100, transition: { duration: 0.2 } });
            onSwipeLeft();
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else if (offset > threshold && onSwipeRight) {
            // Swipe Right (Edit)
            await controls.start({ x: 100, transition: { duration: 0.2 } });
            onSwipeRight();
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else {
            // Snap back
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        }
    };

    // If on desktop, disable swipe completely
    const canDrag = isMobile && (!!onSwipeLeft || !!onSwipeRight);

    return (
        <div className={clsx("relative overflow-hidden rounded-2xl", className)}>
            {/* Background Actions - Only visible on Mobile when swiping */}
            {isMobile && (
                <div className="absolute inset-0 flex items-center justify-between">
                    {/* Left Background (Edit/Right Swipe) */}
                    <div className={clsx("flex items-center justify-start pl-6 w-full h-full absolute left-0", editColor)}>
                        <EditIcon className="text-white" size={24} />
                    </div>
                    {/* Right Background (Delete/Left Swipe) */}
                    <div className={clsx("flex items-center justify-end pr-6 w-full h-full absolute right-0", deleteColor)}>
                        <DeleteIcon className="text-white" size={24} />
                    </div>
                </div>
            )}

            {/* Foreground Content */}
            <motion.div
                drag={canDrag ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                animate={controls}
                className="relative bg-surface z-10"
                whileTap={canDrag ? { cursor: "grabbing" } : {}}
                style={{ touchAction: "pan-y" }}
            >
                {children}
            </motion.div>
        </div>
    );
};
