import React, { useEffect } from 'react';

interface AccessDeniedPageProps {
    onSignOut: () => void;
    userEmail?: string;
    message?: string; // message from the 403 webhook response
}

const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ onSignOut, userEmail, message }) => {
    // Auto sign-out after 15 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onSignOut();
        }, 15000);
        return () => clearTimeout(timer);
    }, [onSignOut]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-40 -right-40 w-96 h-96 ${message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'bg-rh-green/10' : 'bg-red-500/10'} rounded-full blur-3xl animate-pulse`} />
                <div className={`absolute -bottom-40 -left-40 w-96 h-96 ${message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'bg-emerald-600/5' : 'bg-red-600/5'} rounded-full blur-3xl animate-pulse`} style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative w-full max-w-md text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center mb-6">
                    <div className={`${message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'bg-rh-green/10 border-rh-green/20' : 'bg-red-500/20 border-red-500/30'} p-5 rounded-2xl border`}>
                        <span className={`material-symbols-outlined ${message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'text-rh-green' : 'text-red-400'} text-5xl`}>
                            {message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'check_circle' : 'shield_lock'}
                        </span>
                    </div>
                </div>

                {/* Title */}
                <h1 className={`text-3xl font-black tracking-tight mb-3 ${message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'text-rh-green' : 'text-white'}`}>
                    {message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval') ? 'Registration Successful' : 'Access Denied'}
                </h1>

                {/* Webhook message */}
                {message ? (
                    <div className={`${message.toLowerCase().includes('pending') || message.toLowerCase().includes('approval') ? 'bg-rh-green/10 border-rh-green/20' : 'bg-red-500/10 border-red-500/20'} border rounded-xl p-4 mb-6 text-left`}>
                        <div className="flex items-start gap-3">
                            <span className={`material-symbols-outlined ${message.toLowerCase().includes('pending') || message.toLowerCase().includes('approval') ? 'text-rh-green' : 'text-red-400'} text-lg mt-0.5`}>
                                {message.toLowerCase().includes('pending') || message.toLowerCase().includes('approval') ? 'hourglass_top' : 'error'}
                            </span>
                            <p className={`text-sm ${message.toLowerCase().includes('pending') || message.toLowerCase().includes('approval') ? 'text-rh-green font-bold' : 'text-red-300'} leading-relaxed`}>{message}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-400 text-sm mb-6">
                        Your account is not authorized to access this application.
                    </p>
                )}

                {userEmail && (
                    <p className="text-slate-500 text-xs mb-6">
                        <span className="text-slate-300 font-medium">{userEmail}</span>
                    </p>
                )}

                {/* Info Card */}
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-6 mb-6">
                    <div className="flex items-start gap-3 text-left">
                        <span className="material-symbols-outlined text-amber-400 text-xl mt-0.5">info</span>
                        <div>
                            <p className="text-sm text-slate-300 font-medium mb-1">Status Update</p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {message?.toLowerCase().includes('pending') || message?.toLowerCase().includes('approval')
                                    ? "Your request is currently being reviewed by an administrator. Please check back later."
                                    : "Contact the administrator to request access to the Signal Feed trading terminal."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={onSignOut}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-6 rounded-xl border border-white/10 transition-all duration-200 active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    <span className="text-sm">Sign Out & Return to Login</span>
                </button>
            </div>
        </div>
    );
};

export default AccessDeniedPage;
