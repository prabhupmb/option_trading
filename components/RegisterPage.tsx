import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface RegisterPageProps {
  onBackToLogin: () => void;
}

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirmPassword' | 'general', string>>;

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
  if (score <= 3) return { label: 'Medium', color: 'bg-yellow-400', width: '66%' };
  return { label: 'Strong', color: 'bg-rh-green', width: '100%' };
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onBackToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [pageStatus, setPageStatus] = useState<'form' | 'email_confirmation' | 'success'>('form');

  const passwordStrength = getPasswordStrength(password);

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    return errs;
  };

  const isFormValid =
    fullName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    confirmPassword === password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setErrors({ general: error.message });
        return;
      }

      // If no session was returned, email confirmation is required
      if (!data.session) {
        setPageStatus('email_confirmation');
        return;
      }

      // Session exists — sign out immediately (user needs admin approval)
      await supabase.auth.signOut();
      setPageStatus('success');
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Email confirmation screen
  if (pageStatus === 'email_confirmation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
        <BackgroundDecorations />
        <div className="relative w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30">
              <span className="material-symbols-outlined text-white text-4xl">mark_email_read</span>
            </div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-3">Check your email</h2>
            <p className="text-slate-400 text-sm mb-6">
              We sent a confirmation link to <span className="text-white font-semibold">{email}</span>. Confirm your email, then return here to sign in.
            </p>
            <button
              onClick={onBackToLogin}
              className="w-full py-3 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 text-white font-bold text-sm transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (pageStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
        <BackgroundDecorations />
        <div className="relative w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30">
              <span className="material-symbols-outlined text-white text-4xl">verified</span>
            </div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-3">Registration Successful!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your account is <span className="text-rh-green font-semibold">pending admin approval</span>. You'll receive an email when your account is activated.
            </p>
            <button
              onClick={onBackToLogin}
              className="w-full py-3 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 text-white font-bold text-sm transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 relative overflow-hidden">
      <BackgroundDecorations />

      <div className="relative w-full max-w-[480px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30">
              <span className="material-symbols-outlined text-white text-4xl">insights</span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">Create your TradingKarna account</h1>
          <p className="text-slate-400 text-sm font-medium">Auto-trade options &amp; equities across Schwab and Alpaca</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {errors.general && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                <span className="material-symbols-outlined text-red-400 text-lg mt-0.5">error</span>
                <p className="text-sm text-red-400">{errors.general}</p>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">person</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: '' })); }}
                  placeholder="Jane Doe"
                  className={`w-full bg-white/[0.04] border rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${errors.fullName ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/10 focus:border-rh-green/50 focus:ring-rh-green/20'}`}
                />
              </div>
              {errors.fullName && <p className="text-xs text-red-400 mt-1 ml-1">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                  placeholder="jane@example.com"
                  className={`w-full bg-white/[0.04] border rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${errors.email ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/10 focus:border-rh-green/50 focus:ring-rh-green/20'}`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1 ml-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Min. 8 characters"
                  className={`w-full bg-white/[0.04] border rounded-2xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${errors.password ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/10 focus:border-rh-green/50 focus:ring-rh-green/20'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${passwordStrength.label === 'Strong' ? 'text-rh-green' : passwordStrength.label === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
              {errors.password && <p className="text-xs text-red-400 mt-1 ml-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-lg">lock_reset</span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: '' })); }}
                  placeholder="Re-enter password"
                  className={`w-full bg-white/[0.04] border rounded-2xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${errors.confirmPassword ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/10 focus:border-rh-green/50 focus:ring-rh-green/20'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400 mt-1 ml-1">{errors.confirmPassword}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-rh-green hover:bg-rh-green/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.98] mt-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  Creating account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  Create Account
                </>
              )}
            </button>

          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{' '}
          <button
            onClick={onBackToLogin}
            className="text-rh-green font-semibold hover:underline transition-all"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

const BackgroundDecorations: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-96 h-96 bg-rh-green/10 rounded-full blur-3xl animate-pulse" />
    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rh-green/5 rounded-full blur-3xl" />
    <div className="absolute inset-0 opacity-[0.03]" style={{
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }} />
  </div>
);

export default RegisterPage;
