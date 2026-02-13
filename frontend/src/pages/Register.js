/**
 * Register Page for Thanni Canuuu
 * 2025 Design Update: Split layout, Glassmorphism, Premium Water Theme
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axios';
import { Droplets, Phone, Lock, Eye, EyeOff, Loader2, ArrowRight, Store, AlertTriangle, CheckCircle2, XCircle, User, HelpCircle } from 'lucide-react';

const SECURITY_QUESTIONS = [
    "What is your mother's maiden name?",
    "What was the name of your first pet?",
    "What was the name of your first school?",
    "What is your favorite food?",
    "What city were you born in?"
];

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        business_name: '',
        phone: '',
        pin: '',
        confirm_pin: '',
        security_question: SECURITY_QUESTIONS[0],
        security_answer: ''
    });
    const [status, setStatus] = useState({ phone: null, match: null });
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    useEffect(() => {
        if (formData.phone.length === 10) {
            const phoneRegex = /^[6-9]\d{9}$/;
            setStatus(prev => ({ ...prev, phone: phoneRegex.test(formData.phone) ? 'valid' : 'invalid' }));
        } else if (formData.phone.length > 0) {
            setStatus(prev => ({ ...prev, phone: 'invalid' }));
        } else {
            setStatus(prev => ({ ...prev, phone: null }));
        }

        if (formData.confirm_pin.length > 0) {
            setStatus(prev => ({ ...prev, match: formData.pin === formData.confirm_pin ? 'match' : 'mismatch' }));
        } else {
            setStatus(prev => ({ ...prev, match: null }));
        }
    }, [formData.phone, formData.pin, formData.confirm_pin]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if ((name === 'pin' || name === 'confirm_pin') && (!/^\d*$/.test(value) || value.length > 6)) return;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { setError('Please enter your name'); return; }
        if (!formData.business_name.trim()) { setError('Please enter your business name'); return; }
        if (status.phone !== 'valid') { setError('Please enter a valid Indian phone number'); return; }
        if (formData.pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
        if (formData.pin !== formData.confirm_pin) { setError('PINs do not match'); return; }
        if (!formData.security_answer.trim()) { setError('Please answer the security question'); return; }

        setLoading(true);
        try {
            await api.post('/auth/register', {
                name: formData.name,
                business_name: formData.business_name,
                phone: `+91${formData.phone}`,
                pin: formData.pin,
                security_question: formData.security_question,
                security_answer: formData.security_answer
            });
            setSuccess(true);
            toast.success('Registration successful!');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.detail || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-sm w-full text-center animate-fade-in-up">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome Aboard!</h2>
                    <p className="text-slate-500 font-medium mb-8">Your account has been created successfully.</p>
                    <div className="inline-flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-full">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Redirecting to login...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-slate-50">
            {/* LEFT SIDE - VISUAL HERO (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900 to-slate-900 z-0"></div>
                {/* Different pattern for Register */}
                <div className="absolute inset-0 opacity-20 z-10"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2306b6d4' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}>
                </div>

                <div className="relative z-20 flex flex-col justify-between p-12 w-full h-full text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-cyan-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-cyan-400/30 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Thanni Canuuu</span>
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-5xl font-black leading-tight tracking-tight">
                            Start your <span className="text-cyan-400">digital journey</span> today.
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Join hundreds of water vendors who trust us to streamline their delivery operations.
                        </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50">
                        <p className="text-lg font-bold text-white mb-2">"Since switching to Thanni Canuuu, my daily orders have increased by 40%."</p>
                        <div className="flex items-center gap-3 mt-4">
                            <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                            <div>
                                <p className="font-bold text-sm">Rajesh Kumar</p>
                                <p className="text-xs text-slate-500">Om Shakti Waters</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE - FORM */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-blue-50 lg:hidden -z-10"></div>

                <div className="w-full max-w-sm space-y-6 animate-fade-in-up py-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden inline-flex items-center justify-center w-36 h-36 rounded-2xl mb-8 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-2xl" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create Account</h2>
                        <p className="mt-2 text-slate-500">Enter your details to get started.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-shake">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-red-600 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {/* Your Name */}
                        <div className={`group relative transition-all duration-300 ${focusedField === 'name' ? 'scale-[1.02]' : ''}`}>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Your Name</label>
                            <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'name' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                <div className="pl-4 pr-3 text-slate-400"><User className={`w-5 h-5 transition-colors ${focusedField === 'name' ? 'text-cyan-500' : ''}`} /></div>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)} placeholder="e.g., Rajesh, Kumar" className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-medium placeholder:text-slate-300 text-base py-0" disabled={loading} />
                            </div>
                            <p className="text-xs text-slate-400 mt-1 ml-1">This will be used for personal greetings</p>
                        </div>

                        {/* Business Name */}
                        <div className={`group relative transition-all duration-300 ${focusedField === 'business' ? 'scale-[1.02]' : ''}`}>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Business Name</label>
                            <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'business' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                <div className="pl-4 pr-3 text-slate-400"><Store className={`w-5 h-5 transition-colors ${focusedField === 'business' ? 'text-cyan-500' : ''}`} /></div>
                                <input type="text" name="business_name" value={formData.business_name} onChange={handleChange} onFocus={() => setFocusedField('business')} onBlur={() => setFocusedField(null)} placeholder="Kumar Water Supply" className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-medium placeholder:text-slate-300 text-base py-0" disabled={loading} />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className={`group relative transition-all duration-300 ${focusedField === 'phone' ? 'scale-[1.02]' : ''}`}>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Phone Number</label>
                            <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${status.phone === 'invalid' && formData.phone.length > 0 ? 'border-red-300' : focusedField === 'phone' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'
                                }`}>
                                <div className="pl-4 pr-3 text-slate-400"><Phone className={`w-5 h-5 transition-colors ${focusedField === 'phone' ? 'text-cyan-500' : ''}`} /></div>
                                <div className="flex items-center h-full mr-1">
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
                                    className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-medium placeholder:text-slate-300 text-lg py-0 pl-1"
                                    disabled={loading}
                                />
                                <div className="pr-4">{status.phone === 'valid' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}{status.phone === 'invalid' && <XCircle className="w-5 h-5 text-red-500" />}</div>
                            </div>
                        </div>

                        {/* SECURITY QUESTION */}
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                            <div className={`group relative transition-all duration-300 ${focusedField === 'security_question' ? 'scale-[1.02]' : ''}`}>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Security Question</label>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'security_question' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <div className="pl-4 pr-3 text-slate-400"><HelpCircle className={`w-5 h-5 transition-colors ${focusedField === 'security_question' ? 'text-cyan-500' : ''}`} /></div>
                                    <select
                                        name="security_question"
                                        value={formData.security_question}
                                        onChange={handleChange}
                                        onFocus={() => setFocusedField('security_question')}
                                        onBlur={() => setFocusedField(null)}
                                        className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold text-sm py-0 pr-8"
                                        disabled={loading}
                                    >
                                        {SECURITY_QUESTIONS.map((q, i) => (
                                            <option key={i} value={q}>{q}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={`group relative transition-all duration-300 ${focusedField === 'security_answer' ? 'scale-[1.02]' : ''}`}>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Your Answer</label>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'security_answer' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <div className="pl-4 pr-3 text-slate-400"><Lock className={`w-5 h-5 transition-colors ${focusedField === 'security_answer' ? 'text-cyan-500' : ''}`} /></div>
                                    <input
                                        type="text"
                                        name="security_answer"
                                        value={formData.security_answer}
                                        onChange={handleChange}
                                        onFocus={() => setFocusedField('security_answer')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="Enter answer"
                                        className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:font-medium placeholder:text-slate-300 text-base py-0"
                                        disabled={loading}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 ml-1">Remember this for password recovery</p>
                            </div>
                        </div>

                        {/* PINs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`group relative transition-all duration-300 ${focusedField === 'pin' ? 'scale-[1.02]' : ''}`}>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Create PIN</label>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${focusedField === 'pin' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <div className="absolute left-0 pl-3 flex items-center h-full text-slate-400 pointer-events-none">
                                        <Lock className={`w-4 h-4 transition-colors ${focusedField === 'pin' ? 'text-cyan-500' : ''}`} />
                                    </div>
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        name="pin"
                                        value={formData.pin}
                                        onChange={handleChange}
                                        onFocus={() => setFocusedField('pin')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="••••"
                                        maxLength={6}
                                        inputMode="numeric"
                                        className="w-full h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold text-center tracking-[0.3em] pl-8 pr-2 text-lg"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <div className={`group relative transition-all duration-300 ${focusedField === 'confirm' ? 'scale-[1.02]' : ''}`}>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Confirm</label>
                                <div className={`relative flex items-center h-14 w-full rounded-2xl border-2 transition-all duration-200 bg-white ${status.match === 'mismatch' ? 'border-red-300' : focusedField === 'confirm' ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <div className="absolute left-0 pl-3 flex items-center h-full text-slate-400 pointer-events-none">
                                        <Lock className={`w-4 h-4 transition-colors ${focusedField === 'confirm' ? 'text-cyan-500' : ''}`} />
                                    </div>
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        name="confirm_pin"
                                        value={formData.confirm_pin}
                                        onChange={handleChange}
                                        onFocus={() => setFocusedField('confirm')}
                                        onBlur={() => setFocusedField(null)}
                                        placeholder="••••"
                                        maxLength={6}
                                        inputMode="numeric"
                                        className="w-full h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold text-center tracking-[0.3em] pl-8 pr-2 text-lg"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button type="button" onClick={() => setShowPin(!showPin)} className="text-xs font-bold text-cyan-600 hover:text-cyan-700">{showPin ? 'Hide PINs' : 'Show PINs'}</button>
                        </div>

                        <button type="submit" disabled={loading} className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-5 h-5 opacity-60" /></>}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 font-medium">Already have an account? <Link to="/login" className="text-cyan-600 font-bold hover:underline">Log in</Link></p>
                </div>

                {/* Footer for Mobile */}
                <div className="mt-8 mb-6 w-full text-center lg:hidden">
                    <p className="text-xs text-slate-400 font-medium">© 2026 Thanni Canuuu</p>
                </div>
            </div>
        </div>
    );
}
