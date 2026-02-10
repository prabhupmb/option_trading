import React from 'react';

interface LoginPageProps {
    onGoogleLogin: () => void;
    loading?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onGoogleLogin, loading }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rh-green/5 rounded-full blur-3xl" />
            </div>

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
            }} />

            {/* Login Card */}
            <div className="relative w-full max-w-md">
                {/* Logo & Branding */}
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
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">Welcome Back</h2>
                        <p className="text-slate-400 text-sm">Sign in to access your trading dashboard</p>
                    </div>

                    {/* Google Sign-In Button */}
                    <button
                        onClick={onGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-slate-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
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

                {/* Footer */}
                <p className="text-center text-slate-600 text-[10px] mt-6 tracking-wide">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
