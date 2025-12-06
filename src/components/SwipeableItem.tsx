import React from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';
import clsx from 'clsx';

interface SwipeableItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Delete/Reject
    onSwipeRight?: () => void; // Edit/Confirm
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
    editColor = "bg-blue-500",
    deleteColor = "bg-red-500",
    EditIcon = Edit2,
    DeleteIcon = Trash2
}) => {
    const controls = useAnimation();

    const handleDragEnd = async (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const threshold = 60; // Lower threshold for easier triggering

        if (offset < -threshold && onSwipeLeft) {
            // Swipe Left (Delete)
            await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
            onSwipeLeft();
            controls.start({ x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else if (offset > threshold && onSwipeRight) {
            // Swipe Right (Edit)
            onSwipeRight();
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        } else {
            // Snap back
            controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
        }
    };

    return (
        <div className={clsx("relative overflow-hidden rounded-2xl", className)}>
            {/* Background Actions */}
            <div className="absolute inset-0 flex items-center justify-between">
                {/* Left Background (Edit/Confirm) - Visible when dragging right */}
                <div className={clsx("flex items-center justify-start pl-6 w-full h-full absolute left-0", editColor)}>
                    <EditIcon className="text-white" size={24} />
                </div>
                {/* Right Background (Delete/Reject) - Visible when dragging left */}
                <div className={clsx("flex items-center justify-end pr-6 w-full h-full absolute right-0", deleteColor)}>
                    <DeleteIcon className="text-white" size={24} />
                </div>
            </div>

            {/* Foreground Content */}
            <motion.div
                drag={!!onSwipeLeft || !!onSwipeRight ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.9} // More responsive
                onDragEnd={handleDragEnd}
                animate={controls}
                className="relative bg-surface z-10"
                whileTap={!!onSwipeLeft || !!onSwipeRight ? { cursor: "grabbing" } : {}}
                style={{ touchAction: "pan-y" }} // Critical for scrolling lists
            >
                {children}
            </motion.div>
        </div>
    );
};
