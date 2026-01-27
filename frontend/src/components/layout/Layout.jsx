import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { Droplets } from 'lucide-react';
import { useCompanyName } from '../../context/AppContext';

const TopHeader = () => {
    const { companyName } = useCompanyName();

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-white/20 z-40 md:hidden flex items-center px-4 justify-between shadow-sm">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                    <Droplets className="text-white" size={18} fill="currentColor" />
                </div>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">{companyName}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-white flex items-center justify-center text-xs font-bold text-slate-600">
                AD
            </div>
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
            <main className="transition-all duration-300 md:ml-72 pt-20 pb-24 md:py-8 min-h-screen">
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
