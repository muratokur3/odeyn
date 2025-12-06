import { clsx } from 'clsx';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
    return (
        <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onChange(!checked)}
        >
            <div className={clsx(
                "w-12 h-7 flex items-center rounded-full p-1 duration-300 ease-in-out shadow-inner",
                checked ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gray-300"
            )}>
                <div className={clsx(
                    "bg-white w-5 h-5 rounded-full shadow-md transform duration-300 ease-in-out",
                    checked ? "translate-x-5" : "translate-x-0"
                )}></div>
            </div>
            {label && (
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors select-none">
                    {label}
                </span>
            )}
        </div>
    );
};
