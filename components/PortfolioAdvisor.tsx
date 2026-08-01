import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── TYPES ─────────────────────────────────────────────────

interface PortfolioState {
  holding_id: string;
  symbol: string;
  last_price: number | null;
  regime: 'UPTREND' | 'DOWNTREND' | 'RANGE' | null;
  state: string | null;
  action: Action;
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | null;
  reason: string;
  key_levels: Record<string, number>;
  unrealized_pl_pct: number | null;
  computed_at: string;
}

interface HoldingKind {
  id: string;
  kind: 'HOLDING' | 'WATCHLIST';
}

interface AdvisorRow extends PortfolioState {
  kind: 'HOLDING' | 'WATCHLIST';
}

type Action = 'BUY_DIP' | 'ADD' | 'HOLD' | 'TRIM' | 'SELL' | 'WAIT' | 'AVOID';

interface PortfolioAdvisorProps {
  supabase: SupabaseClient;
  userId: string;
  pollInterval?: number; // ms, default 60_000
  refreshKey?: number;   // bump to force re-fetch
}

// ─── CONSTANTS ─────────────────────────────────────────────

const ACTION_PRIORITY: Record<Action, number> = {
  SELL: 0, TRIM: 1, BUY_DIP: 2, ADD: 3, AVOID: 4, WAIT: 5, HOLD: 6,
};

const ACTION_COLORS: Record<Action, string> = {
  BUY_DIP: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  ADD:     'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  HOLD:    'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  TRIM:    'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  SELL:    'bg-red-500/10 text-red-400 ring-red-500/20',
  WAIT:    'bg-zinc-700/30 text-zinc-400 ring-zinc-600/20',
  AVOID:   'bg-zinc-700/30 text-zinc-400 ring-zinc-600/20',
};

// ─── HELPERS ───────────────────────────────────────────────

const prettifyAction = (a: Action): string =>
  a === 'BUY_DIP' ? 'Buy dip' : a.charAt(0) + a.slice(1).toLowerCase();

const prettifyState = (s: string | null): string => {
  if (!s) return '\u2014';
  return s.replace(/_/g, ' ').toLowerCase();
};

const prettifyLevelKey = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmtPct = (pct: number): string => {
  const rounded = Math.round(pct * 100) / 100;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
};

// ─── COMPONENT ─────────────────────────────────────────────

const PortfolioAdvisor: React.FC<PortfolioAdvisorProps> = ({
  supabase,
  userId,
  pollInterval = 60_000,
  refreshKey,
}) => {
  const [rows, setRows] = useState<AdvisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);

    // Fetch active holdings for this user
    const { data: holdings, error: hErr } = await supabase
      .from('portfolio_holdings')
      .select('id, kind')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (hErr) {
      if (mountedRef.current) { setError(hErr.message); setLoading(false); }
      return;
    }
    if (!holdings || holdings.length === 0) {
      if (mountedRef.current) { setRows([]); setLoading(false); }
      return;
    }

    const kindMap = new Map((holdings as HoldingKind[]).map(h => [h.id, h.kind]));
    const holdingIds = holdings.map(h => h.id);

    const { data: states, error: sErr } = await supabase
      .from('portfolio_state')
      .select('*')
      .in('holding_id', holdingIds);

    if (sErr) {
      if (mountedRef.current) { setError(sErr.message); setLoading(false); }
      return;
    }

    if (!mountedRef.current) return;

    const merged: AdvisorRow[] = ((states || []) as PortfolioState[]).map(s => ({
      ...s,
      kind: kindMap.get(s.holding_id) || 'HOLDING',
    }));

    // Sort: action priority, then symbol
    merged.sort((a, b) => {
      const pa = ACTION_PRIORITY[a.action] ?? 99;
      const pb = ACTION_PRIORITY[b.action] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.symbol.localeCompare(b.symbol);
    });

    setRows(merged);
    setLoading(false);
  }, [supabase, userId]);

  // Initial + refreshKey
  useEffect(() => {
    mountedRef.current = true;
    fetchData(true);
    return () => { mountedRef.current = false; };
  }, [fetchData, refreshKey]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;
    const id = setInterval(() => fetchData(false), pollInterval);
    return () => clearInterval(id);
  }, [fetchData, pollInterval]);

  // ─── RENDER ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
        <p className="text-xs text-zinc-500 font-medium text-center py-10">Loading signals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center py-10 space-y-2">
        <p className="text-xs text-red-400 font-medium">{error}</p>
        <button
          onClick={() => fetchData(true)}
          className="text-xs text-zinc-400 hover:text-white underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
        <p className="text-xs text-zinc-500 font-medium text-center py-10">
          No stocks yet. Add symbols to your portfolio to start getting signals.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Desktop table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <th className="px-5 py-3 font-bold">Symbol</th>
              <th className="px-4 py-3 font-bold text-right">Price</th>
              <th className="px-4 py-3 font-bold text-right">P/L</th>
              <th className="px-4 py-3 font-bold">State</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Levels</th>
              <th className="px-4 py-3 font-bold">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.holding_id}
                className="border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-900/50 transition-colors"
              >
                {/* Symbol */}
                <td className="px-5 py-3">
                  <span className="text-sm font-bold text-white font-mono">{r.symbol}</span>
                  {r.kind === 'WATCHLIST' && (
                    <span className="ml-2 text-[9px] font-bold text-zinc-600 uppercase tracking-wider">watch</span>
                  )}
                </td>

                {/* Price */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-mono tabular-nums text-zinc-300">
                    {r.last_price != null ? `$${Math.round(r.last_price * 100) / 100}` : '\u2014'}
                  </span>
                </td>

                {/* P/L */}
                <td className="px-4 py-3 text-right">
                  {r.unrealized_pl_pct != null ? (
                    <span className={`text-sm font-mono tabular-nums font-bold ${
                      r.unrealized_pl_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {fmtPct(r.unrealized_pl_pct)}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-600">&mdash;</span>
                  )}
                </td>

                {/* State */}
                <td className="px-4 py-3">
                  <span className="text-xs text-zinc-400">{prettifyState(r.state)}</span>
                </td>

                {/* Action */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ${ACTION_COLORS[r.action]}`}>
                    {r.strength === 'STRONG' && <span className="text-[9px]" aria-label="Strong signal">&#9733;</span>}
                    {prettifyAction(r.action)}
                  </span>
                </td>

                {/* Levels */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(r.key_levels || {}).slice(0, 4).map(([key, val]) => (
                      <span
                        key={key}
                        className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-[9px] font-mono tabular-nums text-zinc-400 border border-zinc-700/40"
                        title={`${prettifyLevelKey(key)}: ${val}`}
                      >
                        <span className="text-zinc-500">{prettifyLevelKey(key)}</span>{' '}
                        {Math.round(val * 100) / 100}
                      </span>
                    ))}
                    {Object.keys(r.key_levels || {}).length > 4 && (
                      <span
                        className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-[9px] text-zinc-500 border border-zinc-700/40 cursor-default"
                        title={Object.entries(r.key_levels).map(([k, v]) => `${prettifyLevelKey(k)}: ${v}`).join('\n')}
                      >
                        +{Object.keys(r.key_levels).length - 4}
                      </span>
                    )}
                  </div>
                </td>

                {/* Why */}
                <td className="px-4 py-3 max-w-[200px]">
                  <span
                    className="text-xs text-zinc-400 line-clamp-2"
                    title={r.reason}
                  >
                    {r.reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioAdvisor;
