import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ───────────────────────────────────────────────────

type Decision = 'PLACED' | 'DRY_RUN' | 'REJECTED_RR' | 'SKIPPED' | 'ORDER_FAILED';

interface StockTradeDecision {
  id: string;
  run_id: string;
  user_id: string;
  symbol: string;
  trade_side: 'LONG' | 'SHORT';
  signal_id: string | null;
  decision: Decision;
  skip_reason: string | null;
  regime: string | null;
  regime_summary: string | null;
  mins_left_in_session: number | null;
  global_rank: number | null;
  claude_confidence: number | null;
  claude_reasoning: string | null;
  adx_value: number | null;
  rs_vs_spy: number | null;
  vol_ratio: number | null;
  st5m_value: number | null;
  st15m_value: number | null;
  atr15m: number | null;
  entry_price: number | null;
  risk_unit_r: number | null;
  r_method: string | null;
  bracket_sl: number | null;
  sl_dist_pct: number | null;
  bracket_tp: number | null;
  tp_source: 'target_2R' | 'feasibility_capped' | 'fib_capped' | null;
  reward_risk: number | null;
  fib_target: number | null;
  fib_dist_pct: number | null;
  feasible_move: number | null;
  feasible_move_pct: number | null;
  quantity: number | null;
  total_cost: number | null;
  risk_dollars_target: number | null;
  actual_risk_dollars: number | null;
  qty_by_risk: number | null;
  qty_by_affordability: number | null;
  sized_by: 'risk' | 'affordability' | null;
  order_id: string | null;
  order_status: string | null;
  order_type: string | null;
  dry_run: boolean;
  decided_at: string;
  created_at: string;
}

interface DecisionDaily {
  user_id: string;
  trade_date: string;
  candidates: number;
  placed: number;
  rejected_rr: number;
  skipped: number;
  failed: number;
  avg_rr_placed: number | null;
  avg_rr_rejected: number | null;
  total_risk_deployed: number | null;
  risk_consistency_stddev: number | null;
  tp_capped_by_time: number;
  regime: string | null;
}

interface RejectionReason {
  user_id: string;
  trade_date: string;
  reason_bucket: string;
  occurrences: number;
  avg_rr: number | null;
  symbols: string[];
}

// ─── Helpers ─────────────────────────────────────────────────

const fmtPrice = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';
const fmtR3 = (n: number | null | undefined) => n != null ? `$${n.toFixed(3)}` : '—';
const fmtRR = (n: number | null | undefined) => n != null ? `${n.toFixed(2)}R` : '—';
const fmtPct = (n: number | null | undefined) => n != null ? `${n.toFixed(2)}%` : '—';
const fmtCurrency = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';

function toET(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso.slice(11, 16); }
}

function toETDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  } catch { return iso.slice(0, 10); }
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

const DECISION_COLORS: Record<Decision, { bg: string; text: string; border: string }> = {
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

// ─── Sub-components ──────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="flex gap-3 px-4 py-3 border-b border-zinc-800/40 animate-pulse">
    {[40, 64, 48, 80, 56, 48, 40, 56, 72].map((w, i) => (
      <div key={i} className="h-4 rounded bg-zinc-800" style={{ width: w }} />
    ))}
  </div>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="flex-1 min-w-[120px] bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
    <div className="text-xl font-black text-white font-mono">{value}</div>
    {sub && <div className="mt-1">{sub}</div>}
  </div>
);

const RRMeter: React.FC<{ rr: number | null | undefined }> = ({ rr }) => {
  if (rr == null) return <span className="text-zinc-600 font-mono text-sm">—</span>;
  const pct = Math.min(100, (rr / 4) * 100);
  const breakEvenPct = (1.5 / 4) * 100;
  return (
    <div className="relative flex items-center gap-2">
      <span className={`font-mono text-sm font-black ${rrColor(rr)} relative z-10`}>{rr.toFixed(2)}R</span>
      <div className="flex-1 h-3 bg-zinc-800/60 rounded-full overflow-hidden relative hidden md:block">
        <div
          className={`h-full rounded-full transition-all ${rr >= 2 ? 'bg-emerald-500/40' : rr >= 1.5 ? 'bg-amber-500/40' : 'bg-red-500/40'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-zinc-400/50"
          style={{ left: `${breakEvenPct}%` }}
          title="1.5R floor"
        />
      </div>
    </div>
  );
};

const DecisionBadge: React.FC<{ decision: Decision }> = ({ decision }) => {
  const c = DECISION_COLORS[decision];
  const label = decision.replace('_', ' ');
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  );
};

const SideBadge: React.FC<{ side: 'LONG' | 'SHORT' }> = ({ side }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wide ${side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
    {side}
  </span>
);

// ─── Detail panel sections ───────────────────────────────────

const DetailGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{title}</h4>
    <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3 space-y-1 text-xs font-mono">
      {children}
    </div>
  </div>
);

const DRow: React.FC<{ label: string; value: React.ReactNode; muted?: boolean }> = ({ label, value, muted }) => (
  <div className="flex justify-between gap-4">
    <span className="text-zinc-500 shrink-0">{label}</span>
    <span className={muted ? 'text-zinc-500' : 'text-zinc-200'}>{value}</span>
  </div>
);

const ExpandedDetail: React.FC<{ d: StockTradeDecision }> = ({ d }) => {
  const showSkipReason = d.decision !== 'PLACED' && d.decision !== 'DRY_RUN' && d.skip_reason;
  return (
    <div className="px-4 py-4 bg-zinc-950/50 border-t border-zinc-800/30 space-y-4">
      {showSkipReason && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Skip Reason</div>
          <div className="text-xs font-mono text-amber-300/90 whitespace-pre-wrap">{d.skip_reason}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Why this R */}
        <DetailGroup title="Why this R">
          <DRow label="Entry" value={fmtPrice(d.entry_price)} />
          <DRow label="Risk (1R)" value={fmtR3(d.risk_unit_r)} />
          <DRow label="R method" value={d.r_method || '—'} />
          <DRow label="Stop loss" value={fmtPrice(d.bracket_sl)} />
          <DRow label="SL dist" value={fmtPct(d.sl_dist_pct)} />
          <DRow label="ST 5M" value={d.st5m_value != null ? `$${d.st5m_value.toFixed(2)}` : '—'} />
          <div className="pt-1 border-t border-zinc-800/40 text-[10px] text-zinc-600 leading-relaxed">
            R is the distance from entry to stop. Every other number derives from it.
          </div>
        </DetailGroup>

        {/* Why this target */}
        <DetailGroup title="Why this target">
          <DRow label="Target" value={fmtPrice(d.bracket_tp)} />
          <DRow label="TP source" value={d.tp_source?.replace(/_/g, ' ') || '—'} />
          <DRow label="Fib target" value={fmtPrice(d.fib_target)} />
          <DRow label="Fib dist" value={fmtPct(d.fib_dist_pct)} />
          <DRow label="Feasible move" value={fmtPct(d.feasible_move_pct)} />
          <DRow label="Mins left" value={d.mins_left_in_session != null ? `${d.mins_left_in_session}m` : '—'} />
          {d.tp_source === 'feasibility_capped' && (
            <div className="pt-1 border-t border-amber-500/20 text-[10px] text-amber-400/80 leading-relaxed">
              The signal's target was further than the stock could realistically travel in the time left, so the target was pulled in.
            </div>
          )}
        </DetailGroup>

        {/* Why this size */}
        <DetailGroup title="Why this size">
          <DRow label="Quantity" value={d.quantity ?? '—'} />
          <DRow label="Qty (risk)" value={d.qty_by_risk ?? '—'} />
          <DRow label="Qty (afford)" value={d.qty_by_affordability ?? '—'} />
          <DRow label="Sized by" value={d.sized_by || '—'} />
          <DRow label="Total cost" value={fmtCurrency(d.total_cost)} />
          <DRow label="Risk target" value={fmtCurrency(d.risk_dollars_target)} />
          <DRow label="Actual risk" value={fmtCurrency(d.actual_risk_dollars)} />
        </DetailGroup>

        {/* Signal context */}
        <DetailGroup title="Signal context">
          <DRow label="Regime" value={
            <span className={d.regime === 'RISK_ON' ? 'text-emerald-400' : d.regime === 'RISK_OFF' ? 'text-red-400' : 'text-zinc-300'}>
              {d.regime || '—'}
            </span>
          } />
          {d.regime_summary && <div className="text-[10px] text-zinc-500 leading-relaxed">{d.regime_summary}</div>}
          <DRow label="Rank" value={d.global_rank ?? '—'} />
          <DRow label="Claude conf" value={d.claude_confidence != null ? `${d.claude_confidence}%` : '—'} />
          {d.claude_reasoning && <div className="text-[10px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/40">{d.claude_reasoning}</div>}
          <DRow label="ADX" value={d.adx_value != null ? d.adx_value.toFixed(1) : '—'} />
          <DRow label="RS vs SPY" value={d.rs_vs_spy != null ? d.rs_vs_spy.toFixed(2) : '—'} />
          <DRow label="Vol ratio" value={d.vol_ratio != null ? `${d.vol_ratio.toFixed(2)}x` : '—'} />
        </DetailGroup>
      </div>
    </div>
  );
};

// ─── Rejection Reasons Panel ─────────────────────────────────

const RejectionPanel: React.FC<{ reasons: RejectionReason[] }> = ({ reasons }) => {
  if (reasons.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-4 text-center">
        <span className="text-xs text-zinc-600 font-medium">Nothing was rejected today.</span>
      </div>
    );
  }

  const sorted = [...reasons].sort((a, b) => b.occurrences - a.occurrences);
  const maxCount = sorted[0]?.occurrences || 1;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-4 space-y-2">
      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Rejection Reasons</h3>
      {sorted.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 md:w-40 shrink-0 text-xs text-zinc-300 font-medium truncate" title={r.reason_bucket}>{r.reason_bucket}</div>
          <div className="flex-1 h-4 bg-zinc-800/40 rounded-full overflow-hidden relative">
            <div className="h-full bg-amber-500/30 rounded-full" style={{ width: `${(r.occurrences / maxCount) * 100}%` }} />
          </div>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 shrink-0">{r.occurrences}</span>
          <div className="hidden md:flex gap-1 shrink-0 max-w-[200px] overflow-hidden">
            {r.symbols.slice(0, 6).map(s => (
              <span key={s} className="text-[9px] font-bold text-zinc-400 bg-zinc-800/60 rounded px-1.5 py-0.5">{s}</span>
            ))}
            {r.symbols.length > 6 && (
              <span className="text-[9px] font-bold text-zinc-500">+{r.symbols.length - 6}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────

interface Props {
  userId: string;
}

const StockDecisionHistory: React.FC<Props> = ({ userId }) => {
  // State
  const [decisions, setDecisions] = useState<StockTradeDecision[]>([]);
  const [daily, setDaily] = useState<DecisionDaily | null>(null);
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(getTodayET());
  const [dateTo, setDateTo] = useState(getTodayET());
  const [decisionFilter, setDecisionFilter] = useState<Set<Decision>>(new Set(ALL_DECISIONS));
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showDryRuns, setShowDryRuns] = useState(true);
  const [groupByRun, setGroupByRun] = useState(false);

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    const fromTs = `${dateFrom}T00:00:00`;
    const toTs = `${dateTo}T23:59:59`;

    const [decRes, dailyRes, reasonRes] = await Promise.all([
      supabase
        .from('stock_trade_decisions')
        .select('*')
        .eq('user_id', userId)
        .gte('decided_at', fromTs)
        .lte('decided_at', toTs)
        .order('decided_at', { ascending: false })
        .limit(500),
      supabase
        .from('v_stock_decision_daily')
        .select('*')
        .eq('user_id', userId)
        .eq('trade_date', dateFrom)
        .maybeSingle(),
      supabase
        .from('v_stock_rejection_reasons')
        .select('*')
        .eq('user_id', userId)
        .eq('trade_date', dateFrom),
    ]);

    setDecisions((decRes.data as StockTradeDecision[]) || []);
    setDaily((dailyRes.data as DecisionDaily) || null);
    setReasons((reasonRes.data as RejectionReason[]) || []);
    setLoading(false);
  }, [userId, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const isDryRunDay = useMemo(() => decisions.length > 0 && decisions.every(d => d.dry_run), [decisions]);

  const filtered = useMemo(() => {
    let rows = decisions;
    if (!showDryRuns) rows = rows.filter(d => !d.dry_run);
    rows = rows.filter(d => decisionFilter.has(d.decision));
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toUpperCase();
      rows = rows.filter(d => d.symbol.includes(q));
    }
    return rows;
  }, [decisions, showDryRuns, decisionFilter, symbolSearch]);

  const runGroups = useMemo(() => {
    if (!groupByRun) return null;
    const map = new Map<string, StockTradeDecision[]>();
    for (const d of filtered) {
      const key = d.run_id || d.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).map(([runId, rows]) => {
      const earliest = rows.reduce((a, b) => a.decided_at < b.decided_at ? a : b);
      const placedCount = rows.filter(r => r.decision === 'PLACED' || r.decision === 'DRY_RUN').length;
      return { runId, rows, earliestAt: earliest.decided_at, regime: earliest.regime, placed: placedCount, total: rows.length };
    });
  }, [filtered, groupByRun]);

  const toggleDecisionFilter = (d: Decision) => {
    setDecisionFilter(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  // ─── Render ──────────────────────────────────────────────────

  const renderRow = (d: StockTradeDecision) => {
    const isExpanded = expandedId === d.id;
    return (
      <React.Fragment key={d.id}>
        {/* Desktop row */}
        <tr
          className={`hidden md:table-row cursor-pointer transition-colors hover:bg-zinc-800/30 ${isExpanded ? 'bg-zinc-800/20' : ''}`}
          onClick={() => setExpandedId(isExpanded ? null : d.id)}
        >
          <td className="px-3 py-2.5 text-xs font-mono text-zinc-400">{toET(d.decided_at)}</td>
          <td className="px-3 py-2.5 text-sm font-black text-white tracking-tight">{d.symbol}</td>
          <td className="px-3 py-2.5"><SideBadge side={d.trade_side} /></td>
          <td className="px-3 py-2.5"><DecisionBadge decision={d.decision} /></td>
          <td className="px-3 py-2.5 min-w-[140px]"><RRMeter rr={d.reward_risk} /></td>
          <td className="px-3 py-2.5 text-xs font-mono text-zinc-400">{fmtPct(d.sl_dist_pct)}</td>
          <td className="px-3 py-2.5 text-xs font-mono text-zinc-300">{d.quantity ?? '—'}</td>
          <td className="px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-mono text-zinc-200">{fmtCurrency(d.actual_risk_dollars)}</span>
              {d.risk_dollars_target != null && d.actual_risk_dollars != null && (
                <span className="text-[9px] font-mono text-zinc-600">target {fmtCurrency(d.risk_dollars_target)}</span>
              )}
              {d.sized_by === 'affordability' && (
                <span className="text-[9px] text-amber-500 cursor-help" title="Sized down to fit buying power, so this trade risks less than target.">
                  <span className="material-symbols-outlined text-[11px] align-middle">info</span> afford-limited
                </span>
              )}
            </div>
          </td>
          <td className="px-3 py-2.5 text-[10px] font-mono text-zinc-500">{d.tp_source?.replace(/_/g, ' ') || '—'}</td>
          <td className="px-3 py-2.5 text-zinc-600">
            <span className={`material-symbols-outlined text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
          </td>
        </tr>
        {/* Mobile card */}
        <tr className="md:hidden">
          <td colSpan={10}>
            <div
              className={`mx-2 my-1 rounded-lg border transition-colors cursor-pointer ${isExpanded ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-900/40 border-zinc-800/40'}`}
              onClick={() => setExpandedId(isExpanded ? null : d.id)}
            >
              <div className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-white">{d.symbol}</span>
                    <SideBadge side={d.trade_side} />
                    <DecisionBadge decision={d.decision} />
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <RRMeter rr={d.reward_risk} />
                    <span className="font-mono text-zinc-400">{fmtCurrency(d.actual_risk_dollars)}</span>
                    <span className="font-mono text-zinc-600">{toET(d.decided_at)}</span>
                  </div>
                </div>
                <span className={`material-symbols-outlined text-zinc-600 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
              </div>
            </div>
          </td>
        </tr>
        {/* Expanded detail */}
        {isExpanded && (
          <tr>
            <td colSpan={10}><ExpandedDetail d={d} /></td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-5">
      {/* ── Dry-run banner ── */}
      {isDryRunDay && (
        <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-amber-400 text-lg">science</span>
          <span className="text-sm font-bold text-amber-400">Dry run — no live orders were sent.</span>
        </div>
      )}

      {/* ── Header stat cards ── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard label="Candidates" value={daily?.candidates ?? (loading ? '—' : 0)} />
        <StatCard label="Placed" value={daily?.placed ?? (loading ? '—' : 0)} />
        <StatCard
          label="Rejected on R:R"
          value={daily?.rejected_rr ?? (loading ? '—' : 0)}
          sub={daily?.avg_rr_rejected != null ? (
            <span className="text-[10px] font-mono text-zinc-500">avg {daily.avg_rr_rejected.toFixed(2)}R</span>
          ) : null}
        />
        <StatCard
          label="Risk Deployed"
          value={fmtCurrency(daily?.total_risk_deployed)}
          sub={(() => {
            const sd = daily?.risk_consistency_stddev;
            if (sd == null) return null;
            const [color, label] = sd < 5
              ? ['text-emerald-400', 'Consistent']
              : sd <= 15
              ? ['text-amber-400', 'Uneven']
              : ['text-red-400', 'Erratic'];
            return (
              <span
                className={`text-[10px] font-bold ${color} cursor-help`}
                title="Standard deviation of dollar risk across today's trades. Lower means every trade risked a similar amount."
              >
                {label} (sd {sd.toFixed(1)})
              </span>
            );
          })()}
        />
      </div>

      {/* ── Rejection reasons ── */}
      {!loading && <RejectionPanel reasons={reasons} />}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 bg-zinc-900/30 border border-zinc-800/40 rounded-xl px-4 py-3">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none focus:border-emerald-500/40"
          />
          <span className="text-[10px] font-bold text-zinc-500 uppercase">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none focus:border-emerald-500/40"
          />
        </div>

        {/* Decision multi-select */}
        <div className="flex gap-1">
          {ALL_DECISIONS.map(d => {
            const c = DECISION_COLORS[d];
            const active = decisionFilter.has(d);
            return (
              <button
                key={d}
                onClick={() => toggleDecisionFilter(d)}
                className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border transition-all ${
                  active ? `${c.bg} ${c.text} ${c.border}` : 'bg-transparent border-zinc-800/40 text-zinc-600'
                }`}
              >
                {d.replace('_', ' ')}
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
            className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg pl-7 pr-2 py-1 text-xs text-zinc-300 font-mono w-24 focus:outline-none focus:border-emerald-500/40"
          />
        </div>

        {/* Toggles */}
        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
          <input type="checkbox" checked={showDryRuns} onChange={e => setShowDryRuns(e.target.checked)} className="accent-emerald-500 w-3 h-3" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Dry runs</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={groupByRun} onChange={e => setGroupByRun(e.target.checked)} className="accent-emerald-500 w-3 h-3" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Group by run</span>
        </label>
      </div>

      {/* ── Decision table ── */}
      <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="hidden md:table-row border-b border-zinc-800/60">
              {['Time', 'Symbol', 'Side', 'Decision', 'R:R', 'SL %', 'Qty', 'Risk $', 'TP Source', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <tr key={i}><td colSpan={10}><SkeletonRow /></td></tr>
                ))}
              </>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-zinc-800 mb-3 block">history</span>
                    <p className="text-sm text-zinc-500 font-medium">No decisions recorded yet</p>
                    <p className="text-xs text-zinc-600 mt-1">The engine runs at 8:40, 9:00 and 9:25 ET.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.length > 0 && !groupByRun && filtered.map(renderRow)}

            {!loading && runGroups && runGroups.map(g => (
              <React.Fragment key={g.runId}>
                {/* Run subheader */}
                <tr className="bg-zinc-800/20 sticky top-0 z-10">
                  <td colSpan={10}>
                    <div className="flex items-center gap-3 px-4 py-2">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">{toET(g.earliestAt)}</span>
                      {g.regime && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                          g.regime === 'RISK_ON' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : g.regime === 'RISK_OFF' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                          : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/30'
                        }`}>
                          {g.regime}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-zinc-500">
                        {g.placed}/{g.total} placed
                      </span>
                      <span className="text-[9px] font-mono text-zinc-700 ml-auto">{g.runId.slice(0, 8)}</span>
                    </div>
                  </td>
                </tr>
                {g.rows.map(renderRow)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div className="text-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
          {filtered.length} decision{filtered.length !== 1 ? 's' : ''} shown
        </div>
      )}
    </div>
  );
};

export default StockDecisionHistory;
