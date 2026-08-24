import React, { useMemo, useState } from 'react';
import { useOptionDipTrades } from './useOptionDipTrades';
import { OptionDipCard } from './OptionDipCard';
import { OptionDipSkips } from './OptionDipSkips';
import type { EnrichedTrade } from './types';

type Filter = 'open' | 'wins' | 'losses' | 'closed' | 'skipped' | 'all';

function matchFilter(t: EnrichedTrade, f: Filter): boolean {
  switch (f) {
    case 'open':    return t.status === 'OPEN' || t.status == null;
    case 'wins':    return t.status === 'WIN';
    case 'losses':  return t.status === 'LOSS';
    case 'closed':  return t.status != null && t.status !== 'OPEN';
    case 'all':     return true;
    default:        return true;
  }
}

function distanceToStop(t: EnrichedTrade): number {
  if (t.live_price == null || t.dip_stop == null) return Infinity;
  return Math.abs(t.live_price - t.dip_stop);
}

const OptionDipTab: React.FC = () => {
  const { trades, skips, loading, error } = useOptionDipTrades();
  const [filter, setFilter] = useState<Filter>('open');

  // Counts
  const counts = useMemo(() => {
    const c = { open: 0, wins: 0, losses: 0, closed: 0, skipped24h: 0, all: 0 };
    for (const t of trades) {
      c.all++;
      if (t.status === 'OPEN' || t.status == null) c.open++;
      if (t.status === 'WIN') { c.wins++; c.closed++; }
      if (t.status === 'LOSS') { c.losses++; c.closed++; }
      if (t.status === 'MANUAL_CLOSE') c.closed++;
    }
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    c.skipped24h = skips.filter(s => new Date(s.created_at).getTime() > cutoff24h).length;
    return c;
  }, [trades, skips]);

  // Has any dry run
  const hasDryRun = useMemo(() => trades.some(t => t.order_status === 'dry_run'), [trades]);

  // Filtered & sorted
  const shown = useMemo(() => {
    if (filter === 'skipped') return []; // skips view handled separately
    const filtered = trades.filter(t => matchFilter(t, filter));
    return filtered.sort((a, b) => {
      const aOpen = a.status === 'OPEN' || a.status == null;
      const bOpen = b.status === 'OPEN' || b.status == null;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      if (aOpen && bOpen) return distanceToStop(a) - distanceToStop(b);
      // both closed — sort by closed_at desc
      return (b.closed_at || b.created_at).localeCompare(a.closed_at || a.created_at);
    });
  }, [trades, filter]);

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'open',    label: 'Open',    count: counts.open },
    { id: 'wins',    label: 'Wins',    count: counts.wins },
    { id: 'losses',  label: 'Losses',  count: counts.losses },
    { id: 'closed',  label: 'Closed',  count: counts.closed },
    { id: 'skipped', label: 'Skipped', count: counts.skipped24h },
    { id: 'all',     label: 'All',     count: counts.all },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-xl">error</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400">Fetch error — showing last data</p>
            <p className="text-xs text-red-400/70">{error}</p>
          </div>
        </div>
      )}

      {/* Dry-run banner */}
      {hasDryRun && (
        <div className="flex items-center gap-2 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-amber-400 text-xl">science</span>
          <span className="text-sm font-bold text-amber-400">DRY RUN — these positions were simulated, no orders were sent.</span>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            OPTION DIP POSITIONS
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
              {counts.open > 0 ? '● ACTIVE' : '● IDLE'}
            </span>
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Confirmed dips · re-validated at order time · structure-stopped on the underlying
          </p>
        </div>
        <div className="flex gap-3">
          {([
            ['OPEN', counts.open, 'text-emerald-400'],
            ['WINS', counts.wins, 'text-emerald-400'],
            ['LOSSES', counts.losses, 'text-red-400'],
            ['SKIPPED', counts.skipped24h, 'text-zinc-400'],
          ] as const).map(([label, count, color]) => (
            <div key={label} className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-center min-w-[64px]">
              <div className={`font-mono font-bold ${color}`}>{count}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Filter:</span>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f.id
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {f.label} <span className="font-mono ml-1">{f.count}</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          polling every 30s
        </span>
      </div>

      {/* Content */}
      {filter === 'skipped' ? (
        <OptionDipSkips skips={skips} />
      ) : loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Loading option dip positions...</div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-zinc-400">No positions match this filter.</p>
          <p className="text-zinc-600 text-sm mt-1">
            The executor fires when a stock enters DIP_BUY with a qualifying option chain — patience is the edge.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {shown.map(t => <OptionDipCard key={t.id} trade={t} />)}
        </div>
      )}
    </div>
  );
};

export default OptionDipTab;
