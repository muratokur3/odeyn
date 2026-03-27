import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
    iconColor?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className,
    iconColor = 'text-blue-500'
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={twMerge(
                "flex flex-col items-center justify-center py-16 px-6 text-center",
                className
            )}
        >
            {/* Animated Icon Container */}
            <div className="relative mb-8">
                <motion.div
                    animate={{ 
                        scale: [1, 1.05, 1],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ 
                        duration: 4, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                    }}
                    className={clsx(
                        "absolute inset-0 blur-3xl rounded-full",
                        iconColor.replace('text-', 'bg-')
                    )}
                />
                <div className="relative bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-500/10 border border-slate-100 dark:border-slate-700/50">
                    <Icon 
                        size={48} 
                        className={clsx(iconColor, "stroke-[1.5]")} 
                    />
                </div>
            </div>

            {/* Content */}
            <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight"
            >
                {title}
            </motion.h3>
            
            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed mb-10"
            >
                {description}
            </motion.p>

            {/* Action Button */}
            {actionLabel && onAction && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ delay: 0.4 }}
                    onClick={onAction}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all active:shadow-inner"
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
};
