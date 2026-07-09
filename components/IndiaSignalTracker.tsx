// ═══════════════════════════════════════════════════════════════
// India Signal Tracker — single-file React dashboard
// NSE + BSE equities · INR · IST
// ═══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, CheckCircle2, XCircle,
  AlertTriangle, Activity, BarChart2, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';

// ─── CONFIG ───────────────────────────────────────────────────
// Primary: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.
// Fallback: hardcoded values so the UI works without an .env file.
// Demo banner is shown only when env vars are absent.
const SUPABASE_URL  = (import.meta.env.VITE_SUPABASE_URL  as string | undefined)
  || 'https://npwnnlxhdpvgfdpvrohi.supabase.co';
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || 'sb_publishable_TAykwCsieEVaOafYSUfjYA_FadvFq2t';
const HAS_ENV_VARS  = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const TABLE         = 'stock_gate_india_positions';
const REFRESH_MS    = 60_000;

// ─── TYPES ────────────────────────────────────────────────────

type Direction   = 'BUY' | 'SHORT';
type MarketState = 'live' | 'pre-open' | 'closed' | 'weekend';
type ExecHint    = 'READY_BUY' | 'READY_SELL' | 'WAIT';
type TrendDir    = 'UP' | 'DOWN' | 'NEUTRAL';
type TradeResult = 'WIN' | 'LOSS' | 'MANUAL_CLOSE';

interface Gate {
  label:  string;   // 'G1'–'G6'
  passed: boolean;
  desc:   string;   // hover tooltip
}

interface Position {
  id:          string;
  symbol:      string;
  exchange:    'NSE' | 'BSE';
  direction:   Direction;
  tier:        string;
  gates:       Gate[];
  trend1h:     TrendDir;
  trend15m:    TrendDir;
  trend5m:     TrendDir;
  livePrice:   number;
  entryPrice:  number;
  targetPrice: number;
  stopPrice:   number;
  pnlPct:      number;
  rrRatio:     string;
  execHint:    ExecHint;
  openedAt:    string;   // ISO
}

interface HistoryRow {
  id:         string;
  symbol:     string;
  exchange:   'NSE' | 'BSE';
  direction:  Direction;
  result:     TradeResult;
  entryPrice: number;
  exitPrice:  number;
  pnlPct:     number;
  holdMins:   number;
  exitReason: string;
  closedAt:   string;   // ISO
}

// Raw row shape returned by Supabase from stock_gate_india_positions
interface DbRow {
  id:                     number | string;
  symbol:                 string;
  exchange:               string;
  trade_direction:        string;
  tier:                   string | null;
  gates_passed:           number | null;
  signal:                 string | null;
  trading_recommendation: string | null;
  entry_price:            number | null;
  target_price:           number | null;
  stop_loss:              number | null;
  profit_zone_low:        number | null;
  profit_zone_high:       number | null;
  risk_reward_ratio:      number | null;
  fib_target1:            number | null;
  fib_target2:            number | null;
  fib_direction:          string | null;
  g1_sma:                 string | null;
  g2_1h:                  string | null;
  g3_15m:                 string | null;
  g4_5m:                  string | null;
  g5_vwap:                string | null;
  g6_adx:                 string | null;
  gate_reason:            string | null;
  sma_direction:          string | null;
  adx_value:              number | null;
  adx_trend:              string | null;
  plus_di:                number | null;
  minus_di:               number | null;
  vwap_value:             number | null;
  vwap_trend:             string | null;
  vwap_position:          string | null;
  sma20:                  number | null;
  sma50:                  number | null;
  st_1h_direction:        string | null;
  st_15m_direction:       string | null;
  st_5m_direction:        string | null;
  execution_hint:         string | null;
  execution_reason:       string | null;
  current_price:          number | null;
  progress_pct:           number | null;
  high_water_mark:        number | null;
  low_water_mark:         number | null;
  status:                 string;
  close_reason:           string | null;
  opened_at:              string;
  closed_at:              string | null;
}

// ─── DEMO DATA ────────────────────────────────────────────────
// Shown only when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent.

const DEMO_POSITIONS: Position[] = [
  {
    id: 'p1', symbol: 'RELIANCE', exchange: 'NSE', direction: 'BUY', tier: 'A+',
    gates: [
      { label: 'G1', passed: true,  desc: 'SMA trend bullish' },
      { label: 'G2', passed: true,  desc: '1H SuperTrend bullish' },
      { label: 'G3', passed: true,  desc: '15m SuperTrend bullish' },
      { label: 'G4', passed: true,  desc: '5m SuperTrend bullish' },
      { label: 'G5', passed: true,  desc: 'VWAP: price above' },
      { label: 'G6', passed: true,  desc: 'ADX > 25 — strong trend' },
    ],
    trend1h: 'UP', trend15m: 'UP', trend5m: 'UP',
    livePrice: 2948.75, entryPrice: 2912.30, targetPrice: 3020.00, stopPrice: 2880.00,
    pnlPct: 1.25, rrRatio: '1:2.5', execHint: 'READY_BUY',
    openedAt: new Date(Date.now() - 85 * 60_000).toISOString(),
  },
  {
    id: 'p2', symbol: 'SBIN', exchange: 'NSE', direction: 'SHORT', tier: 'A+',
    gates: [
      { label: 'G1', passed: true,  desc: 'SMA trend bearish' },
      { label: 'G2', passed: true,  desc: '1H SuperTrend bearish' },
      { label: 'G3', passed: true,  desc: '15m SuperTrend bearish' },
      { label: 'G4', passed: true,  desc: '5m SuperTrend bearish' },
      { label: 'G5', passed: true,  desc: 'VWAP: price below' },
      { label: 'G6', passed: true,  desc: 'ADX > 25 — strong trend' },
    ],
    trend1h: 'DOWN', trend15m: 'DOWN', trend5m: 'DOWN',
    livePrice: 812.30, entryPrice: 831.50, targetPrice: 786.00, stopPrice: 846.00,
    pnlPct: 2.31, rrRatio: '1:2.8', execHint: 'READY_SELL',
    openedAt: new Date(Date.now() - 34 * 60_000).toISOString(),
  },
  {
    id: 'p3', symbol: 'TCS', exchange: 'NSE', direction: 'SHORT', tier: 'A',
    gates: [
      { label: 'G1', passed: true,  desc: 'SMA trend bearish' },
      { label: 'G2', passed: true,  desc: '1H SuperTrend bearish' },
      { label: 'G3', passed: true,  desc: '15m SuperTrend bearish' },
      { label: 'G4', passed: false, desc: '5m SuperTrend neutral' },
      { label: 'G5', passed: true,  desc: 'VWAP: price below' },
      { label: 'G6', passed: true,  desc: 'ADX > 25 — strong trend' },
    ],
    trend1h: 'DOWN', trend15m: 'DOWN', trend5m: 'NEUTRAL',
    livePrice: 3841.50, entryPrice: 3878.00, targetPrice: 3760.00, stopPrice: 3910.00,
    pnlPct: 0.94, rrRatio: '1:2.2', execHint: 'WAIT',
    openedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
  {
    id: 'p4', symbol: 'HDFCBANK', exchange: 'NSE', direction: 'BUY', tier: 'A',
    gates: [
      { label: 'G1', passed: true,  desc: 'SMA trend bullish' },
      { label: 'G2', passed: true,  desc: '1H SuperTrend bullish' },
      { label: 'G3', passed: false, desc: '15m SuperTrend neutral' },
      { label: 'G4', passed: false, desc: '5m SuperTrend neutral' },
      { label: 'G5', passed: true,  desc: 'VWAP: price above' },
      { label: 'G6', passed: true,  desc: 'ADX > 25 — strong trend' },
    ],
    trend1h: 'UP', trend15m: 'NEUTRAL', trend5m: 'NEUTRAL',
    livePrice: 1718.40, entryPrice: 1702.10, targetPrice: 1760.00, stopPrice: 1680.00,
    pnlPct: 0.96, rrRatio: '1:1.8', execHint: 'WAIT',
    openedAt: new Date(Date.now() - 127 * 60_000).toISOString(),
  },
  {
    id: 'p5', symbol: 'INFY', exchange: 'NSE', direction: 'BUY', tier: 'B+',
    gates: [
      { label: 'G1', passed: true,  desc: 'SMA trend bullish' },
      { label: 'G2', passed: true,  desc: '1H SuperTrend bullish' },
      { label: 'G3', passed: true,  desc: '15m SuperTrend bullish' },
      { label: 'G4', passed: true,  desc: '5m SuperTrend bullish' },
      { label: 'G5', passed: false, desc: 'VWAP: price barely above (weak)' },
      { label: 'G6', passed: true,  desc: 'ADX > 25 — strong trend' },
    ],
    trend1h: 'UP', trend15m: 'UP', trend5m: 'UP',
    livePrice: 1574.80, entryPrice: 1551.20, targetPrice: 1620.00, stopPrice: 1530.00,
    pnlPct: 1.52, rrRatio: '1:2.1', execHint: 'READY_BUY',
    openedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
  },
];

const DEMO_HISTORY: HistoryRow[] = [
  {
    id: 'h1', symbol: 'WIPRO', exchange: 'NSE', direction: 'BUY', result: 'WIN',
    entryPrice: 452.30, exitPrice: 471.80, pnlPct: 4.31, holdMins: 127,
    exitReason: 'Target hit', closedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'h2', symbol: 'ICICIBANK', exchange: 'NSE', direction: 'SHORT', result: 'LOSS',
    entryPrice: 1142.00, exitPrice: 1163.40, pnlPct: -1.87, holdMins: 48,
    exitReason: 'Stop loss', closedAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
  },
  {
    id: 'h3', symbol: 'LT', exchange: 'NSE', direction: 'BUY', result: 'WIN',
    entryPrice: 3612.50, exitPrice: 3854.20, pnlPct: 6.69, holdMins: 312,
    exitReason: 'Target hit', closedAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
  },
  {
    id: 'h4', symbol: 'MARUTI', exchange: 'BSE', direction: 'BUY', result: 'WIN',
    entryPrice: 11840.00, exitPrice: 12211.50, pnlPct: 3.14, holdMins: 195,
    exitReason: 'Target hit', closedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
  },
  {
    id: 'h5', symbol: 'BAJAJFIN', exchange: 'NSE', direction: 'SHORT', result: 'LOSS',
    entryPrice: 6940.00, exitPrice: 7109.30, pnlPct: -2.44, holdMins: 73,
    exitReason: 'Stop loss', closedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
  {
    id: 'h6', symbol: 'AXISBANK', exchange: 'NSE', direction: 'BUY', result: 'WIN',
    entryPrice: 1087.00, exitPrice: 1124.60, pnlPct: 3.46, holdMins: 156,
    exitReason: 'Target hit', closedAt: new Date(Date.now() - 28 * 3_600_000).toISOString(),
  },
  {
    id: 'h7', symbol: 'TATAMOTORS', exchange: 'NSE', direction: 'SHORT', result: 'WIN',
    entryPrice: 1018.50, exitPrice: 972.40, pnlPct: 4.53, holdMins: 204,
    exitReason: 'Target hit', closedAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  },
];

// ─── HELPERS ──────────────────────────────────────────────────

const getIST = (): Date =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

const fmtIST = (d: Date = new Date()): string =>
  d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const fmtISTShort = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour12: false,
    hour: '2-digit', minute: '2-digit',
  });

const getMarketState = (): MarketState => {
  const ist = getIST();
  const day = ist.getDay();
  if (day === 0 || day === 6) return 'weekend';
  const m = ist.getHours() * 60 + ist.getMinutes();
  if (m >= 9 * 60 + 15 && m < 15 * 60 + 30) return 'live';
  if (m >= 9 * 60 && m < 9 * 60 + 15) return 'pre-open';
  return 'closed';
};

const fmtInr = (n: number): string =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtHold = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const holdMins = (openedAt: string): number =>
  Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000);

const calcProgress = (pos: Position): number => {
  const { livePrice, targetPrice, stopPrice, direction } = pos;
  const range = direction === 'BUY' ? targetPrice - stopPrice : stopPrice - targetPrice;
  if (range <= 0) return 0;
  const dist = direction === 'BUY' ? livePrice - stopPrice : stopPrice - livePrice;
  return Math.max(0, Math.min(100, (dist / range) * 100));
};

const timeSince = (iso: string): string => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── SUPABASE FETCH ───────────────────────────────────────────

const supabaseFetch = <T,>(query: string): Promise<T> =>
  fetch(`${SUPABASE_URL}/rest/v1/${TABLE}${query}`, {
    headers: {
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });

// ─── DB → UI TRANSFORMS ───────────────────────────────────────

const parseGate = (label: string, value: string | null, fallbackDesc: string): Gate => ({
  label,
  passed: value?.includes('✓') ?? false,
  desc:   value ?? fallbackDesc,
});

const parseTrendDir = (s: string | null): TrendDir => {
  if (!s) return 'NEUTRAL';
  const u = s.toUpperCase();
  if (u.includes('UP') || u.includes('BULL')) return 'UP';
  if (u.includes('DOWN') || u.includes('BEAR')) return 'DOWN';
  return 'NEUTRAL';
};

const rowToPosition = (r: DbRow): Position => {
  const dir   = r.trade_direction as Direction;
  const entry = r.entry_price ?? 0;
  const live  = r.current_price ?? entry;
  const pnlPct = entry === 0 ? 0
    : dir === 'BUY'
      ? ((live - entry) / entry) * 100
      : ((entry - live) / entry) * 100;
  const rr = r.risk_reward_ratio;
  return {
    id:          String(r.id),
    symbol:      r.symbol,
    exchange:    (r.exchange as 'NSE' | 'BSE'),
    direction:   dir,
    tier:        r.tier ?? '',
    gates: [
      parseGate('G1', r.g1_sma,  'SMA trend'),
      parseGate('G2', r.g2_1h,   '1H SuperTrend'),
      parseGate('G3', r.g3_15m,  '15m SuperTrend'),
      parseGate('G4', r.g4_5m,   '5m SuperTrend'),
      parseGate('G5', r.g5_vwap, 'VWAP position'),
      parseGate('G6', r.g6_adx,  'ADX strength'),
    ],
    trend1h:     parseTrendDir(r.st_1h_direction),
    trend15m:    parseTrendDir(r.st_15m_direction),
    trend5m:     parseTrendDir(r.st_5m_direction),
    livePrice:   live,
    entryPrice:  entry,
    targetPrice: r.target_price ?? 0,
    stopPrice:   r.stop_loss    ?? 0,
    pnlPct,
    rrRatio:     rr != null ? `1:${Number(rr).toFixed(1)}` : '—',
    execHint:    ((r.execution_hint ?? 'WAIT') as ExecHint),
    openedAt:    r.opened_at,
  };
};

const rowToHistory = (r: DbRow): HistoryRow => {
  const dir    = r.trade_direction as Direction;
  const entry  = r.entry_price  ?? 0;
  const exit   = r.current_price ?? entry;
  const pnlPct = entry === 0 ? 0
    : dir === 'BUY'
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100;
  const openMs   = new Date(r.opened_at).getTime();
  const closeMs  = r.closed_at ? new Date(r.closed_at).getTime() : Date.now();
  const holdMins = Math.max(0, Math.round((closeMs - openMs) / 60_000));
  const result: TradeResult =
    r.status === 'WIN'          ? 'WIN'
    : r.status === 'LOSS'       ? 'LOSS'
    : 'MANUAL_CLOSE';
  return {
    id:         String(r.id),
    symbol:     r.symbol,
    exchange:   (r.exchange as 'NSE' | 'BSE'),
    direction:  dir,
    result,
    entryPrice: entry,
    exitPrice:  exit,
    pnlPct,
    holdMins,
    exitReason: r.close_reason ?? r.status ?? '—',
    closedAt:   r.closed_at ?? r.opened_at,
  };
};

// ─── MICRO-COMPONENTS ─────────────────────────────────────────

const MarketDot: React.FC<{ state: MarketState }> = ({ state }) => {
  const cfg: Record<MarketState, { dot: string; label: string; ping: boolean }> = {
    live:       { dot: 'bg-emerald-500', label: 'Live',     ping: true  },
    'pre-open': { dot: 'bg-amber-400',   label: 'Pre-open', ping: false },
    closed:     { dot: 'bg-slate-500',   label: 'Closed',   ping: false },
    weekend:    { dot: 'bg-slate-600',   label: 'Weekend',  ping: false },
  };
  const { dot, label, ping } = cfg[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {ping && (
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="text-xs font-medium text-slate-400">{label}</span>
    </div>
  );
};

const DirectionBadge: React.FC<{ direction: Direction }> = ({ direction }) => (
  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
    direction === 'BUY'
      ? 'text-emerald-400 bg-emerald-950/60 border-emerald-700/50'
      : 'text-rose-400 bg-rose-950/60 border-rose-700/50'
  }`}>
    {direction === 'BUY'
      ? <ArrowUp className="w-2.5 h-2.5" />
      : <ArrowDown className="w-2.5 h-2.5" />}
    {direction}
  </span>
);

const ExecHintPill: React.FC<{ hint: ExecHint }> = ({ hint }) => {
  if (hint === 'WAIT') {
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-slate-500 bg-slate-800 border border-slate-700">
        WAIT
      </span>
    );
  }
  const isBuy = hint === 'READY_BUY';
  return (
    <span className={`relative inline-flex items-center overflow-hidden px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border ${
      isBuy
        ? 'text-emerald-300 bg-emerald-950 border-emerald-500/60'
        : 'text-rose-300 bg-rose-950 border-rose-500/60'
    }`}>
      <span className={`absolute inset-0 motion-safe:animate-pulse ${isBuy ? 'bg-emerald-400/15' : 'bg-rose-400/15'}`} />
      <span className="relative z-10">READY · {isBuy ? 'BUY' : 'SELL'}</span>
    </span>
  );
};

const TrendArrow: React.FC<{ dir: TrendDir; tf: string }> = ({ dir, tf }) => {
  const Icon = dir === 'UP' ? TrendingUp : dir === 'DOWN' ? TrendingDown : Minus;
  const color = dir === 'UP' ? 'text-emerald-400' : dir === 'DOWN' ? 'text-rose-400' : 'text-slate-600';
  return (
    <div className="flex flex-col items-center gap-0.5" title={`${tf}: ${dir}`}>
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-[8px] font-mono text-slate-600">{tf}</span>
    </div>
  );
};

const GateDot: React.FC<{ gate: Gate }> = ({ gate }) => (
  <div
    title={`${gate.label}: ${gate.desc}`}
    className={`w-3 h-3 rounded-full border cursor-help flex-shrink-0 ${
      gate.passed
        ? 'bg-emerald-500 border-emerald-400'
        : 'bg-transparent border-slate-600'
    }`}
  />
);

// ─── PROGRESS BAR ─────────────────────────────────────────────

const ProgressBar: React.FC<{ pos: Position }> = ({ pos }) => {
  const pct      = calcProgress(pos);
  const isBuy    = pos.direction === 'BUY';
  const barColor = isBuy ? 'bg-emerald-500' : 'bg-rose-500';
  const pctColor = pct >= 70 ? (isBuy ? 'text-emerald-300' : 'text-rose-300')
                 : pct >= 40 ? 'text-amber-400'
                 : 'text-slate-500';

  return (
    <div className="space-y-1.5">
      <div className="relative h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-[9px]">
        <span className="text-rose-500">SL {fmtInr(pos.stopPrice)}</span>
        <span className={`font-bold ${pctColor}`}>{pct.toFixed(0)}%</span>
        <span className="text-emerald-500">TGT {fmtInr(pos.targetPrice)}</span>
      </div>
    </div>
  );
};

// ─── POSITION CARD ────────────────────────────────────────────

const PositionCard: React.FC<{ pos: Position }> = ({ pos }) => {
  const isBuy     = pos.direction === 'BUY';
  const isReady   = pos.execHint !== 'WAIT';
  const gatesPass = pos.gates.filter(g => g.passed).length;
  const pnlPos    = pos.pnlPct >= 0;
  const hold      = holdMins(pos.openedAt);

  const borderClass = isReady
    ? isBuy ? 'border-emerald-700/50' : 'border-rose-700/50'
    : 'border-slate-800';

  const priceItems = [
    { label: 'LIVE',   value: pos.livePrice,   color: pnlPos ? 'text-emerald-300' : 'text-rose-300' },
    { label: 'ENTRY',  value: pos.entryPrice,  color: 'text-amber-300' },
    { label: 'TARGET', value: pos.targetPrice, color: 'text-emerald-400' },
    { label: 'STOP',   value: pos.stopPrice,   color: 'text-rose-400' },
  ];

  return (
    <article className={`rounded-xl border bg-slate-900 p-4 space-y-3.5 transition-colors ${borderClass}`}>

      {/* Row 1: Identity + exec hint + P&L */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="font-mono text-base font-black text-white leading-none">{pos.symbol}</span>
          <span className="px-1 py-0.5 rounded text-[9px] font-bold text-slate-500 bg-slate-800 border border-slate-700">{pos.exchange}</span>
          <DirectionBadge direction={pos.direction} />
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40">{pos.tier}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400 bg-slate-800 border border-slate-700 font-mono">
            {gatesPass}/6 ✓
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <ExecHintPill hint={pos.execHint} />
          <span className={`font-mono text-sm font-black ${pnlPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pnlPos ? '+' : ''}{pos.pnlPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Row 2: Price grid */}
      <div className="grid grid-cols-4 gap-2">
        {priceItems.map(p => (
          <div key={p.label} className="text-center">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">{p.label}</span>
            <span className={`block font-mono text-[11px] font-bold ${p.color}`}>{fmtInr(p.value)}</span>
          </div>
        ))}
      </div>

      {/* Row 3: Progress bar */}
      <ProgressBar pos={pos} />

      {/* Row 4: Gates + trend arrows + R:R */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
        <div className="flex items-center gap-1">
          {pos.gates.map(g => <GateDot key={g.label} gate={g} />)}
        </div>
        <div className="flex items-center gap-3">
          <TrendArrow dir={pos.trend1h}  tf="1H"  />
          <TrendArrow dir={pos.trend15m} tf="15m" />
          <TrendArrow dir={pos.trend5m}  tf="5m"  />
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          R:R <span className="text-slate-300 font-bold">{pos.rrRatio}</span>
        </span>
      </div>

      {/* Row 5: Footer */}
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-600">
        <span>Opened {fmtISTShort(pos.openedAt)} IST</span>
        <span>{fmtHold(hold)} open</span>
      </div>
    </article>
  );
};

// ─── STAT ROW ─────────────────────────────────────────────────

const StatRow: React.FC<{ positions: Position[]; history: HistoryRow[] }> = ({ positions, history }) => {
  const readyCount = positions.filter(p => p.execHint !== 'WAIT').length;
  const wins       = history.filter(h => h.result === 'WIN').length;
  const losses     = history.filter(h => h.result === 'LOSS').length;
  const wlTotal    = wins + losses;  // excludes MANUAL_CLOSE per spec
  const winRate    = wlTotal > 0 ? (wins / wlTotal) * 100 : 0;
  const avgHold    = history.length > 0
    ? history.reduce((a, h) => a + h.holdMins, 0) / history.length
    : 0;

  const stats = [
    {
      label: 'Open positions',
      value: String(positions.length),
      color: 'text-white',
    },
    {
      label: 'Ready to act',
      value: String(readyCount),
      color: readyCount > 0 ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      label: 'Win rate',
      value: wlTotal > 0 ? `${winRate.toFixed(1)}%` : '—',
      color: winRate >= 50 ? 'text-emerald-400' : wlTotal > 0 ? 'text-rose-400' : 'text-slate-500',
    },
    {
      label: 'Wins / Losses',
      value: wlTotal > 0 ? `${wins}W / ${losses}L` : '—',
      color: 'text-slate-300',
    },
    {
      label: 'Avg hold time',
      value: history.length > 0 ? fmtHold(Math.round(avgHold)) : '—',
      color: 'text-slate-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
          <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">{s.label}</span>
          <span className={`block font-mono text-lg font-black ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── HISTORY TABLE ────────────────────────────────────────────

const HistoryTable: React.FC<{ rows: HistoryRow[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
        <BarChart2 className="w-10 h-10" />
        <p className="text-sm font-semibold text-slate-500">No closed trades yet</p>
        <p className="text-xs text-slate-600">Closed positions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-xs min-w-[720px]">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80">
            {['Symbol', 'Direction', 'Result', 'Entry → Exit', 'P&L', 'Hold', 'Exit reason', 'Closed'].map(col => (
              <th key={col} className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isWin     = row.result === 'WIN';
            const isManual  = row.result === 'MANUAL_CLOSE';
            const pnlColor  = isWin ? 'text-emerald-400' : 'text-rose-400';
            const resultCfg = isWin
              ? { icon: <CheckCircle2 className="w-2.5 h-2.5" />, cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/40', label: 'WIN' }
              : isManual
              ? { icon: <Minus className="w-2.5 h-2.5" />,        cls: 'text-slate-400 bg-slate-800/60 border-slate-700/40',       label: 'CLOSED' }
              : { icon: <XCircle className="w-2.5 h-2.5" />,      cls: 'text-rose-400 bg-rose-950/40 border-rose-700/40',          label: 'LOSS' };
            return (
              <tr
                key={row.id}
                className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/30 ${
                  i % 2 === 1 ? 'bg-slate-900/20' : ''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono font-black text-white">{row.symbol}</span>
                  <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold text-slate-600 bg-slate-800 border border-slate-700">{row.exchange}</span>
                </td>
                <td className="px-4 py-3">
                  <DirectionBadge direction={row.direction} />
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${resultCfg.cls}`}>
                    {resultCfg.icon}
                    {resultCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                  {fmtInr(row.entryPrice)}
                  <span className="mx-1 text-slate-700">→</span>
                  {fmtInr(row.exitPrice)}
                </td>
                <td className={`px-4 py-3 font-mono font-bold ${pnlColor}`}>
                  {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 font-mono text-slate-400">{fmtHold(row.holdMins)}</td>
                <td className="px-4 py-3 text-slate-400">{row.exitReason}</td>
                <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">{timeSince(row.closedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── EMPTY OPEN STATE ─────────────────────────────────────────

const EmptyOpen: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
    <Activity className="w-10 h-10" />
    <p className="text-sm font-semibold text-slate-500">No open positions</p>
    <p className="text-xs text-slate-600">Scanner runs 09:20–15:15 IST · qualifying signals appear here automatically.</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function IndiaSignalTracker() {
  const [positions,   setPositions]   = useState<Position[]>([]);
  const [history,     setHistory]     = useState<HistoryRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [lastSynced,  setLastSynced]  = useState<Date | null>(null);
  const [clockStr,    setClockStr]    = useState(() => fmtIST());
  const [marketState, setMarketState] = useState<MarketState>(() => getMarketState());
  const [activeTab,   setActiveTab]   = useState<'open' | 'history'>('open');

  // ── Data fetch ───────────────────────────────────────────────

  const load = useCallback(async () => {
    // Always fetch — SUPABASE_URL/ANON always have values (env var or hardcoded fallback).
    // HAS_ENV_VARS only controls the demo banner, not whether we fetch.
    setLoading(true);
    try {
      const [openRows, histRows] = await Promise.all([
        supabaseFetch<DbRow[]>('?status=eq.OPEN&order=opened_at.desc'),
        supabaseFetch<DbRow[]>('?status=neq.OPEN&order=opened_at.desc&limit=50'),
      ]);
      setPositions(openRows.map(rowToPosition));
      setHistory(histRows.map(rowToHistory));
      setError(null);
    } catch (e) {
      // Non-blocking: keep last-good data on screen, show error banner
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
      setLastSynced(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // ── Clock tick ───────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setClockStr(fmtIST());
      setMarketState(getMarketState());
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Derived ──────────────────────────────────────────────────

  const readyCount = positions.filter(p => p.execHint !== 'WAIT').length;
  const openLabel  = `Open (${positions.length})`;
  const histLabel  = `History (${history.length})`;

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white">
                🇮🇳 Signal Tracker
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-500 bg-slate-800 border border-slate-700">v1.0</span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">NSE · BSE · Indian equities</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <MarketDot state={marketState} />
            <span className="font-mono text-sm font-bold text-slate-300 tabular-nums">{clockStr} IST</span>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh data"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* ── Demo banner (only when env vars absent) ── */}
        {!HAS_ENV_VARS && (
          <div
            role="status"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-400 text-xs font-medium"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Demo data — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env to load live positions.
          </div>
        )}

        {/* ── Error banner (non-blocking, keep last-good data) ── */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-800/40 text-red-400 text-xs font-medium"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Fetch error — showing last data. {error}
            <button
              onClick={load}
              className="ml-auto font-bold underline underline-offset-2 hover:text-red-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Stat row ── */}
        <StatRow positions={positions} history={history} />

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-slate-800" role="tablist">
          {([
            { id: 'open',    label: openLabel },
            { id: 'history', label: histLabel },
          ] as const).map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                activeTab === tab.id
                  ? 'text-white border-emerald-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.id === 'open' && readyCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-700/40">
                  {readyCount} ready
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Open tab ── */}
        {activeTab === 'open' && (
          <section role="tabpanel" aria-label="Open positions">
            {loading && positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-700" />
                <p className="text-sm text-slate-600">Loading positions…</p>
              </div>
            ) : positions.length === 0 ? (
              <EmptyOpen />
            ) : (
              <div className="space-y-3">
                {positions.map(p => <PositionCard key={p.id} pos={p} />)}
              </div>
            )}
          </section>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && (
          <section role="tabpanel" aria-label="Trade history">
            <HistoryTable rows={history} />
          </section>
        )}

        {/* ── Footer ── */}
        {lastSynced && (
          <footer className="text-center text-[10px] font-mono text-slate-700">
            Last synced {fmtIST(lastSynced)} IST · auto-refreshes every {REFRESH_MS / 1000}s
          </footer>
        )}

      </div>
    </div>
  );
}
