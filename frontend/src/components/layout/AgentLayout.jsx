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
    History, LogOut, Truck, IndianRupee, User
} from 'lucide-react';

const AgentLayout = ({ children }) => {
    const { vendor } = useCompanyName();
    const navigate = useNavigate();
    const location = useLocation();
    const [agentName, setAgentName] = useState('');
    const [pendingCount, setPendingCount] = useState(0);
    const [duesCount, setDuesCount] = useState(0);

    // Fetch agent info and pending count
    const fetchAgentInfo = useCallback(async () => {
        try {
            const res = await api.get('/agent/dashboard');
            setAgentName(res.data.agent_name || 'Agent');
            const m = res.data.metrics || {};
            setPendingCount((m.pending_orders || 0) + (m.assigned_orders || 0));
            setDuesCount(m.unpaid_orders || 0);
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
        { path: '/agent/dues', icon: IndianRupee, label: 'Dues', badge: duesCount },
        { path: '/agent/history', icon: History, label: 'History' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
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
                <Link
                    to="/agent/profile"
                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all shadow-sm active:scale-95"
                    title="Profile & Settings"
                >
                    <User className="w-5 h-5" />
                </Link>
            </header>

            {/* Main Content */}
            <main className="pt-20 px-4 max-w-lg mx-auto">
                {children}
            </main>

            {/* Premium Mobile Bottom Nav */}
            <nav className="fixed bottom-4 left-4 right-4 bg-white/80 backdrop-blur-2xl border border-white/20 z-40 px-3 py-2 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] safe-area-bottom ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between max-w-lg mx-auto relative px-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`relative flex flex-col items-center justify-center gap-1 min-w-[64px] py-1.5 rounded-2xl transition-all duration-300 group touch-manipulation`}
                            >
                                <div className={`relative p-2 rounded-xl transition-all duration-300 ${active
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110'
                                    : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600'}`}>
                                    <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110' : 'group-active:scale-95'}`} strokeWidth={active ? 2.5 : 2} />

                                    {/* Badge */}
                                    {item.badge > 0 && (
                                        <span className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] text-[10px] font-black rounded-full flex items-center justify-center px-1.5 border-2 shadow-sm transition-all duration-300 ${active ? 'bg-white text-emerald-600 border-emerald-600 animate-pulse' : 'bg-red-500 text-white border-white animate-in zoom-in'
                                            }`}>
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${active
                                    ? 'text-emerald-700 opacity-100 translate-y-0.5'
                                    : 'text-slate-400 opacity-0 -translate-y-1'}`}>
                                    {item.label}
                                </span>

                                {/* Active Indicator Dot */}
                                {active && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-emerald-600 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default AgentLayout;
