/**
 * AgentHistory - Premium delivery history view
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    History, Droplets, CheckCircle2, Banknote, CreditCard,
    RotateCcw, TrendingUp, Wallet, Calendar, ArrowLeft, Filter, MapPin, Camera
} from 'lucide-react';

export default function AgentHistory() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get('/agent/history', { params: { days } });
                setHistory(res.data.history || []);
                setSummary(res.data.summary || {});
            } catch (err) {
                toast.error('Failed to load history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [days]);

    // Group deliveries by date
    const groupByDate = (items) => {
        const groups = {};
        items.forEach(item => {
            const dateStr = item.delivered_at ? item.delivered_at.split('T')[0] : 'Unknown';
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(item);
        });
        return groups;
    };

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'Unknown') return 'Unknown Date';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Invalid Date';

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (d.toDateString() === today.toDateString()) return 'Today';
            if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (e) {
            return 'Date Error';
        }
    };

    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch { return ''; }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    const grouped = groupByDate(history);

    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between pt-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20 py-2 border-b border-white/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/agent/dashboard')}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">History</h1>
                </div>

                <div className="relative">
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="appearance-none bg-white border border-slate-200 rounded-2xl pl-4 pr-10 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={14}>Last 14 Days</option>
                        <option value={30}>Last 30 Days</option>
                    </select>
                    <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>

            {/* Summary Hero Card */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-900/20 mx-1">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Earned</p>
                        <p className="text-4xl font-black tracking-tighter">₹{(summary.total_earnings || 0).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Deliveries</p>
                        <p className="text-4xl font-black tracking-tighter">{history.length}</p>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-white/10">
                    <div className="bg-white/5 rounded-2xl p-3 backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Banknote className="w-3 h-3" /> Cash
                        </div>
                        <p className="text-lg font-bold">₹{summary.total_cash || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <CreditCard className="w-3 h-3" /> UPI
                        </div>
                        <p className="text-lg font-bold">₹{summary.total_upi || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <RotateCcw className="w-3 h-3" /> Empty
                        </div>
                        <p className="text-lg font-bold">{summary.total_empty_cans || 0}</p>
                    </div>
                </div>
            </div>

            {/* Timeline List */}
            {history.length === 0 ? (
                <div className="bg-white rounded-[32px] border border-slate-100 p-10 text-center shadow-sm mx-1">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-50">
                        <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-black text-slate-900 text-lg mb-1">No History Found</h3>
                    <p className="text-slate-400 text-sm font-medium">Delivered orders will appear here.</p>
                </div>
            ) : (
                <div className="space-y-8 px-1">
                    {Object.entries(grouped, (a, b) => new Date(b) - new Date(a)).map(([dateStr, items]) => (
                        <div key={dateStr} className="relative">
                            {/* Date Sticky Header */}
                            <div className="sticky top-[72px] z-10 py-2 bg-slate-50/95 backdrop-blur-sm mb-4">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm text-xs font-black uppercase tracking-widest text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(dateStr)}
                                </div>
                            </div>

                            <div className="space-y-4 pl-4 border-l-2 border-slate-200 ml-4 relative">
                                {items.map((item, idx) => (
                                    <div key={item.order_id || idx} className="relative group">
                                        {/* Timeline Dot */}
                                        <div className="absolute -left-[23px] top-6 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 bg-emerald-500 ring-4 ring-slate-50"></div>

                                        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group-hover:border-emerald-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-black text-slate-900 text-sm tracking-tight truncate pr-4">
                                                    {item.customer_name}
                                                </h4>
                                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                                    ₹{item.amount}
                                                </span>
                                            </div>

                                            <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {formatTime(item.delivered_at)}
                                            </div>

                                            <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black">
                                                        {item.quantity}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Delivered</span>
                                                </div>

                                                {item.empty_cans_collected > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-black">
                                                            {item.empty_cans_collected}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Returned</span>
                                                    </div>
                                                )}

                                                <div className="ml-auto flex items-center gap-2">
                                                    {item.delivery_photo_url && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(`${api.defaults.baseURL.replace('/api', '')}${item.delivery_photo_url}`, '_blank');
                                                            }}
                                                            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Camera className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${item.payment_status?.includes('paid')
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-rose-50 text-rose-600'
                                                        }`}>
                                                        {item.payment_status?.replace(/_/g, ' ') || 'Unpaid'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Clock({ className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
