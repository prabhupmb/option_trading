import React, { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── TYPES ─────────────────────────────────────────────────

interface PortfolioHolding {
  id: string;
  user_id: string;
  symbol: string;
  kind: 'HOLDING' | 'WATCHLIST';
  shares: number | null;
  avg_cost: number | null;
  entry_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface AddToPortfolioProps {
  supabase: SupabaseClient;
  userId: string;
  onChange?: () => void;
}

type Kind = 'HOLDING' | 'WATCHLIST';

// ─── COMPONENT ─────────────────────────────────────────────

const AddToPortfolio: React.FC<AddToPortfolioProps> = ({ supabase, userId, onChange }) => {
  const [positions, setPositions] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [kind, setKind] = useState<Kind>('HOLDING');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // ─── FETCH ─────────────────────────────────────────────

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setPositions(data || []);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  // ─── VALIDATE & SUBMIT ────────────────────────────────

  const validate = (): boolean => {
    const sym = symbol.trim().toUpperCase();
    if (!sym || !/^[A-Z]{1,5}$/.test(sym)) {
      setFormError('Enter a valid ticker symbol (1-5 letters).');
      return false;
    }
    if (kind === 'HOLDING') {
      if (shares && (isNaN(Number(shares)) || Number(shares) <= 0)) {
        setFormError('Shares must be a positive number.');
        return false;
      }
      if (avgCost && (isNaN(Number(avgCost)) || Number(avgCost) <= 0)) {
        setFormError('Average cost must be a positive number.');
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);

    const sym = symbol.trim().toUpperCase();
    const row: Record<string, unknown> = {
      user_id: userId,
      symbol: sym,
      kind,
      is_active: true,
      shares: kind === 'HOLDING' && shares ? Number(shares) : null,
      avg_cost: kind === 'HOLDING' && avgCost ? Number(avgCost) : null,
      entry_date: kind === 'HOLDING' && entryDate ? entryDate : null,
    };

    const { error: err } = await supabase
      .from('portfolio_holdings')
      .upsert(row, { onConflict: 'user_id,symbol', ignoreDuplicates: false });

    if (err) {
      setFormError(err.message);
    } else {
      setSymbol('');
      setShares('');
      setAvgCost('');
      setEntryDate('');
      await fetchPositions();
      onChange?.();
    }
    setSubmitting(false);
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    const { error: err } = await supabase
      .from('portfolio_holdings')
      .update({ is_active: false })
      .eq('id', id);

    if (!err) {
      setPositions(p => p.filter(h => h.id !== id));
      onChange?.();
    }
    setRemoving(null);
  };

  // ─── RENDER ────────────────────────────────────────────

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Your portfolio</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Add the stocks you want the advisor to watch.</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Symbol */}
          <div className="flex-1">
            <label htmlFor="atp-symbol" className="sr-only">Symbol</label>
            <input
              id="atp-symbol"
              type="text"
              placeholder="Symbol e.g. AAPL"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              maxLength={5}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-zinc-950 font-mono uppercase"
            />
          </div>

          {/* Kind toggle */}
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden flex-shrink-0" role="radiogroup" aria-label="Position type">
            {(['HOLDING', 'WATCHLIST'] as const).map(k => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  kind === k
                    ? 'bg-emerald-500/15 text-emerald-400 border-r border-zinc-800'
                    : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-r border-zinc-800 last:border-r-0'
                }`}
              >
                {k === 'HOLDING' ? 'Holding' : 'Watchlist'}
              </button>
            ))}
          </div>
        </div>

        {/* Holding-only fields */}
        {kind === 'HOLDING' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="atp-shares" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Shares</label>
              <input
                id="atp-shares"
                type="number"
                step="any"
                min="0"
                placeholder="40"
                value={shares}
                onChange={e => setShares(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-zinc-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="atp-avgcost" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Avg cost</label>
              <input
                id="atp-avgcost"
                type="number"
                step="any"
                min="0"
                placeholder="153.20"
                value={avgCost}
                onChange={e => setAvgCost(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-zinc-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="atp-entrydate" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Entry date</label>
              <input
                id="atp-entrydate"
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-zinc-950 [color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {formError && (
          <p className="text-xs text-red-400 font-medium" role="alert">{formError}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          {submitting ? 'Adding...' : 'Add to portfolio'}
        </button>
      </form>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Positions list */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-xs text-zinc-500 font-medium">Loading positions...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-xs text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchPositions}
            className="text-xs text-zinc-400 hover:text-white underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Retry
          </button>
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-zinc-500 font-medium">No stocks yet. Add one above to start getting signals.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* List header */}
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {positions.length} position{positions.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-zinc-600">Removing a stock stops its alerts</span>
          </div>

          {positions.map(h => (
            <div
              key={h.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-bold text-white font-mono">{h.symbol}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  h.kind === 'HOLDING'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'
                }`}>
                  {h.kind === 'HOLDING' ? 'Holding' : 'Watch'}
                </span>
                <span className="text-xs text-zinc-500 font-mono tabular-nums">
                  {h.kind === 'HOLDING' && h.shares != null
                    ? `${Math.round(h.shares)} sh${h.avg_cost != null ? ` @ ${h.avg_cost.toFixed(2)}` : ''}`
                    : '\u2014'}
                </span>
              </div>
              <button
                onClick={() => handleRemove(h.id)}
                disabled={removing === h.id}
                aria-label={`Remove ${h.symbol}`}
                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddToPortfolio;
