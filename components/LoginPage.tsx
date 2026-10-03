import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface LoginPageProps {
    onGoogleLogin: () => void;
    onShowRegister?: () => void;
    loading?: boolean;
}

const isInAppBrowser = (): string | null => {
    const ua = navigator.userAgent || '';
    if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/LinkedIn/i.test(ua)) return 'LinkedIn';
    if (/Twitter|TwitterAndroid/i.test(ua)) return 'Twitter/X';
    if (/Snapchat/i.test(ua)) return 'Snapchat';
    if (/Pinterest/i.test(ua)) return 'Pinterest';
    if (/TikTok/i.test(ua)) return 'TikTok';
    return null;
};

const LoginPage: React.FC<LoginPageProps> = ({ onGoogleLogin, onShowRegister, loading }) => {
    const [tab, setTab] = useState<'google' | 'email'>('google');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendOk, setResendOk] = useState(false);

    // Forgot password sub-view
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState('');

    const inAppName = isInAppBrowser();

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNeedsConfirmation(false);
        if (!email.trim() || !password) return;

        setEmailLoading(true);
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (authError) {
                if (authError.message?.toLowerCase().includes('email not confirmed')) {
                    setNeedsConfirmation(true);
                    setError('Email not confirmed. Please check your inbox or resend below.');
                } else {
                    setError(authError.message || 'Sign in failed.');
                }
            }
            // Success: onAuthStateChange in useAuth handles the rest
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setEmailLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        setResending(true);
        setResendOk(false);
        try {
            await supabase.auth.resend({ type: 'signup', email: email.trim() });
            setResendOk(true);
        } catch {
            // Silently fail
        } finally {
            setResending(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');
        if (!forgotEmail.trim()) return;

        setForgotLoading(true);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                redirectTo: window.location.origin,
            });
            if (resetError) {
                setForgotError(resetError.message || 'Failed to send reset email.');
            } else {
                setForgotSent(true);
            }
        } catch {
            setForgotError('Network error. Please try again.');
        } finally {
            setForgotLoading(false);
        }
    };

    // ── Forgot Password sub-view ──
    if (showForgot) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
                <BackgroundDecor />
                <div className="relative w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center mb-6">
                            <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30">
                                <span className="material-symbols-outlined text-white text-4xl">lock_reset</span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight mb-2">Reset Password</h1>
                        <p className="text-slate-400 text-sm">Enter your email to receive a reset link</p>
                    </div>

                    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
                        {forgotSent ? (
                            <div className="text-center">
                                <span className="material-symbols-outlined text-rh-green text-5xl mb-4 block">mark_email_read</span>
                                <h2 className="text-lg font-bold text-white mb-2">Check your email</h2>
                                <p className="text-slate-400 text-sm mb-6">
                                    We sent a reset link to <span className="text-white font-semibold">{forgotEmail}</span>. Click the link to set a new password.
                                </p>
                                <button
                                    onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                                    className="w-full py-3 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 text-white font-bold text-sm transition-all"
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
                                {forgotError && (
                                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                                        <span className="material-symbols-outlined text-red-400 text-lg mt-0.5">error</span>
                                        <p className="text-sm text-red-400">{forgotError}</p>
                                    </div>
                                )}
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">mail</span>
                                    <input
                                        type="email"
                                        value={forgotEmail}
                                        onChange={e => setForgotEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        autoFocus
                                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-rh-green/50 focus:ring-rh-green/20 transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!forgotEmail.trim() || forgotLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all"
                                >
                                    {forgotLoading ? (
                                        <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-lg">send</span>
                                    )}
                                    Send Reset Link
                                </button>
                            </form>
                        )}
                    </div>

                    {!forgotSent && (
                        <p className="text-center text-slate-500 text-sm mt-6">
                            Remember your password?{' '}
                            <button onClick={() => { setShowForgot(false); setForgotError(''); }} className="text-rh-green font-semibold hover:underline">
                                Sign in
                            </button>
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // ── Main Login view ──
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
            <BackgroundDecor />

            <div className="relative w-full max-w-md">
                {/* In-app browser warning */}
                {inAppName && (
                    <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                        <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">warning</span>
                        <p className="text-sm text-amber-300">
                            You're in the <strong>{inAppName}</strong> browser. Google sign-in may not work here. Use <strong>Email sign-in</strong> or open this page in Chrome / Safari.
                        </p>
                    </div>
                )}

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-6">
                        <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30">
                            <span className="material-symbols-outlined text-white text-4xl">insights</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">SIGNAL FEED</h1>
                    <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">PRO TRADING TERMINAL</p>
                </div>

                {/* Glass Card */}
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-white mb-2">Welcome Back</h2>
                        <p className="text-slate-400 text-sm">Sign in to access your trading dashboard</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex rounded-xl bg-white/[0.04] border border-white/10 p-1 mb-6">
                        <button
                            onClick={() => { setTab('google'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                tab === 'google' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill={tab === 'google' ? '#4285F4' : '#64748b'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill={tab === 'google' ? '#34A853' : '#64748b'} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill={tab === 'google' ? '#FBBC05' : '#64748b'} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill={tab === 'google' ? '#EA4335' : '#64748b'} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </button>
                        <button
                            onClick={() => { setTab('email'); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                tab === 'email' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">mail</span>
                            Email
                        </button>
                    </div>

                    {/* Google Tab */}
                    {tab === 'google' && (
                        <button
                            onClick={onGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-slate-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            )}
                            <span className="text-sm">Continue with Google</span>
                        </button>
                    )}

                    {/* Email Tab */}
                    {tab === 'email' && (
                        <form onSubmit={handleEmailLogin} noValidate className="space-y-4">
                            {error && (
                                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                                    <span className="material-symbols-outlined text-red-400 text-lg mt-0.5">error</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-red-400">{error}</p>
                                        {needsConfirmation && (
                                            <button
                                                type="button"
                                                onClick={handleResendConfirmation}
                                                disabled={resending || resendOk}
                                                className="mt-2 text-xs font-bold text-rh-green hover:underline disabled:opacity-50"
                                            >
                                                {resendOk ? 'Confirmation email sent!' : resending ? 'Sending...' : 'Resend confirmation email'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">mail</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setError(''); }}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-rh-green/50 focus:ring-rh-green/20 transition-all"
                                />
                            </div>

                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-rh-green/50 focus:ring-rh-green/20 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                                    className="text-xs text-slate-400 hover:text-rh-green font-semibold transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={!email.trim() || !password || emailLoading}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.98]"
                            >
                                {emailLoading ? (
                                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined text-lg">login</span>
                                )}
                                Sign In
                            </button>
                        </form>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secure Login</span>
                        <div className="flex-1 h-px bg-white/10"></div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                        {[
                            { icon: 'trending_up', text: 'Real-time signal scanning' },
                            { icon: 'security', text: 'Enterprise-grade security' },
                            { icon: 'speed', text: 'AI-powered trade analysis' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 text-slate-400">
                                <span className="material-symbols-outlined text-rh-green text-lg">{feature.icon}</span>
                                <span className="text-xs font-medium">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Register link */}
                {onShowRegister && (
                    <div className="mt-6 text-center">
                        <p className="text-slate-500 text-sm">
                            Don't have an account?{' '}
                            <button onClick={onShowRegister} className="text-rh-green font-semibold hover:underline transition-all">
                                Create one
                            </button>
                        </p>
                    </div>
                )}

                <p className="text-center text-slate-600 text-[10px] mt-6 tracking-wide">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
};

const BackgroundDecor: React.FC = () => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rh-green/5 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
        }} />
    </>
);

export default LoginPage;
