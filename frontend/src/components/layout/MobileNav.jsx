import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Package, TruckIcon, Droplets, Settings } from 'lucide-react';

const MobileNav = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: Package, label: 'Dash' },
        { path: '/orders', icon: TruckIcon, label: 'Orders' },
        { path: '/stock', icon: Droplets, label: 'Stock' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <nav className="fixed bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 md:hidden pb-safe">
            <div className="flex justify-around items-center p-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex flex-col items-center justify-center w-full py-3 rounded-xl transition-all duration-300 ${isActive
                                    ? 'text-sky-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <div className={`relative p-1.5 transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                {isActive && (
                                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
