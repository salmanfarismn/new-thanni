/**
 * AgentDashboard - Mobile-first premium dashboard for delivery agents
 * Shows today's metrics, cash collection summary, pending orders, and quick actions
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    Package, CheckCircle2, Truck, Clock, Banknote,
    AlertTriangle, RefreshCw, ArrowRight, Droplets, TrendingUp,
    ClipboardCheck, CreditCard, Wallet, RotateCcw, MapPin, Phone,
    IndianRupee, TrendingDown, History, User
} from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SoundService } from '../../utils/SoundService';

export default function AgentDashboard() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { on, isConnected } = useWebSocket();

    const fetchDashboard = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const [dashRes, ordersRes] = await Promise.all([
                api.get('/agent/dashboard'),
                api.get('/agent/orders')
            ]);
            setDashboard(dashRes.data);
            setPendingOrders(ordersRes.data.orders || []);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            if (!showRefresh) toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(() => fetchDashboard(true), 30000);
        return () => clearInterval(interval);
    }, [fetchDashboard]);

    // Real-time WebSocket updates
    useEffect(() => {
        const cleanups = [
            on('new_order', (data) => {
                SoundService.playWaterDrop();
                toast.success('New Delivery Assigned!', {
                    description: `Customer: ${data.customer_name} - ${data.quantity} cans`,
                    duration: 5000,
                });
                fetchDashboard(true);
            }),
            on('payment_update', () => fetchDashboard(true)),
            on('order_delivered', () => fetchDashboard(true)),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [on, fetchDashboard]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        if (hour < 21) return 'Good Evening';
        return 'Good Night';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-sm tracking-wide uppercase">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const metrics = dashboard?.metrics || {};

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'} animate-pulse`}></span>
                        {isConnected ? 'Live Dashboard' : 'Dashboard'}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight truncate">
                        {getGreeting()},<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 block truncate">
                            {dashboard?.agent_name?.split(' ')[0] || 'Agent'}
                        </span>
                    </h1>
                </div>
                <button
                    onClick={() => fetchDashboard(true)}
                    disabled={refreshing}
                    className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-90"
                >
                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
            </div>

            {/* Compact Activity Bar */}
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-lg font-black text-slate-900 leading-none">{(metrics.pending_orders || 0) + (metrics.assigned_orders || 0)}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                    </div>
                </div>
                <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-lg font-black text-slate-900 leading-none">{metrics.completed_orders || 0}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Done</p>
                    </div>
                </div>
            </div>

            {/* Unified Financial Hero Card */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl shadow-slate-900/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                                <Wallet className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Live Balance</span>
                        </div>
                        {(metrics.total_outstanding || 0) > 0 && (
                            <div onClick={() => navigate('/agent/dues')} className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2 cursor-pointer active:scale-95 transition-all text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase tracking-tight font-mono">₹{metrics.total_outstanding} Due</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center py-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Today's Earnings</p>
                        <p className="text-5xl font-black tracking-tighter leading-none text-white drop-shadow-md">
                            ₹{(metrics.today_earnings || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/5">
                        <div className="space-y-1 border-r border-white/10 pr-2">
                            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                <Banknote className="w-3 h-3" /> Cash
                            </div>
                            <p className="text-xl font-black tracking-tight">₹{(metrics.cash_collected || 0).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1 pl-2">
                            <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                                <CreditCard className="w-3 h-3" /> UPI
                            </div>
                            <p className="text-xl font-black tracking-tight">₹{(metrics.upi_collected || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Horizontal Quick Actions Bar */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-1">Quick Access</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar px-2">
                    <QuickActionButton icon={ClipboardCheck} label="Deliver" color="emerald" onClick={() => navigate('/agent/complete')} />
                    <QuickActionButton icon={IndianRupee} label="Dues" color="amber" onClick={() => navigate('/agent/dues')} />
                    <QuickActionButton icon={AlertTriangle} label="Report" color="rose" onClick={() => navigate('/agent/damage')} />
                    <QuickActionButton icon={History} label="History" color="blue" onClick={() => navigate('/agent/history')} />
                    <QuickActionButton icon={User} label="Profile" color="indigo" onClick={() => navigate('/agent/profile')} />
                </div>
            </div>

            {/* Pending Orders Section */}
            <div>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 text-lg tracking-tight">Up Next</h3>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {pendingOrders.length}
                        </span>
                    </div>
                    {pendingOrders.length > 0 && (
                        <button
                            onClick={() => navigate('/agent/orders')}
                            className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 active:scale-95 transition-transform"
                        >
                            View All <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {pendingOrders.filter(o => o.status !== 'delivered').length > 0 ? (
                    <div className="space-y-4">
                        {pendingOrders
                            .filter(o => o.status !== 'delivered')
                            .slice(0, 3)
                            .map((order) => (
                                <div
                                    key={order.order_id}
                                    onClick={() => navigate(`/agent/complete?orderId=${order.order_id}`)}
                                    className="group bg-white/80 backdrop-blur-xl rounded-[32px] p-6 border border-slate-100/60 shadow-lg shadow-slate-200/40 active:scale-[0.98] transition-all cursor-pointer hover:border-emerald-200 hover:shadow-xl relative overflow-hidden"
                                >
                                    {/* Glassy header background */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

                                    <div className="flex gap-5 relative z-10">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${order.status === 'out_for_delivery' ? 'bg-amber-100 text-amber-600 shadow-inner' : 'bg-blue-100 text-blue-600 shadow-inner'
                                            } group-hover:scale-110 group-active:scale-95`}>
                                            <Truck className="w-8 h-8" strokeWidth={2.5} />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-center gap-2 mb-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
                                                <span className={`px-2 py-0.5 rounded-full ${order.status === 'out_for_delivery' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-slate-400">#{order.order_id.slice(-6)}</span>
                                            </div>
                                            <h4 className="font-black text-slate-800 text-xl truncate leading-tight mb-3">
                                                {order.customer_name}
                                            </h4>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50/50 rounded-xl border border-slate-100">
                                                    <Droplets className="w-3.5 h-3.5 text-sky-500" />
                                                    <span className="text-xs font-black text-slate-700">{order.quantity} × {order.litre_size}L</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                                    <span className="text-xs font-black text-emerald-600">₹{order.amount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-100 p-10 text-center shadow-sm">
                        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="font-black text-slate-900 text-lg mb-1">All Clear!</h3>
                        <p className="text-slate-400 text-sm font-medium">Ready for the next run. 🚀</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function QuickActionButton({ icon: Icon, label, color, onClick }) {
    const theme = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    };

    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-2 group min-w-[64px]"
        >
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 shadow-sm ${theme[color] || theme.emerald} group-hover:scale-110 group-active:scale-90`}>
                <Icon className="w-6 h-6 stroke-[2.5px]" />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter transition-colors group-hover:text-slate-900">
                {label}
            </span>
        </button>
    );
}
