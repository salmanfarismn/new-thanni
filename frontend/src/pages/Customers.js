import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Users, Search, PhoneCall, MessageCircle, MapPin, Clock, IndianRupee, AlertCircle } from 'lucide-react';
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
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, [searchTerm]); // Reload when search changes (debouncing would be better but KISS)

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const params = {};
            if (searchTerm) params.search = searchTerm;
            const response = await api.get('/customers', { params });
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

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
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sticky top-0 bg-slate-50/95 backdrop-blur-md z-30 py-4 -mx-4 px-4 sm:static sm:bg-transparent sm:py-0 sm:px-0">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Customers
                        <span className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-full">{customers.length}</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Your customer base from order history</p>
                </div>

                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all w-full sm:w-72 shadow-sm font-bold"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-300 mx-auto mb-4"></div>
                        <p className="text-slate-400 font-medium">Loading customers...</p>
                    </div>
                ) : customers.length > 0 ? (
                    customers.map((customer) => (
                        <Card key={customer._id} noPadding className="overflow-hidden group hover:shadow-lg transition-all duration-300">
                            <div className="p-6 pb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-50 text-sky-600 flex items-center justify-center text-lg font-black border border-sky-100 shadow-sm">
                                        {customer.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <button
                                            onClick={() => handleEdit(customer)}
                                            className="p-2 -mt-2 -mr-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all"
                                            title="Edit Customer"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <div className="mt-1">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Spent</div>
                                            <div className="text-lg font-black text-slate-900">{formatCurrency(customer.total_spent)}</div>
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 mb-1 truncate">{customer.name}</h3>
                                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-4">
                                    <PhoneCall size={14} /> {customer._id}
                                </div>

                                <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 min-h-[60px]">
                                    <MapPin size={16} className="mt-0.5 text-slate-400 flex-shrink-0" />
                                    <span className="line-clamp-2">{customer.address || "Address not provided"}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Orders</div>
                                        <div className="font-black text-slate-900 text-lg">{customer.total_orders}</div>
                                    </div>
                                    <div className={`bg-slate-50 rounded-xl p-2 border ${customer.pending_due > 0 ? 'border-red-100 bg-red-50' : 'border-slate-100'}`}>
                                        <div className={`text-xs font-bold uppercase tracking-widest ${customer.pending_due > 0 ? 'text-red-400' : 'text-slate-400'}`}>Due</div>
                                        <div className={`font-black text-lg ${customer.pending_due > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                            {customer.pending_due > 0 ? formatCurrency(customer.pending_due) : '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100">
                                <a
                                    href={`tel:${customer._id}`}
                                    className="flex items-center justify-center gap-2 py-3 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    <PhoneCall size={16} /> Call
                                </a>
                                <a
                                    href={`https://wa.me/91${customer._id.replace(/\D/g, '').slice(-10)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-colors"
                                >
                                    <MessageCircle size={16} /> Chat
                                </a>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Users size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No customers found</h3>
                        <p className="text-slate-500">
                            {searchTerm ? "Try adjusting your search" : "Customers will appear here once they place an order"}
                        </p>
                    </div>
                )}
            </div>
            {/* Edit Customer Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-0 shadow-2xl rounded-[32px]">
                    <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <DialogHeader>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <Edit2 size={24} className="text-sky-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black tracking-tight">Edit Customer</DialogTitle>
                                    <DialogDescription className="text-slate-400 font-medium">
                                        Update details for +91 {editingCustomer?.phone}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-8 space-y-6 bg-white text-slate-900">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Customer Name</label>
                            <input
                                type="text"
                                value={editingCustomer?.name || ''}
                                onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter full name"
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-900"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Primary Address</label>
                            <textarea
                                value={editingCustomer?.address || ''}
                                onChange={(e) => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Enter detailed address (House no, Street, Landmark)"
                                rows={3}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-900 resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsEditDialogOpen(false)}
                            className="flex-1 h-14 rounded-2xl font-black text-slate-500"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black shadow-lg shadow-slate-900/20"
                        >
                            {saving ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <Save size={20} />
                                    <span>Save Changes</span>
                                </div>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
