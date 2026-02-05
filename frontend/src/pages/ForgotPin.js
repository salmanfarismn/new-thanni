/**
 * Forgot PIN Page for Thanni Canuuu
 * Secure PIN recovery via Security Question
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axios';
import { Phone, Lock, ArrowRight, ArrowLeft, Loader2, Shield, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

// Step constants
const STEPS = {
    PHONE: 'phone',
    SECURITY_QUESTION: 'security_question',
    NEW_PIN: 'new_pin',
    SUCCESS: 'success'
};

export default function ForgotPin() {
    const navigate = useNavigate();
    const [step, setStep] = useState(STEPS.PHONE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [phone, setPhone] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);

    const handleGetQuestion = async (e) => {
        e.preventDefault();
        if (phone.length !== 10) {
            setError('Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/forgot-pin/request', {
                phone: `+91${phone}`
            });

            setSecurityQuestion(response.data.data.security_question);
            setStep(STEPS.SECURITY_QUESTION);
        } catch (err) {
            console.error('Get Question error:', err);
            setError(err.response?.data?.detail || 'Failed to find account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAnswer = async (e) => {
        e.preventDefault();
        if (!securityAnswer.trim()) {
            setError('Please enter your answer');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/forgot-pin/verify', {
                phone: `+91${phone}`,
                answer: securityAnswer
            });

            setResetToken(response.data.data?.reset_token || '');
            toast.success('Security answer verified!');
            setStep(STEPS.NEW_PIN);
        } catch (err) {
            console.error('Verify Answer error:', err);
            setError(err.response?.data?.detail || 'Incorrect answer. Please try again.');
            setSecurityAnswer('');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPin = async (e) => {
        e.preventDefault();

        if (newPin.length < 4 || newPin.length > 6) {
            setError('PIN must be 4-6 digits');
            return;
        }
        if (newPin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post('/auth/forgot-pin/reset', {
                phone: `+91${phone}`,
                reset_token: resetToken,
                new_pin: newPin
            });

            toast.success('PIN reset successful!');
            setStep(STEPS.SUCCESS);
        } catch (err) {
            console.error('Reset PIN error:', err);
            setError(err.response?.data?.detail || 'Failed to reset PIN. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-slate-50">
            {/* LEFT SIDE - VISUAL HERO (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 z-0"></div>
                <div className="absolute inset-0 opacity-20 z-10"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%230ea5e9' fill-opacity='1' d='M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'bottom',
                        backgroundSize: 'cover'
                    }}>
                </div>

                <div className="relative z-20 flex flex-col justify-between p-12 w-full h-full text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-blue-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-blue-400/30 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Thanni Canuuu</span>
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 inline-block">
                            <Shield className="w-12 h-12 text-blue-400" />
                        </div>
                        <h1 className="text-4xl font-black leading-tight tracking-tight">
                            Secure PIN <span className="text-blue-400">Recovery</span>
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Reset your PIN securely using your security question. Your account security is our priority.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span>256-bit Encryption</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE - FORM */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 lg:hidden -z-10"></div>

                <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
                    {/* Back Button */}
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>

                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-4 overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-xl" />
                        </div>
                    </div>

                    {/* STEP: PHONE */}
                    {step === STEPS.PHONE && (
                        <>
                            <div className="text-center lg:text-left">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Forgot your PIN?</h2>
                                <p className="mt-2 text-slate-500">Enter your phone number to proceed.</p>
                            </div>

                            <form onSubmit={handleGetQuestion} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-red-600 text-sm font-medium">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                                    <div className="relative flex items-center h-14 w-full rounded-2xl border-2 border-slate-100 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                                        <div className="pl-4 pr-3 text-slate-400">
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div className="flex items-center h-full mr-2">
                                            <span className="text-lg font-bold text-slate-500 select-none">+91</span>
                                        </div>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 10) setPhone(val);
                                            }}
                                            placeholder="98765 43210"
                                            maxLength={10}
                                            className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:text-slate-300 text-lg pl-1"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || phone.length !== 10}
                                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <span>Continue</span>
                                            <ArrowRight className="w-5 h-5 opacity-60" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* STEP: SECURITY QUESTION */}
                    {step === STEPS.SECURITY_QUESTION && (
                        <>
                            <div className="text-center lg:text-left">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Security Check</h2>
                                <p className="mt-2 text-slate-500">Answer your security question to reset PIN.</p>
                            </div>

                            <form onSubmit={handleVerifyAnswer} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-red-600 text-sm font-medium">{error}</p>
                                    </div>
                                )}

                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                    <div className="flex items-start gap-3">
                                        <HelpCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Security Question</p>
                                            <p className="text-blue-900 font-bold text-lg">{securityQuestion}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Your Answer</label>
                                    <div className="relative flex items-center h-14 w-full rounded-2xl border-2 border-slate-100 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                                        <input
                                            type="text"
                                            value={securityAnswer}
                                            onChange={(e) => setSecurityAnswer(e.target.value)}
                                            placeholder="Enter your answer"
                                            className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:text-slate-300 text-lg px-4"
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !securityAnswer}
                                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <span>Verify Answer</span>
                                            <ArrowRight className="w-5 h-5 opacity-60" />
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setStep(STEPS.PHONE); setSecurityAnswer(''); setError(''); }}
                                    className="w-full text-slate-500 font-medium text-sm hover:text-slate-700"
                                >
                                    Change phone number
                                </button>
                            </form>
                        </>
                    )}

                    {/* STEP: NEW PIN */}
                    {step === STEPS.NEW_PIN && (
                        <>
                            <div className="text-center lg:text-left">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create New PIN</h2>
                                <p className="mt-2 text-slate-500">Enter a new 4-6 digit PIN for your account.</p>
                            </div>

                            <form onSubmit={handleResetPin} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-red-600 text-sm font-medium">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New PIN</label>
                                        <div className="relative flex items-center h-14 w-full rounded-2xl border-2 border-slate-100 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                                            <div className="pl-4 pr-3 text-slate-400">
                                                <Lock className="w-5 h-5" />
                                            </div>
                                            <input
                                                type={showPin ? 'text' : 'password'}
                                                value={newPin}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    if (val.length <= 6) setNewPin(val);
                                                }}
                                                placeholder="••••••"
                                                maxLength={6}
                                                inputMode="numeric"
                                                className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:text-slate-300 text-lg tracking-[0.3em] text-center"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm PIN</label>
                                        <div className="relative flex items-center h-14 w-full rounded-2xl border-2 border-slate-100 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                                            <div className="pl-4 pr-3 text-slate-400">
                                                <Lock className="w-5 h-5" />
                                            </div>
                                            <input
                                                type={showPin ? 'text' : 'password'}
                                                value={confirmPin}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    if (val.length <= 6) setConfirmPin(val);
                                                }}
                                                placeholder="••••••"
                                                maxLength={6}
                                                inputMode="numeric"
                                                className="flex-1 h-full bg-transparent border-none focus:ring-0 text-slate-900 font-bold placeholder:text-slate-300 text-lg tracking-[0.3em] text-center"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer ml-1">
                                        <input
                                            type="checkbox"
                                            checked={showPin}
                                            onChange={(e) => setShowPin(e.target.checked)}
                                            className="rounded border-slate-300"
                                        />
                                        <span className="text-sm text-slate-500">Show PIN</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || newPin.length < 4 || newPin !== confirmPin}
                                    className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span>Reset PIN</span>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* STEP: SUCCESS */}
                    {step === STEPS.SUCCESS && (
                        <div className="text-center space-y-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full">
                                <CheckCircle className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">PIN Reset Successful!</h2>
                                <p className="mt-2 text-slate-500">Your PIN has been updated. You can now login with your new PIN.</p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                            >
                                <span>Go to Login</span>
                                <ArrowRight className="w-5 h-5 opacity-60" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer for Mobile */}
                <div className="absolute bottom-6 w-full text-center lg:hidden">
                    <p className="text-xs text-slate-400 font-medium">© 2026 Thanni Canuuu</p>
                </div>
            </div>
        </div>
    );
}
