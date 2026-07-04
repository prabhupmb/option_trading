import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

// ─── ENDPOINT PLACEHOLDERS ────────────────────────────────────────────────────
// Fetching is done via the shared supabase client (services/supabase.ts).
// Update these there to point to a different project.
const _SUPABASE_URL = 'https://npwnnlxhdpvgfdpvrohi.supabase.co';
const _ANON_KEY     = 'sb_publishable_TAykwCsieEVaOafYSUfjYA_FadvFq2t';
void _SUPABASE_URL; void _ANON_KEY;

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TrendDir       = 'UP' | 'DOWN' | 'UNKNOWN';
type StockState     = 'WATCHING' | 'DOWNTREND' | 'CONSOLIDATING' | 'DIP_BUY'
                    | 'BREAKOUT_PENDING' | 'BREAKOUT_CONFIRMED' | 'RUNNING';
type SupportStatus  = 'holding' | 'untested' | 'broken';
type BreakoutStatus = 'far' | 'pending' | 'confirming' | 'confirmed';

interface SupportLevel { price: number; status: SupportStatus; }
type BuyZoneStatus = 'IN_ZONE' | 'ARMED' | 'INVALIDATED';
interface BuyZone {
  lo:            number | null;
  hi:            number | null;
  status?:       BuyZoneStatus;
  reason?:       'supports_broken' | 'no_uptrend' | null;
  reclaim_level?: number | null;
  anchor_ratio?: number;
}

interface LifecycleRow {
  symbol:                string;
  last_price:            number;
  trend_4h:              TrendDir;
  state:                 StockState;
  support_levels:        SupportLevel[];
  buy_zone:              BuyZone | null;
  breakout_level:        number | null;
  breakout_status:       BreakoutStatus;
  breakout_confirm_bars: number;
  disp_target1:          number | null;
  disp_target2:          number | null;
  swing_high:            number;
  swing_low:             number;
  updated_at:            string;
}

// ─── STATE CONFIG ─────────────────────────────────────────────────────────────

interface StateCfg { headline: string; sub: string; tone: string; icon: string; step: number; }

const STATE_CFG: Record<StockState, StateCfg> = {
  WATCHING:           { headline: 'Watching',                  sub: 'On the list — nothing happening yet.',                                              tone: '#71717a', icon: 'visibility',    step: 0 },
  DOWNTREND:          { headline: 'Pulling back — wait',       sub: 'Drifting lower. Not a buy yet — wait for it to steady.',                            tone: '#fb7185', icon: 'trending_down', step: 1 },
  CONSOLIDATING:      { headline: 'Settling down',             sub: 'Trading quietly in a range — sit tight until it picks a direction.',                tone: '#fbbf24', icon: 'pause_circle',  step: 1 },
  DIP_BUY:            { headline: 'In the buy zone',           sub: 'Found support and holding — a spot to watch for an entry.',                         tone: '#4ade80', icon: 'south',         step: 2 },
  BREAKOUT_PENDING:   { headline: 'Breaking out — confirming', sub: 'Pushing higher. Waiting for it to prove the move before we call it.',               tone: '#38bdf8', icon: 'rocket_launch', step: 3 },
  BREAKOUT_CONFIRMED: { headline: 'Breakout confirmed',        sub: "The move held — it's on its way toward the targets.",                               tone: '#4ade80', icon: 'verified',      step: 4 },
  RUNNING:            { headline: 'In the run',                sub: 'Trade is live and working toward its targets.',                                     tone: '#4ade80', icon: 'trending_up',   step: 4 },
};

// Filter chip groups (plain-language categories shown to users)
const FILTER_CHIPS: { id: string; label: string; states: StockState[] | null }[] = [
  { id: 'all',     label: 'All',          states: null },
  { id: 'watch',   label: 'Watching',     states: ['WATCHING', 'CONSOLIDATING'] },
  { id: 'pull',    label: 'Pulling back', states: ['DOWNTREND'] },
  { id: 'dip',     label: 'Buy zone',     states: ['DIP_BUY'] },
  { id: 'break',   label: 'Breakout',     states: ['BREAKOUT_PENDING', 'BREAKOUT_CONFIRMED'] },
  { id: 'running', label: 'Running',      states: ['RUNNING'] },
];

const STEPS = ['Watching', 'Pullback', 'Buy zone', 'Breakout', 'Running'] as const;

// ─── CONTEXT FILTER CONFIG ────────────────────────────────────────────────────

interface CtxChip { id: string; label: string; test: (row: LifecycleRow) => boolean; }

const deepestSupport = (row: LifecycleRow): SupportLevel | null => {
  const sl = row.support_levels ?? [];
  return sl.length === 0 ? null : sl.reduce((a, b) => b.price < a.price ? b : a);
};

const CONTEXT_CHIPS: CtxChip[] = [
  { id: 'strong-support', label: 'Strong support', test: r => deepestSupport(r)?.status === 'holding' },
  { id: 'at-support',     label: 'At support',     test: r => (r.support_levels ?? []).some(s => s.status === 'holding') },
  { id: 'dip-buy',        label: 'Dip buy',        test: r => r.state === 'DIP_BUY' },
  { id: 'consolidating',  label: 'Consolidating',  test: r => r.state === 'CONSOLIDATING' },
  { id: 'near-breakout',  label: 'Near breakout',  test: r => r.breakout_status === 'pending' || r.breakout_status === 'confirming' },
  { id: 'confirmed',      label: 'Confirmed',      test: r => r.breakout_status === 'confirmed' },
  { id: 'in-buy-zone',    label: 'In buy zone',    test: r => { const bz = r.buy_zone, p = r.last_price; return bz != null && bz.lo != null && bz.hi != null && p != null && p >= bz.lo && p <= bz.hi; } },
  { id: 'support-broken', label: 'Support broken', test: r => (r.support_levels ?? []).some(s => s.status === 'broken') },
];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK: LifecycleRow[] = [
  {
    symbol: 'META', last_price: 621.50, trend_4h: 'UP', state: 'RUNNING',
    support_levels: [{ price: 598.00, status: 'holding' }, { price: 580.00, status: 'untested' }],
    buy_zone: { lo: 598.00, hi: 608.00 }, breakout_level: 610.00,
    breakout_status: 'confirmed', breakout_confirm_bars: 2,
    disp_target1: 628.00, disp_target2: 645.00,
    swing_high: 652.00, swing_low: 572.00,
    updated_at: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    symbol: 'NVDA', last_price: 131.80, trend_4h: 'UP', state: 'BREAKOUT_CONFIRMED',
    support_levels: [{ price: 120.00, status: 'holding' }, { price: 112.00, status: 'untested' }],
    buy_zone: { lo: 118.00, hi: 124.00 }, breakout_level: 125.00,
    breakout_status: 'confirmed', breakout_confirm_bars: 2,
    disp_target1: 138.00, disp_target2: 148.00,
    swing_high: 152.00, swing_low: 108.00,
    updated_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    symbol: 'TSLA', last_price: 252.40, trend_4h: 'UP', state: 'BREAKOUT_PENDING',
    support_levels: [{ price: 238.00, status: 'holding' }, { price: 224.00, status: 'untested' }],
    buy_zone: { lo: 235.00, hi: 244.00 }, breakout_level: 255.00,
    breakout_status: 'confirming', breakout_confirm_bars: 1,
    disp_target1: 268.00, disp_target2: 285.00,
    swing_high: 292.00, swing_low: 216.00,
    updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    symbol: 'AAPL', last_price: 196.20, trend_4h: 'UP', state: 'DIP_BUY',
    support_levels: [{ price: 192.00, status: 'holding' }, { price: 184.00, status: 'untested' }],
    buy_zone: { lo: 191.00, hi: 197.50 }, breakout_level: 202.00,
    breakout_status: 'pending', breakout_confirm_bars: 0,
    disp_target1: 210.00, disp_target2: 220.00,
    swing_high: 226.00, swing_low: 180.00,
    updated_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    symbol: 'PLTR', last_price: 80.55, trend_4h: 'UP', state: 'DIP_BUY',
    support_levels: [{ price: 78.00, status: 'holding' }, { price: 72.00, status: 'untested' }],
    buy_zone: { lo: 77.00, hi: 82.00 }, breakout_level: 86.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 92.00, disp_target2: 100.00,
    swing_high: 106.00, swing_low: 66.00,
    updated_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    symbol: 'MSFT', last_price: 438.10, trend_4h: 'UP', state: 'CONSOLIDATING',
    support_levels: [{ price: 428.00, status: 'holding' }, { price: 414.00, status: 'untested' }],
    buy_zone: null, breakout_level: 448.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 460.00, disp_target2: 475.00,
    swing_high: 482.00, swing_low: 406.00,
    updated_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    symbol: 'SOFI', last_price: 13.82, trend_4h: 'UNKNOWN', state: 'CONSOLIDATING',
    support_levels: [{ price: 12.80, status: 'holding' }, { price: 11.90, status: 'untested' }],
    buy_zone: null, breakout_level: 15.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 16.50, disp_target2: null,
    swing_high: 17.20, swing_low: 11.40,
    updated_at: new Date(Date.now() - 55 * 60000).toISOString(),
  },
  {
    symbol: 'AMD', last_price: 140.30, trend_4h: 'DOWN', state: 'DOWNTREND',
    support_levels: [
      { price: 136.00, status: 'holding' },
      { price: 128.00, status: 'untested' },
      { price: 156.00, status: 'broken' },
    ],
    buy_zone: null, breakout_level: 152.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: null, disp_target2: null,
    swing_high: 166.00, swing_low: 124.00,
    updated_at: new Date(Date.now() - 14 * 60000).toISOString(),
  },
  {
    symbol: 'AMZN', last_price: 193.40, trend_4h: 'UNKNOWN', state: 'WATCHING',
    support_levels: [{ price: 186.00, status: 'holding' }, { price: 178.00, status: 'untested' }],
    buy_zone: null, breakout_level: 200.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 210.00, disp_target2: null,
    swing_high: 216.00, swing_low: 174.00,
    updated_at: new Date(Date.now() - 42 * 60000).toISOString(),
  },
  {
    symbol: 'GOOG', last_price: 177.60, trend_4h: 'DOWN', state: 'WATCHING',
    support_levels: [{ price: 170.00, status: 'untested' }, { price: 162.00, status: 'untested' }],
    buy_zone: null, breakout_level: 185.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 195.00, disp_target2: null,
    swing_high: 202.00, swing_low: 156.00,
    updated_at: new Date(Date.now() - 67 * 60000).toISOString(),
  },
  {
    symbol: 'COIN', last_price: 238.80, trend_4h: 'UP', state: 'BREAKOUT_PENDING',
    support_levels: [{ price: 224.00, status: 'holding' }, { price: 210.00, status: 'untested' }],
    buy_zone: { lo: 222.00, hi: 230.00 }, breakout_level: 242.00,
    breakout_status: 'confirming', breakout_confirm_bars: 1,
    disp_target1: 256.00, disp_target2: 272.00,
    swing_high: 278.00, swing_low: 204.00,
    updated_at: new Date(Date.now() - 6 * 60000).toISOString(),
  },
  {
    symbol: 'HOOD', last_price: 29.44, trend_4h: 'UNKNOWN', state: 'WATCHING',
    support_levels: [{ price: 27.00, status: 'holding' }, { price: 24.50, status: 'untested' }],
    buy_zone: null, breakout_level: 32.00,
    breakout_status: 'far', breakout_confirm_bars: 0,
    disp_target1: 36.00, disp_target2: null,
    swing_high: 38.00, swing_low: 22.00,
    updated_at: new Date(Date.now() - 88 * 60000).toISOString(),
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// ─── BUY ZONE KILL SWITCH ────────────────────────────────────────────────────
// Set to false to suppress the overlay entirely with no other side effects.
const SHOW_BUY_ZONE = true;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmt = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';

// ─── TREND BADGE ─────────────────────────────────────────────────────────────

const TrendBadge: React.FC<{ dir: TrendDir }> = ({ dir }) => {
  if (dir === 'UNKNOWN') return null;
  const up = dir === 'UP';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
      style={{
        background: up ? 'rgba(74,222,128,0.1)' : 'rgba(251,113,133,0.1)',
        color: up ? '#4ade80' : '#fb7185',
      }}
    >
      <span className="material-symbols-outlined text-[11px] leading-none">
        {up ? 'arrow_upward' : 'arrow_downward'}
      </span>
      {up ? 'Trending up' : 'Trending down'}
    </span>
  );
};

// ─── JOURNEY STEPPER ──────────────────────────────────────────────────────────

const StepperBar: React.FC<{ step: number }> = ({ step }) => (
  <div>
    {/* Dots + connectors */}
    <div className="flex items-center">
      {STEPS.map((_, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <React.Fragment key={i}>
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-500"
              style={{
                background: active ? '#22c55e' : done ? '#166534' : '#27272a',
                boxShadow: active ? '0 0 0 3px rgba(34,197,94,0.18), 0 0 10px rgba(34,197,94,0.5)' : 'none',
              }}
            />
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px transition-all duration-500"
                style={{ background: done ? '#166534' : '#27272a' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
    {/* Labels */}
    <div className="flex mt-2">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done   = i < step;
        return (
          <span
            key={label}
            className="text-[9px] font-bold uppercase tracking-wide transition-colors duration-300"
            style={{
              flex: 1,
              color: active ? '#22c55e' : done ? '#4ade80' : '#3f3f46',
              textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center',
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  </div>
);

// ─── PRICE TRACK ─────────────────────────────────────────────────────────────

const SUPPORT_CFG: Record<SupportStatus, { line: string; textColor: string; dashed: boolean }> = {
  holding:  { line: '#4ade80', textColor: '#4ade80', dashed: false },
  untested: { line: '#3f3f46', textColor: '#71717a', dashed: false },
  broken:   { line: '#fb7185', textColor: '#fb7185', dashed: true  },
};

const PriceTrack: React.FC<{ item: LifecycleRow }> = ({ item }) => {
  const {
    swing_low, swing_high, last_price,
    support_levels, buy_zone,
    breakout_level, breakout_confirm_bars,
    disp_target1, disp_target2, trend_4h,
  } = item;

  const safeHigh = swing_high ?? (last_price ?? 100) * 1.2;
  const safeLow  = swing_low  ?? (last_price ?? 100) * 0.8;
  const pad   = (safeHigh - safeLow) * 0.09;
  const lo    = safeLow  - pad;
  const hi    = safeHigh + pad;
  const range = hi - lo || 1;

  // Vertical position helpers (higher price = smaller top%)
  const toTop    = (p: number) => `${Math.max(0, Math.min(100, (1 - (p - lo) / range) * 100)).toFixed(2)}%`;
  const toBottom = (p: number) => `${Math.max(0, Math.min(100, ((p - lo) / range) * 100)).toFixed(2)}%`;

  const safeSupport   = support_levels ?? [];
  const lowestPrice   = safeSupport.length > 0 ? Math.min(...safeSupport.map(s => s.price)) : -Infinity;
  const sortedSupport = [...safeSupport].sort((a, b) => b.price - a.price);

  // Shared row layout: label (w-32, right-align) · track-element · price (w-24, left-align)
  const RowWrap: React.FC<{
    price: number;
    label: React.ReactNode;
    track: React.ReactNode;
    priceEl: React.ReactNode;
    zIndex?: number;
  }> = ({ price, label, track, priceEl, zIndex = 1 }) => (
    <div
      className="absolute w-full flex items-center"
      style={{ top: toTop(price), transform: 'translateY(-50%)', zIndex }}
    >
      <div className="w-32 flex-shrink-0 flex justify-end pr-3">{label}</div>
      <div className="flex-1 flex items-center min-w-0">{track}</div>
      <div className="w-24 flex-shrink-0 pl-3">{priceEl}</div>
    </div>
  );

  return (
    <div className="relative select-none" style={{ height: 320 }}>

      {/* ── Vertical axis line ── */}
      <div
        className="absolute top-0 bottom-0 w-px pointer-events-none"
        style={{ left: '50%', transform: 'translateX(-50%)', background: '#1f1f23' }}
      />

      {/* ── Buy Zone overlay (new-shape only; old-shape or null → nothing) ── */}
      {SHOW_BUY_ZONE && buy_zone != null && 'status' in buy_zone && buy_zone.status != null && (() => {
        const CHART_H = 320;
        // pixel-accurate converter (clamps to visible area)
        const toPx = (p: number) => Math.max(0, Math.min(CHART_H, (1 - (p - lo) / range) * CHART_H));

        const { status, lo: bzLo, hi: bzHi, reason, reclaim_level } = buy_zone;

        if (status === 'IN_ZONE' || status === 'ARMED') {
          if (bzHi == null || bzLo == null) return null;
          const bandTopPx = toPx(bzHi);
          const bandBotPx = toPx(bzLo);
          const bandH     = Math.max(4, bandBotPx - bandTopPx);
          const inZone    = status === 'IN_ZONE';

          return (
            <div
              className="absolute inset-x-0 pointer-events-none"
              style={{
                top:          bandTopPx,
                height:       bandH,
                background:   inZone ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.06)',
                border:       `1px ${inZone ? 'solid' : 'dashed'} rgba(52,211,153,${inZone ? 0.4 : 0.3})`,
                borderRadius: 3,
                zIndex:       0,
              }}
            >
              <span
                className="absolute right-2 top-1 font-mono text-[9px] font-bold leading-none"
                style={{ color: inZone ? '#34d399' : 'rgba(52,211,153,0.5)' }}
              >
                BUY ZONE {fmt(bzLo)} – {fmt(bzHi)} · {status === 'IN_ZONE' ? 'IN ZONE' : 'ARMED'}
              </span>
            </div>
          );
        }

        if (status === 'INVALIDATED') {
          const pillTopPx = reclaim_level != null ? toPx(reclaim_level) : 8;
          const msg = reason === 'supports_broken'
            ? reclaim_level != null
              ? `Buy zone invalid — all supports broken. Reclaim ${fmt(reclaim_level)} first.`
              : 'Buy zone invalid — all supports broken.'
            : 'Buy zone inactive — 4h trend is not up.';

          return (
            <div
              className="absolute right-3 pointer-events-none"
              style={{ top: pillTopPx, transform: 'translateY(-50%)', zIndex: 20 }}
            >
              <span
                className="inline-block px-2 py-0.5 rounded-full border font-mono text-[9px] leading-snug"
                style={{
                  background:  '#18181b',
                  borderColor: '#3f3f46',
                  color:       '#71717a',
                  maxWidth:    220,
                  whiteSpace:  'normal',
                }}
              >
                {msg}
              </span>
            </div>
          );
        }

        return null;
      })()}

      {/* ── Target 2 ── */}
      {disp_target2 != null && (
        <RowWrap
          price={disp_target2}
          label={<span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>Target</span>}
          track={<div className="w-full h-px border-t border-dashed opacity-40" style={{ borderColor: '#4ade80' }} />}
          priceEl={<span className="font-mono text-[10px]" style={{ color: '#4ade80' }}>{fmt(disp_target2)}</span>}
        />
      )}

      {/* ── Target 1 ── */}
      {disp_target1 != null && (
        <RowWrap
          price={disp_target1}
          label={<span className="text-[10px] font-medium" style={{ color: '#22c55e' }}>Target</span>}
          track={<div className="w-full h-px border-t border-dashed opacity-50" style={{ borderColor: '#22c55e' }} />}
          priceEl={<span className="font-mono text-[10px]" style={{ color: '#22c55e' }}>{fmt(disp_target1)}</span>}
        />
      )}

      {/* ── Breakout level ── */}
      {breakout_level != null && (
        <div
          className="absolute w-full flex items-center"
          style={{ top: toTop(breakout_level), transform: 'translateY(-50%)', zIndex: 2 }}
        >
          <div className="w-32 flex-shrink-0 flex justify-end pr-3">
            <span className="text-[10px] font-medium" style={{ color: '#38bdf8' }}>Breakout</span>
          </div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div
              className="flex-1 h-px opacity-60"
              style={{ borderTop: `1px ${breakout_confirm_bars >= 2 ? 'solid' : 'dashed'} #38bdf8` }}
            />
            {/* Confirmation dots */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full border"
                  style={{
                    background: i < breakout_confirm_bars ? '#38bdf8' : 'transparent',
                    borderColor: '#38bdf8',
                    opacity: i < breakout_confirm_bars ? 1 : 0.35,
                  }}
                />
              ))}
              {breakout_confirm_bars >= 2 && (
                <span className="text-[9px] font-bold" style={{ color: '#38bdf8' }}>Confirmed</span>
              )}
              {breakout_confirm_bars === 1 && (
                <span className="text-[9px] font-bold opacity-70" style={{ color: '#38bdf8' }}>Confirming</span>
              )}
            </div>
          </div>
          <div className="w-24 flex-shrink-0 pl-3">
            <span className="font-mono text-[10px]" style={{ color: '#38bdf8' }}>{fmt(breakout_level)}</span>
          </div>
        </div>
      )}

      {/* ── Current price dot ── */}
      <div
        className="absolute w-full flex items-center"
        style={{ top: toTop(last_price ?? ((safeHigh + safeLow) / 2)), transform: 'translateY(-50%)', zIndex: 10 }}
      >
        <div className="w-32 flex-shrink-0 flex justify-end pr-3">
          <span className="text-[10px] font-bold" style={{ color: '#22c55e' }}>now</span>
        </div>
        <div className="flex-1 flex items-center min-w-0">
          <div
            className="w-3.5 h-3.5 rounded-full flex-shrink-0 motion-safe:animate-pulse"
            style={{
              background: '#22c55e',
              boxShadow: '0 0 0 4px rgba(34,197,94,0.15), 0 0 14px rgba(34,197,94,0.55)',
            }}
          />
        </div>
        <div className="w-24 flex-shrink-0 pl-3">
          <span className="font-mono text-sm font-black" style={{ color: '#fafafa' }}>{fmt(last_price)}</span>
        </div>
      </div>

      {/* ── Support levels ── */}
      {sortedSupport.map((s, i) => {
        const cfg      = SUPPORT_CFG[s.status];
        const isLowest = s.price === lowestPrice;
        const label    = s.status === 'broken' ? 'Broken' : isLowest ? 'Strong support' : 'Support';
        return (
          <RowWrap
            key={i}
            price={s.price}
            label={<span className="text-[10px]" style={{ color: cfg.textColor }}>{label}</span>}
            track={
              <div
                className="w-full h-px opacity-55"
                style={{ borderTop: `1px ${cfg.dashed ? 'dashed' : 'solid'} ${cfg.line}` }}
              />
            }
            priceEl={<span className="font-mono text-[10px]" style={{ color: cfg.line }}>{fmt(s.price)}</span>}
          />
        );
      })}
    </div>
  );
};

// ─── ROSTER ROW SKELETON ─────────────────────────────────────────────────────

const RosterSkeleton: React.FC<{ n?: number }> = ({ n = 8 }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-3 border-b animate-pulse" style={{ borderColor: '#1f1f23' }}>
        <div className="h-3 w-10 rounded" style={{ background: '#1f1f23' }} />
        <div className="h-3 flex-1 rounded" style={{ background: '#131316' }} />
        <div className="h-3 w-14 rounded" style={{ background: '#131316' }} />
      </div>
    ))}
  </>
);

// ─── DETAIL SKELETON ─────────────────────────────────────────────────────────

const DetailSkeleton: React.FC = () => (
  <div className="p-6 space-y-5 max-w-2xl mx-auto animate-pulse">
    <div className="flex gap-3 items-end">
      <div className="h-8 w-20 rounded" style={{ background: '#131316' }} />
      <div className="h-6 w-24 rounded" style={{ background: '#131316' }} />
    </div>
    <div className="h-24 rounded-2xl" style={{ background: '#131316' }} />
    <div className="h-14 rounded-xl" style={{ background: '#131316' }} />
    <div className="h-72 rounded-xl" style={{ background: '#131316' }} />
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const StockLifecycleView: React.FC = () => {
  const [rows, setRows]       = useState<LifecycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [activeCtx, setActiveCtx] = useState<Set<string>>(new Set());

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const { data, error: dbErr } = await supabase
        .from('stock_lifecycle')
        .select('symbol,last_price,trend_4h,current_stage,state,support_levels,buy_zone,breakout_level,breakout_status,breakout_confirm_bars,disp_target1,disp_target2,swing_high,swing_low,updated_at')
        .order('symbol', { ascending: true });

      if (dbErr) throw dbErr;

      if (!data || data.length === 0) {
        setRows(MOCK); setUseMock(true);
      } else {
        // Map current_stage → state when state column is null/missing
        const STAGE_MAP: Record<string, StockState> = {
          WATCHING:           'WATCHING',
          CONSOLIDATING:      'CONSOLIDATING',
          BREAKOUT_DETECTED:  'BREAKOUT_PENDING',
          OPEN_T1:            'BREAKOUT_CONFIRMED',
          OPEN_T2:            'RUNNING',
          DIP:                'DIP_BUY',
          FAILED_BREAKOUT:    'DOWNTREND',
          CLOSED_WIN:         'WATCHING',
          CLOSED_LOSS:        'DOWNTREND',
          MANUAL_CLOSE:       'WATCHING',
        };
        const mapped = data.map((row: any) => ({
          ...row,
          state: (row.state as StockState) ?? STAGE_MAP[row.current_stage] ?? 'WATCHING',
          support_levels: row.support_levels ?? [],
        }));
        setRows(mapped as LifecycleRow[]); setUseMock(false);
      }
      setError(null);
    } catch (err: any) {
      console.error('[StockLifecycleView]', err);
      setRows(MOCK); setUseMock(true); setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 45_000);
    return () => clearInterval(t);
  }, [fetchData]);

  // Auto-select first row once data is ready
  useEffect(() => {
    if (!selected && rows.length > 0) setSelected(rows[0].symbol);
  }, [rows, selected]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const activeChip = FILTER_CHIPS.find(c => c.id === filter) ?? FILTER_CHIPS[0];

  // Stage-filtered base (used for context chip badge counts)
  const stageFiltered = useMemo(() => {
    if (!activeChip.states) return rows;
    return rows.filter(r => activeChip.states!.includes(r.state));
  }, [rows, activeChip]);

  const toggleCtx = (id: string) =>
    setActiveCtx(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visible = useMemo(() => {
    let items = stageFiltered;
    // AND-combine every active context filter
    for (const id of activeCtx) {
      const chip = CONTEXT_CHIPS.find(c => c.id === id);
      if (chip) items = items.filter(chip.test);
    }
    const q = search.trim().toUpperCase();
    if (q) items = items.filter(r => r.symbol.includes(q));
    return items;
  }, [stageFiltered, activeCtx, search]);

  const selectedRow = rows.find(r => r.symbol === selected) ?? null;
  const cfg         = selectedRow ? (STATE_CFG[selectedRow.state] ?? STATE_CFG['WATCHING']) : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#0a0a0b', color: '#fafafa' }}>

      {/* ══ LEFT ROSTER ══════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col border-r overflow-hidden flex-shrink-0"
        style={{ width: 272, borderColor: '#1f1f23', background: '#0d0d10' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b" style={{ borderColor: '#1f1f23' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>Watchlist</p>

          {/* Search */}
          <div className="relative">
            <span
              className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: '#52525b' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search symbol…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg focus:outline-none"
              style={{
                background: '#131316',
                border: '1px solid #1f1f23',
                color: '#fafafa',
                boxShadow: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#22c55e')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#1f1f23')}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: '#52525b' }}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 1 — Stage filters (single-select) */}
        <div className="flex-shrink-0 px-3 pt-2 pb-1.5 flex flex-wrap gap-1.5 border-b" style={{ borderColor: '#1f1f23' }}>
          {FILTER_CHIPS.map(chip => {
            const count  = chip.states ? rows.filter(r => chip.states!.includes(r.state)).length : rows.length;
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all"
                style={{
                  background:  active ? 'rgba(34,197,94,0.08)' : '#131316',
                  borderColor: active ? '#22c55e'              : '#1f1f23',
                  color:       active ? '#22c55e'              : '#52525b',
                }}
              >
                {chip.label}
                <span style={{ opacity: 0.55 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ROW 2 — Context filters (multi-select) */}
        <div className="flex-shrink-0 px-3 pt-1.5 pb-2 border-b" style={{ borderColor: '#1f1f23' }}>
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_CHIPS.map(chip => {
              const active = activeCtx.has(chip.id);
              const count  = stageFiltered.filter(chip.test).length;
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleCtx(chip.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all"
                  style={{
                    background:  active ? 'rgba(34,197,94,0.08)' : 'transparent',
                    borderColor: active ? '#22c55e'              : '#2a2a2e',
                    color:       active ? '#22c55e'              : '#3f3f46',
                  }}
                >
                  {chip.label}
                  <span style={{ opacity: active ? 0.7 : 0.45 }}>{count}</span>
                </button>
              );
            })}
            {activeCtx.size > 0 && (
              <button
                onClick={() => setActiveCtx(new Set())}
                className="px-2 py-0.5 text-[10px] font-bold transition-colors"
                style={{ color: '#52525b' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fb7185')}
                onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <RosterSkeleton />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-5 gap-2">
              <span className="material-symbols-outlined text-3xl" style={{ color: '#27272a' }}>search_off</span>
              <p className="text-xs text-center" style={{ color: '#52525b' }}>
                {activeCtx.size > 0 ? 'No matches — loosen filters.' : search ? `No match for "${search}"` : 'Nothing in this category.'}
              </p>
              {(search || filter !== 'all' || activeCtx.size > 0) && (
                <button
                  className="text-xs font-bold mt-1"
                  style={{ color: '#22c55e' }}
                  onClick={() => { setSearch(''); setFilter('all'); setActiveCtx(new Set()); }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            visible.map((row, idx) => {
              const rc         = STATE_CFG[row.state] ?? STATE_CFG['WATCHING'];
              const isSelected = row.symbol === selected;
              const isUp       = row.trend_4h === 'UP';
              const isDown     = row.trend_4h === 'DOWN';
              return (
                <button
                  key={row.symbol}
                  onClick={() => setSelected(row.symbol)}
                  className="w-full text-left flex items-center gap-2 px-3 py-3 border-b border-l-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-green-500"
                  style={{
                    borderBottomColor: '#1f1f23',
                    borderLeftColor:   isSelected ? '#22c55e' : 'transparent',
                    background:        isSelected
                      ? '#131316'
                      : idx % 2 === 0
                        ? 'transparent'
                        : 'rgba(255,255,255,0.01)',
                  }}
                >
                  {/* Symbol */}
                  <span className="font-black text-sm font-mono tracking-tight" style={{ color: '#fafafa', minWidth: 46 }}>
                    {row.symbol}
                  </span>

                  {/* Trend arrow */}
                  {row.trend_4h !== 'UNKNOWN' && (
                    <span
                      className="material-symbols-outlined text-[12px] flex-shrink-0"
                      style={{ color: isUp ? '#4ade80' : '#fb7185' }}
                    >
                      {isUp ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}

                  {/* State headline */}
                  <span className="text-[10px] font-bold flex-1 min-w-0 truncate" style={{ color: rc.tone }}>
                    {rc.headline}
                  </span>

                  {/* Price */}
                  <span className="font-mono text-[10px] flex-shrink-0" style={{ color: '#52525b' }}>
                    {fmt(row.last_price)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-3 py-2 border-t flex items-center gap-2"
          style={{ borderColor: '#1f1f23' }}
        >
          {useMock && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
              style={{ color: '#fbbf24', borderColor: '#78350f', background: 'rgba(251,191,36,0.06)' }}
            >
              DEMO
            </span>
          )}
          <span className="text-[9px] ml-auto" style={{ color: '#3f3f46' }}>
            {visible.length} of {rows.length}
          </span>
        </div>
      </div>

      {/* ══ RIGHT DETAIL ═════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {loading ? (
          <DetailSkeleton />
        ) : !selectedRow || !cfg ? (
          /* Empty placeholder */
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
            <span className="material-symbols-outlined text-5xl" style={{ color: '#27272a' }}>candlestick_chart</span>
            <p className="text-sm font-bold" style={{ color: '#3f3f46' }}>Pick a stock to see its full picture</p>
            <p className="text-xs text-center" style={{ color: '#27272a', maxWidth: 280 }}>
              Each stock is tracked through its journey — from first watch to a confirmed move.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-2xl mx-auto pb-10">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="text-3xl font-black font-mono tracking-tight" style={{ color: '#fafafa' }}>
                    {selectedRow.symbol}
                  </h2>
                  <span className="text-2xl font-mono font-bold" style={{ color: '#a1a1aa' }}>
                    {fmt(selectedRow.last_price)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <TrendBadge dir={selectedRow.trend_4h} />
                  <span className="text-[10px]" style={{ color: '#52525b' }}>
                    Updated {timeAgo(selectedRow.updated_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={fetchData}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: '#1f1f23', color: '#52525b', background: '#131316' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Refresh
              </button>
            </div>

            {/* ── Hero status card ────────────────────────────────────────── */}
            <div
              className="rounded-2xl p-5 border"
              style={{
                background:   `${cfg.tone}0c`,
                borderColor:  `${cfg.tone}22`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cfg.tone}18` }}
                >
                  <span className="material-symbols-outlined text-xl" style={{ color: cfg.tone }}>
                    {cfg.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-black leading-tight" style={{ color: cfg.tone }}>
                    {cfg.headline}
                  </p>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: '#a1a1aa' }}>
                    {cfg.sub}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Journey stepper ─────────────────────────────────────────── */}
            <div
              className="rounded-xl p-4 border"
              style={{ background: '#0d0d10', borderColor: '#1f1f23' }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: '#3f3f46' }}>
                Journey
              </p>
              <StepperBar step={cfg.step} />
            </div>

            {/* ── Price track ─────────────────────────────────────────────── */}
            <div
              className="rounded-xl p-5 border"
              style={{ background: '#0d0d10', borderColor: '#1f1f23' }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest mb-5" style={{ color: '#3f3f46' }}>
                Price levels
              </p>
              <PriceTrack item={selectedRow} />
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default StockLifecycleView;
