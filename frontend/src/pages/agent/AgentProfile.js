/**
 * AgentProfile - Alert preferences and profile for delivery agents
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
    User, Bell, BellRing, Smartphone, Volume2, Package,
    CreditCard, AlertTriangle, ArrowLeft, LogOut, ChevronRight,
    ShieldCheck, Smartphone as DeviceIcon
} from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { removeAuthToken } from '../../api/axios';

export default function AgentProfile() {
    const navigate = useNavigate();
    const [agentInfo, setAgentInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // Notification preferences state
    const [notifPrefs, setNotifPrefs] = useState({
        order_alerts: true,
        payment_alerts: true,
        system_alerts: true,
        sound_enabled: true,
        push_enabled: true
    });
    const [notifSaving, setNotifSaving] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load dashboard for basic agent info
                const dashRes = await api.get('/agent/dashboard');
                setAgentInfo(dashRes.data);

                // Load notification prefs
                const prefRes = await api.get('/notifications/preferences');
                setNotifPrefs(prev => ({ ...prev, ...prefRes.data }));
            } catch (err) {
                console.error('Failed to load profile data', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const updateNotifPref = async (key, value) => {
        const prev = notifPrefs[key];
        setNotifPrefs(p => ({ ...p, [key]: value }));
        setNotifSaving(key);
        try {
            await api.put('/notifications/preferences', { [key]: value });
            toast.success('Preference updated');
        } catch (err) {
            setNotifPrefs(p => ({ ...p, [key]: prev }));
            toast.error('Failed to update preference');
        } finally {
            setNotifSaving(null);
        }
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            try {
                await api.post('/auth/logout');
                toast.success('Logged out successfully');
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                removeAuthToken();
                navigate('/login');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 pt-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20 py-2 border-b border-white/50">
                <button
                    onClick={() => navigate('/agent/dashboard')}
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Profile</h1>
            </div>

            {/* Agent Hero Card */}
            <div className="relative overflow-hidden bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm mx-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-slate-900/20">
                        {(agentInfo?.agent_name || 'A').substring(0, 1)}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                            {agentInfo?.agent_name || 'Agent'}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Status</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Today</p>
                        <p className="text-lg font-black text-slate-900">₹{agentInfo?.metrics?.today_earnings || 0}</p>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dues</p>
                        <p className="text-lg font-black text-rose-600">₹{agentInfo?.metrics?.total_outstanding || 0}</p>
                    </div>
                </div>
            </div>

            {/* Account Settings */}
            <div className="space-y-4 px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Account</h3>
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-50">
                        <div className="p-4 flex items-center justify-between group active:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">Security PIN</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Change your 6-digit access PIN</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-4 px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Alert Preferences</h3>
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-4 space-y-2">
                    {[
                        { key: 'order_alerts', icon: Package, label: 'Order Alerts', desc: 'New deliveries assigned', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { key: 'payment_alerts', icon: CreditCard, label: 'Payment Alerts', desc: 'Confirmations & dues', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { key: 'system_alerts', icon: AlertTriangle, label: 'System Alerts', desc: 'App updates & important news', color: 'text-amber-600', bg: 'bg-amber-50' },
                        { key: 'sound_enabled', icon: Volume2, label: 'Sound Alerts', desc: 'Play notification sound', color: 'text-violet-600', bg: 'bg-violet-50' },
                        { key: 'push_enabled', icon: DeviceIcon, label: 'Push Notifications', desc: 'Alerts on this device', color: 'text-rose-600', bg: 'bg-rose-50' },
                    ].map(({ key, icon: Icon, label, desc, color, bg }) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center shadow-sm`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 leading-tight">{label}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{desc}</p>
                                </div>
                            </div>
                            <Switch
                                checked={notifPrefs[key]}
                                onCheckedChange={(v) => updateNotifPref(key, v)}
                                disabled={notifSaving === key}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Logout Action */}
            <div className="px-1 pt-4">
                <button
                    onClick={handleLogout}
                    className="w-full h-14 bg-red-50 hover:bg-red-100 text-red-600 rounded-3xl border border-red-100 flex items-center justify-center gap-3 font-black transition-all active:scale-[0.98]"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="uppercase tracking-widest text-xs">Logout Session</span>
                </button>
                <p className="text-center text-[10px] text-slate-300 font-bold uppercase mt-6 tracking-[0.2em]">
                    Thanni Canuuu • Version 1.2.0
                </p>
            </div>
        </div>
    );
}
