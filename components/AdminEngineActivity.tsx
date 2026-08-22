import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ───────────────────────────────────────────────────

type Decision = 'PLACED' | 'DRY_RUN' | 'REJECTED_RR' | 'SKIPPED' | 'ORDER_FAILED';

interface AdminDecisionSummary {
  trade_date_et: string;
  users_active: number;
  candidates: number;
  placed: number;
  dry_run: number;
  rejected_rr: number;
  skipped: number;
  failed: number;
  avg_rr_placed: number | null;
  total_risk_deployed: number | null;
  risk_stddev: number | null;
  tp_capped_by_time: number;
  regime: string | null;
}

interface AdminDecisionRow {
  id: string;
  run_id: string;
  user_id: string;
  display_name: string | null;
  user_email: string | null;
  symbol: string;
  trade_side: 'LONG' | 'SHORT';
  decision: Decision;
  skip_reason: string | null;
  entry_price: number | null;
  risk_unit_r: number | null;
  r_method: string | null;
  bracket_sl: number | null;
  sl_dist_pct: number | null;
  st5m_value: number | null;
  bracket_tp: number | null;
  tp_source: 'target_2R' | 'feasibility_capped' | 'fib_capped' | null;
  reward_risk: number | null;
  fib_target: number | null;
  fib_dist_pct: number | null;
  feasible_move_pct: number | null;
  mins_left_in_session: number | null;
  quantity: number | null;
  total_cost: number | null;
  risk_dollars_target: number | null;
  actual_risk_dollars: number | null;
  qty_by_risk: number | null;
  qty_by_affordability: number | null;
  sized_by: 'risk' | 'affordability' | null;
  regime: string | null;
  regime_summary: string | null;
  global_rank: number | null;
  claude_confidence: number | null;
  claude_reasoning: string | null;
  adx_value: number | null;
  rs_vs_spy: number | null;
  vol_ratio: number | null;
  atr15m: number | null;
  order_id: string | null;
  order_status: string | null;
  order_type: string | null;
  dry_run: boolean;
  broker: string | null;
  submitted_at: string | null;
  decided_at: string;
  trade_date_et: string;
}

// ─── Helpers ─────────────────────────────────────────────────

const fp = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';
const fr3 = (n: number | null | undefined) => n != null ? `$${n.toFixed(3)}` : '—';
const frr = (n: number | null | undefined) => n != null ? `${n.toFixed(2)}R` : '—';
const fpct = (n: number | null | undefined) => n != null ? `${n.toFixed(2)}%` : '—';

function toET(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso.slice(11, 16); }
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

const DC: Record<Decision, { bg: string; text: string; border: string }> = {
  PLACED:       { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  DRY_RUN:      { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  REJECTED_RR:  { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  SKIPPED:      { bg: 'bg-zinc-500/10',    text: 'text-zinc-400',    border: 'border-zinc-500/30' },
  ORDER_FAILED: { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30' },
};

const ALL_DECISIONS: Decision[] = ['PLACED', 'DRY_RUN', 'REJECTED_RR', 'SKIPPED', 'ORDER_FAILED'];

function rrColor(rr: number | null | undefined): string {
  if (rr == null) return 'text-zinc-500';
  if (rr >= 2) return 'text-emerald-400';
  if (rr >= 1.5) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Small sub-components ────────────────────────────────────

const Badge: React.FC<{ decision: Decision }> = ({ decision }) => {
  const c = DC[decision];
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>{decision.replace(/_/g, ' ')}</span>;
};

const Side: React.FC<{ side: 'LONG' | 'SHORT' }> = ({ side }) => (
  <span className={`text-[10px] font-bold uppercase ${side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{side}</span>
);

const RRMeter: React.FC<{ rr: number | null | undefined }> = ({ rr }) => {
  if (rr == null) return <span className="text-zinc-600 font-mono text-sm">—</span>;
  const pct = Math.min(100, (rr / 4) * 100);
  const tickPct = (1.5 / 4) * 100;
  return (
    <div className="relative flex items-center gap-2">
      <span className={`font-mono text-sm font-black ${rrColor(rr)} relative z-10 shrink-0`}>{rr.toFixed(2)}R</span>
      <div className="flex-1 h-3 bg-zinc-800/60 rounded-full overflow-hidden relative hidden md:block">
        <div className={`h-full rounded-full ${rr >= 2 ? 'bg-emerald-500/40' : rr >= 1.5 ? 'bg-amber-500/40' : 'bg-red-500/40'}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 bottom-0 w-px bg-zinc-400/50" style={{ left: `${tickPct}%` }} title="1.5R reject threshold" />
      </div>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="flex-1 min-w-[100px] bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</div>
    <div className="text-lg font-black text-white font-mono leading-tight">{value}</div>
    {sub && <div className="mt-0.5">{sub}</div>}
  </div>
);

const SkeletonRow: React.FC = () => (
  <div className="flex gap-3 px-4 py-3 border-b border-zinc-800/30 animate-pulse">
    {[36, 56, 56, 40, 72, 56, 56, 56, 48, 36, 56].map((w, i) => (
      <div key={i} className="h-4 rounded bg-zinc-800" style={{ width: w }} />
    ))}
  </div>
);

// ─── Detail groups ───────────────────────────────────────────

const DG: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{title}</h4>
    <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3 space-y-1 text-xs font-mono">{children}</div>
  </div>
);

const DR: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <span className="text-zinc-500 shrink-0">{label}</span>
    <span className="text-zinc-200 text-right">{value}</span>
  </div>
);

const ExpandedRow: React.FC<{ d: AdminDecisionRow }> = ({ d }) => {
  const showSkip = !['PLACED', 'DRY_RUN'].includes(d.decision) && d.skip_reason;
  return (
    <div className="px-4 py-4 bg-zinc-950/50 border-t border-zinc-800/30 space-y-4">
      {showSkip && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Skip Reason</div>
          <pre className="text-xs font-mono text-amber-300/90 whitespace-pre-wrap leading-relaxed">{d.skip_reason}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Why this stop */}
        <DG title="Why this stop">
          <DR label="Entry" value={fp(d.entry_price)} />
          <DR label="1R" value={fr3(d.risk_unit_r)} />
          <DR label="R method" value={d.r_method || '—'} />
          <DR label="Stop loss" value={fp(d.bracket_sl)} />
          <DR label="SL dist" value={fpct(d.sl_dist_pct)} />
          <DR label="ST 5M" value={fp(d.st5m_value)} />
          <div className="pt-1 border-t border-zinc-800/40 text-[10px] text-zinc-600 leading-relaxed">
            R is the distance from entry to the stop. The target and the position size are both derived from it.
          </div>
        </DG>

        {/* Why this target */}
        <DG title="Why this target">
          <DR label="Target" value={fp(d.bracket_tp)} />
          <DR label="TP source" value={d.tp_source?.replace(/_/g, ' ') || '—'} />
          <DR label="Fib target" value={fp(d.fib_target)} />
          <DR label="Fib dist" value={fpct(d.fib_dist_pct)} />
          <DR label="Feasible move" value={fpct(d.feasible_move_pct)} />
          <DR label="Mins left" value={d.mins_left_in_session != null ? `${d.mins_left_in_session}m` : '—'} />
          {d.tp_source === 'feasibility_capped' && (
            <div className="pt-1 border-t border-amber-500/20 text-[10px] text-amber-400/80 leading-relaxed">
              The signal's target was further than this stock could realistically travel in the time remaining, so the target was pulled in.
            </div>
          )}
          {d.tp_source === 'fib_capped' && (
            <div className="pt-1 border-t border-amber-500/20 text-[10px] text-amber-400/80 leading-relaxed">
              The Fibonacci target was nearer than 2R, so it was used instead.
            </div>
          )}
        </DG>

        {/* Why this size */}
        <DG title="Why this size">
          <DR label="Quantity" value={d.quantity ?? '—'} />
          <DR label="Qty (risk)" value={d.qty_by_risk ?? '—'} />
          <DR label="Qty (afford)" value={d.qty_by_affordability ?? '—'} />
          <DR label="Sized by" value={d.sized_by || '—'} />
          <DR label="Total cost" value={fp(d.total_cost)} />
          <DR label="Risk target" value={fp(d.risk_dollars_target)} />
          <DR label="Actual risk" value={fp(d.actual_risk_dollars)} />
        </DG>

        {/* Signal context */}
        <DG title="Signal context">
          <DR label="Regime" value={
            <span className={d.regime === 'RISK_ON' ? 'text-emerald-400' : d.regime === 'RISK_OFF' ? 'text-red-400' : 'text-zinc-300'}>
              {d.regime || '—'}
            </span>
          } />
          {d.regime_summary && <div className="text-[10px] text-zinc-500 leading-relaxed">{d.regime_summary}</div>}
          <DR label="Rank" value={d.global_rank ?? '—'} />
          <DR label="Claude conf" value={d.claude_confidence != null ? `${d.claude_confidence}%` : '—'} />
          {d.claude_reasoning && <div className="text-[10px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/40">{d.claude_reasoning}</div>}
          <DR label="ADX" value={d.adx_value != null ? d.adx_value.toFixed(1) : '—'} />
          <DR label="RS vs SPY" value={d.rs_vs_spy != null ? d.rs_vs_spy.toFixed(2) : '—'} />
          <DR label="Vol ratio" value={d.vol_ratio != null ? `${d.vol_ratio.toFixed(2)}x` : '—'} />
          <DR label="ATR 15M" value={d.atr15m != null ? `$${d.atr15m.toFixed(3)}` : '—'} />
        </DG>

        {/* Order */}
        {d.order_id && (
          <DG title="Order">
            <DR label="Order ID" value={
              <span className="select-all cursor-copy" title="Click to copy">{d.order_id}</span>
            } />
            <DR label="Status" value={d.order_status || '—'} />
            <DR label="Type" value={d.order_type || '—'} />
            <DR label="Broker" value={d.broker || '—'} />
            <DR label="Submitted" value={d.submitted_at ? toET(d.submitted_at) : '—'} />
          </DG>
        )}
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────

const PAGE_SIZE = 50;

const AdminEngineActivity: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<AdminDecisionSummary | null>(null);
  const [rows, setRows] = useState<AdminDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  // Filters
  const [date, setDate] = useState(getTodayET());
  const [userFilter, setUserFilter] = useState<string>('');
  const [decisionFilter, setDecisionFilter] = useState<Set<Decision>>(new Set(ALL_DECISIONS));
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDryRuns, setShowDryRuns] = useState(false);
  const [groupByRun, setGroupByRun] = useState(false);

  // Fetch summary (always, for the collapsed header)
  useEffect(() => {
    setSummaryLoading(true);
    supabase
      .from('v_admin_decision_summary')
      .select('*')
      .eq('trade_date_et', date)
      .maybeSingle()
      .then(({ data }) => {
        setSummary(data as AdminDecisionSummary | null);
        setSummaryLoading(false);
      });
  }, [date]);

  // Fetch rows (only when expanded)
  const fetchRows = useCallback(async (reset = false) => {
    if (!expanded) return;
    const page = reset ? 0 : pageRef.current;
    if (reset) { pageRef.current = 0; setRows([]); setHasMore(true); }
    setLoading(true);

    const { data } = await supabase
      .from('v_admin_decision_history')
      .select('*')
      .eq('trade_date_et', date)
      .order('decided_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const fetched = (data as AdminDecisionRow[]) || [];
    setRows(prev => reset ? fetched : [...prev, ...fetched]);
    setHasMore(fetched.length === PAGE_SIZE);
    pageRef.current = page + 1;
    setLoading(false);
  }, [expanded, date]);

  useEffect(() => { if (expanded) fetchRows(true); }, [expanded, date]);

  // Distinct users for filter dropdown
  const distinctUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = r.user_id;
      if (!map.has(key)) map.set(key, r.display_name || r.user_email || r.user_id.slice(0, 8));
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // Client-side filter
  const filtered = useMemo(() => {
    let f = rows;
    if (!showDryRuns) f = f.filter(r => !r.dry_run);
    f = f.filter(r => decisionFilter.has(r.decision));
    if (userFilter) f = f.filter(r => r.user_id === userFilter);
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toUpperCase();
      f = f.filter(r => r.symbol.includes(q));
    }
    return f;
  }, [rows, showDryRuns, decisionFilter, userFilter, symbolSearch]);

  // Run groups
  const runGroups = useMemo(() => {
    if (!groupByRun) return null;
    const map = new Map<string, AdminDecisionRow[]>();
    for (const r of filtered) {
      const k = r.run_id || r.id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([runId, items]) => {
      const earliest = items.reduce((a, b) => a.decided_at < b.decided_at ? a : b);
      const placed = items.filter(r => r.decision === 'PLACED' || r.decision === 'DRY_RUN').length;
      return { runId, items, earliestAt: earliest.decided_at, regime: earliest.regime, placed, total: items.length };
    });
  }, [filtered, groupByRun]);

  const toggleDecision = (d: Decision) => {
    setDecisionFilter(prev => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  };

  // ─── Collapsed header ───────────────────────────────────────

  const s = summary;
  const regimeColor = s?.regime === 'RISK_ON' ? 'text-emerald-400' : s?.regime === 'RISK_OFF' ? 'text-red-400' : 'text-zinc-400';

  const headerLine = summaryLoading
    ? 'Loading...'
    : s
    ? `${s.candidates} candidates · ${s.placed} placed · ${s.rejected_rr} rejected · ${s.failed} failed`
    : 'No engine activity today';

  // ─── Render ──────────────────────────────────────────────────

  const renderRow = (d: AdminDecisionRow) => {
    const isExp = expandedId === d.id;
    const userName = d.display_name || d.user_email || d.user_id.slice(0, 8);
    return (
      <React.Fragment key={d.id}>
        {/* Desktop */}
        <tr
          className={`hidden md:table-row cursor-pointer transition-colors hover:bg-zinc-800/30 ${isExp ? 'bg-zinc-800/20' : ''}`}
          onClick={() => setExpandedId(isExp ? null : d.id)}
        >
          <td className="px-2 py-2 text-xs font-mono text-zinc-500">{toET(d.decided_at)}</td>
          <td className="px-2 py-2 text-xs text-zinc-300 truncate max-w-[120px]" title={userName}>{userName}</td>
          <td className="px-2 py-2 text-sm font-black text-white tracking-tight">{d.symbol}</td>
          <td className="px-2 py-2"><Side side={d.trade_side} /></td>
          <td className="px-2 py-2"><Badge decision={d.decision} /></td>
          <td className="px-2 py-2 text-xs font-mono text-zinc-400">{fp(d.entry_price)}</td>
          <td className="px-2 py-2">
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-300">{fp(d.bracket_sl)}</span>
              {d.sl_dist_pct != null && <span className="text-[9px] font-mono text-zinc-600">{fpct(d.sl_dist_pct)}</span>}
            </div>
          </td>
          <td className="px-2 py-2 text-xs font-mono text-zinc-400">{fp(d.bracket_tp)}</td>
          <td className="px-2 py-2 min-w-[120px]"><RRMeter rr={d.reward_risk} /></td>
          <td className="px-2 py-2 text-xs font-mono text-zinc-300">{d.quantity ?? '—'}</td>
          <td className="px-2 py-2">
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-200">{fp(d.actual_risk_dollars)}</span>
              {d.risk_dollars_target != null && (
                <span className="text-[9px] font-mono text-zinc-600">target {fp(d.risk_dollars_target)}</span>
              )}
              {d.sized_by === 'affordability' && (
                <span className="text-[9px] text-amber-500 cursor-help" title="Sized down to fit buying power, so this risks less than target.">
                  <span className="material-symbols-outlined text-[11px] align-middle">info</span> afford-limited
                </span>
              )}
            </div>
          </td>
          <td className="px-2 py-2 text-zinc-600">
            <span className={`material-symbols-outlined text-sm transition-transform ${isExp ? 'rotate-180' : ''}`}>expand_more</span>
          </td>
        </tr>
        {/* Mobile card */}
        <tr className="md:hidden">
          <td colSpan={12}>
            <div
              className={`mx-2 my-1 rounded-lg border cursor-pointer ${isExp ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-900/40 border-zinc-800/40'}`}
              onClick={() => setExpandedId(isExp ? null : d.id)}
            >
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-black text-white">{d.symbol}</span>
                  <Side side={d.trade_side} />
                  <Badge decision={d.decision} />
                  <span className="ml-auto text-[10px] font-mono text-zinc-600">{toET(d.decided_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                  <span className="truncate max-w-[120px]">{userName}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <RRMeter rr={d.reward_risk} />
                  <span className="font-mono text-zinc-400">{fp(d.actual_risk_dollars)}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
        {isExp && (
          <tr><td colSpan={12}><ExpandedRow d={d} /></td></tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="border border-zinc-800/50 rounded-xl bg-zinc-900/20 overflow-hidden">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-800/20 transition-colors"
      >
        <span className="text-base">&#9881;&#65039;</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Engine Activity</span>
            <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">Admin</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-0.5">{headerLine}</div>
        </div>
        {s?.regime && <span className={`text-[10px] font-bold uppercase ${regimeColor}`}>{s.regime.replace('_', ' ')}</span>}
        <span className={`material-symbols-outlined text-zinc-600 text-lg transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-zinc-800/40 px-5 py-5 space-y-5">
          {/* Stat tiles */}
          <div className="flex gap-2.5 flex-wrap">
            <Tile label="Candidates" value={s?.candidates ?? '—'} />
            <Tile label="Placed" value={s?.placed ?? '—'} sub={
              s?.avg_rr_placed != null ? <span className="text-[10px] font-mono text-zinc-500">avg {s.avg_rr_placed.toFixed(2)}R</span> : null
            } />
            <Tile label="Rejected (R:R)" value={s?.rejected_rr ?? '—'} />
            <Tile label="Risk Deployed" value={fp(s?.total_risk_deployed)} sub={(() => {
              const sd = s?.risk_stddev;
              if (sd == null) return null;
              const [c, l] = sd < 5 ? ['text-emerald-400', 'Consistent'] : sd <= 15 ? ['text-amber-400', 'Uneven'] : ['text-red-400', 'Erratic'];
              return <span className={`text-[10px] font-bold ${c} cursor-help`} title="Spread of dollar risk across today's placed trades. Lower is better — it means every trade risked a similar amount.">{l} (sd {sd.toFixed(1)})</span>;
            })()} />
            <Tile label="Users Active" value={s?.users_active ?? '—'} />
          </div>

          {/* Dry-run notice */}
          {s && s.dry_run > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-amber-400 text-sm">science</span>
              <span className="text-xs font-medium text-amber-400">{s.dry_run} decision{s.dry_run !== 1 ? 's were' : ' was a'} dry run{s.dry_run !== 1 ? 's' : ''} — no live orders sent.</span>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 bg-zinc-900/30 border border-zinc-800/40 rounded-lg px-3 py-2.5">
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setExpandedId(null); }}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none focus:border-emerald-500/40"
            />

            {/* User filter */}
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/40"
            >
              <option value="">All users</option>
              {distinctUsers.map(([uid, name]) => (
                <option key={uid} value={uid}>{name}</option>
              ))}
            </select>

            {/* Decision chips */}
            <div className="flex gap-1">
              {ALL_DECISIONS.map(d => {
                const c = DC[d];
                const on = decisionFilter.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDecision(d)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border transition-all ${
                      on ? `${c.bg} ${c.text} ${c.border}` : 'bg-transparent border-zinc-800/40 text-zinc-700'
                    }`}
                  >
                    {d.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>

            {/* Symbol search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-sm text-zinc-600">search</span>
              <input
                type="text"
                placeholder="Symbol..."
                value={symbolSearch}
                onChange={e => setSymbolSearch(e.target.value)}
                className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg pl-7 pr-2 py-1 text-xs text-zinc-300 font-mono w-20 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            <label className="flex items-center gap-1 cursor-pointer ml-auto">
              <input type="checkbox" checked={showDryRuns} onChange={e => setShowDryRuns(e.target.checked)} className="accent-emerald-500 w-3 h-3" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Dry runs</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={groupByRun} onChange={e => setGroupByRun(e.target.checked)} className="accent-emerald-500 w-3 h-3" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Group by run</span>
            </label>
          </div>

          {/* Table */}
          <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="hidden md:table-row border-b border-zinc-800/50">
                  {['Time', 'User', 'Symbol', 'Side', 'Decision', 'Entry', 'SL', 'TP', 'R:R', 'Qty', 'Risk $', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <>{[1,2,3,4,5].map(i => <tr key={i}><td colSpan={12}><SkeletonRow /></td></tr>)}</>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={12}>
                      <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-3xl text-zinc-800 mb-2 block">history</span>
                        <p className="text-sm text-zinc-500 font-medium">No engine activity for this date.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.length > 0 && !groupByRun && filtered.map(renderRow)}

                {runGroups && runGroups.map(g => (
                  <React.Fragment key={g.runId}>
                    <tr className="bg-zinc-800/20 sticky top-0 z-10">
                      <td colSpan={12}>
                        <div className="flex items-center gap-3 px-3 py-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 font-mono">{toET(g.earliestAt)}</span>
                          {g.regime && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              g.regime === 'RISK_ON' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : g.regime === 'RISK_OFF' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                              : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/30'
                            }`}>{g.regime}</span>
                          )}
                          <span className="text-[10px] font-bold text-zinc-500">{g.placed}/{g.total} placed</span>
                          <span className="text-[9px] font-mono text-zinc-700 ml-auto">{g.runId.slice(0, 8)}</span>
                        </div>
                      </td>
                    </tr>
                    {g.items.map(renderRow)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Load more */}
            {hasMore && filtered.length > 0 && (
              <div className="flex justify-center py-3 border-t border-zinc-800/30">
                <button
                  onClick={() => fetchRows(false)}
                  disabled={loading}
                  className="text-xs font-bold text-zinc-500 hover:text-emerald-400 uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="text-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
              {filtered.length} decision{filtered.length !== 1 ? 's' : ''} shown
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEngineActivity;
