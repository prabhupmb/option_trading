// ═══════════════════════════════════════════════════════════════
// DIP BUY — dashboard screen (tab under Stock Gate)
// Reads stock_dip_lifecycle from Supabase, polls every 30s.
// Signature element: the Dip Ladder bar — swing low → swing high
// with the golden zone shaded, price / stop / T1 markers, mirroring
// the SL→Target progress bar customers already know from Stock Gate.
// ═══════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

type DipState = 'WATCHING' | 'NO_UPTREND' | 'DIP_WATCH' | 'DIP_READY' | 'DIP_BUY' | 'DIP_FAILED';

interface ConfluenceItem { src: string; price: number }

interface DipRow {
  symbol: string;
  dip_state: DipState;
  last_reason: string | null;
  price: number | null;
  bar_dt: string | null;
  trend_4h: string | null;
  swing_high: number | null;
  swing_low: number | null;
  retrace_pct: number | null;
  golden_lo: number | null;
  golden_hi: number | null;
  confluence: number;
  confluence_detail: ConfluenceItem[] | null;
  zone_lo: number | null;
  zone_hi: number | null;
  dip_stop: number | null;
  t1_target: number | null;
  t2_target: number | null;
  buy_signaled_at: string | null;
  stabilizing: boolean;
  selling_exhausted: boolean;
  data_stale: boolean;
  updated_at: string;
}

const STATE_META: Record<DipState, { label: string; chip: string; accent: string; blurb: string }> = {
  DIP_BUY:    { label: 'DIP BUY',    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', accent: 'border-l-emerald-500', blurb: 'Reversal confirmed at support' },
  DIP_READY:  { label: 'DIP READY',  chip: 'bg-amber-500/15 text-amber-400 border-amber-500/40',       accent: 'border-l-amber-500',   blurb: 'Strong support holding — setup forming' },
  DIP_WATCH:  { label: 'DIP WATCH',  chip: 'bg-sky-500/15 text-sky-400 border-sky-500/40',             accent: 'border-l-sky-500',     blurb: 'Pullback in progress — watch support' },
  DIP_FAILED: { label: 'FAILED',     chip: 'bg-rose-500/15 text-rose-400 border-rose-500/40',          accent: 'border-l-rose-500',    blurb: 'Support failed — stand aside' },
  WATCHING:   { label: 'WATCHING',   chip: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',          accent: 'border-l-zinc-600',    blurb: 'Trending — no dip yet' },
  NO_UPTREND: { label: 'NO UPTREND', chip: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',          accent: 'border-l-zinc-700',    blurb: 'Downtrend — a falling price here is not a dip' },
};

const LADDER: DipState[] = ['DIP_WATCH', 'DIP_READY', 'DIP_BUY'];
const fmt = (n: number | null | undefined, d = 2) => (n == null ? '—' : `$${Number(n).toFixed(d)}`);
const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

// ── Dip Ladder bar: swing low → swing high, golden zone shaded ──
function DipLadderBar({ r }: { r: DipRow }) {
  const lo = r.swing_low, hi = r.swing_high;
  if (lo == null || hi == null || hi <= lo) return null;
  const pct = (v: number | null) => (v == null ? null : Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)));
  const pPrice = pct(r.price), pZoneLo = pct(r.golden_lo), pZoneHi = pct(r.golden_hi);
  const pStop = pct(r.dip_stop);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        <span>Swing Low {fmt(lo)}</span>
        <span>{r.retrace_pct != null ? `${(r.retrace_pct * 100).toFixed(0)}% pullback` : ''}</span>
        <span>Swing High {fmt(hi)}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-zinc-800 overflow-visible">
        {/* golden zone */}
        {pZoneLo != null && pZoneHi != null && (
          <div
            className="absolute h-full bg-amber-500/30 border-x border-amber-500/60"
            style={{ left: `${pZoneLo}%`, width: `${Math.max(pZoneHi - pZoneLo, 1)}%` }}
            title={`Golden zone ${fmt(r.golden_lo)}–${fmt(r.golden_hi)}`}
          />
        )}
        {/* stop marker */}
        {pStop != null && (
          <div className="absolute -top-1 h-4 w-0.5 bg-rose-500" style={{ left: `${pStop}%` }} title={`Stop ${fmt(r.dip_stop)}`} />
        )}
        {/* price marker */}
        {pPrice != null && (
          <div
            className="absolute -top-1.5 h-5 w-5 -ml-2.5 rounded-full border-2 border-zinc-950 shadow"
            style={{
              left: `${pPrice}%`,
              background: r.dip_state === 'DIP_BUY' ? '#10b981' : r.dip_state === 'DIP_FAILED' ? '#f43f5e' : '#e4e4e7',
            }}
            title={`Price ${fmt(r.price)}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
        <span className="text-rose-400">🛑 {fmt(r.dip_stop)}</span>
        <span className="text-amber-400">Zone {fmt(r.golden_lo)}–{fmt(r.golden_hi)}</span>
        <span className="text-emerald-400">🎯 T1 {fmt(r.t1_target)} · T2 {fmt(r.t2_target)}</span>
      </div>
    </div>
  );
}

// ── Ladder step indicator: WATCH → READY → BUY ──
function LadderSteps({ state }: { state: DipState }) {
  const idx = LADDER.indexOf(state);
  const failed = state === 'DIP_FAILED';
  return (
    <div className="flex items-center gap-1.5" title="Dip ladder progression">
      {LADDER.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-7 rounded-full ${
              failed ? 'bg-rose-500/30' : i <= idx ? (i === 2 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-zinc-800'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function DipCard({ r, isNew }: { r: DipRow; isNew: boolean }) {
  const meta = STATE_META[r.dip_state] ?? STATE_META.WATCHING;
  const conf = r.confluence_detail ?? [];
  return (
    <div className={`rounded-xl bg-zinc-900/70 border border-l-4 ${meta.accent} p-4 transition-all ${
      isNew ? 'border-emerald-500/60 ring-2 ring-emerald-500/30' : 'border-zinc-800'
    }`}>
      {isNew && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-emerald-400">
          <span>🔔</span> Newly entered DIP BUY
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xl font-bold tracking-tight text-zinc-100">{r.symbol}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
          {r.trend_4h === 'UP' && (
            <span className="text-[11px] px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">4H UP</span>
          )}
          {r.confluence >= 2 && (
            <span className="text-[11px] px-2 py-0.5 rounded border bg-violet-500/10 text-violet-300 border-violet-500/30">
              {r.confluence}× support
            </span>
          )}
          {r.data_stale && (
            <span className="text-[11px] px-2 py-0.5 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/30">STALE</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-mono text-zinc-100">{fmt(r.price)}</div>
          <div className="text-[11px] text-zinc-500">{ago(r.updated_at)}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{meta.blurb}</p>
        <LadderSteps state={r.dip_state} />
      </div>

      <DipLadderBar r={r} />

      {/* stacked support levels */}
      {conf.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {conf.map((c) => (
            <span key={c.src} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {c.src.replace('FIB_', 'Fib ')} {fmt(c.price)}
            </span>
          ))}
        </div>
      )}

      {/* confirmation flags */}
      <div className="mt-3 flex gap-4 text-[11px] text-zinc-500">
        <span className={r.selling_exhausted ? 'text-emerald-400' : ''}>
          {r.selling_exhausted ? '✓' : '○'} Selling exhausting
        </span>
        <span className={r.stabilizing ? 'text-emerald-400' : ''}>
          {r.stabilizing ? '✓' : '○'} Reversal candle
        </span>
        {r.buy_signaled_at && r.dip_state === 'DIP_BUY' && (
          <span className="text-emerald-400 ml-auto">Signaled {ago(r.buy_signaled_at)}</span>
        )}
      </div>
    </div>
  );
}

const FILTERS: { id: string; label: string; states: DipState[] }[] = [
  { id: 'actionable', label: '🟢 Dip Buy',   states: ['DIP_BUY'] },
  { id: 'ready',      label: '👀 Ready',      states: ['DIP_READY'] },
  { id: 'watch',      label: '📉 Watching',   states: ['DIP_WATCH'] },
  { id: 'failed',     label: '🛑 Failed',     states: ['DIP_FAILED'] },
  { id: 'all',        label: 'All',           states: ['DIP_BUY','DIP_READY','DIP_WATCH','DIP_FAILED','WATCHING','NO_UPTREND'] },
];

export default function DipBuyScreen() {
  const [rows, setRows] = useState<DipRow[]>([]);
  const [filter, setFilter] = useState('actionable');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDipBuySymbols, setNewDipBuySymbols] = useState<Set<string>>(new Set());

  // Track previous DIP_BUY symbols to detect newly entered ones
  const prevDipBuyRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error: fetchErr } = await supabase
        .from('stock_dip_lifecycle')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!alive) return;

      if (fetchErr) {
        setError(fetchErr.message);
        // keep last-good rows on screen
      } else if (data) {
        const newRows = data as DipRow[];

        if (!isFirstLoad.current) {
          // Detect symbols that newly entered DIP_BUY since last poll
          const currentBuys = new Set(newRows.filter(r => r.dip_state === 'DIP_BUY').map(r => r.symbol));
          const entered = [...currentBuys].filter(s => !prevDipBuyRef.current.has(s));
          if (entered.length > 0) {
            setNewDipBuySymbols(prev => new Set([...prev, ...entered]));
            // Clear highlights after 60s
            setTimeout(() => {
              setNewDipBuySymbols(prev => {
                const next = new Set(prev);
                entered.forEach(s => next.delete(s));
                return next;
              });
            }, 60_000);
          }
          prevDipBuyRef.current = currentBuys;
        } else {
          // First load: seed the ref, no highlights
          isFirstLoad.current = false;
          prevDipBuyRef.current = new Set(newRows.filter(r => r.dip_state === 'DIP_BUY').map(r => r.symbol));
        }

        setRows(newRows);
        setError(null);
      }
      setLoading(false);
    };

    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = rows.filter((r) => f.states.includes(r.dip_state)).length;
    return c;
  }, [rows]);

  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = rows
    .filter((r) => active.states.includes(r.dip_state))
    .sort((a, b) => active.states.indexOf(a.dip_state) - active.states.indexOf(b.dip_state));

  return (
    <div className="p-6 space-y-5">
      {/* non-blocking error banner */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500 text-xl">error</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">Fetch error — showing last data</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">{error}</p>
          </div>
        </div>
      )}

      {/* header */}
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            DIP BUY TRACKER
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">● ACTIVE</span>
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Pullbacks in confirmed uptrends · golden-zone support · reversal-confirmed entries
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-center">
            <div className="text-emerald-400 font-mono font-bold">{counts.actionable ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Buy Now</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-center">
            <div className="text-amber-400 font-mono font-bold">{counts.ready ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Forming</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-center">
            <div className="text-sky-400 font-mono font-bold">{counts.watch ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pulling Back</div>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Filter:</span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f.id
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {f.label} <span className="font-mono ml-1">{counts[f.id] ?? 0}</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-600">● polling every 30s</span>
      </div>

      {/* cards */}
      {loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Loading dip states…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-zinc-400">No symbols in this state right now.</p>
          <p className="text-zinc-600 text-sm mt-1">
            A dip-buy only prints in a confirmed uptrend, at stacked support, after a reversal candle — patience is the edge.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {shown.map((r) => <DipCard key={r.symbol} r={r} isNew={newDipBuySymbols.has(r.symbol)} />)}
        </div>
      )}
    </div>
  );
}
