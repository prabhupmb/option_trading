import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type StageKey =
  | 'WATCHING' | 'BREAKOUT_DETECTED' | 'OPEN_T1' | 'OPEN_T2'
  | 'DIP' | 'FAILED_BREAKOUT' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'MANUAL_CLOSE';

type EventType =
  | 'WATCH_START' | 'BREAKOUT_DETECTED' | 'ENTERED' | 'T1_HIT' | 'T2_HIT'
  | 'DIP_WARNING' | 'DIP_RECOVERED' | 'FAILED_BREAKOUT' | 'STRONG_SELL'
  | 'STOP_HIT' | 'MANUAL_CLOSE';

interface Lifecycle {
  symbol: string;
  current_stage: StageKey;
  position_id: string | null;
  last_price: number | null;
  last_reason: string | null;
  updated_at: string;
}

interface StageEvent {
  id: number;
  symbol: string;
  from_stage: string;
  to_stage: string;
  event_type: EventType;
  reason: string | null;
  price: number | null;
  sma20: number | null;
  sma50: number | null;
  vwap: number | null;
  st_dir: string | null;
  vol_ratio: number | null;
  position_id: string | null;
  created_at: string;
}

interface StagePosition {
  id?: string;
  symbol: string;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'MANUAL_CLOSE';
  qty: number | null;
  entry_price: number | null;
  t1_target: number | null;
  t2_target: number | null;
  stop_loss: number | null;
  target_stage: 'T1' | 'T2' | null;
  close_reason: string | null;
  closed_at: string | null;
  created_at: string;
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_LIFECYCLE: Lifecycle[] = [
  { symbol: 'NVDA', current_stage: 'OPEN_T1',           position_id: 'p1', last_price: 118.42, last_reason: 'ST flipped UP, breakout confirmed', updated_at: new Date(Date.now() - 12*60000).toISOString() },
  { symbol: 'TSLA', current_stage: 'BREAKOUT_DETECTED',  position_id: null, last_price: 248.10, last_reason: 'Volume 2.3x, VWAP cross', updated_at: new Date(Date.now() - 4*60000).toISOString() },
  { symbol: 'AAPL', current_stage: 'WATCHING',           position_id: null, last_price: 198.55, last_reason: 'SMA20 > SMA50, waiting ST confirm', updated_at: new Date(Date.now() - 33*60000).toISOString() },
  { symbol: 'META', current_stage: 'OPEN_T2',            position_id: 'p2', last_price: 614.30, last_reason: 'T1 hit, SL moved to BE', updated_at: new Date(Date.now() - 7*60000).toISOString() },
  { symbol: 'AMD',  current_stage: 'DIP',                position_id: 'p3', last_price: 142.80, last_reason: 'Price dipped below VWAP', updated_at: new Date(Date.now() - 18*60000).toISOString() },
  { symbol: 'AMZN', current_stage: 'FAILED_BREAKOUT',    position_id: null, last_price: 195.20, last_reason: 'Volume dried up, ST flipped DOWN', updated_at: new Date(Date.now() - 45*60000).toISOString() },
  { symbol: 'MSFT', current_stage: 'CLOSED_WIN',         position_id: 'p4', last_price: 441.60, last_reason: 'T2 target hit', updated_at: new Date(Date.now() - 95*60000).toISOString() },
  { symbol: 'GOOG', current_stage: 'CLOSED_LOSS',        position_id: 'p5', last_price: 178.30, last_reason: 'Stop hit at 176.50', updated_at: new Date(Date.now() - 120*60000).toISOString() },
  { symbol: 'SOFI', current_stage: 'WATCHING',           position_id: null, last_price: 14.82, last_reason: 'ADX rising, watching VWAP', updated_at: new Date(Date.now() - 8*60000).toISOString() },
];

const MOCK_EVENTS: StageEvent[] = [
  { id: 1, symbol: 'NVDA', from_stage: 'WATCHING', to_stage: 'BREAKOUT_DETECTED', event_type: 'BREAKOUT_DETECTED', reason: 'Vol 2.8x, VWAP cross UP', price: 115.20, sma20: 114.80, sma50: 112.40, vwap: 115.00, st_dir: 'UP', vol_ratio: 2.8, position_id: null, created_at: new Date(Date.now() - 35*60000).toISOString() },
  { id: 2, symbol: 'NVDA', from_stage: 'BREAKOUT_DETECTED', to_stage: 'OPEN_T1', event_type: 'ENTERED', reason: 'ST confirmed UP on 5m, all gates passed', price: 115.80, sma20: 114.90, sma50: 112.40, vwap: 115.30, st_dir: 'UP', vol_ratio: 2.4, position_id: 'p1', created_at: new Date(Date.now() - 28*60000).toISOString() },
  { id: 3, symbol: 'NVDA', from_stage: 'OPEN_T1', to_stage: 'DIP', event_type: 'DIP_WARNING', reason: 'Price dropped below VWAP briefly', price: 116.90, sma20: 115.20, sma50: 112.60, vwap: 117.10, st_dir: 'UP', vol_ratio: 1.2, position_id: 'p1', created_at: new Date(Date.now() - 20*60000).toISOString() },
  { id: 4, symbol: 'NVDA', from_stage: 'DIP', to_stage: 'OPEN_T1', event_type: 'DIP_RECOVERED', reason: 'Reclaimed VWAP, ST still UP', price: 117.40, sma20: 115.50, sma50: 112.80, vwap: 117.00, st_dir: 'UP', vol_ratio: 1.8, position_id: 'p1', created_at: new Date(Date.now() - 15*60000).toISOString() },
];

const MOCK_POSITIONS: StagePosition[] = [
  { symbol: 'NVDA', status: 'OPEN', qty: 100, entry_price: 115.80, t1_target: 120.00, t2_target: 125.00, stop_loss: 113.00, target_stage: 'T1', close_reason: null, closed_at: null, created_at: new Date(Date.now() - 28*60000).toISOString() },
  { symbol: 'META', status: 'OPEN', qty: 25,  entry_price: 605.00, t1_target: 615.00, t2_target: 628.00, stop_loss: 598.00, target_stage: 'T2', close_reason: null, closed_at: null, created_at: new Date(Date.now() - 62*60000).toISOString() },
  { symbol: 'AMD',  status: 'OPEN', qty: 50,  entry_price: 144.50, t1_target: 150.00, t2_target: 156.00, stop_loss: 141.00, target_stage: 'T1', close_reason: null, closed_at: null, created_at: new Date(Date.now() - 45*60000).toISOString() },
];

// ─── STAGE CONFIG ─────────────────────────────────────────────────────────────

const STAGE_ORDER: StageKey[] = [
  'WATCHING', 'BREAKOUT_DETECTED', 'OPEN_T1', 'OPEN_T2',
  'DIP', 'FAILED_BREAKOUT', 'CLOSED_WIN', 'CLOSED_LOSS',
];

const STAGE_CFG: Record<StageKey, { label: string; color: string; border: string; bg: string; dot: string; icon: string }> = {
  WATCHING:          { label: 'Watching',         color: 'text-slate-300',   border: 'border-slate-600/40',  bg: 'bg-slate-800/40',  dot: 'bg-slate-400',   icon: 'visibility' },
  BREAKOUT_DETECTED: { label: 'Breakout',         color: 'text-indigo-300',  border: 'border-indigo-500/40', bg: 'bg-indigo-900/20', dot: 'bg-indigo-400',  icon: 'rocket_launch' },
  OPEN_T1:           { label: 'Open · T1',        color: 'text-emerald-300', border: 'border-emerald-500/40',bg: 'bg-emerald-900/20',dot: 'bg-emerald-400', icon: 'arrow_upward' },
  OPEN_T2:           { label: 'Open · T2',        color: 'text-teal-300',    border: 'border-teal-500/40',   bg: 'bg-teal-900/20',   dot: 'bg-teal-400',    icon: 'emoji_events' },
  DIP:               { label: 'Dip',              color: 'text-amber-300',   border: 'border-amber-500/40',  bg: 'bg-amber-900/20',  dot: 'bg-amber-400',   icon: 'arrow_downward' },
  FAILED_BREAKOUT:   { label: 'Failed',           color: 'text-zinc-400',    border: 'border-zinc-600/40',   bg: 'bg-zinc-800/30',   dot: 'bg-zinc-500',    icon: 'block' },
  CLOSED_WIN:        { label: 'Win',              color: 'text-green-300',   border: 'border-green-500/40',  bg: 'bg-green-900/20',  dot: 'bg-green-400',   icon: 'check_circle' },
  CLOSED_LOSS:       { label: 'Loss',             color: 'text-red-300',     border: 'border-red-500/40',    bg: 'bg-red-900/20',    dot: 'bg-red-400',     icon: 'cancel' },
  MANUAL_CLOSE:      { label: 'Manual Close',     color: 'text-gray-400',    border: 'border-gray-600/40',   bg: 'bg-gray-800/30',   dot: 'bg-gray-500',    icon: 'close' },
};

const EVENT_CFG: Record<string, { color: string; icon: string; label: string }> = {
  WATCH_START:       { color: 'text-slate-400',   icon: 'visibility',     label: 'Watch Start' },
  BREAKOUT_DETECTED: { color: 'text-indigo-400',  icon: 'rocket_launch',  label: 'Breakout' },
  ENTERED:           { color: 'text-emerald-400', icon: 'login',          label: 'Entered' },
  T1_HIT:            { color: 'text-teal-400',    icon: 'my_location',    label: 'T1 Hit' },
  T2_HIT:            { color: 'text-green-400',   icon: 'emoji_events',   label: 'T2 Hit' },
  DIP_WARNING:       { color: 'text-amber-400',   icon: 'warning',        label: 'Dip Warning' },
  DIP_RECOVERED:     { color: 'text-lime-400',    icon: 'undo',           label: 'Dip Recovered' },
  FAILED_BREAKOUT:   { color: 'text-zinc-400',    icon: 'dark_mode',      label: 'Failed' },
  STRONG_SELL:       { color: 'text-orange-400',  icon: 'trending_down',  label: 'Strong Sell' },
  STOP_HIT:          { color: 'text-red-400',     icon: 'dangerous',      label: 'Stop Hit' },
  MANUAL_CLOSE:      { color: 'text-gray-400',    icon: 'close',          label: 'Manual Close' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, prefix = '$') =>
  n != null ? `${prefix}${Number(n).toFixed(2)}` : '—';

const fmtX = (n: number | null | undefined) =>
  n != null ? `${Number(n).toFixed(2)}x` : '—';

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const pnlPct = (entry: number | null, last: number | null): number | null => {
  if (!entry || !last) return null;
  return ((last - entry) / entry) * 100;
};

const progressPct = (entry: number | null, t1: number | null, t2: number | null, stage: 'T1' | 'T2' | null): number => {
  if (!entry || !t1) return 0;
  if (stage === 'T2' && t2) {
    const full = (t2 - entry);
    return full > 0 ? Math.min(100, ((t1 - entry) / full) * 100) : 50;
  }
  return 50;
};

// ─── SKELETONS ────────────────────────────────────────────────────────────────

const CardSkeleton = () => (
  <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 space-y-2 animate-pulse">
    <div className="h-4 bg-slate-700 rounded w-14" />
    <div className="h-3 bg-slate-700 rounded w-10" />
    <div className="h-3 bg-slate-700 rounded w-full" />
  </div>
);

const RowSkeleton = () => (
  <tr className="border-b border-slate-800 animate-pulse">
    {[1,2,3,4,5,6,7,8].map(i => (
      <td key={i} className="px-3 py-2.5"><div className="h-3 bg-slate-800 rounded w-full" /></td>
    ))}
  </tr>
);

// ─── SYMBOL TIMELINE PANEL ────────────────────────────────────────────────────

const SymbolTimeline: React.FC<{
  symbol: string;
  events: StageEvent[];
  position: StagePosition | null;
  lifecycle: Lifecycle | null;
  loading: boolean;
  onClose: () => void;
}> = ({ symbol, events, position, lifecycle, loading, onClose }) => {
  const t1Pct = progressPct(position?.entry_price ?? null, position?.t1_target ?? null, position?.t2_target ?? null, position?.target_stage ?? null);
  const stageForBar = position?.target_stage;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-white tracking-tight font-mono">{symbol}</span>
          {lifecycle && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STAGE_CFG[lifecycle.current_stage]?.bg} ${STAGE_CFG[lifecycle.current_stage]?.border} ${STAGE_CFG[lifecycle.current_stage]?.color}`}>
              {STAGE_CFG[lifecycle.current_stage]?.label}
            </span>
          )}
          {lifecycle?.last_price && (
            <span className="text-sm font-mono font-bold text-slate-200">{fmt(lifecycle.last_price)}</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Open position summary */}
      {position && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Open Position</span>
            <span className="ml-auto text-[9px] font-mono text-slate-400">Qty: {position.qty ?? '—'}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { l: 'Entry', v: fmt(position.entry_price), c: 'text-amber-300' },
              { l: 'T1', v: fmt(position.t1_target), c: 'text-emerald-300' },
              { l: 'T2', v: fmt(position.t2_target), c: 'text-teal-300' },
              { l: 'SL', v: fmt(position.stop_loss), c: 'text-red-400' },
            ].map(({ l, v, c }) => (
              <div key={l}>
                <div className="text-[8px] text-slate-500 font-bold uppercase">{l}</div>
                <div className={`text-xs font-mono font-bold ${c}`}>{v}</div>
              </div>
            ))}
          </div>
          {/* Progress bar entry → T1 → T2 */}
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className={`absolute h-full rounded-full transition-all duration-700 ${stageForBar === 'T2' ? 'bg-teal-500' : 'bg-emerald-500'}`}
              style={{ width: `${t1Pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-mono">
            <span>Entry</span>
            {stageForBar === 'T2' ? <span className="text-teal-400">T2 chasing</span> : <span className="text-emerald-400">→ T1</span>}
            <span>T2</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">No events yet</div>
        ) : (
          [...events].reverse().map((ev, idx) => {
            const cfg = EVENT_CFG[ev.event_type] || EVENT_CFG.WATCH_START;
            const isLast = idx === 0;
            return (
              <div key={ev.id} className="flex gap-3 pb-3">
                {/* Line + Icon */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                    isLast ? 'bg-slate-700 border-slate-500' : 'bg-slate-800/60 border-slate-700/40'
                  }`}>
                    <span className={`material-symbols-outlined text-[14px] ${cfg.color}`}>{cfg.icon}</span>
                  </div>
                  {idx < events.length - 1 && <div className="w-px flex-1 bg-slate-700/50 mt-1 min-h-[12px]" />}
                </div>
                {/* Content */}
                <div className={`flex-1 min-w-0 pb-1 rounded-lg px-2.5 py-2 ${isLast ? 'bg-slate-800/40 border border-slate-700/30' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[9px] text-slate-600 font-mono">{ev.from_stage} → {ev.to_stage}</span>
                    <span className="ml-auto text-[9px] font-mono text-slate-500">{fmtTime(ev.created_at)}</span>
                  </div>
                  {ev.reason && (
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{ev.reason}</p>
                  )}
                  {/* Metrics row */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ev.price != null && <span className="text-[9px] font-mono text-slate-400">px {fmt(ev.price)}</span>}
                    {ev.vwap != null && <span className="text-[9px] font-mono text-slate-500">vwap {fmt(ev.vwap)}</span>}
                    {(ev.sma20 != null || ev.sma50 != null) && (
                      <span className="text-[9px] font-mono text-slate-500">
                        sma {ev.sma20 != null ? ev.sma20.toFixed(1) : '—'}·{ev.sma50 != null ? ev.sma50.toFixed(1) : '—'}
                      </span>
                    )}
                    {ev.st_dir && (
                      <span className={`text-[9px] font-bold ${ev.st_dir === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>ST {ev.st_dir}</span>
                    )}
                    {ev.vol_ratio != null && <span className="text-[9px] font-mono text-slate-500">{fmtX(ev.vol_ratio)}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── STAGE CARD ───────────────────────────────────────────────────────────────

const StageCard: React.FC<{
  item: Lifecycle;
  selected: boolean;
  flash: boolean;
  onClick: () => void;
}> = ({ item, selected, flash, onClick }) => {
  const cfg = STAGE_CFG[item.current_stage] || STAGE_CFG.WATCHING;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500
        ${selected
          ? 'border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/30'
          : `${cfg.border} ${cfg.bg} hover:border-opacity-70`
        }
        ${flash ? 'animate-[stageFlash_0.6s_ease-out]' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-black text-white font-mono tracking-tight">{item.symbol}</span>
        {item.last_price != null && (
          <span className="text-xs font-mono text-slate-300">{fmt(item.last_price)}</span>
        )}
      </div>
      {item.last_reason && (
        <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2 mb-1">{item.last_reason}</p>
      )}
      <span className="text-[8px] font-mono text-slate-500">{timeAgo(item.updated_at)}</span>
    </button>
  );
};

// ─── OPEN POSITIONS TABLE ─────────────────────────────────────────────────────

const OpenPositionsTable: React.FC<{
  positions: StagePosition[];
  lifecycles: Lifecycle[];
  loading: boolean;
}> = ({ positions, lifecycles, loading }) => {
  const lcMap = Object.fromEntries(lifecycles.map(l => [l.symbol, l]));
  const open = positions.filter(p => p.status === 'OPEN').sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
        <span className="material-symbols-outlined text-emerald-400 text-base">table_rows</span>
        <span className="text-xs font-black text-white uppercase tracking-wide">Open Positions</span>
        <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full ml-1">{open.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/40">
              {['Symbol','Entry','Last','Unreal %','Target','T1','T2','SL','Qty','Open Since'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i => <RowSkeleton key={i} />)
            ) : open.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-xs">No open positions</td>
              </tr>
            ) : open.map(p => {
              const lc = lcMap[p.symbol];
              const pct = pnlPct(p.entry_price, lc?.last_price ?? null);
              const isPos = pct != null && pct >= 0;
              return (
                <tr key={p.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="px-3 py-2.5 font-black text-white font-mono">{p.symbol}</td>
                  <td className="px-3 py-2.5 font-mono text-amber-300">{fmt(p.entry_price)}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-200">{fmt(lc?.last_price)}</td>
                  <td className={`px-3 py-2.5 font-mono font-bold ${pct == null ? 'text-slate-500' : isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pct == null ? '—' : `${isPos ? '+' : ''}${pct.toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${p.target_stage === 'T2' ? 'text-teal-300 bg-teal-900/20 border-teal-700/40' : 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40'}`}>
                      {p.target_stage ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-emerald-300">{fmt(p.t1_target)}</td>
                  <td className="px-3 py-2.5 font-mono text-teal-300">{fmt(p.t2_target)}</td>
                  <td className="px-3 py-2.5 font-mono text-red-400">{fmt(p.stop_loss)}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-300">{p.qty ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500 text-[10px]">{timeAgo(p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const USE_MOCK = false; // flips to true if supabase fails

const StageTrackerDashboard: React.FC = () => {
  const [lifecycles, setLifecycles] = useState<Lifecycle[]>([]);
  const [positions, setPositions] = useState<StagePosition[]>([]);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [lcLoading, setLcLoading] = useState(true);
  const [posLoading, setPosLoading] = useState(true);
  const [flashSymbols, setFlashSymbols] = useState<Set<string>>(new Set());
  const [hiddenStages, setHiddenStages] = useState<Set<StageKey>>(new Set());
  const [search, setSearch] = useState('');
  const [useMock, setUseMock] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchLifecycles = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('stock_lifecycle').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      setLifecycles(data || []);
      setUseMock(false);
    } catch {
      setLifecycles(MOCK_LIFECYCLE);
      setUseMock(true);
    } finally {
      setLcLoading(false);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('stage_positions').select('*').eq('status', 'OPEN');
      if (error) throw error;
      setPositions(data || []);
    } catch {
      setPositions(MOCK_POSITIONS);
    } finally {
      setPosLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async (symbol: string) => {
    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_stage_events')
        .select('*')
        .eq('symbol', symbol)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch {
      setEvents(symbol === 'NVDA' ? MOCK_EVENTS : []);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchLifecycles();
    fetchPositions();
    const interval = setInterval(() => { fetchLifecycles(); fetchPositions(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchLifecycles, fetchPositions]);

  // ── Fetch events on symbol select ──────────────────────────────────────────

  useEffect(() => {
    if (selectedSymbol) fetchEvents(selectedSymbol);
    else setEvents([]);
  }, [selectedSymbol, fetchEvents]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const flash = (sym: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setFlashSymbols(prev => new Set(prev).add(sym));
      debounceRef.current = setTimeout(() => {
        setFlashSymbols(new Set());
      }, 800);
    };

    const lcSub = supabase
      .channel('lifecycle-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_lifecycle' }, payload => {
        const updated = payload.new as Lifecycle;
        setLifecycles(prev => prev.map(l => l.symbol === updated.symbol ? updated : l));
        flash(updated.symbol);
      })
      .subscribe();

    const evSub = supabase
      .channel('event-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_stage_events' }, payload => {
        const ev = payload.new as StageEvent;
        flash(ev.symbol);
        if (ev.symbol === selectedSymbol) {
          setEvents(prev => [...prev, ev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(lcSub);
      supabase.removeChannel(evSub);
    };
  }, [selectedSymbol]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredLifecycles = lifecycles.filter(l =>
    (!search || l.symbol.toUpperCase().includes(search.toUpperCase())) &&
    !hiddenStages.has(l.current_stage)
  );

  const selectedLc = lifecycles.find(l => l.symbol === selectedSymbol) ?? null;
  const selectedPos = positions.find(p => p.symbol === selectedSymbol) ?? null;

  const toggleStage = (s: StageKey) => {
    setHiddenStages(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-hidden bg-slate-950 text-slate-100 flex flex-col h-full">
      <style>{`
        @keyframes stageFlash {
          0%   { box-shadow: 0 0 0 2px rgba(99,102,241,0.6); }
          100% { box-shadow: none; }
        }
      `}</style>

      {/* ── Filter Bar ── */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 flex-wrap bg-slate-900/80">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Symbol…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700/50 text-slate-200 placeholder-slate-600
                focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 w-28 font-mono"
            />
          </div>
          {useMock && (
            <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">
              MOCK DATA
            </span>
          )}
        </div>
        {/* Stage chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {STAGE_ORDER.map(s => {
            const cfg = STAGE_CFG[s];
            const count = lifecycles.filter(l => l.current_stage === s).length;
            const hidden = hiddenStages.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStage(s)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold transition-all ${
                  hidden
                    ? 'opacity-30 border-slate-700/40 bg-slate-800/40 text-slate-500'
                    : `${cfg.border} ${cfg.bg} ${cfg.color}`
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hidden ? 'bg-slate-600' : cfg.dot}`} />
                {cfg.label}
                {count > 0 && <span className="font-black">{count}</span>}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { fetchLifecycles(); fetchPositions(); }}
          className="text-slate-500 hover:text-emerald-400 transition-colors ml-auto"
          title="Refresh"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
        </button>
      </div>

      {/* ── Main area: Board + Timeline ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Board + Table (left/main column) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Stage Board */}
          <div className="flex-shrink-0 border-b border-slate-800 overflow-x-auto">
            <div className="flex gap-3 p-3 min-w-max">
              {STAGE_ORDER.filter(s => !hiddenStages.has(s)).map(stage => {
                const cfg = STAGE_CFG[stage];
                const items = filteredLifecycles.filter(l => l.current_stage === stage);
                return (
                  <div key={stage} className="w-44 flex-shrink-0 flex flex-col gap-2">
                    {/* Column header */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                      <span className={`material-symbols-outlined text-[13px] ${cfg.color}`}>{cfg.icon}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                      <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-black/20 ${cfg.color}`}>{items.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {lcLoading
                        ? [1, 2].map(i => <CardSkeleton key={i} />)
                        : items.length === 0
                          ? <p className="text-[9px] text-slate-600 text-center py-3">Empty</p>
                          : items.map(item => (
                            <StageCard
                              key={item.symbol}
                              item={item}
                              selected={selectedSymbol === item.symbol}
                              flash={flashSymbols.has(item.symbol)}
                              onClick={() => setSelectedSymbol(s => s === item.symbol ? null : item.symbol)}
                            />
                          ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open Positions Table */}
          <div className="flex-1 overflow-y-auto p-3">
            <OpenPositionsTable positions={positions} lifecycles={lifecycles} loading={posLoading} />
          </div>
        </div>

        {/* Symbol Timeline Panel */}
        {selectedSymbol && (
          <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l border-slate-700/50">
            <SymbolTimeline
              symbol={selectedSymbol}
              events={events}
              position={selectedPos}
              lifecycle={selectedLc}
              loading={eventsLoading}
              onClose={() => setSelectedSymbol(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StageTrackerDashboard;
