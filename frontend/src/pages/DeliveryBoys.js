import { useState, useEffect } from 'react';
import { api } from '../context/AppContext';
import { Users, Plus, Trash2, Power, Phone, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DeliveryBoys() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone_number: '' });
    const [formError, setFormError] = useState('');

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            const response = await api.get('/delivery-staff');
            setStaff(response.data);
        } catch (error) {
            console.error('Error loading delivery staff:', error);
            toast.error('Failed to load delivery staff');
        } finally {
            setLoading(false);
        }
    };

    const generateStaffId = () => {
        return `DS${Date.now().toString().slice(-8)}`;
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

            toast.success('Delivery boy added successfully!');
            setFormData({ name: '', phone_number: '' });
            setShowForm(false);
            loadStaff();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Failed to add delivery boy';
            setFormError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (staffId, currentStatus) => {
        try {
            await api.put(`/delivery-staff/${staffId}?is_active=${!currentStatus}`);
            toast.success(`Delivery boy ${currentStatus ? 'deactivated' : 'activated'}!`);
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
            toast.success('Delivery boy deleted successfully!');
            loadStaff();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete delivery boy');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="delivery-boys-page">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Delivery Boys</h1>
                    <p className="text-slate-600 mt-1">Manage your delivery staff</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    data-testid="add-delivery-boy-btn"
                    className="bg-sky-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-sky-600 transition-all flex items-center gap-2 shadow-sm"
                >
                    <Plus size={20} />
                    Add Delivery Boy
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" data-testid="add-form">
                    <h2 className="text-xl font-semibold text-slate-900 mb-4">Add New Delivery Boy</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {formError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                                <AlertCircle size={18} />
                                {formError}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                <User size={16} className="inline mr-2" />
                                Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter delivery boy name"
                                data-testid="name-input"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                <Phone size={16} className="inline mr-2" />
                                WhatsApp Number
                            </label>
                            <input
                                type="tel"
                                value={formData.phone_number}
                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                placeholder="Enter WhatsApp number (e.g., 9876543210)"
                                data-testid="phone-input"
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">Enter number without country code or with + prefix</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                data-testid="save-btn"
                                className="flex-1 bg-sky-500 text-white py-3 rounded-xl font-semibold hover:bg-sky-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Adding...' : 'Add Delivery Boy'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    setFormError('');
                                    setFormData({ name: '', phone_number: '' });
                                }}
                                className="px-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                    <Users className="text-sky-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                        <h3 className="font-semibold text-sky-900 mb-1">Delivery Staff Management</h3>
                        <p className="text-sm text-sky-800">
                            Add delivery boys who will receive order notifications via WhatsApp. Only active staff members will be assigned new orders.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {staff.length > 0 ? (
                    staff.map((person) => (
                        <div
                            key={person.staff_id}
                            className={`bg-white p-5 rounded-xl border-2 transition-all ${person.is_active !== false
                                ? 'border-slate-200 hover:border-sky-200'
                                : 'border-slate-200 bg-slate-50 opacity-70'
                                }`}
                            data-testid={`staff-card-${person.staff_id}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${person.is_active !== false ? 'bg-sky-100' : 'bg-slate-200'
                                        }`}>
                                        <Users className={person.is_active !== false ? 'text-sky-600' : 'text-slate-500'} size={20} />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-900 text-lg">{person.name}</div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Phone size={14} />
                                            {person.phone_number}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${person.is_active !== false
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-200 text-slate-600'
                                        }`}>
                                        {person.is_active !== false ? 'Active' : 'Inactive'}
                                    </span>

                                    {person.active_orders_count > 0 && (
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                                            {person.active_orders_count} pending
                                        </span>
                                    )}

                                    <button
                                        onClick={() => toggleStatus(person.staff_id, person.is_active !== false)}
                                        data-testid={`toggle-${person.staff_id}`}
                                        className={`p-2 rounded-lg transition-all ${person.is_active !== false
                                            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                            : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                            }`}
                                        title={person.is_active !== false ? 'Deactivate' : 'Activate'}
                                    >
                                        <Power size={18} />
                                    </button>

                                    <button
                                        onClick={() => deleteStaff(person.staff_id, person.name)}
                                        data-testid={`delete-${person.staff_id}`}
                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                        <Users className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No delivery staff yet</h3>
                        <p className="text-slate-600 mb-4">Add your first delivery boy to start receiving orders</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-sky-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-sky-600 transition-all"
                        >
                            Add Delivery Boy
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="font-semibold text-amber-900 mb-2">Important Notes</h3>
                <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Only active delivery boys receive WhatsApp notifications for new orders</li>
                    <li>• Deactivated staff won't be assigned new orders but can still see existing ones</li>
                    <li>• You cannot delete a delivery boy with pending orders</li>
                    <li>• Remember to set up shifts for delivery boys in the Shifts page</li>
                </ul>
            </div>
        </div>
    );
}
