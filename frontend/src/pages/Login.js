/**
 * Login Page for Thanni Canuuu
 * 2025 Design Update: Split layout, Glassmorphism, Premium Water Theme
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import api, { setAuthToken, setVendor, removeAuthToken } from '../api/axios';
import { Droplets, Phone, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ phone: '', pin: '' });
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'pin' && (!/^\d*$/.test(value) || value.length > 6)) return;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.phone.length !== 10) { setError('Please enter a valid 10-digit phone number'); return; }
        if (formData.pin.length < 4) { setError('PIN must be at least 4 digits'); return; }

        setLoading(true);
        setError('');

        // IMPORTANT: Clear any existing auth data before new login
        // This ensures proper vendor isolation
        removeAuthToken();

        try {
            const deviceName = getDeviceName();
            const response = await api.post('/auth/login', {
                phone: `+91${formData.phone}`,
                pin: formData.pin,
                device_name: deviceName
            });

            setAuthToken(response.data.access_token);
            setVendor(response.data.vendor);
            toast.success(`Welcome back, ${response.data.vendor.name || response.data.vendor.business_name}!`);
            navigate('/');
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.detail || 'Login failed. Please verify your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const getDeviceName = () => {
        const ua = navigator.userAgent;
        if (/iPhone|iPad/i.test(ua)) return 'iOS Device';
        if (/Android/i.test(ua)) return 'Android Device';
        if (/Mac/i.test(ua)) return 'Mac';
        if (/Windows/i.test(ua)) return 'Windows PC';
        return 'Web Browser';
    };

    return (
        <div className="min-h-screen w-full flex bg-slate-50">
            {/* LEFT SIDE - VISUAL HERO (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
                {/* Abstract Water Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 z-0"></div>
                <div className="absolute inset-0 opacity-30 z-10"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%230ea5e9' fill-opacity='1' d='M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'bottom',
                        backgroundSize: 'cover'
                    }}>
                </div>

                {/* Content Overlay */}
                <div className="relative z-20 flex flex-col justify-between p-12 w-full h-full text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-blue-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-blue-400/30 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Thanni Canuuu</span>
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-5xl font-black leading-tight tracking-tight">
                            Manage your <span className="text-blue-400">water delivery</span> business with confidence.
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Track orders, manage inventory, and secure your vendor account with our improved, multi-device platform.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs">
                                    <ShieldCheck className="w-4 h-4 text-blue-500 opacity-60" />
                                </div>
                            ))}
                        </div>
                        <p>Trusted by local vendors across India</p>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE - FORM */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
                {/* Mobile Background Gradient (only visible on mobile) */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 lg:hidden -z-10"></div>

                <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden inline-flex items-center justify-center w-36 h-36 rounded-2xl mb-8 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-2xl" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
                        <p className="mt-2 text-slate-500">Please enter your details to sign in.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-shake">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-red-600 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <div className="space-y-5">
                            {/* Phone Input */}
                            <div className={`group relative transition-all duration-300 ${focusedField === 'phone' ? 'scale-[1.02]' : ''}`}>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">
                                    Phone Number
                                </label>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'phone'
                                    ? 'border-blue-500 ring-4 ring-blue-500/10'
                                    : 'border-slate-100 hover:border-slate-200'
                                    }`}>
                                    <div className="pl-4 pr-3 text-slate-400">
                                        <Phone className={`w-5 h-5 transition-colors ${focusedField === 'phone' ? 'text-blue-500' : ''}`} />
                                    </div>
                                    <div className="flex items-center h-full mr-2">
                                        <span className="text-lg font-bold text-slate-500 select-none">+91</span>
                                    </div>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 10) setFormData(prev => ({ ...prev, phone: val }));
                                        }}
                                        onFocus={() => setFocusedField('phone')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="98765 43210"
                                        maxLength={10}
                                        className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-medium placeholder:text-slate-300 text-lg pl-1"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* PIN Input */}
                            <div className={`group relative transition-all duration-300 ${focusedField === 'pin' ? 'scale-[1.02]' : ''}`}>
                                <div className="flex items-center justify-between mb-1.5 ml-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        PIN Code
                                    </label>
                                    <Link to="/forgot-pin" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                                        Forgot PIN?
                                    </Link>
                                </div>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'pin'
                                    ? 'border-blue-500 ring-4 ring-blue-500/10'
                                    : 'border-slate-100 hover:border-slate-200'
                                    }`}>
                                    <div className="absolute left-0 pl-4 flex items-center pointer-events-none h-full text-slate-400">
                                        <Lock className={`w-5 h-5 transition-colors ${focusedField === 'pin' ? 'text-blue-500' : ''}`} />
                                    </div>
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        name="pin"
                                        value={formData.pin}
                                        onChange={handleChange}
                                        onFocus={() => setFocusedField('pin')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="••••••"
                                        maxLength={6}
                                        inputMode="numeric"
                                        className="w-full h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-bold placeholder:text-slate-300 text-lg tracking-[0.5em] text-center pl-12 pr-12"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="absolute right-0 pr-4 h-full flex items-center text-slate-400 hover:text-blue-600 transition-colors z-10"
                                    >
                                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Log in</span>
                                    <ArrowRight className="w-5 h-5 opacity-60" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 font-medium">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-blue-600 font-bold hover:underline">
                            Register now
                        </Link>
                    </p>
                </div>

                {/* Footer for Mobile */}
                <div className="absolute bottom-6 w-full text-center lg:hidden">
                    <p className="text-xs text-slate-400 font-medium">© 2026 Thanni Canuuu</p>
                </div>
            </div>
        </div>
    );
}
