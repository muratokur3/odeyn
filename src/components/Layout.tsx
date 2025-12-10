import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export const Layout = () => {
    return (
        <div className="min-h-screen bg-background text-text-primary font-sans relative">
            <main className="w-full pb-24">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
};
