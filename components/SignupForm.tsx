import React, { useState } from 'react';
import type { VerificationData } from '../services/useAuth';
import type { Session } from '@supabase/supabase-js';

interface SignupFormProps {
    verificationData: VerificationData;
    session: Session | null;
    onSignOut: () => void;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

const SignupForm: React.FC<SignupFormProps> = ({ verificationData, session, onSignOut }) => {
    const [formData, setFormData] = useState({
        userName: '',
        fullName: verificationData.fullName || '',
        phone: '',
    });
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
    const [errorMessage, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitStatus('submitting');
        setError('');

        try {
            console.log('📝 Registering user:', {
                userName: formData.userName,
                fullName: formData.fullName,
                email: verificationData.email,
                phone: formData.phone || undefined,
            });

            const resp = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/register-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userName: formData.userName,
                    fullName: formData.fullName,
                    email: verificationData.email,
                    phone: formData.phone || undefined,
                }),
            });

            console.log('📝 Register response status:', resp.status);

            let result: any = {};
            try {
                const body = await resp.json();
                result = Array.isArray(body) ? body[0] : body;
            } catch (e) {
                // JSON parse failed
            }

            console.log('📝 Register result:', result);

            if (resp.status === 201) {
                // ✅ Registration successful
                console.log('✅ Registration successful — pending approval');
                setSubmitStatus('success');

            } else if (resp.status === 409) {
                // ⚠️ Conflict — username or email taken
                const msg = result.message || 'Username or email already registered.';
                console.log('⚠️ Conflict (409):', msg);
                setError(msg);
                setSubmitStatus('error');

            } else if (resp.status === 400) {
                // ❌ Validation error
                const msg = result.message || 'Please check your input and try again.';
                console.log('❌ Validation error (400):', msg);
                setError(msg);
                setSubmitStatus('error');

            } else {
                // Unknown error
                const msg = result.message || `Registration failed (${resp.status}). Please try again.`;
                setError(msg);
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('❌ Registration request failed:', error);
            setError('Unable to connect. Please check your internet and try again.');
            setSubmitStatus('error');
        }
    };

    // ═══════════════ SUCCESS SCREEN ═══════════════
    if (submitStatus === 'success') {
        // Auto sign-out after 5 seconds → back to login
        setTimeout(() => onSignOut(), 5000);

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/15 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative w-full max-w-md text-center">
                    <div className="inline-flex items-center justify-center mb-6">
                        <div className="bg-rh-green p-5 rounded-2xl shadow-2xl shadow-rh-green/30">
                            <span className="material-symbols-outlined text-white text-5xl">check_circle</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-rh-green tracking-tight mb-3">Registration Successful!</h1>
                    <p className="text-rh-green font-bold text-sm mb-8">
                        Your account is pending admin approval.
                    </p>
                    <p className="text-slate-500 text-xs animate-pulse">
                        Redirecting to login in 5 seconds...
                    </p>
                </div>
            </div>
        );
    }

    // ═══════════════ SIGNUP FORM ═══════════════
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
            }} />

            <div className="relative w-full max-w-md">
                {/* Branding */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="bg-rh-green p-3 rounded-2xl shadow-2xl shadow-rh-green/30">
                            <span className="material-symbols-outlined text-white text-3xl">insights</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight mb-1">Complete Your Profile</h1>
                    <p className="text-slate-400 text-sm">
                        {verificationData.message || 'One more step to access Signal Feed'}
                    </p>
                </div>

                {/* User Info from webhook */}
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-4 mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                        {verificationData.avatarUrl ? (
                            <img src={verificationData.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-slate-400 text-xl flex items-center justify-center w-full h-full">person</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{verificationData.fullName || 'New User'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{verificationData.email}</p>
                    </div>
                    <span className="material-symbols-outlined text-rh-green text-lg">verified</span>
                </div>

                {/* Error banner */}
                {submitStatus === 'error' && errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-red-400 text-lg mt-0.5 flex-shrink-0">error</span>
                        <p className="text-sm text-red-300 leading-relaxed">{errorMessage}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-6 space-y-4">

                    {/* Username */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Username</label>
                        <input
                            type="text"
                            value={formData.userName}
                            onChange={(e) => setFormData({ ...formData, userName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rh-green/50 focus:border-rh-green/50 transition-all"
                            placeholder="Choose a username"
                            required
                            minLength={3}
                            maxLength={30}
                            pattern="[a-z0-9_]+"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Lowercase letters, numbers, and underscores only</p>
                    </div>

                    {/* Full Name — pre-filled */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                        <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rh-green/50 focus:border-rh-green/50 transition-all"
                            placeholder="Enter your full name"
                            required
                        />
                    </div>

                    {/* Email — pre-filled, read-only */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
                        <input
                            type="email"
                            value={verificationData.email || ''}
                            readOnly
                            className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">From your Google account — cannot be changed</p>
                    </div>

                    {/* Phone — optional */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number <span className="text-slate-600">(optional)</span></label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rh-green/50 focus:border-rh-green/50 transition-all"
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitStatus === 'submitting'}
                        className="w-full flex items-center justify-center gap-2 bg-rh-green hover:bg-rh-green/90 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-rh-green/20 hover:shadow-rh-green/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {submitStatus === 'submitting' ? (
                            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-xl">how_to_reg</span>
                        )}
                        <span className="text-sm">{submitStatus === 'submitting' ? 'Registering...' : 'Complete Registration'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onSignOut}
                        className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
                    >
                        Sign out and use a different account
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SignupForm;
