import { useState, useEffect, useMemo } from 'react';
import { api } from '../context/AppContext';
import {
    Users, Search, PhoneCall, MessageCircle, MapPin,
    Clock, IndianRupee, AlertCircle, Navigation,
    TrendingUp, ArrowUpDown, ShieldCheck, Crown,
    History, Filter, CheckCircle2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from 'sonner';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Button from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Edit2, Save, X } from 'lucide-react';

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [sortBy, setBy] = useState('active'); // 'active', 'spent', 'due', 'orders'
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, [debouncedSearch]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const params = {};
            if (debouncedSearch) params.search = debouncedSearch;
            const response = await api.get('/customers', { params });
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const sortedCustomers = useMemo(() => {
        const list = [...customers];
        switch (sortBy) {
            case 'spent':
                return list.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
            case 'due':
                return list.sort((a, b) => (b.pending_due || 0) - (a.pending_due || 0));
            case 'orders':
                return list.sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0));
            case 'active':
            default:
                return list.sort((a, b) => new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0));
        }
    }, [customers, sortBy]);

    const stats = useMemo(() => {
        return {
            total: customers.length,
            totalReceivable: customers.reduce((sum, c) => sum + (c.pending_due || 0), 0),
            highDueCount: customers.filter(c => (c.pending_due || 0) > 0).length,
            topSpender: customers.reduce((prev, curr) => (prev.total_spent > curr.total_spent) ? prev : curr, { total_spent: 0 })
        };
    }, [customers]);

    const handleEdit = (customer) => {
        setEditingCustomer({
            phone: customer._id,
            name: customer.name || '',
            address: customer.address || ''
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingCustomer.name.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            setSaving(true);
            await api.put(`/customers/${editingCustomer.phone}`, {
                name: editingCustomer.name,
                address: editingCustomer.address
            });
            toast.success('Customer updated successfully');
            setIsEditDialogOpen(false);
            loadCustomers();
        } catch (error) {
            console.error('Error updating customer:', error);
            toast.error(error.response?.data?.detail || 'Failed to update customer');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Area */}
            <div className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Customers
                            <Badge variant="premium" className="px-3 py-1 text-sm font-black">{customers.length}</Badge>
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">Manage relationships and track order history</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search name or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-slate-900 transition-all w-full shadow-sm font-bold"
                            />
                        </div>
                    </div>
                </div>

                {/* Quick Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4 bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                <Users size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customers</p>
                                <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                                <IndianRupee size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receivables</p>
                                <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.totalReceivable)}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                                <AlertCircle size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Due</p>
                                <p className="text-2xl font-black text-amber-600">{stats.highDueCount} <span className="text-xs font-medium text-slate-400">Users</span></p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md text-amber-400 rounded-2xl flex items-center justify-center">
                                <Crown size={24} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Spender</p>
                                <p className="text-lg font-black truncate">{stats.topSpender.name || '---'}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Sort & Filter Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
                        <Filter size={16} className="text-slate-400 mr-2 flex-shrink-0" />
                        {[
                            { id: 'active', label: 'Recently Active', icon: History },
                            { id: 'spent', label: 'Highest Spent', icon: TrendingUp },
                            { id: 'due', label: 'Highest Due', icon: AlertCircle },
                            { id: 'orders', label: 'Most Orders', icon: ShieldCheck }
                        ].map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setBy(option.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap
                                    ${sortBy === option.id
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                                        : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'}
                                `}
                            >
                                <option.icon size={14} />
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Customer List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-32 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-b-slate-900 mx-auto mb-4"></div>
                        <p className="text-slate-400 font-bold text-lg">Syncing customer records...</p>
                    </div>
                ) : sortedCustomers.length > 0 ? (
                    sortedCustomers.map((customer) => (
                        <Card key={customer._id} noPadding className="overflow-hidden group hover:shadow-2xl transition-all duration-500 border-slate-100 relative">
                            {/* VIP Badge */}
                            {(customer.total_spent > 5000 || customer.total_orders > 10) && (
                                <div className="absolute top-4 right-4 z-10">
                                    <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-sm border border-amber-200">
                                        <Crown size={12} fill="currentColor" /> VIP
                                    </div>
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-[20px] bg-slate-900 flex items-center justify-center text-xl font-black text-white shadow-lg relative shrink-0">
                                        {customer.name?.charAt(0).toUpperCase() || '?'}
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-slate-900">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-black text-slate-900 truncate leading-tight">{customer.name}</h3>
                                            <button
                                                onClick={() => handleEdit(customer)}
                                                className="p-1.5 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm tracking-tight flex items-center gap-1.5 mt-1">
                                            <PhoneCall size={12} className="text-slate-300" />
                                            +91 {customer._id}
                                        </p>
                                    </div>
                                </div>

                                {/* Status Dashboard */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 flex flex-col items-center justify-center text-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Total Spent</div>
                                        <div className="text-base font-black text-slate-900">{formatCurrency(customer.total_spent)}</div>
                                    </div>
                                    <div className={`
                                        rounded-2xl p-3 border flex flex-col items-center justify-center text-center
                                        ${customer.pending_due > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}
                                    `}>
                                        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 leading-none ${customer.pending_due > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                                            {customer.pending_due > 0 ? 'Receivable' : 'Status'}
                                        </div>
                                        <div className={`text-base font-black ${customer.pending_due > 0 ? 'text-rose-600' : 'text-emerald-600 flex items-center gap-1'}`}>
                                            {customer.pending_due > 0 ? formatCurrency(customer.pending_due) : <><CheckCircle2 size={14} /> Clear</>}
                                        </div>
                                    </div>
                                </div>

                                {/* Address Section */}
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group/addr block relative bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:bg-slate-100/80 mb-6"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                            <MapPin size={16} className="text-slate-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</span>
                                                <Navigation size={12} className="text-sky-500 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed line-clamp-2">
                                                {customer.address || "No primary address set"}
                                            </p>
                                        </div>
                                    </div>
                                </a>

                                {/* Footer Stats */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                        <Clock size={12} />
                                        <span>Active {formatDistanceToNow(new Date(customer.last_order_date || 0), { addSuffix: true })}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                                        <ArrowUpDown size={10} /> {customer.total_orders} Orders
                                    </div>
                                </div>
                            </div>

                            {/* Massive Action Buttons */}
                            <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100">
                                <a
                                    href={`tel:${customer._id}`}
                                    className="flex items-center justify-center gap-2 py-4 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                                >
                                    <PhoneCall size={16} fill="currentColor" className="opacity-20" /> Call
                                </a>
                                <a
                                    href={`https://wa.me/91${customer._id.replace(/\D/g, '').slice(-10)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 py-4 text-emerald-600 font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-colors"
                                >
                                    <MessageCircle size={16} fill="currentColor" className="opacity-20" /> WhatsApp
                                </a>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-40 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                            <Users size={40} className="text-slate-200" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">No customers matching your criteria</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto">
                            {searchTerm ? "We couldn't find anyone with that name or phone Number." : "Your customer list will grow automatically as you process orders."}
                        </p>
                        {searchTerm && (
                            <Button
                                variant="secondary"
                                onClick={() => setSearchTerm('')}
                                className="mt-6 rounded-xl font-bold"
                            >
                                Clear Search
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Customer Dialog - Harder, Safer, Prettier */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden border-0 shadow-3xl rounded-[32px] md:rounded-[40px] max-h-[90vh] flex flex-col">
                    <div className="bg-slate-900 p-6 md:p-10 text-white relative overflow-hidden shrink-0">
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-sky-500/20 rounded-full blur-[80px]"></div>
                        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px]"></div>

                        <DialogHeader className="relative z-10">
                            <div className="flex items-center gap-5 mb-4">
                                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-[24px] border border-white/20 flex items-center justify-center shadow-inner">
                                    <Edit2 size={28} className="text-sky-300" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-3xl font-black tracking-tight mb-1">Update Details</DialogTitle>
                                    <DialogDescription className="text-slate-400 font-bold flex items-center gap-1.5 uppercase tracking-widest text-[10px]">
                                        <ShieldCheck size={12} className="text-emerald-500" /> Secure Customer Record
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between mt-6">
                                <span className="text-xs font-bold text-slate-500 uppercase">Customer Line</span>
                                <span className="font-mono text-sky-400 font-bold tracking-widest">+91 {editingCustomer?.phone}</span>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 md:p-10 space-y-6 md:space-y-8 bg-white overflow-y-auto">
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Full Identity</label>
                            <input
                                type="text"
                                value={editingCustomer?.name || ''}
                                onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Abinash J"
                                className="w-full h-14 md:h-16 px-5 md:px-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-black text-lg md:text-xl text-slate-900 placeholder:text-slate-200"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center pl-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Service Location</label>
                                <span className="text-[10px] font-bold text-slate-300">Used for navigation</span>
                            </div>
                            <textarea
                                value={editingCustomer?.address || ''}
                                onChange={(e) => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="House / Flat No, Street, Landmarks..."
                                rows={3}
                                className="w-full px-5 md:px-6 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-bold text-slate-700 resize-none leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter className="px-6 md:px-10 pb-6 md:pb-10 pt-4 md:pt-0 bg-white flex flex-col sm:flex-row gap-3 md:gap-4 shrink-0 mt-auto">
                        <Button
                            variant="secondary"
                            onClick={() => setIsEditDialogOpen(false)}
                            className="h-14 md:h-16 rounded-[20px] md:rounded-[24px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 border-0 order-2 sm:order-1 flex-1"
                        >
                            Dismiss
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="h-14 md:h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-[20px] md:rounded-[24px] font-black shadow-lg shadow-slate-900/10 order-1 sm:order-2 flex-[2] transition-transform active:scale-95"
                        >
                            {saving ? (
                                <RefreshCw className="animate-spin h-6 w-6 mx-auto" />
                            ) : (
                                <div className="flex items-center justify-center gap-2 md:gap-3">
                                    <Save size={18} className="stroke-[3]" />
                                    <span>Sync Record</span>
                                </div>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// RefreshCw icon for the save button
function RefreshCw(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    )
}
