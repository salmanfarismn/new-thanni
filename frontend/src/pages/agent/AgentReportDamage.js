/**
 * AgentReportDamage - Premium damage reporting workflow
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    AlertTriangle, Package, Loader2, CheckCircle2,
    Droplets, RotateCcw, Camera, X, ImagePlus, ArrowLeft, ArrowRight
} from 'lucide-react';

export default function AgentReportDamage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        order_id: '',
        damaged_qty: 0,
        returned_qty: 0,
        reason: 'other',
        notes: '',
        litre_size: 20
    });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [reportId, setReportId] = useState('');
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await api.get('/agent/orders', { params: { status: 'delivered' } });
                setOrders(res.data.orders || []);
            } catch (err) { /* ignore */ }
            setLoading(false);
        };
        fetchOrders();
    }, []);

    const reasons = [
        { value: 'broken', label: 'Broken/Cracked', color: 'rose' },
        { value: 'leaked', label: 'Leaked', color: 'blue' },
        { value: 'contaminated', label: 'Dirty/Contaminated', color: 'amber' },
        { value: 'customer_return', label: 'Customer Return', color: 'slate' },
    ];

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 10MB)
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

    const handleSubmit = async () => {
        if (form.damaged_qty === 0 && form.returned_qty === 0) {
            toast.error('Enter at least damaged or returned quantity');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('damaged_qty', form.damaged_qty);
            formData.append('returned_qty', form.returned_qty);
            formData.append('reason', form.reason);
            formData.append('litre_size', form.litre_size);
            if (form.order_id) formData.append('order_id', form.order_id);
            if (form.notes) formData.append('notes', form.notes);
            if (photo) formData.append('photo', photo);

            const res = await api.post('/agent/report-damage', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setReportId(res.data.report_id);
            setSubmitted(true);
            toast.success('Damage report filed successfully');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to submit report');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setForm({ order_id: '', damaged_qty: 0, returned_qty: 0, reason: 'other', notes: '', litre_size: 20 });
        setPhoto(null);
        setPhotoPreview(null);
        setSubmitted(false);
        setReportId('');
    };

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6 px-6 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center relative shadow-xl shadow-emerald-500/30">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Report Filed!</h2>
                    <p className="text-slate-500 font-medium">Tracking ID: <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded-lg text-slate-700">{reportId}</span></p>
                </div>

                <div className="w-full max-w-sm space-y-3 pt-6">
                    <button
                        onClick={() => navigate('/agent/dashboard')}
                        className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                        Back to Dashboard
                    </button>
                    <button
                        onClick={resetForm}
                        className="w-full h-14 bg-white text-slate-900 font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                        File Another Report
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 pt-4 pb-4 border-b border-slate-100 px-2">
                <button
                    onClick={() => navigate('/agent/dashboard')}
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none text-red-600">Report Issue</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">Damaged or Returned Stock</p>
                </div>
            </div>

            {/* Related Order Selector */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Associated Order (Optional)</label>
                <div className="relative">
                    <select
                        value={form.order_id}
                        onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                        className="w-full h-14 pl-4 pr-10 bg-white rounded-[20px] border-2 border-slate-100 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                    >
                        <option value="">-- No specific order --</option>
                        {orders.map(o => (
                            <option key={o.order_id} value={o.order_id}>
                                {o.customer_name} • #{o.order_id.slice(-6)}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                </div>
            </div>

            {/* Reason Grid */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Issue Reason</label>
                <div className="grid grid-cols-2 gap-3">
                    {reasons.map(r => (
                        <button
                            key={r.value}
                            onClick={() => setForm({ ...form, reason: r.value })}
                            className={`h-24 p-3 rounded-[24px] border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 text-center ${form.reason === r.value
                                ? `bg-${r.color}-500 text-white border-${r.color}-600 shadow-lg shadow-${r.color}-500/20`
                                : `bg-white border-slate-100 text-slate-400 hover:border-${r.color}-200 hover:bg-${r.color}-50`
                                }`}
                        >
                            {form.reason === r.value && (
                                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <span className="text-sm font-black leading-tight">{r.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Can Size Toggle */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Can Size</label>
                <div className="bg-white p-1 rounded-[20px] flex border border-slate-100 shadow-sm">
                    {[20, 25].map(size => (
                        <button
                            key={size}
                            onClick={() => setForm({ ...form, litre_size: size })}
                            className={`flex-1 py-3 rounded-[16px] text-sm font-black transition-all ${form.litre_size === size
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {size} Litre
                        </button>
                    ))}
                </div>
            </div>

            {/* Quantity Inputs */}
            <div className="grid grid-cols-2 gap-4 bg-slate-100/50 p-4 rounded-[32px]">
                <div className="space-y-2">
                    <label className="text-xs font-black text-rose-500 uppercase tracking-widest pl-1">Damaged</label>
                    <div className="bg-white rounded-[24px] p-2 flex flex-col items-center border border-rose-100 shadow-sm">
                        <button onClick={() => setForm({ ...form, damaged_qty: Math.max(0, form.damaged_qty - 1) })} className="w-full py-2 hover:bg-slate-50 text-slate-400 rounded-[16px] transition-colors">-</button>
                        <span className="text-3xl font-black text-rose-600 my-2">{form.damaged_qty}</span>
                        <button onClick={() => setForm({ ...form, damaged_qty: form.damaged_qty + 1 })} className="w-full py-2 bg-rose-50 text-rose-600 rounded-[16px] hover:bg-rose-100 transition-colors">+</button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-blue-500 uppercase tracking-widest pl-1">Returned</label>
                    <div className="bg-white rounded-[24px] p-2 flex flex-col items-center border border-blue-100 shadow-sm">
                        <button onClick={() => setForm({ ...form, returned_qty: Math.max(0, form.returned_qty - 1) })} className="w-full py-2 hover:bg-slate-50 text-slate-400 rounded-[16px] transition-colors">-</button>
                        <span className="text-3xl font-black text-blue-600 my-2">{form.returned_qty}</span>
                        <button onClick={() => setForm({ ...form, returned_qty: form.returned_qty + 1 })} className="w-full py-2 bg-blue-50 text-blue-600 rounded-[16px] hover:bg-blue-100 transition-colors">+</button>
                    </div>
                </div>
            </div>

            {/* Photo Proof */}
            <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Evidence Photo</label>

                {photoPreview ? (
                    <div className="relative rounded-[24px] overflow-hidden border-4 border-white shadow-md group h-48">
                        <img
                            src={photoPreview}
                            alt="Proof"
                            className="w-full h-full object-cover"
                        />
                        <button
                            onClick={removePhoto}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-rose-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full h-32 rounded-[24px] border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] group bg-slate-50"
                    >
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 group-hover:text-emerald-700">Tap to take photo</span>
                    </button>
                )}

                {/* Hidden Inputs */}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />

                {/* Gallery Option (small text link) */}
                {!photoPreview && (
                    <div className="text-center">
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-slate-400 hover:text-slate-600 underline decoration-slate-300 underline-offset-4">
                            Or upload from gallery
                        </button>
                    </div>
                )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Additional Notes</label>
                <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="w-full bg-white rounded-[24px] border border-slate-100 p-4 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-slate-100 focus:border-slate-300 resize-none shadow-sm"
                    maxLength={500}
                />
            </div>

            {/* Sticky Submit Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
                <button
                    onClick={handleSubmit}
                    disabled={submitting || (form.damaged_qty === 0 && form.returned_qty === 0)}
                    className="w-full h-14 bg-rose-600 disabled:bg-slate-300 text-white font-bold text-lg rounded-[20px] shadow-xl shadow-rose-500/20 disabled:shadow-none flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
                >
                    {submitting ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <AlertTriangle className="w-5 h-5" />
                            <span>Submit Report</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
