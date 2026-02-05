/**
 * Devices/Sessions Management Page
 * 2025 Design Update: Clean grid layout, activity indicators, simplified actions
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../api/axios';
import {
    Smartphone, Monitor, Tablet, Globe, Clock, MapPin, LogOut, Loader2,
    Shield, CheckCircle2, AlertTriangle, RefreshCw, Calendar, Laptop, AlertCircle
} from 'lucide-react';

export default function Devices() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logoutModal, setLogoutModal] = useState({ isOpen: false, sessionId: null, isCurrent: false, deviceName: '' });

    const loadSessions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/auth/sessions');
            setSessions(response.data.sessions || []);
        } catch (err) {
            console.error('Error loading sessions:', err);
            if (err.response?.status === 401) navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const getRelativeTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return date.toLocaleDateString();
    };

    const handleLogout = async () => {
        const { sessionId, isCurrent } = logoutModal;
        try {
            setLogoutModal(prev => ({ ...prev, isOpen: false }));
            const toastId = toast.loading('Logging out device...');
            await api.delete(`/auth/sessions/${sessionId}`);

            if (isCurrent) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('vendor');
                toast.success('Logged out successfully', { id: toastId });
                navigate('/login');
            } else {
                toast.success('Device logged out', { id: toastId });
                loadSessions();
            }
        } catch (err) {
            toast.error('Failed to logout device');
        }
    };

    if (loading && sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-slate-400 font-medium">Loading devices...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-12 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Sessions</h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Manage the <span className="text-slate-900 font-bold">{sessions.length}</span> devices connected to your account.
                    </p>
                </div>
                <button onClick={loadSessions} className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-xl font-bold text-slate-600 transition-all shadow-sm">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((session) => (
                    <div key={session.session_id}
                        className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 border bg-white ${session.is_current
                                ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                            }`}>

                        <div className="flex items-start gap-5">
                            {/* Device Icon */}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${session.is_current ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-500'
                                }`}>
                                {session.device_name.toLowerCase().includes('mobile') || session.device_name.toLowerCase().includes('phone') ? <Smartphone className="w-7 h-7" /> : <Monitor className="w-7 h-7" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 truncate pr-2">{session.device_name}</h3>
                                        {session.is_current && (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100/50 text-emerald-700 text-xs font-bold mt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                Current
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setLogoutModal({ isOpen: true, sessionId: session.session_id, isCurrent: session.is_current, deviceName: session.device_name })}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                        title="Revoke Access"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-y-2 gap-x-4 text-sm font-medium text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 opacity-70" />
                                        {session.ip_address}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Clock className="w-3.5 h-3.5 opacity-70" />
                                        {getRelativeTime(session.last_active)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {logoutModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                            <LogOut className="w-6 h-6 text-red-500 ml-0.5" />
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-900 mb-2">Log out session?</h3>
                        <p className="text-slate-500 text-center mb-6 px-2">
                            Are you sure you want to disconnect <span className="font-bold text-slate-800">{logoutModal.deviceName}</span>?
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setLogoutModal(p => ({ ...p, isOpen: false }))} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleLogout} className="px-5 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/20">Log out</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
