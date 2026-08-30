import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ───────────────────────────────────────────────────

type EventType = 'BREAKOUT' | 'BREAKDOWN' | 'FAILED_BREAK' | 'COILED';
type Direction = 'LONG' | 'SHORT';
type Stage = 'COILED' | 'BREAKOUT_TODAY' | 'BREAKDOWN_TODAY' | 'RETEST' | 'EXTENDED' | 'FAILED_BREAK' | 'INVALIDATED';
type GateStatus = 'pass' | 'weak' | 'fail' | 'fail_open';

interface Gate { id: number; name: string; status: GateStatus; detail: string }

interface StructureEvent {
  id: string;
  symbol: string;
  trade_date: string;
  event_type: EventType;
  direction: Direction;
  stage: Stage;
  provisional: boolean;
  tier: 'A+' | 'A' | 'B' | 'C' | null;
  conviction_score: number | null;
  gates_passed: number | null;
  gates_fail_open: number | null;
  gates: Gate[] | null;
  has_trade_plan: boolean;

  broken_level: number | null;
  level_type: string | null;
  level_held_days: number | null;
  break_price: number | null;
  break_date: string | null;
  penetration_pct: number | null;
  dist_to_level_pct: number | null;
  pct_vs_level: number | null;

  current_price: number | null;
  entry_price: number | null;
  stop_price: number | null;
  stop_pct: number | null;
  stop_method: string | null;
  risk_unit_r: number | null;

  t1: number | null; t1_rr: number | null; t1_pct: number | null;
  t1_days: number | null; t1_scale_pct: number | null; t1_source: string | null;
  t2: number | null; t2_rr: number | null; t2_pct: number | null;
  t2_days: number | null; t2_scale_pct: number | null; t2_source: string | null;
  t3_method: string | null; t3_scale_pct: number | null;
  t2_beyond_time_stop: boolean | null;

  why_text: string | null;
  score_basis: 'break_gates' | 'squeeze_quality' | 'trap_quality' | null;
  failed_bars_ago: number | null;

  time_stop_days: number | null;
  days_since_break: number | null;
  days_to_time_stop: number | null;

  vol_ratio: number | null;
  rs_vs_spy: number | null; rs_vs_qqq: number | null;
  bb_pctile: number | null; squeeze_days: number | null;
  rsi: number | null; rsi_extended: boolean | null;
  adx: number | null;
  obv_confirms: boolean | null;
  daily_atr_pct: number | null;
  h4_fail_open: boolean | null;
}

// ─── Formatters ──────────────────────────────────────────────

const fp = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';
const fpct = (n: number | null | undefined, d = 1) => n != null ? `${n.toFixed(d)}%` : '—';
const fR = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}R` : '—';

type SortKey = 'conviction' | 'freshness' | 't2_rr' | 'vol_ratio';

// ─── Gate dot ────────────────────────────────────────────────

const GATE_DOT: Record<GateStatus, string> = {
  pass: 'bg-emerald-500',
  weak: 'bg-amber-500',
  fail_open: 'bg-zinc-500',
  fail: 'bg-red-500',
};

// ─── Skeleton card ───────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-5 space-y-4 animate-pulse">
    <div className="flex gap-3"><div className="h-5 w-16 bg-zinc-800 rounded" /><div className="h-5 w-20 bg-zinc-800 rounded" /><div className="h-5 w-12 bg-zinc-800 rounded" /></div>
    <div className="h-8 bg-zinc-800/60 rounded-lg" />
    <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-800/40 rounded-lg" />)}</div>
    <div className="h-6 bg-zinc-800/30 rounded-full" />
  </div>
);

// ─── Tile ────────────────────────────────────────────────────

const Tile: React.FC<{ label: string; value: string; color?: string; sub?: string; subColor?: string; subTitle?: string }> = ({ label, value, color, sub, subColor, subTitle }) => (
  <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-2.5 text-center">
    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-[15px] font-black font-mono ${color || 'text-zinc-100'}`}>{value}</div>
    {sub && <div className={`text-[10px] font-mono mt-0.5 ${subColor || 'text-zinc-500'}`} title={subTitle}>{sub}</div>}
  </div>
);

// ─── Progress bar ────────────────────────────────────────────

const LevelProgress: React.FC<{ e: StructureEvent }> = ({ e }) => {
  if (e.broken_level == null || e.t2 == null || e.current_price == null) return null;
  const isShort = e.direction === 'SHORT';
  const range = Math.abs(e.t2 - e.broken_level);
  if (range === 0) return null;

  const rawPct = isShort
    ? ((e.broken_level - e.current_price) / (e.broken_level - e.t2)) * 100
    : ((e.current_price - e.broken_level) / (e.t2 - e.broken_level)) * 100;
  const pct = Math.max(0, Math.min(100, rawPct));

  const t1Pct = e.t1 != null
    ? Math.max(0, Math.min(100,
        isShort
          ? ((e.broken_level - e.t1) / (e.broken_level - e.t2)) * 100
          : ((e.t1 - e.broken_level) / (e.t2 - e.broken_level)) * 100
      ))
    : null;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
        <span className="uppercase tracking-wider">level → t2 progress</span>
        <span className="font-mono font-bold text-zinc-300">{pct.toFixed(0)}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-zinc-800 overflow-visible">
        <div
          className={`h-full rounded-full ${e.direction === 'LONG' ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
          style={{ width: `${pct}%` }}
        />
        {t1Pct != null && (
          <div className="absolute top-0 bottom-0 w-px bg-amber-400/60" style={{ left: `${t1Pct}%` }} title={`T1 ${fp(e.t1)}`} />
        )}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1">
        <span>{fp(e.broken_level)} level</span>
        {e.t1 != null && <span className="text-amber-400/60">t1 {fp(e.t1)}</span>}
        <span>t2 {fp(e.t2)}</span>
      </div>
    </div>
  );
};

// ─── Gates disclosure ────────────────────────────────────────

const GatesDisclosure: React.FC<{ gates: Gate[] | null; passed: number | null }> = ({ gates, passed }) => {
  const [open, setOpen] = useState(false);
  if (!gates || gates.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        onKeyDown={ev => ev.key === 'Enter' && setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        gates ({passed ?? 0}/7)
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {gates.map(g => (
            <div key={g.id} className="flex items-start gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono border bg-zinc-900/40 border-zinc-800/30">
              <span className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${GATE_DOT[g.status]}`} />
              <span className="font-bold text-zinc-400 shrink-0 w-20">{g.name}</span>
              <span className="text-zinc-500 break-all leading-relaxed">{g.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Full card ───────────────────────────────────────────────

const FullCard: React.FC<{ e: StructureEvent; onLifecycle?: (s: string) => void }> = ({ e, onLifecycle }) => {
  const isLong = e.direction === 'LONG';
  const accentColor = isLong ? '#00d97e' : '#ff4757';
  const pctColor = (e.pct_vs_level ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pctLabel = (e.pct_vs_level ?? 0) >= 0 ? 'above level' : 'below level';

  return (
    <div
      className={`relative bg-[#0d1117] rounded-2xl overflow-hidden border ${e.provisional ? 'border-dashed border-zinc-600' : 'border-[#1e2430]'} hover:border-[#2a3142] transition-all`}
      tabIndex={0}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />
      <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white tracking-tight">{e.symbol}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
              e.event_type === 'BREAKOUT' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40'
              : e.event_type === 'BREAKDOWN' ? 'text-red-400 bg-red-900/30 border-red-700/40'
              : 'text-zinc-400 bg-zinc-800/60 border-zinc-600/40'
            }`}>
              {e.event_type}
            </span>
            {e.tier != null && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black text-amber-300 bg-amber-900/30 border border-amber-600/40">{e.tier}</span>
            )}
            {e.provisional && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-zinc-500 bg-zinc-800/40 border border-zinc-700/30 cursor-help" title="Daily bar still forming — confirms after 4pm ET">provisional</span>
            )}
            {e.gates_passed != null && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-blue-400 bg-blue-900/20 border border-blue-800/30">
                {e.gates_passed}/7
                {(e.gates_fail_open ?? 0) > 0 && (
                  <span className="ml-0.5 cursor-help" title={`${e.gates_fail_open} gate(s) passed on missing data`}>!</span>
                )}
              </span>
            )}
            {e.conviction_score != null && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-violet-400 bg-violet-900/20 border border-violet-800/30 cursor-help"
                title={e.score_basis === 'break_gates' ? 'Break quality across 7 gates' : e.score_basis === 'squeeze_quality' ? 'Squeeze quality — not comparable to breakout scores' : e.score_basis === 'trap_quality' ? 'Trap quality — not comparable to breakout scores' : undefined}
              >
                conv {e.conviction_score}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl font-black font-mono ${pctColor}`}>
              {e.pct_vs_level != null ? `${e.pct_vs_level >= 0 ? '+' : ''}${e.pct_vs_level.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[11px] text-zinc-500">
              {pctLabel}{e.days_since_break != null ? ` · ${e.days_since_break}d ago` : ''}
            </div>
          </div>
        </div>

        {/* Status chip */}
        <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${
          isLong ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-300' : 'bg-red-500/5 border-red-500/15 text-red-300'
        }`}>
          broke {fp(e.break_price)} on {e.break_date || '—'} · {e.level_type || '—'} {fp(e.broken_level)} held {e.level_held_days ?? '—'}d
        </div>

        {/* Why line */}
        {e.why_text && (
          <p className="text-xs text-zinc-400 leading-snug line-clamp-2">{e.why_text}</p>
        )}

        {/* Price tiles */}
        <div className="grid grid-cols-3 gap-2">
          <Tile label="level" value={fp(e.broken_level)} />
          <Tile label="current" value={fp(e.current_price)} color={isLong ? 'text-emerald-400' : 'text-red-400'} />
          <Tile label="stop" value={fp(e.stop_price)} color="text-red-400" />
        </div>

        {/* Target ladder */}
        <div className="grid grid-cols-3 gap-2">
          <Tile
            label={`t1 · ${e.t1_scale_pct ?? '—'}%`}
            value={fp(e.t1)}
            sub={`${e.direction === 'SHORT' ? '' : '+'}${fpct(e.t1_pct)}${e.direction === 'SHORT' ? ' gain' : ''} · ${fR(e.t1_rr)} · ~${e.t1_days ?? '—'}d`}
          />
          <Tile
            label={`t2 · ${e.t2_scale_pct ?? '—'}%`}
            value={fp(e.t2)}
            sub={`${e.direction === 'SHORT' ? '' : '+'}${fpct(e.t2_pct)}${e.direction === 'SHORT' ? ' gain' : ''} · ${fR(e.t2_rr)} · ~${e.t2_days ?? '—'}d`}
            subColor={e.t2_beyond_time_stop ? 'text-amber-400' : undefined}
            subTitle={e.t2_beyond_time_stop ? 'Target is further out than the time stop' : undefined}
          />
          <Tile
            label={`t3 · ${e.t3_scale_pct ?? '—'}%`}
            value="trail"
            sub={e.t3_method || '—'}
          />
        </div>

        {/* Progress bar */}
        <LevelProgress e={e} />

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/40 pt-3">
          <span>
            {e.trade_date} · {e.provisional ? 'provisional' : 'confirmed close'}
          </span>
          <span className="font-mono">
            vol {e.vol_ratio != null ? `${e.vol_ratio.toFixed(1)}x` : '—'} · 1R {fp(e.risk_unit_r)} · day {e.days_since_break ?? '—'} of {e.time_stop_days ?? '—'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <GatesDisclosure gates={e.gates} passed={e.gates_passed} />
          <div className="ml-auto flex gap-2">
            {onLifecycle && (
              <button
                onClick={() => onLifecycle(e.symbol)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:border-zinc-500 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">timeline</span>
                Lifecycle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Compact card ────────────────────────────────────────────

const CompactCard: React.FC<{ e: StructureEvent }> = ({ e }) => {
  const isLong = e.direction === 'LONG';
  const accentColor = e.event_type === 'FAILED_BREAK' ? '#ff4757' : '#71717a';

  let chipText = '';
  if (e.event_type === 'FAILED_BREAK') {
    chipText = `trapped ${isLong ? 'longs' : 'shorts'}${e.failed_bars_ago != null ? ` · broke ${e.failed_bars_ago}d ago` : ''}`;
  } else if (e.event_type === 'COILED') {
    chipText = `coiled ${e.squeeze_days ?? '—'}d · ${fpct(e.dist_to_level_pct)} from ${fp(e.broken_level)}`;
  }

  return (
    <div
      className={`relative bg-[#0d1117] rounded-2xl overflow-hidden border ${e.provisional ? 'border-dashed border-zinc-600' : 'border-[#1e2430]'} hover:border-[#2a3142] transition-all`}
      tabIndex={0}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />
      <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white tracking-tight">{e.symbol}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
              e.event_type === 'FAILED_BREAK' ? 'text-red-400 bg-red-900/30 border-red-700/40'
              : 'text-zinc-400 bg-zinc-800/60 border-zinc-600/40'
            }`}>
              {e.event_type.replace('_', ' ')}
            </span>
            {e.tier != null && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black text-amber-300 bg-amber-900/30 border border-amber-600/40">{e.tier}</span>
            )}
            {e.provisional && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-zinc-500 bg-zinc-800/40 border border-zinc-700/30 cursor-help" title="Daily bar still forming — confirms after 4pm ET">provisional</span>
            )}
            {e.conviction_score != null && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-violet-400 bg-violet-900/20 border border-violet-800/30 cursor-help"
                title={e.score_basis === 'break_gates' ? 'Break quality across 7 gates' : e.score_basis === 'squeeze_quality' ? 'Squeeze quality — not comparable to breakout scores' : e.score_basis === 'trap_quality' ? 'Trap quality — not comparable to breakout scores' : undefined}
              >
                conv {e.conviction_score}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-lg font-black font-mono text-zinc-300">{fp(e.current_price)}</span>
          </div>
        </div>

        {/* Status chip */}
        {chipText && (
          <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${
            e.event_type === 'FAILED_BREAK' ? 'bg-red-500/5 border-red-500/15 text-red-300' : 'bg-zinc-800/30 border-zinc-700/30 text-zinc-400'
          }`}>
            {chipText}
          </div>
        )}

        {/* Why line */}
        {e.why_text && (
          <p className="text-xs text-zinc-400 leading-snug line-clamp-2">{e.why_text}</p>
        )}

        {/* Footer */}
        <div className="text-[11px] text-zinc-500">
          {e.trade_date} · {e.provisional ? 'provisional' : 'confirmed close'}
        </div>
      </div>
    </div>
  );
};

// ─── Main screen ─────────────────────────────────────────────

interface Props {
  onNavigateToLifecycle?: (symbol: string) => void;
}

const StructureBoard: React.FC<Props> = ({ onNavigateToLifecycle }) => {
  const [events, setEvents] = useState<StructureEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  // Filters: multi-select chip set
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('conviction');

  const fetchData = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('v_structure_board')
      .select('*')
      .order('event_type')
      .order('conviction_score', { ascending: false });

    if (!alive.current) return;
    if (err) {
      setError(err.message);
    } else {
      setEvents((data || []) as StructureEvent[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  // Counts per event type
  const counts = useMemo(() => {
    const c: Record<string, number> = { BREAKOUT: 0, BREAKDOWN: 0, FAILED_BREAK: 0, COILED: 0 };
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let todayCount = 0;
    for (const e of events) {
      c[e.event_type] = (c[e.event_type] || 0) + 1;
      if (e.trade_date === todayStr) todayCount++;
    }
    return { ...c, TODAY: todayCount };
  }, [events]);

  const toggleFilter = (f: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  // Filter + sort
  const shown = useMemo(() => {
    let filtered = events;

    if (activeFilters.size > 0) {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      filtered = events.filter(e => {
        if (activeFilters.has('TODAY') && e.trade_date !== todayStr) return false;
        const typeFilters = new Set([...activeFilters].filter(f => f !== 'TODAY'));
        if (typeFilters.size > 0 && !typeFilters.has(e.event_type)) return false;
        return true;
      });
    }

    const BASIS_RANK: Record<string, number> = { break_gates: 0, trap_quality: 1, squeeze_quality: 2 };
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'conviction': {
          const aRank = BASIS_RANK[a.score_basis ?? ''] ?? 3;
          const bRank = BASIS_RANK[b.score_basis ?? ''] ?? 3;
          if (aRank !== bRank) return aRank - bRank;
          return (b.conviction_score ?? 0) - (a.conviction_score ?? 0);
        }
        case 'freshness': return (a.days_since_break ?? 999) - (b.days_since_break ?? 999);
        case 't2_rr': return (b.t2_rr ?? 0) - (a.t2_rr ?? 0);
        case 'vol_ratio': return (b.vol_ratio ?? 0) - (a.vol_ratio ?? 0);
        default: return 0;
      }
    });

    return sorted;
  }, [events, activeFilters, sortBy]);

  const CHIPS: { id: string; label: string; count: number; color: string; activeColor: string }[] = [
    { id: 'TODAY', label: 'TODAY', count: counts.TODAY, color: 'text-blue-400 bg-blue-900/10 border-blue-800/20', activeColor: 'bg-blue-900/30 border-blue-600/60 ring-1 ring-blue-400' },
    { id: 'BREAKOUT', label: 'BREAKOUTS', count: counts.BREAKOUT, color: 'text-emerald-400 bg-emerald-900/10 border-emerald-800/20', activeColor: 'bg-emerald-900/30 border-emerald-600/60 ring-1 ring-emerald-400' },
    { id: 'BREAKDOWN', label: 'BREAKDOWNS', count: counts.BREAKDOWN, color: 'text-red-400 bg-red-900/10 border-red-800/20', activeColor: 'bg-red-900/30 border-red-600/60 ring-1 ring-red-400' },
    { id: 'FAILED_BREAK', label: 'FAILED', count: counts.FAILED_BREAK, color: 'text-zinc-400 bg-zinc-800/20 border-zinc-700/20', activeColor: 'bg-zinc-800/40 border-zinc-500/60 ring-1 ring-zinc-400' },
    { id: 'COILED', label: 'COILED', count: counts.COILED, color: 'text-amber-400 bg-amber-900/10 border-amber-800/20', activeColor: 'bg-amber-900/30 border-amber-600/60 ring-1 ring-amber-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
      <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500 text-xl">error</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400">Fetch error — showing last data</p>
              <p className="text-xs text-red-400/70">{error}</p>
            </div>
            <button onClick={fetchData} className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-wide">Retry</button>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0e16] rounded-2xl border border-[#1e2430] overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-900/20 border border-violet-700/30 flex items-center justify-center text-2xl shrink-0">
              <span className="material-symbols-outlined text-violet-400">stacked_bar_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black tracking-tight uppercase text-white">Structure Board</h1>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE
                </span>
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">Breakouts, breakdowns, failed breaks and coiled setups — daily close scanner</p>
            </div>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">Filter:</span>
          {CHIPS.map(c => {
            const isActive = activeFilters.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleFilter(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${
                  isActive ? `${c.color.split(' ')[0]} ${c.activeColor}` : `${c.color}`
                } ${c.count === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
              >
                <span className="uppercase tracking-wide">{c.label}</span>
                <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{c.count}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-zinc-600 font-bold">{shown.length} of {events.length} shown</span>
            <select
              value={sortBy}
              onChange={ev => setSortBy(ev.target.value as SortKey)}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/40"
            >
              <option value="conviction">Conviction</option>
              <option value="freshness">Break freshness</option>
              <option value="t2_rr">T2 R-multiple</option>
              <option value="vol_ratio">Volume ratio</option>
            </select>
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-800 mb-3 block">stacked_bar_chart</span>
            <p className="text-zinc-400 font-medium">No structure events today.</p>
            <p className="text-zinc-600 text-sm mt-1">The scanner runs every 30 minutes during market hours.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-4">
            {shown.map(e =>
              e.has_trade_plan
                ? <FullCard key={e.id} e={e} onLifecycle={onNavigateToLifecycle} />
                : <CompactCard key={e.id} e={e} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StructureBoard;
