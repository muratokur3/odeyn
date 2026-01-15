import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export const Layout = () => {
    const location = useLocation();
    // Hide nav ONLY on:
    // 1. Debt Details (/debt/...)
    // 2. Stream History (/person/.../history)
    const hideNav = location.pathname.startsWith('/debt/') || location.pathname.endsWith('/history');

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans relative">
            <main className={`w-full ${hideNav ? '' : 'pb-24'}`}>
                <Outlet />
            </main>
            {!hideNav && <BottomNav />}
        </div>
    );
};
