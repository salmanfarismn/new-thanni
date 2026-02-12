import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Users, Plus, Trash2, Power, Phone, User, AlertCircle, Truck, Search, ShieldCheck, PhoneCall, MessageCircle, KeyRound, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
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
    const [formData, setFormData] = useState({ name: '', phone_number: '', pin: '' });
    const [formError, setFormError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // PIN Reset state
    const [resetPinDialog, setResetPinDialog] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);
    const [newPin, setNewPin] = useState('');
    const [showNewPin, setShowNewPin] = useState(false);
    const [resettingPin, setResettingPin] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

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

    const generatePin = () => {
        return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit random PIN
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

        if (formData.pin && (formData.pin.length < 4 || formData.pin.length > 6 || !/^\d+$/.test(formData.pin))) {
            setFormError('PIN must be 4-6 digits');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                staff_id: generateStaffId(),
                name: formData.name.trim(),
                phone_number: formData.phone_number.trim(),
                active_orders_count: 0,
                is_active: true
            };

            // Include PIN if provided
            if (formData.pin) {
                payload.pin = formData.pin;
            }

            await api.post('/delivery-staff', payload);

            toast.success('Delivery agent added successfully!');
            if (formData.pin) {
                toast.info(`Login PIN for ${formData.name}: ${formData.pin}`, { duration: 10000 });
            }
            setFormData({ name: '', phone_number: '', pin: '' });
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

    const openResetPin = (person) => {
        setResetTarget(person);
        setNewPin('');
        setShowNewPin(false);
        setResetPinDialog(true);
    };

    const handleResetPin = async () => {
        if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
            toast.error('PIN must be 4-6 digits');
            return;
        }
        setResettingPin(true);
        try {
            await api.put(`/delivery-staff/${resetTarget.staff_id}/reset-pin?new_pin=${newPin}`);
            toast.success(`PIN updated for ${resetTarget.name}`);
            toast.info(`New PIN: ${newPin}`, { duration: 8000 });
            setResetPinDialog(false);
            setResetTarget(null);
            setNewPin('');
            loadStaff();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reset PIN');
        } finally {
            setResettingPin(false);
        }
    };

    const copyToClipboard = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            toast.success('Copied to clipboard');
            setTimeout(() => setCopiedId(null), 2000);
        } catch { /* ignore */ }
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

                        {/* PIN Field */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Login PIN
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, pin: generatePin() })}
                                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                                >
                                    <RefreshCw size={12} /> Auto-generate
                                </button>
                            </div>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type={showNewPin ? 'text' : 'password'}
                                    value={formData.pin}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 6) setFormData({ ...formData, pin: val });
                                    }}
                                    placeholder="4-6 digit PIN"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className="w-full pl-10 pr-20 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all font-bold tracking-widest text-center"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPin(!showNewPin)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 transition-colors"
                                >
                                    {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5 ml-1">
                                Agent uses this PIN + phone number to log in. Leave blank to skip.
                            </p>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white flex-1">{saving ? 'Saving...' : 'Create Agent'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* PIN Reset Dialog */}
            <Dialog open={resetPinDialog} onOpenChange={setResetPinDialog}>
                <DialogContent className="sm:max-w-[380px] w-[95vw] rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <KeyRound className="text-amber-500" size={20} />
                            Reset PIN
                        </DialogTitle>
                    </DialogHeader>

                    {resetTarget && (
                        <div className="space-y-5 mt-2">
                            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-bold text-lg">
                                    {resetTarget.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm">{resetTarget.name}</p>
                                    <p className="text-xs text-slate-400">{resetTarget.phone_number}</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New PIN</label>
                                    <button
                                        type="button"
                                        onClick={() => setNewPin(generatePin())}
                                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} /> Generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showNewPin ? 'text' : 'password'}
                                        value={newPin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 6) setNewPin(val);
                                        }}
                                        placeholder="Enter new 4-6 digit PIN"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all font-bold tracking-[0.3em] text-center text-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPin(!showNewPin)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600"
                                    >
                                        {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setResetPinDialog(false)} className="flex-1">Cancel</Button>
                                <Button
                                    onClick={handleResetPin}
                                    disabled={resettingPin || !newPin || newPin.length < 4}
                                    className="bg-amber-500 hover:bg-amber-600 text-white flex-1 disabled:opacity-50"
                                >
                                    {resettingPin ? 'Resetting...' : 'Reset PIN'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Note Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="text-sky-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Login Access:</span> Agents can log in at <strong>/login</strong> using their phone number and the PIN you set here. Only <strong>Active</strong> agents with a PIN can log in.
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

                                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-3">
                                    <Phone size={14} />
                                    {person.phone_number}
                                </div>

                                {/* PIN Status Badge */}
                                <div className="flex items-center gap-2 mb-4">
                                    {person.has_pin ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">
                                            <KeyRound size={12} />
                                            PIN Set
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 text-xs font-bold">
                                            <KeyRound size={12} />
                                            No PIN
                                        </span>
                                    )}
                                    {person.active_orders_count > 0 && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                            <Truck size={12} className="mr-1" />
                                            {person.active_orders_count} Active
                                        </span>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-3 gap-2">
                                    <a href={`tel:${person.phone_number}`} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors">
                                        <PhoneCall size={14} /> Call
                                    </a>
                                    <a href={`https://wa.me/${person.phone_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-xs hover:bg-emerald-100 transition-colors">
                                        <MessageCircle size={14} /> Chat
                                    </a>
                                    <button
                                        onClick={() => openResetPin(person)}
                                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 text-amber-600 font-bold text-xs hover:bg-amber-100 transition-colors"
                                    >
                                        <KeyRound size={14} /> PIN
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400">{person.staff_id}</span>
                                    <button
                                        onClick={() => copyToClipboard(person.staff_id, person.staff_id)}
                                        className="text-slate-300 hover:text-slate-500 transition-colors"
                                        title="Copy ID"
                                    >
                                        {copiedId === person.staff_id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                    </button>
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
