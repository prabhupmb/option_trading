import React, { useState } from 'react';
import type { VerificationData } from '../services/useAuth';

interface SignupFormProps {
    verificationData: VerificationData;
    onSignOut: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ verificationData, onSignOut }) => {
    const [formData, setFormData] = useState({
        fullName: verificationData.fullName || '',
        phone: '',
        tradingExperience: '',
        referralCode: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            console.log('📝 Submitting signup form:', {
                ...formData,
                email: verificationData.email,
            });
            // You can add a webhook call here to register the user
            await new Promise(resolve => setTimeout(resolve, 1500));
            setSubmitted(true);
        } catch (error) {
            console.error('❌ Signup failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative w-full max-w-md text-center">
                    <div className="inline-flex items-center justify-center mb-6">
                        <div className="bg-rh-green/20 p-5 rounded-2xl border border-rh-green/30">
                            <span className="material-symbols-outlined text-rh-green text-5xl">check_circle</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-3">Request Submitted!</h1>
                    <p className="text-slate-400 text-sm mb-8">
                        Your registration request has been submitted. You'll receive access once approved by the administrator.
                    </p>
                    <button
                        onClick={onSignOut}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-6 rounded-xl border border-white/10 transition-all duration-200 active:scale-[0.98]"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        <span className="text-sm">Return to Login</span>
                    </button>
                </div>
            </div>
        );
    }

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

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-6 space-y-4">
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

                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trading Experience</label>
                        <select
                            value={formData.tradingExperience}
                            onChange={(e) => setFormData({ ...formData, tradingExperience: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rh-green/50 focus:border-rh-green/50 transition-all appearance-none cursor-pointer"
                            required
                        >
                            <option value="" className="bg-slate-900">Select experience level</option>
                            <option value="beginner" className="bg-slate-900">Beginner (0-1 years)</option>
                            <option value="intermediate" className="bg-slate-900">Intermediate (1-3 years)</option>
                            <option value="advanced" className="bg-slate-900">Advanced (3-5 years)</option>
                            <option value="expert" className="bg-slate-900">Expert (5+ years)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Referral Code <span className="text-slate-600">(optional)</span></label>
                        <input
                            type="text"
                            value={formData.referralCode}
                            onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rh-green/50 focus:border-rh-green/50 transition-all"
                            placeholder="Enter referral code"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-rh-green hover:bg-rh-green/90 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-rh-green/20 hover:shadow-rh-green/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {isSubmitting ? (
                            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-xl">how_to_reg</span>
                        )}
                        <span className="text-sm">{isSubmitting ? 'Submitting...' : 'Complete Registration'}</span>
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
