/**
 * AgentOrders - Order queue for delivery agents
 * Shows assigned orders with real-time refresh, navigation links, and quick actions
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    Package, RefreshCw, Droplets, MapPin, Phone, MessageCircle,
    Clock, CheckCircle2, ChevronDown, ChevronUp, Navigation, StickyNote,
    ArrowRight
} from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SoundService } from '../../utils/SoundService';

export default function AgentOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('active');
    const [expandedOrder, setExpandedOrder] = useState(null);

    const { on, isConnected } = useWebSocket();

    const fetchOrders = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const status = filter === 'active' ? undefined : 'delivered';
            const res = await api.get('/agent/orders', { params: { status } });
            setOrders(res.data.orders || []);
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter]);

    useEffect(() => {
        setLoading(true);
        fetchOrders();
        // Polling removed in favor of WebSockets
    }, [fetchOrders]);

    // Real-time WebSocket updates
    useEffect(() => {
        const cleanups = [
            on('new_order', (data) => {
                SoundService.playWaterDrop();
                // Backend scopes events, so if we receive it, it's relevant
                toast.info(`New delivery assigned!`, {
                    description: `${data.customer_name} - ${data.quantity} cans`
                });
                fetchOrders(true);
            }),
            on('order_delivered', (data) => {
                // If an order is delivered (could be by this agent on another device or cancelled by vendor)
                fetchOrders(true);
            }),
            on('payment_update', () => fetchOrders(true))
        ];
        return () => cleanups.forEach(fn => fn());
    }, [on, fetchOrders]);

    const openMaps = (address) => {
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    };

    const callCustomer = (phone) => {
        window.open(`tel:${phone}`, '_self');
    };

    const whatsappCustomer = (phone, name) => {
        const msg = encodeURIComponent(`Hi ${name}, I'm from Thanni Canuuu. I'm arriving with your water delivery.`);
        window.open(`https://wa.me/${phone.replace(/\+/g, '')}?text=${msg}`, '_blank');
    };

    const markDelivered = (orderId) => {
        navigate(`/agent/complete?orderId=${orderId}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Header */}
            <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Your Queue</h1>
                    {isConnected && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-100">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1" />
                            Live
                        </span>
                    )}
                </div>
                <button
                    onClick={() => fetchOrders(true)}
                    disabled={refreshing}
                    className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-500 shadow-sm transition-all active:rotate-180"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                    onClick={() => setFilter('active')}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${filter === 'active'
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    <Package className={`w-4 h-4 ${filter === 'active' ? 'text-blue-500' : ''}`} />
                    Active
                </button>
                <button
                    onClick={() => setFilter('delivered')}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${filter === 'delivered'
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    <CheckCircle2 className={`w-4 h-4 ${filter === 'delivered' ? 'text-emerald-500' : ''}`} />
                    Delivered
                </button>
            </div>

            {/* Orders List */}
            {orders.filter(o => filter === 'active' ? o.status !== 'delivered' : o.status === 'delivered').length === 0 ? (
                <div className="bg-white rounded-[40px] border border-slate-100 p-12 text-center shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                        <Package className="w-12 h-12 text-slate-200" />
                    </div>
                    <h3 className="font-black text-slate-900 text-xl mb-2">
                        {filter === 'active' ? 'Queue is Empty' : 'No History'}
                    </h3>
                    <p className="text-slate-400 text-sm font-medium max-w-[200px] mx-auto leading-relaxed">
                        {filter === 'active'
                            ? 'You have no pending deliveries at the moment.'
                            : 'Orders you deliver today will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders
                        .filter(o => filter === 'active' ? o.status !== 'delivered' : o.status === 'delivered')
                        .map((order) => {
                            const isExpanded = expandedOrder === order?.order_id;
                            const hasNotes = order?.customer_notes || order?.delivery_instructions || order?.notes;

                            return (
                                <div
                                    key={order?.order_id || Math.random()}
                                    className={`bg-white rounded-[32px] border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-xl shadow-blue-500/10 ring-1 ring-blue-50' : 'border-slate-100 shadow-sm'
                                        }`}
                                >
                                    <button
                                        onClick={() => setExpandedOrder(isExpanded ? null : order?.order_id)}
                                        className="w-full p-5 flex items-start text-left gap-4"
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${isExpanded
                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-blue-50 text-blue-500'
                                            }`}>
                                            <Droplets className="w-6 h-6" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${order?.status === 'delivered' ? 'bg-emerald-50 text-emerald-600'
                                                    : order?.status === 'assigned' ? 'bg-blue-50 text-blue-600'
                                                        : order?.status === 'out_for_delivery' ? 'bg-amber-50 text-amber-600'
                                                            : 'bg-slate-50 text-slate-500'
                                                    }`}>
                                                    {(order?.status || 'pending').replace(/_/g, ' ')}
                                                </span>
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                                            </div>

                                            <h3 className="font-black text-slate-900 text-base truncate mb-0.5">
                                                {order?.customer_name || 'Customer'}
                                            </h3>
                                            <p className="text-slate-400 text-xs font-medium truncate">
                                                #{order?.order_id?.slice(-6) || 'XXXXXX'} · {order?.created_at ? new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' : ''} <span className="text-slate-600 font-bold">{order?.quantity || 0}× {order?.litre_size || 20}L</span>
                                            </p>
                                        </div>
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-5 pb-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
                                            {/* Quick Info Grid */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Qty</p>
                                                    <p className="font-black text-slate-900 text-lg leading-none">{order?.quantity || 0}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 mt-1">{order?.litre_size || 20}L Cans</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total</p>
                                                    <p className="font-black text-emerald-600 text-lg leading-none">₹{order?.amount || 0}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 mt-1">To Collect</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                                    <p className={`font-black text-lg leading-none ${order?.payment_status?.includes('paid') ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {order?.payment_status?.includes('paid') ? 'PAID' : 'DUE'}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-500 mt-1">Payment</p>
                                                </div>
                                            </div>

                                            {/* Customer Notes / Delivery Instructions */}
                                            {hasNotes && (
                                                <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-4 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                                                    <div className="relative z-10">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <StickyNote className="w-4 h-4 text-amber-500" />
                                                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Instructions</span>
                                                        </div>
                                                        <p className="text-xs font-medium text-amber-900 leading-relaxed">
                                                            {order?.delivery_instructions || order?.customer_notes || order?.notes}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Address with Maps link */}
                                            {order?.customer_address && (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Delivery Location</label>
                                                    <button
                                                        onClick={() => openMaps(order.customer_address)}
                                                        className="w-full flex items-start gap-3 text-left bg-white border-2 border-slate-100 rounded-2xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all active:scale-[0.98] group"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                            <Navigation className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 leading-tight mb-1">{order.customer_address}</p>
                                                            <p className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                                                                TAP TO NAVIGATE <ArrowRight className="w-3 h-3" />
                                                            </p>
                                                        </div>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Contact Buttons */}
                                            {order?.customer_phone && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => callCustomer(order.customer_phone)}
                                                        className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all active:scale-[0.98]"
                                                    >
                                                        <Phone className="w-4 h-4" /> Call
                                                    </button>
                                                    <button
                                                        onClick={() => whatsappCustomer(order.customer_phone, order.customer_name)}
                                                        className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-bold text-xs rounded-2xl transition-all active:scale-[0.98]"
                                                    >
                                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                                    </button>
                                                </div>
                                            )}

                                            {/* Status Action */}
                                            {filter === 'active' && (
                                                <button
                                                    onClick={() => markDelivered(order.order_id)}
                                                    className="w-full py-4 bg-slate-900 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                                >
                                                    Mark as Delivered
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
