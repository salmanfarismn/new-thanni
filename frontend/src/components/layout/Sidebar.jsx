import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Package, TruckIcon, Droplets, Settings, LogOut, ChevronRight, Users } from 'lucide-react';
import { useCompanyName } from '../../context/AppContext';

const Sidebar = ({ className = "" }) => {
    const location = useLocation();
    const { companyName } = useCompanyName();

    // Navigation Items
    const navItems = [
        { path: '/', icon: Package, label: 'Dashboard' },
        { path: '/orders', icon: TruckIcon, label: 'Orders' },
        { path: '/delivery', icon: Users, label: 'Delivery Management' },
        { path: '/stock', icon: Droplets, label: 'Stock Manager' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <aside className={`flex flex-col h-screen bg-slate-900 text-white w-72 fixed left-0 top-0 border-r border-slate-800 transition-all duration-300 z-50 ${className}`}>
            {/* Brand Section */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                        <Droplets className="text-white" size={20} fill="currentColor" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-white">{companyName}</h1>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-xs text-slate-400 font-medium tracking-wide">OPERATIONAL</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Main Menu
                </div>

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-custom-sky bg-opacity-10 text-sky-400 font-medium'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon
                                    size={20}
                                    className={`transition-colors duration-200 ${isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-white'}`}
                                />
                                <span>{item.label}</span>
                            </div>

                            {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"></span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User / Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                        <span className="text-sm font-bold text-slate-300">AD</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">Admin User</p>
                        <p className="text-xs text-slate-500 truncate">admin@thannicanuuu.com</p>
                    </div>
                    <LogOut size={16} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
