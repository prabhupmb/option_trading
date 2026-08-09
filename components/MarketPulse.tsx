import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ──────────────────────────────────────────────────

type Severity = 'INFO' | 'POSITIVE' | 'WARNING' | 'DANGER';
type BroadcastType = 'TOP_PICK' | 'BREAKOUT' | 'MARKET_CAUTION' | 'MARKET_HEALTHY' | 'INFO';

interface Broadcast {
  id: string;
  broadcast_type: BroadcastType;
  severity: Severity;
  headline: string;
  body: string | null;
  symbols: string[] | null;
  session: string | null;
  is_pinned: boolean;
  active: boolean;
  expires_at: string;
  created_at: string;
}

interface MarketPulseProps {
  isAdmin?: boolean;
  userId?: string;
}

// ─── SEVERITY MAP ───────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { bg: string; border: string; text: string; icon: string }> = {
  DANGER:   { bg: 'bg-red-950/30',    border: 'border-red-700/40',    text: 'text-red-400',    icon: 'error' },
  WARNING:  { bg: 'bg-amber-950/30',  border: 'border-amber-700/40',  text: 'text-amber-400',  icon: 'warning' },
  POSITIVE: { bg: 'bg-emerald-950/30', border: 'border-emerald-700/40', text: 'text-emerald-400', icon: 'trending_up' },
  INFO:     { bg: 'bg-slate-800/40',  border: 'border-slate-700/40',  text: 'text-slate-400',  icon: 'info' },
};

const TYPE_SEVERITY_DEFAULT: Record<BroadcastType, Severity> = {
  TOP_PICK: 'POSITIVE',
  BREAKOUT: 'POSITIVE',
  MARKET_CAUTION: 'WARNING',
  MARKET_HEALTHY: 'POSITIVE',
  INFO: 'INFO',
};

const TYPE_LABELS: Record<BroadcastType, string> = {
  TOP_PICK: 'Top Pick',
  BREAKOUT: 'Breakout',
  MARKET_CAUTION: 'Market Caution',
  MARKET_HEALTHY: 'Market Healthy',
  INFO: 'Info',
};

const BROADCAST_TYPES: BroadcastType[] = ['TOP_PICK', 'BREAKOUT', 'MARKET_CAUTION', 'MARKET_HEALTHY', 'INFO'];
const SEVERITIES: Severity[] = ['INFO', 'POSITIVE', 'WARNING', 'DANGER'];

// ─── BANNER ROW ─────────────────────────────────────────────

const BannerRow: React.FC<{ b: Broadcast; onDismiss: (id: string) => void }> = ({ b, onDismiss }) => {
  const cfg = SEVERITY_CONFIG[b.severity] || SEVERITY_CONFIG.INFO;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border} transition-all`}>
      <span className={`material-symbols-outlined text-lg mt-0.5 flex-shrink-0 ${cfg.text}`}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>{b.headline}</span>
          {b.is_pinned && (
            <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Pinned</span>
          )}
        </div>
        {b.body && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{b.body}</p>}
        {b.symbols && b.symbols.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {b.symbols.map(s => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-[9px] font-mono font-bold text-slate-300 uppercase">{s}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(b.id)}
        className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
};

// ─── COMPOSER MODAL ─────────────────────────────────────────

const ComposerModal: React.FC<{ onClose: () => void; userId: string }> = ({ onClose, userId }) => {
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [broadcastType, setBroadcastType] = useState<BroadcastType>('INFO');
  const [severity, setSeverity] = useState<Severity>('INFO');
  const [symbolsText, setSymbolsText] = useState('');
  const [pinned, setPinned] = useState(false);
  const [expiryHours, setExpiryHours] = useState(6);
  const [replaceActive, setReplaceActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync severity when type changes
  useEffect(() => {
    setSeverity(TYPE_SEVERITY_DEFAULT[broadcastType]);
  }, [broadcastType]);

  const handleSubmit = async () => {
    if (!headline.trim()) { setError('Headline is required'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError('Not authenticated'); setSubmitting(false); return; }

      const symbols = symbolsText.trim()
        ? symbolsText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : [];

      const resp = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/market-broadcast-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          admin_user_id: userId,
          headline: headline.trim(),
          body: body.trim() || null,
          broadcast_type: broadcastType,
          severity,
          symbols,
          is_pinned: pinned,
          expiry_hours: expiryHours,
          replace_active: replaceActive,
        }),
      });

      const result = await resp.json().catch(() => null);
      if (!resp.ok) {
        setError(result?.error || `Server error (${resp.status})`);
        setSubmitting(false);
        return;
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Network error');
      setSubmitting(false);
    }
  };

  // Live preview broadcast
  const previewBroadcast: Broadcast = {
    id: 'preview',
    broadcast_type: broadcastType,
    severity,
    headline: headline || 'Your headline here',
    body: body || null,
    symbols: symbolsText.trim() ? symbolsText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : null,
    session: null,
    is_pinned: pinned,
    active: true,
    expires_at: '',
    created_at: new Date().toISOString(),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d1117] border border-[#1e2430] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2430]">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-400">campaign</span>
            Push Broadcast
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Headline */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Headline *</label>
            <input
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Market's weak - don't force it"
              className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Optional detail text..."
              rows={2}
              className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Type + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
              <select
                value={broadcastType}
                onChange={e => setBroadcastType(e.target.value as BroadcastType)}
                className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {BROADCAST_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as Severity)}
                className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Symbols */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Symbols (comma-separated)</label>
            <input
              value={symbolsText}
              onChange={e => setSymbolsText(e.target.value)}
              placeholder="SPY, QQQ, AAPL"
              className="w-full px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expires in (hours)</label>
            <input
              type="number"
              value={expiryHours}
              onChange={e => setExpiryHours(Math.max(1, parseInt(e.target.value) || 6))}
              min={1}
              max={72}
              className="w-24 px-3 py-2 bg-[#080b10] border border-[#1e2430] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-amber-500" />
              <span className="text-xs font-bold text-slate-400">Pin to top</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={replaceActive} onChange={e => setReplaceActive(e.target.checked)} className="accent-red-500" />
              <span className="text-xs font-bold text-slate-400">Replace current banners</span>
            </label>
          </div>

          {/* Live preview */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Preview</label>
            <BannerRow b={previewBroadcast} onDismiss={() => {}} />
          </div>

          {/* Error */}
          {error && <p className="text-xs font-bold text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e2430]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#1e2430] text-xs font-bold text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !headline.trim()}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
              submitting || !headline.trim()
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-600/20'
            }`}
          >
            {submitting ? 'Sending...' : 'Push Broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────

const MarketPulse: React.FC<MarketPulseProps> = ({ isAdmin = false, userId }) => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showComposer, setShowComposer] = useState(false);
  const mountedRef = useRef(true);

  const fetchBroadcasts = useCallback(async () => {
    const { data, error } = await supabase
      .from('market_broadcasts')
      .select('*')
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && mountedRef.current) {
      setBroadcasts(data || []);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchBroadcasts();
    return () => { mountedRef.current = false; };
  }, [fetchBroadcasts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('market_broadcasts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_broadcasts' }, () => {
        fetchBroadcasts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBroadcasts]);

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const visible = broadcasts.filter(b => !dismissed.has(b.id));

  if (visible.length === 0 && !isAdmin) return null;

  return (
    <>
      <div className="px-4 md:px-8">
        {visible.length > 0 && (
          <div className="space-y-2 py-2">
            {visible.map(b => <BannerRow key={b.id} b={b} onDismiss={handleDismiss} />)}
          </div>
        )}
        {isAdmin && (
          <div className={visible.length > 0 ? 'pb-2' : 'py-2'}>
            <button
              onClick={() => setShowComposer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-700/30 bg-amber-900/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-900/30 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">campaign</span>
              Push Broadcast
            </button>
          </div>
        )}
      </div>

      {showComposer && userId && (
        <ComposerModal onClose={() => { setShowComposer(false); fetchBroadcasts(); }} userId={userId} />
      )}
    </>
  );
};

export default MarketPulse;
