/**
 * AgentCompleteOrder - Premium delivery completion workflow
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    CheckCircle2, Package, Droplets, CreditCard, Banknote, XCircle,
    Loader2, ArrowLeft, ChevronRight, Camera, ImagePlus, X, MapPin, Truck, ArrowRight
} from 'lucide-react';

export default function AgentCompleteOrder() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [paymentType, setPaymentType] = useState('');
    const [emptyCans, setEmptyCans] = useState(0);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const fetchActiveOrders = useCallback(async () => {
        try {
            const res = await api.get('/agent/orders');
            const orderList = (res.data.orders || []).filter(o =>
                o.status === 'assigned' || o.status === 'out_for_delivery' || o.status === 'pending' || o.status === 'in_queue'
            );
            setOrders(orderList);

            // Auto-select order if orderId query param is present
            const preSelectId = searchParams.get('orderId');
            if (preSelectId) {
                const match = orderList.find(o => o.order_id === preSelectId);
                if (match) setSelectedOrder(match);
            }
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchActiveOrders();
    }, [fetchActiveOrders]);

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Photo must be under 10MB');
            return;
        }
        setPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleComplete = async () => {
        if (!selectedOrder) { toast.error('Select an order first'); return; }
        if (!paymentType) { toast.error('Select payment type'); return; }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('order_id', selectedOrder.order_id);
            formData.append('payment_type', paymentType);
            formData.append('empty_cans_collected', emptyCans);
            if (notes) formData.append('notes', notes);
            if (photo) formData.append('photo', photo);

            const res = await api.post('/agent/complete-order', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(res.data.message || 'Delivery completed!');

            // Reset and go back
            setSelectedOrder(null);
            setPaymentType('');
            setEmptyCans(0);
            setNotes('');
            removePhoto();
            navigate('/agent/dashboard'); // Go back to dashboard after completion
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to complete order');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Step 1: Select Order List
    if (!selectedOrder) {
        return (
            <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 pt-4">
                    <button
                        onClick={() => navigate('/agent/dashboard')}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Select Order</h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Which order are you delivering?</p>
                    </div>
                </div>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-[32px] border border-slate-100 p-10 text-center shadow-sm mt-8">
                        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="font-black text-slate-900 text-xl mb-2">All Clear!</h3>
                        <p className="text-slate-400 font-medium">No pending orders to deliver.</p>
                        <button
                            onClick={() => navigate('/agent/dashboard')}
                            className="mt-6 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {orders.map((order) => (
                            <button
                                key={order.order_id}
                                onClick={() => setSelectedOrder(order)}
                                className="group w-full bg-white rounded-[28px] p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all active:scale-[0.98] text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Package className="w-24 h-24 text-emerald-500 -rotate-12" />
                                </div>

                                <div className="relative z-10 flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center border border-emerald-100 flex-shrink-0 shadow-sm">
                                        <Truck className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-black text-slate-900 text-lg tracking-tight truncate pr-2">
                                                {order.customer_name}
                                            </h3>
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                ₹{order.amount}
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-slate-500 text-xs font-bold flex items-center gap-1.5 align-middle">
                                                <MapPin className="w-3 h-3" /> {order.customer_address || 'No address'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                                    {order.quantity} × {order.litre_size}L
                                                </span>
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${order.status === 'out_for_delivery' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="self-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Step 2: Completion Form
    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 pt-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20 py-2 border-b border-white/50">
                <button
                    onClick={() => { setSelectedOrder(null); removePhoto(); }}
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Confirm Delivery</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">Order #{selectedOrder.order_id.slice(-6)}</p>
                </div>
            </div>

            {/* Order Summary Card */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-lg shadow-slate-900/20">
                        <span className="text-xl font-black leading-none">{selectedOrder.quantity}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Cans</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 leading-tight mb-1">{selectedOrder.customer_name}</h2>
                        <p className="text-slate-500 text-sm font-medium leading-snug">{selectedOrder.customer_address}</p>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                                ₹{selectedOrder.amount} Total
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Collection Method */}
            <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Payment Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <PaymentOption
                        id="cash"
                        label="Cash Collected"
                        icon={Banknote}
                        color="emerald"
                        selected={paymentType}
                        onSelect={setPaymentType}
                    />
                    <PaymentOption
                        id="upi"
                        label="Paid via UPI"
                        icon={CreditCard}
                        color="blue"
                        selected={paymentType}
                        onSelect={setPaymentType}
                    />
                    <PaymentOption
                        id="not_paid"
                        label="Pay Later / Due"
                        icon={XCircle}
                        color="amber"
                        selected={paymentType}
                        onSelect={setPaymentType}
                    />
                </div>
            </div>

            {/* Empty Cans Counter */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Empty Cans Returned</label>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">Inventory</span>
                </div>

                <div className="bg-white rounded-[28px] p-2 border border-slate-100 shadow-sm flex items-center justify-between">
                    <button
                        onClick={() => setEmptyCans(Math.max(0, emptyCans - 1))}
                        className="w-16 h-16 rounded-[20px] bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95"
                    >
                        <span className="text-3xl font-light mb-1">-</span>
                    </button>

                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-black text-slate-900 tracking-tighter">{emptyCans}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CANS</span>
                    </div>

                    <button
                        onClick={() => setEmptyCans(emptyCans + 1)}
                        className="w-16 h-16 rounded-[20px] bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95"
                    >
                        <span className="text-3xl font-light mb-1">+</span>
                    </button>
                </div>
            </div>

            {/* Photo Proof */}
            <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 flex justify-between">
                    <span>Photo Proof</span>
                    <span className="text-slate-300 font-bold">OPTIONAL</span>
                </label>

                {photoPreview ? (
                    <div className="relative rounded-[24px] overflow-hidden border-4 border-white shadow-md group">
                        <img
                            src={photoPreview}
                            alt="Proof"
                            className="w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                        <button
                            onClick={removePhoto}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-900">Photo Attached</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            className="h-24 rounded-[24px] border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                                <Camera className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 group-hover:text-emerald-700">Camera</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="h-24 rounded-[24px] border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                                <ImagePlus className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 group-hover:text-blue-700">Gallery</span>
                        </button>
                    </div>
                )}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </div>

            {/* Submit Button Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
                <button
                    onClick={handleComplete}
                    disabled={submitting || !paymentType}
                    className="w-full h-14 bg-slate-900 text-white font-bold text-lg rounded-[20px] shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
                >
                    {submitting ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <span>Complete Delivery</span>
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function PaymentOption({ id, label, icon: Icon, color, selected, onSelect }) {
    const isSelected = selected === id;

    const colors = {
        emerald: isSelected ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 border-emerald-600' : 'hover:border-emerald-200 hover:bg-emerald-50',
        blue: isSelected ? 'bg-blue-500 text-white ring-4 ring-blue-500/20 border-blue-600' : 'hover:border-blue-200 hover:bg-blue-50',
        amber: isSelected ? 'bg-amber-500 text-white ring-4 ring-amber-500/20 border-amber-600' : 'hover:border-amber-200 hover:bg-amber-50',
    };

    return (
        <button
            onClick={() => onSelect(id)}
            className={`relative p-4 rounded-[24px] border-2 transition-all duration-300 flex flex-col items-center gap-3 w-full h-28 justify-center active:scale-95 ${isSelected ? 'border-transparent shadow-lg transform scale-[1.02]' : 'border-slate-100 bg-white text-slate-500'
                } ${colors[color]}`}
        >
            {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <CheckCircle2 className={`w-3.5 h-3.5 text-${color}-600`} />
                </div>
            )}

            <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
            <span className={`text-xs font-black uppercase tracking-wide ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                {label}
            </span>
        </button>
    );
}
