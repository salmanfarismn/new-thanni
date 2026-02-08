import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { Droplets } from 'lucide-react';
import { useCompanyName } from '../../context/AppContext';

import { useNavigate, Link } from 'react-router-dom';
import api, { removeAuthToken } from '../../api/axios';
import { toast } from 'sonner';

const TopHeader = () => {
    const { companyName, logoUrl } = useCompanyName();
    const navigate = useNavigate();

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            try {
                await api.post('/auth/logout');
                toast.success('Logged out successfully');
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                removeAuthToken();
                navigate('/login');
            }
        }
    };

    const getInitials = (name) => {
        if (!name) return 'TC';
        const words = name.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 md:hidden flex items-center px-4 justify-between shadow-sm">
            <div className="flex items-center gap-3">
                <Link
                    to="/"
                    className="relative w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm overflow-hidden active:scale-95 transition-all"
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <Droplets className="text-white" size={18} fill="currentColor" />
                        </div>
                    )}
                </Link>
                <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-sm leading-tight truncate max-w-[180px]">{companyName}</span>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </div>
            <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-500 hover:bg-slate-100 transition-all shadow-sm active:scale-95"
                title="Logout"
            >
                {getInitials(companyName)}
            </button>
        </header>
    );
};

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex" />

            {/* Mobile Top Header */}
            <TopHeader />

            {/* Main Content Area */}
            <main className="transition-all duration-300 md:ml-72 pt-20 pb-24 md:py-12 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <MobileNav />
        </div>
    );
};

export default Layout;
