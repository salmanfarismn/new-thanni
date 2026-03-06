/**
 * AgentDues — Mobile-first dues tracking page for delivery agents.
 * 
 * Shows:
 *   - Summary cards (collected today, total outstanding)
 *   - Filterable dues list (All / UPI Pending / Cash Due / Unpaid)
 *   - Sticky totals bar
 *   - Real-time updates via WebSocket
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../context/AppContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { toast } from 'sonner';
import {
    IndianRupee, Clock, AlertCircle, CheckCircle2, Filter,
    TrendingUp, TrendingDown, Phone, MapPin, Banknote,
    CreditCard, ArrowRight, RefreshCw, Wallet
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAYMENT_STATUS_CONFIG = {
    upi_pending: {
        label: 'UPI Pending',
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
        icon: CreditCard,
        accent: 'border-l-amber-400'
    },
    cash_due: {
        label: 'Cash Due',
        color: 'text-orange-700',
        bg: 'bg-orange-50 border-orange-200',
        icon: Banknote,
        accent: 'border-l-orange-400'
    },
    delivered_unpaid: {
        label: 'Delivered Unpaid',
        color: 'text-red-700',
        bg: 'bg-red-50 border-red-200',
        icon: AlertCircle,
        accent: 'border-l-red-400'
    },
    unpaid: {
        label: 'Unpaid',
        color: 'text-red-700',
        bg: 'bg-red-50 border-red-200',
        icon: AlertCircle,
        accent: 'border-l-red-400'
    },
    not_paid: {
        label: 'Not Paid',
        color: 'text-red-700',
        bg: 'bg-red-50 border-red-200',
        icon: AlertCircle,
        accent: 'border-l-red-400'
    },
    pending: {
        label: 'Pending',
        color: 'text-slate-700',
        bg: 'bg-slate-50 border-slate-200',
        icon: Clock,
        accent: 'border-l-slate-400'
    }
};

const FILTER_OPTIONS = [
    { value: 'all', label: 'All Dues' },
    { value: 'upi_pending', label: 'UPI Pending' },
    { value: 'cash_due', label: 'Cash Due' },
    { value: 'delivered_unpaid', label: 'Unpaid' },
];

export default function AgentDues() {
    const [dues, setDues] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);

    const { on, isConnected } = useWebSocket();

    const loadDues = useCallback(async () => {
        try {
            const params = filter !== 'all' ? { status: filter } : {};
            const [duesRes, summaryRes] = await Promise.all([
                api.get('/agent/dues', { params }),
                api.get('/agent/dues/summary')
            ]);
            setDues(duesRes.data.dues || []);
            setSummary(summaryRes.data);
        } catch (err) {
            toast.error('Failed to load dues');
            console.error('Load dues error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter]);

    useEffect(() => {
        setLoading(true);
        loadDues();
    }, [loadDues]);

    // Real-time: reload on payment updates
    useEffect(() => {
        const cleanup = on('payment_update', (data) => {
            toast.success(`Payment updated: ${data.customer_name || 'Order'} — ₹${data.amount || 0}`);
            loadDues();
        });
        return cleanup;
    }, [on, loadDues]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDues();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Unknown';
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return dateStr;
        }
    };

    const filteredTotal = useMemo(() => {
        return dues.reduce((sum, d) => sum + (d.amount || 0), 0);
    }, [dues]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
                    ))}
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-28 bg-slate-100 rounded-2xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-28 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        Dues & Collections
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Track your pending payments
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isConnected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 opacity-80" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Collected Today</span>
                        </div>
                        <p className="text-2xl font-black">₹{(summary.today?.total_collected || 0).toLocaleString()}</p>
                        <p className="text-[10px] mt-1 opacity-70 font-medium">
                            {summary.today?.total_orders || 0} orders
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-lg shadow-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-4 h-4 opacity-80" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Outstanding</span>
                        </div>
                        <p className="text-2xl font-black">₹{(summary.outstanding?.total_amount || 0).toLocaleString()}</p>
                        <p className="text-[10px] mt-1 opacity-70 font-medium">
                            {summary.outstanding?.total_orders || 0} pending
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <Banknote className="w-4 h-4 text-green-600" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cash</span>
                        </div>
                        <p className="text-lg font-black text-slate-900">₹{(summary.today?.cash_collected || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{summary.today?.cash_orders || 0} orders</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">UPI</span>
                        </div>
                        <p className="text-lg font-black text-slate-900">₹{(summary.today?.upi_collected || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{summary.today?.upi_orders || 0} orders</p>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {FILTER_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setFilter(opt.value)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation ${filter === opt.value
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Dues List */}
            {dues.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">All Clear! 🎉</p>
                    <p className="text-sm text-slate-500 mt-1">No pending dues in this category</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {dues.map((due, idx) => {
                        const config = PAYMENT_STATUS_CONFIG[due.payment_status] || PAYMENT_STATUS_CONFIG.pending;
                        const StatusIcon = config.icon;
                        return (
                            <div
                                key={due.order_id || idx}
                                className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-4 ${config.accent} transition-all hover:shadow-md`}
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-900 text-sm truncate">
                                                {due.customer_name}
                                            </h3>
                                            <div className="flex items-center gap-1 mt-1">
                                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                <p className="text-[11px] text-slate-500 truncate">
                                                    {due.customer_address || 'No address'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                            <p className="text-lg font-black text-slate-900">₹{(due.amount || 0).toLocaleString()}</p>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.bg} ${config.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium">{due.quantity} × {due.litre_size}L</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(due.delivered_at)}
                                            </span>
                                        </div>
                                        {due.customer_phone && (
                                            <a
                                                href={`tel:${due.customer_phone}`}
                                                className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 active:scale-90 transition-transform touch-manipulation"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Phone className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
