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
    ClipboardCheck, CreditCard, Wallet, RotateCcw, MapPin, Phone
} from 'lucide-react';

export default function AgentDashboard() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live Dashboard
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

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <MetricCard
                    icon={Package}
                    label="Pending"
                    value={(metrics.pending_orders || 0) + (metrics.assigned_orders || 0)}
                    color="amber"
                    subtitle="To Deliver"
                />
                <MetricCard
                    icon={CheckCircle2}
                    label="Completed"
                    value={metrics.completed_orders || 0}
                    color="emerald"
                    subtitle="Today"
                />
            </div>

            {/* Financial Summary Card */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-900/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Today's Wallet</span>
                    </div>

                    <div className="mb-6">
                        <p className="text-5xl font-black tracking-tighter leading-none mb-1">
                            ₹{(metrics.today_earnings || 0).toLocaleString()}
                        </p>
                        <p className="text-slate-500 text-xs font-medium">Total collected today</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                <Banknote className="w-3.5 h-3.5" /> Cash
                            </div>
                            <p className="text-xl font-bold tracking-tight">₹{(metrics.cash_collected || 0).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                <CreditCard className="w-3.5 h-3.5" /> UPI
                            </div>
                            <p className="text-xl font-bold tracking-tight">₹{(metrics.upi_collected || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
                <h3 className="font-black text-slate-900 text-lg tracking-tight px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                    <QuickActionCard
                        icon={ClipboardCheck}
                        label="Complete"
                        desc="Mark Delivered"
                        color="emerald"
                        onClick={() => navigate('/agent/complete')}
                    />
                    <QuickActionCard
                        icon={AlertTriangle}
                        label="Report"
                        desc="Log Damage"
                        color="rose" // Changed to rose for better alert feel
                        onClick={() => navigate('/agent/damage')}
                    />
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

                {pendingOrders.length > 0 ? (
                    <div className="space-y-3">
                        {pendingOrders.slice(0, 3).map((order, idx) => (
                            <div
                                key={order.order_id}
                                onClick={() => navigate(`/agent/complete?orderId=${order.order_id}`)}
                                className="group bg-white rounded-3xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 relative overflow-hidden"
                            >
                                {/* Status Stripe */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${order.status === 'out_for_delivery' ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}></div>

                                <div className="flex gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${order.status === 'out_for_delivery' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                #{order.order_id.slice(-6)}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-sm truncate leading-tight mb-1">
                                            {order.customer_name}
                                        </h4>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1 whitespace-nowrap">
                                                <Droplets className="w-3 h-3 text-sky-500" />
                                                <span className="font-bold text-slate-700">{order.quantity}×</span> {order.litre_size}L
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="font-bold text-emerald-600">₹{order.amount}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end justify-center gap-2">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
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
                        <h3 className="font-black text-slate-900 text-lg mb-1">All Caught Up!</h3>
                        <p className="text-slate-400 text-sm font-medium">You have no pending deliveries.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color, subtitle }) {
    const theme = {
        amber: 'bg-amber-50 text-amber-600 decoration-amber-200',
        emerald: 'bg-emerald-50 text-emerald-600 decoration-emerald-200',
        blue: 'bg-blue-50 text-blue-600 decoration-blue-200',
        rose: 'bg-rose-50 text-rose-600 decoration-rose-200'
    };

    return (
        <div className="bg-white rounded-[28px] p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group hover:shadow-md transition-all active:scale-[0.98]">
            {/* Background decoration */}
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-20 blur-2xl ${color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>

            <div className={`w-12 h-12 rounded-2xl ${theme[color].split(' ')[0]} ${theme[color].split(' ')[1]} flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300`}>
                <Icon className="w-6 h-6 stroke-[2.5px]" />
            </div>

            <div>
                <p className="font-black text-3xl text-slate-900 tracking-tighter leading-none mb-1">
                    {value}
                </p>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                    {subtitle && <span className="text-[10px] text-slate-400 font-medium">{subtitle}</span>}
                </div>
            </div>
        </div>
    );
}

function QuickActionCard({ icon: Icon, label, desc, color, onClick }) {
    const theme = {
        emerald: {
            bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'group-hover:bg-emerald-500', iconHover: 'group-hover:text-white'
        },
        rose: {
            bg: 'bg-rose-50', text: 'text-rose-600', hover: 'group-hover:bg-rose-500', iconHover: 'group-hover:text-white'
        }
    };

    // Fallback theme if color not found
    const t = theme[color] || theme.emerald;

    return (
        <button
            onClick={onClick}
            className="group flex flex-col p-5 bg-white rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.96] text-left relative overflow-hidden"
        >
            <div className={`hidden absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-${color}-50 to-transparent rounded-bl-full opacity-50`}></div>

            <div className={`w-12 h-12 rounded-2xl ${t.bg} ${t.text} flex items-center justify-center mb-3 transition-colors duration-300 ${t.hover} shadow-sm`}>
                <Icon className={`w-6 h-6 stroke-[2.5px] transition-colors duration-300 ${t.iconHover}`} />
            </div>

            <div>
                <span className="block font-black text-slate-900 text-sm tracking-tight mb-0.5 group-hover:text-emerald-700 transition-colors">
                    {label}
                </span>
                <span className="block text-slate-400 text-xs font-medium">
                    {desc}
                </span>
            </div>
        </button>
    );
}
