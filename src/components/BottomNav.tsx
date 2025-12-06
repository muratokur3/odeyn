import { Home, User, BookUser, GripHorizontal, Calculator } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { path: '/', icon: Home, label: 'Anasayfa' },
        { path: '/tools', icon: Calculator, label: 'Araçlar' },
        { path: '/dial', icon: GripHorizontal, label: 'Hızlı İşlem' },
        { path: '/contacts', icon: BookUser, label: 'Rehber' },
        { path: '/profile', icon: User, label: 'Profil' },
    ];

    return (
        <div className="flex-none bg-surface border-t border-slate-700 pb-safe z-40 w-full max-w-md mx-auto">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={clsx(
                                "flex flex-col items-center justify-center w-full h-full space-y-1",
                                isActive ? "text-primary" : "text-text-secondary hover:text-text-primary"
                            )}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
