import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Users, Plus, Trash2, Power, Phone, User, AlertCircle, Truck, Search, ShieldCheck, PhoneCall, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import Button from '../components/ui/button';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';

export default function DeliveryAgents({ minimal = false }) {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone_number: '' });
    const [formError, setFormError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            const response = await api.get('/delivery-staff');
            setStaff(response.data);
        } catch (error) {
            console.error('Error loading delivery staff:', error);
            toast.error('Failed to load delivery agents');
        } finally {
            setLoading(false);
        }
    };

    const generateStaffId = () => {
        return `DA${Date.now().toString().slice(-8)}`; // DA for Delivery Agent
    };

    const validatePhoneNumber = (phone) => {
        const cleaned = phone.replace(/[\s\-\+]/g, '');
        return /^\d{10,15}$/.test(cleaned);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.name.trim()) {
            setFormError('Name is required');
            return;
        }

        if (!validatePhoneNumber(formData.phone_number)) {
            setFormError('Please enter a valid phone number (10-15 digits)');
            return;
        }

        try {
            setSaving(true);
            await api.post('/delivery-staff', {
                staff_id: generateStaffId(),
                name: formData.name.trim(),
                phone_number: formData.phone_number.trim(),
                active_orders_count: 0,
                is_active: true
            });

            toast.success('Delivery agent added successfully!');
            setFormData({ name: '', phone_number: '' });
            setShowForm(false);
            loadStaff();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Failed to add delivery agent';
            setFormError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (staffId, currentStatus, name) => {
        try {
            await api.put(`/delivery-staff/${staffId}?is_active=${!currentStatus}`);
            toast.success(`${name} is now ${!currentStatus ? 'Active' : 'Inactive'}`);
            loadStaff();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update status');
        }
    };

    const deleteStaff = async (staffId, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            return;
        }

        try {
            await api.delete(`/delivery-staff/${staffId}`);
            toast.success('Agent removed successfully');
            loadStaff();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete agent');
        }
    };

    const filteredStaff = staff.filter(person =>
        person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.phone_number.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
                <p className="text-slate-500 font-medium">Loading agents...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sticky top-0 bg-slate-50/95 backdrop-blur-md z-30 py-4 -mx-4 px-4 sm:static sm:bg-transparent sm:py-0 sm:px-0">
                {!minimal && (
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Team
                            <span className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-full">{staff.length}</span>
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">Manage your delivery fleet</p>
                    </div>
                )}

                <div className={`flex gap-3 ${minimal ? 'w-full justify-between md:justify-end' : ''}`}>
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all w-full sm:w-64 shadow-sm"
                        />
                    </div>
                    <Button
                        onClick={() => setShowForm(true)}
                        className="bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-200 px-6"
                    >
                        <Plus size={18} className="mr-2" />
                        Add
                    </Button>
                </div>
            </div>

            {/* Add Agent Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="sm:max-w-[425px] w-[95vw] rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900">New Agent</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 mt-2">
                        {formError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                                <AlertCircle size={18} />
                                {formError}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Jane Doe"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="tel"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    placeholder="9876543210"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all font-bold"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white flex-1">{saving ? 'Saving...' : 'Create Agent'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Note Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="text-sky-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">System Note:</span> Only <strong>Active</strong> agents will receive automated order notifications. Make sure to update the <strong>Shifts</strong> page to assign them to specific time slots.
                </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.length > 0 ? (
                    filteredStaff.map((person) => (
                        <Card
                            key={person.staff_id}
                            noPadding
                            className={`overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${person.is_active !== false ? 'border-slate-200' : 'border-slate-100 opacity-75'
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${person.is_active !== false
                                        ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-sky-200'
                                        : 'bg-slate-100 text-slate-300'
                                        }`}>
                                        {person.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button
                                            onClick={() => toggleStatus(person.staff_id, person.is_active !== false, person.name)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${person.is_active !== false ? 'bg-emerald-500' : 'bg-slate-200'
                                                }`}
                                            title={person.is_active !== false ? 'Deactivate Agent' : 'Activate Agent'}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${person.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${person.is_active !== false ? 'text-emerald-500' : 'text-slate-400'
                                            }`}>
                                            {person.is_active !== false ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 truncate mb-1">{person.name}</h3>

                                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-4">
                                    <Phone size={14} />
                                    {person.phone_number}
                                </div>

                                {/* Call Actions */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <a href={`tel:${person.phone_number}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors">
                                        <PhoneCall size={16} /> Call
                                    </a>
                                    <a href={`https://wa.me/${person.phone_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm hover:bg-emerald-100 transition-colors">
                                        <MessageCircle size={16} /> Chat
                                    </a>
                                </div>

                                {person.active_orders_count > 0 && (
                                    <div className="mb-6 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                        <Truck size={12} className="mr-1.5" />
                                        {person.active_orders_count} Active Delivery
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-xs font-mono text-slate-400">
                                    {person.staff_id}
                                </div>
                                <button
                                    onClick={() => deleteStaff(person.staff_id, person.name)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg group"
                                    title="Delete Agent"
                                >
                                    <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Users size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No agents found</h3>
                        <p className="text-slate-500 mb-6">
                            {searchTerm ? 'Try adjusting your search terms' : 'Add your first delivery agent to get started'}
                        </p>
                        {searchTerm && (
                            <Button variant="ghost" onClick={() => setSearchTerm('')} className="text-sky-600">
                                Clear Search
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
