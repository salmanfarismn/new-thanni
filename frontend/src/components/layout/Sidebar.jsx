import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Package, TruckIcon, Droplets, Settings, LogOut, Users, Loader2 } from 'lucide-react';
import { useCompanyName } from '../../context/AppContext';
import api, { getVendor, removeAuthToken } from '../../api/axios';
import { toast } from 'sonner';

const Sidebar = ({ className = "" }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { companyName } = useCompanyName();
    const [vendor, setVendor] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);

    // Load vendor info from localStorage or API
    useEffect(() => {
        const storedVendor = getVendor();
        if (storedVendor) {
            setVendor(storedVendor);
        } else {
            // Fetch from API if not in localStorage
            loadVendorInfo();
        }
    }, []);

    const loadVendorInfo = async () => {
        try {
            const response = await api.get('/auth/me');
            setVendor(response.data);
        } catch (error) {
            console.error('Error loading vendor info:', error);
        }
    };

    const handleLogout = async () => {
        try {
            setLoggingOut(true);
            await api.post('/auth/logout');
            toast.success('Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
            // Still logout locally even if API fails
        } finally {
            removeAuthToken();
            navigate('/login');
        }
    };

    // Get initials from business name
    const getInitials = (name) => {
        if (!name) return 'TC';
        const words = name.split(' ').filter(w => w.length > 0);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

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
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20 overflow-hidden">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
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
                <div className="flex items-center gap-3 p-2">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg">
                        <span className="text-sm font-bold text-white">
                            {getInitials(vendor?.business_name)}
                        </span>
                    </div>

                    {/* Vendor Info */}
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">
                            {vendor?.business_name || 'Loading...'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                            {vendor?.phone || ''}
                        </p>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all disabled:opacity-50"
                        title="Logout"
                    >
                        {loggingOut ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <LogOut size={18} />
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
