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
    Clock, CheckCircle2, ChevronDown, ChevronUp, Navigation, StickyNote
} from 'lucide-react';

export default function AgentOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('active');
    const [expandedOrder, setExpandedOrder] = useState(null);

    const fetchOrders = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const status = filter === 'delivered' ? 'delivered' : undefined;
            const res = await api.get('/agent/orders', { params: { status } });
            setOrders(res.data.orders || []);
        } catch (err) {
            console.error('Orders fetch error:', err);
            if (!showRefresh) toast.error('Failed to load orders');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filter]);

    useEffect(() => {
        setLoading(true);
        fetchOrders();
        const interval = setInterval(() => fetchOrders(true), 30000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const callCustomer = (phone) => {
        if (phone) window.open(`tel:${phone}`);
    };

    const whatsappCustomer = (phone, name) => {
        if (!phone) return;
        const cleanPhone = phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        const msg = encodeURIComponent(`Hi ${name}, your water can delivery is on the way! 🚰`);
        window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
    };

    const openMaps = (address) => {
        if (!address) return;
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    };

    const markDelivered = (orderId) => {
        navigate(`/agent/complete?orderId=${orderId}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium text-sm">Loading orders...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Order Queue
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                        My Tasks
                    </h1>
                </div>
                <button
                    onClick={() => fetchOrders(true)}
                    disabled={refreshing}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-90"
                >
                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl backdrop-blur-sm sticky top-0 z-20 shadow-sm border border-white/50">
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
            {orders.length === 0 ? (
                <div className="bg-white rounded-[32px] border border-slate-100 p-10 text-center shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                        <Package className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="font-black text-slate-900 text-lg mb-1">No Orders Found</h3>
                    <p className="text-slate-400 text-sm font-medium">
                        {filter === 'active' ? 'You have no pending deliveries.' : 'No completed deliveries yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const isExpanded = expandedOrder === order.order_id;
                        const hasNotes = order.customer_notes || order.delivery_instructions || order.notes;

                        return (
                            <div
                                key={order.order_id}
                                className={`bg-white rounded-[28px] border transition-all overflow-hidden ${isExpanded
                                    ? 'border-blue-200 shadow-xl shadow-blue-500/10 scale-[1.01]'
                                    : 'border-slate-100 shadow-sm hover:border-blue-100 hover:shadow-md'}`}
                            >
                                {/* Order Header — tap to expand */}
                                <button
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.order_id)}
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
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600'
                                                    : order.status === 'assigned' ? 'bg-blue-50 text-blue-600'
                                                        : order.status === 'out_for_delivery' ? 'bg-amber-50 text-amber-600'
                                                            : 'bg-slate-50 text-slate-500'
                                                }`}>
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                                        </div>

                                        <h3 className="font-black text-slate-900 text-base truncate mb-0.5">
                                            {order.customer_name}
                                        </h3>
                                        <p className="text-slate-400 text-xs font-medium truncate">
                                            #{order.order_id.slice(-6)} · <span className="text-slate-600 font-bold">{order.quantity}× {order.litre_size}L</span>
                                        </p>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-5 pb-6 space-y-5 animate-in slide-in-from-top-2 duration-300">
                                        {/* Divider */}
                                        <div className="h-px w-full bg-slate-50"></div>

                                        {/* Order Stats Grid */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Quantity</p>
                                                <p className="font-black text-slate-900 text-lg leading-none">{order.quantity}</p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-1">{order.litre_size}L Cans</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total</p>
                                                <p className="font-black text-emerald-600 text-lg leading-none">₹{order.amount}</p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-1">To Collect</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                                <p className={`font-black text-lg leading-none ${order.payment_status?.includes('paid') ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {order.payment_status?.includes('paid') ? 'PAID' : 'DUE'}
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
                                                        {order.delivery_instructions || order.customer_notes || order.notes}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Address with Maps link */}
                                        {order.customer_address && (
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
                                        {order.customer_phone && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => callCustomer(order.customer_phone)}
                                                    className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all active:scale-[0.98]"
                                                >
                                                    <Phone className="w-4 h-4" />
                                                    Call Customer
                                                </button>
                                                <button
                                                    onClick={() => whatsappCustomer(order.customer_phone, order.customer_name)}
                                                    className="flex items-center justify-center gap-2 py-3.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] font-bold text-xs rounded-2xl transition-all active:scale-[0.98]"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    WhatsApp
                                                </button>
                                            </div>
                                        )}

                                        {/* Mark Delivered Button (only for active orders) */}
                                        {filter === 'active' && order.status !== 'delivered' && (
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => markDelivered(order.order_id)}
                                                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm relative overflow-hidden group"
                                                >
                                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                                    <CheckCircle2 className="w-5 h-5 relative z-10" />
                                                    <span className="relative z-10">Complete Delivery</span>
                                                </button>
                                            </div>
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
