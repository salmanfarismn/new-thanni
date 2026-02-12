/**
 * AgentLayout - Mobile-first layout for delivery agents
 * Includes sticky header with agent info, pending orders badge, and bottom nav
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useCompanyName } from '../../context/AppContext';
import api, { removeAuthToken } from '../../api/axios';
import { toast } from 'sonner';
import {
    LayoutDashboard, Package, ClipboardCheck, AlertTriangle as DamageIcon,
    History, LogOut, Truck
} from 'lucide-react';

const AgentLayout = ({ children }) => {
    const { vendor } = useCompanyName();
    const navigate = useNavigate();
    const location = useLocation();
    const [agentName, setAgentName] = useState('');
    const [pendingCount, setPendingCount] = useState(0);

    // Fetch agent info and pending count
    const fetchAgentInfo = useCallback(async () => {
        try {
            const res = await api.get('/agent/dashboard');
            setAgentName(res.data.agent_name || 'Agent');
            const m = res.data.metrics || {};
            setPendingCount((m.pending_orders || 0) + (m.assigned_orders || 0));
        } catch (err) {
            // Silently fail — layout should still render
        }
    }, []);

    useEffect(() => {
        fetchAgentInfo();
        const interval = setInterval(fetchAgentInfo, 30000);
        return () => clearInterval(interval);
    }, [fetchAgentInfo]);

    // Re-fetch when navigating back to refresh badge
    useEffect(() => {
        fetchAgentInfo();
    }, [location.pathname, fetchAgentInfo]);

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

    const navItems = [
        { path: '/agent/dashboard', icon: LayoutDashboard, label: 'Home' },
        { path: '/agent/orders', icon: Package, label: 'Orders', badge: pendingCount },
        { path: '/agent/complete', icon: ClipboardCheck, label: 'Complete' },
        { path: '/agent/damage', icon: DamageIcon, label: 'Report' },
        { path: '/agent/history', icon: History, label: 'History' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
            {/* Agent Top Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-lg border-b border-slate-100 z-40 flex items-center px-4 justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Truck className="text-white w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-sm leading-tight truncate max-w-[180px]">
                            {agentName || 'Agent'}
                        </span>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">On Duty</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-100 transition-all shadow-sm active:scale-95"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            {/* Main Content */}
            <main className="pt-20 px-4 max-w-lg mx-auto">
                {children}
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 z-40 px-2 py-1 safe-area-bottom">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 ${active
                                    ? 'text-emerald-600'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-emerald-50' : ''}`}>
                                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                                    {/* Badge */}
                                    {item.badge > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-sm shadow-red-500/30">
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold tracking-wide ${active ? 'text-emerald-700' : ''}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default AgentLayout;
