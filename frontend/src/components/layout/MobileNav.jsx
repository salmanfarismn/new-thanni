import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Package, TruckIcon, Droplets, Settings, Users } from 'lucide-react';

const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: Package, label: 'Home' },
        { path: '/orders', icon: TruckIcon, label: 'Orders' },
        { path: '/delivery', icon: Users, label: 'Staff' },
        { path: '/stock', icon: Droplets, label: 'Stock' },
        { path: '/settings', icon: Settings, label: 'Config' },
    ];

    return (
        <nav className="fixed bottom-6 left-6 right-6 bg-[#0f172a] backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl shadow-black/40 z-50 md:hidden animate-slide-up pb-safe">
            <div className="flex justify-between items-center p-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex flex-col items-center justify-center flex-1 py-3 gap-1 rounded-[1.5rem] transition-all duration-300 ${isActive
                                ? 'bg-white/10 text-sky-400 shadow-inner'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="transition-transform duration-300 group-active:scale-90" />
                            <span className={`text-[10px] font-bold tracking-wide transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
