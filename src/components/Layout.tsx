import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export const Layout = () => {
    return (
        <div className="h-[100dvh] flex flex-col bg-background text-text-primary font-sans overflow-hidden">
            <main className="flex-1 overflow-y-auto w-full relative scroll-smooth scrollbar-hide">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
};
