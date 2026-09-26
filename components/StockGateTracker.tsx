import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';
import ExecuteStockTradeModal from './ExecuteStockTradeModal';
import { SmartSignal } from '../hooks/useSignals';

// ─── TYPES ────────────────────────────────────────────────────

interface StrategyConfig {
    id: string;
    strategy: string;
    display_name: string;
    icon: string;
    is_active: boolean;
    params: { [key: string]: any };
}

interface BoardRow {
    id: number;
    symbol: string;
    trade_direction: 'BUY' | 'SHORT';
    setup_type: 'BREAKOUT' | 'DIP';
    signal_state: 'STRONG_BUY' | 'BUY' | 'DIP_BUY' | 'DIP_WATCH' | 'SELL' | 'STRONG_SELL';
    signal: string;
    tier: 'A+' | 'A';
    gates_passed: string;
    dip_gates_passed: string | null;
    qualified: boolean;
    block_reason: 'SHORT_BLOCKLIST' | 'SHORT_ON_SUPPORT' | 'STOP_TOO_WIDE' | null;
    watch_reason: 'NO_TRIGGER' | 'RR_BELOW_FLOOR' | 'T1_TOO_CLOSE' | null;
    current_price: number;
    entry_price: number;
    target_price: number;
    fib_target2: number;
    stop_loss: number;
    sl_pct: number;
    sl_method: string;
    rr_value: number | null;
    risk_reward_ratio: string;
    t1_dist_pct: number;
    execution_hint: 'READY_BUY' | 'READY_SELL' | 'WAIT';
    execution_reason: string;
    st_5m_direction: 'BULLISH' | 'BEARISH';
    st_15m_direction: 'BULLISH' | 'BEARISH';
    st_1h_direction: 'BULLISH' | 'BEARISH';
    st_4h_direction: 'BULLISH' | 'BEARISH';
    st_daily_direction: 'BULLISH' | 'BEARISH' | null;
    sma20: number | null;
    sma50: number | null;
    sma_direction: string;
    adx_value: number;
    plus_di: number;
    minus_di: number;
    vwap_value: number;
    vwap_position: 'ABOVE' | 'BELOW';
    vwap_trend: 'RISING' | 'FALLING' | 'NEUTRAL';
    atr_pct: number;
    rvol: number | null;
    volume_trend: 'SURGE' | 'HIGH' | 'NORMAL' | 'LOW' | 'UNKNOWN';
    retrace_pct: number | null;
    pullback_pct: number | null;
    invalidation_price: number | null;
    entry_location_pct: number | null;
    gate_reason: string;
    dip_gate_reason: string | null;
    horizon_target: number | null;
    horizon_move_pct: number | null;
    horizon_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    price_source: 'REAL-TIME' | 'HUB-5m-CLOSE';
    snapshot_age_sec: number;
    scan_id: string;
    scanned_at: string;
}

interface StockGatePosition {
    id: string;
    symbol: string;
    trade_direction: string;
    tier: string;
    status: string;
    signal: string;
    trading_recommendation: string;
    entry_price: number;
    target_price: number;
    stop_loss: number;
    profit_zone_low: number;
    profit_zone_high: number;
    risk_reward_ratio: string;
    fib_swing_high: number;
    fib_swing_low: number;
    fib_target1: number;
    fib_target2: number;
    fib_direction: string;
    gates_passed: string;
    adx_value: number;
    adx_trend: string;
    plus_di: number;
    minus_di: number;
    vwap_value: number;
    vwap_trend: string;
    vwap_position: string;
    vwap_distance: number;
    sma20: number;
    sma50: number;
    sma_spread: number;
    st_1h_direction: string;
    st_1h_value: number;
    st_15m_direction: string;
    st_15m_value: number;
    st_5m_direction: string;
    st_5m_value: number;
    g1_sma: string;
    g2_1h: string;
    g3_15m: string;
    g4_5m: string;
    g5_vwap: string;
    g6_adx: string;
    gate_reason: string;
    sma_direction: string;
    consensus_vote: string;
    opened_at: string;
    source: string;
    version: string;
    current_price: number;
    progress_pct: number;
    high_water_mark: number;
    low_water_mark: number;
    last_checked_at: string;
    check_count: number;
    closed_at: string | null;
    close_reason: string | null;
    pnl_dollars: number;
    pnl_pct: number;
    // Extended fields (nullable for older rows)
    setup_type?: 'BREAKOUT' | 'DIP' | null;
    signal_state?: string | null;
    round_number?: number | null;
    exposure_key?: string | null;
    st_4h_direction?: string | null;
    st_4h_value?: number | null;
    st4h_exit_armed?: boolean | null;
    sl_pct?: number | null;
    sl_method?: string | null;
    rr_value?: number | null;
    t1_dist_pct?: number | null;
    atr_pct?: number | null;
    rvol?: number | null;
    volume_trend?: string | null;
    horizon_target?: number | null;
    horizon_move_pct?: number | null;
    horizon_confidence?: string | null;
    dip_gates_passed?: string | null;
    dip_gate_reason?: string | null;
    dip_retrace_pct?: number | null;
    dip_pullback_pct?: number | null;
    dip_invalidation_price?: number | null;
    dip_trigger_at?: string | null;
    entry_location_pct?: number | null;
    price_source?: string | null;
    // Execution hint (existing)
    execution_hint?: string | null;
    execution_reason?: string | null;
    st_5m_aligned?: boolean | null;
    st_15m_aligned?: boolean | null;
    option_type?: string | null;
}

interface StockGateHistory {
    id: string;
    position_id: string;
    symbol: string;
    trade_direction: string;
    tier: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    pnl_dollars: number;
    result: string;
    exit_reason: string;
    duration_minutes: number;
    high_water_mark: number;
    low_water_mark: number;
    opened_at: string;
    closed_at: string;
    gates_passed: string;
}

type BoardFilter = 'ALL' | 'STRONG_BUY' | 'BUY' | 'DIP_BUY' | 'DIP_WATCH' | 'SELL' | 'STRONG_SELL';
type SetupFilter = 'ALL' | 'BREAKOUT' | 'DIP';

const STATE_ORDER: Record<string, number> = {
    STRONG_BUY: 0, BUY: 1, DIP_BUY: 2, DIP_WATCH: 3, SELL: 4, STRONG_SELL: 5,
};

// ─── HELPERS ─────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toFixed(2)}` : '\u2014';
const pctFmt = (n: number | null | undefined, decimals = 1) => n != null ? `${n.toFixed(decimals)}%` : '\u2014';

const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes) return '\u2014';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h < 24) return `${h}h ${m}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
};

const timeSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '\u2014';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    return formatDuration(mins) + ' ago';
};

const durationSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '\u2014';
    return formatDuration(Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
};

const formatOpenedAt = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '\u2014';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} ${timePart} (${timeSince(dateStr)})`;
};

const gateIsPassed = (g: string | null | undefined): boolean => {
    if (!g) return false;
    return g.includes('\u2713') || g.includes('\u2705') || g.includes('PASS');
};

const calcPnl = (pos: StockGatePosition): number => {
    if (pos.pnl_pct != null && pos.pnl_pct !== 0) return pos.pnl_pct;
    if (!pos.entry_price || !pos.current_price) return 0;
    const isBuy = pos.trade_direction?.toUpperCase() === 'BUY';
    return isBuy
        ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
        : ((pos.entry_price - pos.current_price) / pos.entry_price) * 100;
};

const isProfitable = (pos: StockGatePosition): boolean => {
    const isBuy = pos.trade_direction?.toUpperCase() === 'BUY';
    return isBuy ? pos.current_price > pos.entry_price : pos.current_price < pos.entry_price;
};

const getCSTNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

const isMarketHoursCT = (): boolean => {
    const cst = getCSTNow();
    const d = cst.getDay();
    if (d === 0 || d === 6) return false;
    const hm = cst.getHours() * 100 + cst.getMinutes();
    return hm >= 830 && hm < 1500;
};

// ─── SIGNAL STATE BADGE ─────────────────────────────────────

const STATE_STYLES: Record<string, { label: string; emoji: string; bg: string; border: string; text: string }> = {
    STRONG_BUY:  { label: 'Strong Buy',  emoji: '\uD83D\uDD25', bg: 'rgba(22,163,74,0.15)',  border: 'rgba(22,163,74,0.5)',   text: '#16a34a' },
    BUY:         { label: 'Buy',         emoji: '\u2705',        bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#22c55e' },
    DIP_BUY:     { label: 'Dip Buy',     emoji: '\uD83D\uDFE2', bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.4)',  text: '#14b8a6' },
    DIP_WATCH:   { label: 'Dip Watch',   emoji: '\uD83D\uDC40', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.35)', text: '#38bdf8' },
    SELL:        { label: 'Sell',         emoji: '\u2705',        bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.4)',  text: '#f97316' },
    STRONG_SELL: { label: 'Strong Sell',  emoji: '\uD83D\uDD25', bg: 'rgba(220,38,38,0.15)',  border: 'rgba(220,38,38,0.5)',   text: '#dc2626' },
};

const SignalStateBadge: React.FC<{ state: string }> = ({ state }) => {
    const s = STATE_STYLES[state] || { label: state, emoji: '', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', text: '#6b7280' };
    return (
        <span style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 900,
            background: s.bg, border: `1px solid ${s.border}`, color: s.text,
            letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
            {s.emoji} {s.label}
        </span>
    );
};

// ─── EXECUTION HINT BADGE ───────────────────────────────────

const ExecBadge: React.FC<{ hint: string; reason?: string }> = ({ hint, reason }) => {
    const isReady = hint === 'READY_BUY' || hint === 'READY_SELL';
    return (
        <span title={reason || ''} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 900,
            letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'default',
            ...(isReady ? {
                color: '#22c55e', background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 0 10px rgba(52,211,153,0.18)',
            } : {
                color: '#8b93a7', background: 'rgba(107,114,128,0.08)',
                border: '1px solid rgba(107,114,128,0.2)',
            }),
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isReady ? '#22c55e' : '#8b93a7',
                animation: isReady ? 'sgPulse 2s infinite' : 'none',
            }} />
            {isReady ? (hint === 'READY_BUY' ? 'Ready Buy' : 'Ready Sell') : 'Wait'}
        </span>
    );
};

// ─── TF DOT ─────────────────────────────────────────────────

const TfDot: React.FC<{ label: string; dir: string | null | undefined }> = ({ label, dir }) => {
    const bullish = (dir || '').toUpperCase() === 'BULLISH';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, color: '#7a8c8c',
        }}>
            <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: bullish ? '#22c55e' : '#ef4444',
            }} />
            {label}
        </span>
    );
};

// ─── RANGE BAR ──────────────────────────────────────────────

const RangeBar: React.FC<{ sl: number; entry: number; t1: number; t2: number; current: number }> = ({ sl, entry, t1, t2, current }) => {
    const min = Math.min(sl, entry, t1, t2);
    const max = Math.max(sl, entry, t1, t2);
    const range = max - min || 1;
    const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / range) * 100))}%`;
    return (
        <div style={{ position: 'relative', height: 8, background: '#182222', borderRadius: 4, margin: '2px 0' }}>
            {/* SL → Entry zone (red) */}
            <div style={{
                position: 'absolute', left: pos(Math.min(sl, entry)), width: `calc(${pos(Math.max(sl, entry))} - ${pos(Math.min(sl, entry))})`,
                top: 0, bottom: 0, background: 'rgba(239,68,68,0.25)', borderRadius: 4,
            }} />
            {/* Entry → T1 zone (green) */}
            <div style={{
                position: 'absolute', left: pos(Math.min(entry, t1)), width: `calc(${pos(Math.max(entry, t1))} - ${pos(Math.min(entry, t1))})`,
                top: 0, bottom: 0, background: 'rgba(34,197,94,0.20)', borderRadius: 4,
            }} />
            {/* T1 → T2 zone (bright green) */}
            <div style={{
                position: 'absolute', left: pos(Math.min(t1, t2)), width: `calc(${pos(Math.max(t1, t2))} - ${pos(Math.min(t1, t2))})`,
                top: 0, bottom: 0, background: 'rgba(22,163,74,0.15)', borderRadius: 4,
            }} />
            {/* Markers */}
            {[
                { v: sl, color: '#ef4444', label: 'SL' },
                { v: entry, color: '#facc15', label: 'Entry' },
                { v: t1, color: '#22c55e', label: 'T1' },
                { v: t2, color: '#16a34a', label: 'T2' },
            ].map(m => (
                <div key={m.label} title={m.label} style={{
                    position: 'absolute', left: pos(m.v), top: -1, width: 3, height: 10,
                    background: m.color, borderRadius: 1, transform: 'translateX(-1px)',
                }} />
            ))}
            {/* Current price diamond */}
            <div title={`Current ${fmt(current)}`} style={{
                position: 'absolute', left: pos(current), top: '50%',
                width: 6, height: 6, background: '#fff', borderRadius: 1,
                transform: 'translate(-3px, -50%) rotate(45deg)',
            }} />
        </div>
    );
};

// ─── GATE DOTS ──────────────────────────────────────────────

const GateDots: React.FC<{ passed: string; total?: number }> = ({ passed, total = 6 }) => {
    const match = passed.match(/(\d+)/);
    const n = match ? parseInt(match[1]) : 0;
    return (
        <span style={{ display: 'inline-flex', gap: 3 }}>
            {Array.from({ length: total }, (_, i) => (
                <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: i < n ? '#22c55e' : '#1f2a2a',
                    border: `1px solid ${i < n ? 'rgba(34,197,94,0.5)' : '#2a3838'}`,
                }} />
            ))}
        </span>
    );
};

// ─── COLLAPSIBLE GATE LIST ──────────────────────────────────

const GateList: React.FC<{ reason: string; labels?: string[] }> = ({ reason, labels }) => {
    const [open, setOpen] = useState(false);
    const items = reason.split(' | ').filter(Boolean);
    return (
        <div>
            <button onClick={() => setOpen(!open)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#7a8c8c',
                fontSize: 9, fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}>
                <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block', fontSize: 8 }}>
                    &#9660;
                </span>
                {open ? 'Hide gates' : 'Show gates'}
            </button>
            {open && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {items.map((item, i) => {
                        const pass = item.includes('\u2713') || item.includes('\u2705') || item.includes('PASS');
                        const label = labels?.[i];
                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 8px', borderRadius: 6,
                                fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                                background: pass ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)',
                                border: `1px solid ${pass ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)'}`,
                                color: pass ? '#22c55e' : 'rgba(239,68,68,0.6)',
                            }}>
                                <span style={{ flexShrink: 0 }}>{pass ? '\u2705' : '\u274C'}</span>
                                {label && <span style={{ color: '#4a5959', flexShrink: 0, width: 36 }}>{label}:</span>}
                                <span style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>{item}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── PROGRESS BAR (positions) ───────────────────────────────

const StockGateProgressBar: React.FC<{ position: StockGatePosition }> = ({ position }) => {
    const { entry_price, target_price, stop_loss, progress_pct, high_water_mark, low_water_mark } = position;
    const pct = Math.max(0, Math.min(100, progress_pct || 0));
    const hwm = Math.max(0, Math.min(100, high_water_mark || 0));
    const lwm = Math.max(0, Math.min(100, low_water_mark || 0));
    const range = Math.abs(target_price - stop_loss);
    const entryPct = range > 0 ? Math.max(0, Math.min(100, (Math.abs(entry_price - stop_loss) / range) * 100)) : 50;
    const zoneColor = pct >= 80 ? '#00d97e' : pct >= 60 ? '#7bed9f' : pct >= 40 ? '#ffd32a' : pct >= 20 ? '#ff9f43' : '#ff4757';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                <span>SL \u2192 Target Progress</span>
                <span className="font-mono" style={{ color: zoneColor }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="relative h-5 rounded-full overflow-visible bg-gray-200 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2430]">
                <div className="absolute inset-0 rounded-full opacity-20"
                    style={{ background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 25%, #ffd32a 50%, #7bed9f 75%, #00d97e 100%)' }} />
                <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, #ff475720 0%, ${zoneColor}80 100%)`, borderRight: `2px solid ${zoneColor}` }} />
                <div className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${entryPct}%`, background: 'rgba(255,211,42,0.5)', borderLeft: '1px dashed rgba(255,211,42,0.7)' }} />
                {hwm > 0 && <div className="absolute -top-2.5 text-[8px] text-emerald-400 font-black z-10" style={{ left: `calc(${hwm}% - 3px)` }} title={`HWM ${hwm.toFixed(1)}%`}>\u25B2</div>}
                {lwm > 0 && lwm < 100 && <div className="absolute -bottom-2.5 text-[8px] text-red-400 font-black z-10" style={{ left: `calc(${lwm}% - 3px)` }} title={`LWM ${lwm.toFixed(1)}%`}>\u25BC</div>}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-[#0d1117] z-20 transition-all duration-700 ease-out shadow-lg"
                    style={{ left: `calc(${pct}% - 6px)`, background: zoneColor, boxShadow: `0 0 8px ${zoneColor}80` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold mt-0.5">
                <span className="text-red-400">\u26D4 {fmt(stop_loss)}</span>
                <span className="text-yellow-400/70">Entry {fmt(entry_price)}</span>
                <span className="text-emerald-400">\uD83C\uDFAF {fmt(target_price)}</span>
            </div>
        </div>
    );
};

// ─── GATE DETAILS (positions, expandable) ───────────────────

const GATE_INFO = [
    { key: 'g1_sma', label: 'G1 SMA' },
    { key: 'g2_1h', label: 'G2 1H' },
    { key: 'g3_15m', label: 'G3 15M' },
    { key: 'g4_5m', label: 'G4 5M' },
    { key: 'g5_vwap', label: 'G5 4H ST' },
    { key: 'g6_adx', label: 'G6 ADX' },
];

const GateDetails: React.FC<{ position: StockGatePosition }> = ({ position }) => (
    <div className="pt-3 border-t border-gray-200 dark:border-[#1e2430] space-y-1.5">
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Gate Conditions</span>
        {GATE_INFO.map(({ key, label }) => {
            const value = (position as any)[key] as string || '\u2014';
            const passed = gateIsPassed(value);
            return (
                <div key={key} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[10px] font-mono border ${passed ? 'bg-emerald-950/25 border-emerald-800/30 text-emerald-300' : 'bg-red-950/15 border-red-900/20 text-red-400/60'}`}>
                    <span className="flex-shrink-0 text-[11px]">{passed ? '\u2705' : '\u274C'}</span>
                    <span className="font-bold text-slate-500 flex-shrink-0 w-14">{label}:</span>
                    <span className="break-all leading-relaxed">{value}</span>
                </div>
            );
        })}
    </div>
);

// ─── SIGNAL BOARD CARD ──────────────────────────────────────

const BREAKOUT_LABELS = ['SMA', '1H', '15M', '5M', '4H ST', 'ADX'];
const DIP_LABELS = ['Trend', '4H', '1D', 'Depth', 'Zone', 'Trigger'];

const SignalCard: React.FC<{ row: BoardRow; lockedSymbols: Set<string> }> = ({ row, lockedSymbols }) => {
    const isLong = row.trade_direction === 'BUY';
    const isDip = row.setup_type === 'DIP';
    const isLocked = lockedSymbols.has(row.symbol);
    const rrLow = row.rr_value != null && row.rr_value < 1.5;

    // Lock status
    let lockLine: React.ReactNode;
    if (isLocked) {
        lockLine = <span style={{ color: '#22c55e', fontWeight: 700 }}>\uD83D\uDD12 Locked</span>;
    } else if (row.qualified) {
        lockLine = <span style={{ color: '#facc15' }}>Qualified \u2014 locks next scan if within Top-N / caps</span>;
    } else if (row.block_reason) {
        const msgs: Record<string, string> = {
            SHORT_BLOCKLIST: 'Blocked: commodity/leveraged ETF',
            SHORT_ON_SUPPORT: `Blocked: short sitting on support (${row.entry_location_pct ?? 0}% of range)`,
            STOP_TOO_WIDE: `Blocked: stop ${pctFmt(row.sl_pct)} too wide`,
        };
        lockLine = <span style={{ color: '#4a5959' }}>{msgs[row.block_reason] || row.block_reason}</span>;
    } else if (row.watch_reason) {
        const msgs: Record<string, string> = {
            NO_TRIGGER: 'Waiting for 5m trigger',
            RR_BELOW_FLOOR: 'R:R below floor',
            T1_TOO_CLOSE: 'Target too close',
        };
        lockLine = <span style={{ color: '#38bdf8' }}>{msgs[row.watch_reason] || row.watch_reason}</span>;
    } else {
        lockLine = <span style={{ color: '#4a5959' }}>{row.gates_passed} \u2014 board only</span>;
    }

    return (
        <div style={{
            background: '#131C1C', border: '1px solid #1F2A2A', borderRadius: 12,
            overflow: 'hidden', padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 12,
        }}>
            {/* Row 1: Symbol + Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#E0F0E0', letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono', monospace" }}>
                    {row.symbol}
                </span>
                <SignalStateBadge state={row.signal_state} />
                <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900,
                    background: isLong ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${isLong ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                    color: isLong ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                    {isLong ? 'LONG' : 'SHORT'}
                </span>
                <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900,
                    background: isDip ? 'rgba(20,184,166,0.1)' : 'rgba(59,130,246,0.08)',
                    border: `1px solid ${isDip ? 'rgba(20,184,166,0.3)' : 'rgba(59,130,246,0.25)'}`,
                    color: isDip ? '#14b8a6' : '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                    {row.setup_type}
                </span>
                <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900,
                    background: row.tier === 'A+' ? 'rgba(255,215,0,0.12)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${row.tier === 'A+' ? 'rgba(255,215,0,0.5)' : 'rgba(34,197,94,0.4)'}`,
                    color: row.tier === 'A+' ? '#FFD700' : '#22c55e',
                    boxShadow: row.tier === 'A+' ? '0 0 8px rgba(255,215,0,0.2)' : 'none',
                }}>
                    {row.tier}
                </span>
            </div>

            {/* Lock status */}
            <div style={{ fontSize: 10, fontWeight: 600 }}>{lockLine}</div>

            {/* Level row */}
            <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
            }}>
                <span style={{ color: '#7a8c8c' }}>Entry <span style={{ color: '#facc15' }}>{fmt(row.current_price)}</span></span>
                <span style={{ color: '#7a8c8c' }}>T1 <span style={{ color: '#22c55e' }}>{fmt(row.target_price)}</span> <span style={{ color: '#22c55e', fontSize: 9 }}>+{row.t1_dist_pct.toFixed(1)}%</span></span>
                <span style={{ color: '#7a8c8c' }}>T2 <span style={{ color: '#16a34a' }}>{fmt(row.fib_target2)}</span></span>
                <span style={{ color: '#7a8c8c' }}>SL <span style={{ color: '#ef4444' }}>{fmt(row.stop_loss)}</span> <span style={{ color: '#ef4444', fontSize: 9 }}>-{row.sl_pct.toFixed(1)}%</span></span>
                <span style={{ color: '#7a8c8c' }}>R:R <span style={{ color: rrLow ? '#ef4444' : '#E0F0E0', fontWeight: 900 }}>{row.risk_reward_ratio}</span></span>
            </div>

            {/* Range bar */}
            <RangeBar sl={row.stop_loss} entry={row.entry_price} t1={row.target_price} t2={row.fib_target2} current={row.current_price} />

            {/* Execution + TF dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <ExecBadge hint={row.execution_hint} reason={row.execution_reason} />
                <div style={{ display: 'flex', gap: 8 }}>
                    <TfDot label="5m" dir={row.st_5m_direction} />
                    <TfDot label="15m" dir={row.st_15m_direction} />
                    <TfDot label="1H" dir={row.st_1h_direction} />
                    <TfDot label="4H" dir={row.st_4h_direction} />
                    <TfDot label="1D" dir={row.st_daily_direction} />
                </div>
            </div>

            {/* Gates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {isDip ? (
                    <>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#7a8c8c' }}>DIP Gates</span>
                        <GateDots passed={row.dip_gates_passed || '0/6'} />
                        {row.dip_gate_reason && <GateList reason={row.dip_gate_reason} labels={DIP_LABELS} />}
                    </>
                ) : (
                    <>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#7a8c8c' }}>Gates</span>
                        <GateDots passed={row.gates_passed} />
                        {row.gate_reason && <GateList reason={row.gate_reason} labels={BREAKOUT_LABELS} />}
                    </>
                )}
            </div>

            {/* DIP extras */}
            {isDip && (row.retrace_pct != null || row.pullback_pct != null) && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7a8c8c', fontFamily: "'JetBrains Mono', monospace" }}>
                    {row.retrace_pct != null && <span>Retrace {row.retrace_pct.toFixed(1)}% </span>}
                    {row.pullback_pct != null && <span>\u00B7 Pullback {row.pullback_pct.toFixed(1)}% </span>}
                    {row.invalidation_price != null && <span>\u00B7 Invalid below {fmt(row.invalidation_price)}</span>}
                </div>
            )}

            {/* Footer: ADX, RVOL, ATR, 30D */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 9, fontWeight: 700,
                color: '#7a8c8c', fontFamily: "'JetBrains Mono', monospace",
                borderTop: '1px solid #1F2A2A', paddingTop: 10,
            }}>
                <span style={{ color: row.adx_value >= 25 ? '#22c55e' : row.adx_value >= 20 ? '#f59e0b' : '#7a8c8c' }}>
                    ADX {row.adx_value.toFixed(0)} <span style={{ color: '#4a5959' }}>+DI {row.plus_di.toFixed(0)} -DI {row.minus_di.toFixed(0)}</span>
                </span>
                <span>RVOL {row.rvol != null ? `${row.rvol.toFixed(1)}x` : '\u2014'} <span style={{
                    color: row.volume_trend === 'SURGE' ? '#22c55e' : row.volume_trend === 'HIGH' ? '#16a34a' : '#4a5959',
                }}>{row.volume_trend}</span></span>
                <span>ATR {row.atr_pct.toFixed(1)}%</span>
                {row.horizon_target != null && (
                    <span>30D <span style={{ color: '#E0F0E0' }}>{fmt(row.horizon_target)}</span> +{(row.horizon_move_pct || 0).toFixed(1)}%
                        {row.horizon_confidence && row.horizon_confidence !== 'UNKNOWN' && (
                            <span style={{
                                marginLeft: 4, padding: '1px 5px', borderRadius: 3, fontSize: 8,
                                background: row.horizon_confidence === 'HIGH' ? 'rgba(34,197,94,0.1)' : row.horizon_confidence === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)',
                                border: `1px solid ${row.horizon_confidence === 'HIGH' ? 'rgba(34,197,94,0.25)' : row.horizon_confidence === 'MEDIUM' ? 'rgba(245,158,11,0.25)' : 'rgba(107,114,128,0.2)'}`,
                                color: row.horizon_confidence === 'HIGH' ? '#22c55e' : row.horizon_confidence === 'MEDIUM' ? '#f59e0b' : '#6b7280',
                            }}>
                                {row.horizon_confidence}
                            </span>
                        )}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── POSITION CARD (extended) ───────────────────────────────

const GATE_KEYS = ['g1_sma', 'g2_1h', 'g3_15m', 'g4_5m', 'g5_vwap', 'g6_adx'];

const PositionCard: React.FC<{
    position: StockGatePosition;
    onManualClose: (p: StockGatePosition) => void;
    onExecuteStock: (p: StockGatePosition) => void;
    onNavigateToLifecycle?: (symbol: string) => void;
}> = ({ position, onManualClose, onExecuteStock, onNavigateToLifecycle }) => {
    const [expanded, setExpanded] = useState(false);
    const isBuy = position.trade_direction?.toUpperCase() === 'BUY';
    const pnl = calcPnl(position);
    const profitable = isProfitable(position);
    const setupType = position.setup_type || 'BREAKOUT';
    const isDip = setupType === 'DIP';

    let rec = position.trading_recommendation;
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        if (position.tier === 'A+') rec = isBuy ? 'STRONG BUY' : 'STRONG SELL';
        else rec = isBuy ? 'BUY' : 'SELL';
    }
    const isStrong = rec.includes('STRONG');
    const accentColor = isBuy ? '#00d97e' : '#ff4757';
    const pnlPositive = pnl >= 0;

    return (
        <div className="relative bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden border border-gray-200 dark:border-[#1e2430] hover:border-gray-300 dark:hover:border-[#2a3142] transition-all duration-200 group">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />
            <div className="h-px w-full" style={{ background: pnlPositive ? 'linear-gradient(90deg,transparent,rgba(0,217,126,0.3),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,71,87,0.2),transparent)' }} />

            <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">
                {/* Row 1: Symbol + Badges + P&L */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight leading-none">{position.symbol}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                            {position.trade_direction?.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${position.tier?.includes('+') ? 'text-amber-300 bg-amber-900/30 border-amber-600/40' : 'text-slate-300 bg-slate-800/60 border-slate-600/60'}`}>
                            {position.tier}
                        </span>
                        {/* Setup type pill */}
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border uppercase ${isDip ? 'text-teal-400 bg-teal-900/20 border-teal-600/30' : 'text-blue-400 bg-blue-900/15 border-blue-700/25'}`}>
                            {setupType}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800/30">
                            {isDip ? (position.dip_gates_passed || position.gates_passed || '0/6') : (position.gates_passed || '0/6')} \u2705
                        </span>
                        {/* Signal state badge */}
                        {position.signal_state && <SignalStateBadge state={position.signal_state} />}
                        {/* Round badge */}
                        {(position.round_number ?? 0) > 1 && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black text-violet-400 bg-violet-900/20 border border-violet-800/30">
                                Round #{position.round_number}
                            </span>
                        )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                        <span className={`block text-xl font-black font-mono tabular-nums leading-tight ${pnlPositive ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                        {position.pnl_dollars != null && position.pnl_dollars !== 0 && (
                            <span className={`block text-[11px] font-bold font-mono ${position.pnl_dollars >= 0 ? 'text-[#00d97e]/60' : 'text-[#ff4757]/60'}`}>
                                {position.pnl_dollars >= 0 ? '+' : ''}{fmt(position.pnl_dollars)}
                            </span>
                        )}
                        <span className="block text-[9px] text-slate-600 font-mono mt-0.5">{timeSince(position.opened_at)}</span>
                    </div>
                </div>

                {/* Signal badge */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isBuy
                        ? (isStrong ? 'text-emerald-300 bg-emerald-950/40 border-emerald-700/40' : 'text-green-400 bg-green-950/30 border-green-800/30')
                        : (isStrong ? 'text-red-300 bg-red-950/40 border-red-700/40' : 'text-red-400 bg-red-950/30 border-red-800/30')}`}>
                        {isStrong ? '\uD83D\uDD25' : '\u2705'} {rec} (LOCKED)
                    </div>
                    {/* Execution hint */}
                    {position.execution_hint && <ExecBadge hint={position.execution_hint} reason={position.execution_reason || ''} />}
                </div>

                {/* 4H ST row */}
                {position.st_4h_direction && (
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                        <TfDot label="4H SuperTrend" dir={position.st_4h_direction} />
                        {position.st4h_exit_armed === false && (
                            <span className="inline-flex items-center gap-1 text-amber-400 text-[9px]" title="4H exit monitor has not armed yet. The monitor will arm once the position moves sufficiently in-profit to meet the arming threshold.">
                                <span className="material-symbols-outlined text-[14px]">shield</span>
                                4H exit not armed yet
                            </span>
                        )}
                    </div>
                )}

                {/* Price trio */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-100 dark:bg-[#111620] rounded-xl p-2.5 border border-gray-200 dark:border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">\uD83D\uDD12 Entry</span>
                        <span className="block text-sm font-black font-mono text-amber-300">{fmt(position.entry_price)}</span>
                    </div>
                    <div className={`rounded-xl p-2.5 border ${profitable ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/15 border-red-900/20'}`}>
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">\uD83D\uDCCD Current</span>
                        <span className={`block text-sm font-black font-mono ${profitable ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(position.current_price)}</span>
                        <span className={`block text-[8px] font-mono font-bold ${profitable ? 'text-[#00d97e]/60' : 'text-[#ff4757]/60'}`}>{profitable ? '\u25B2' : '\u25BC'} {Math.abs(pnl).toFixed(2)}%</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-[#111620] rounded-xl p-2.5 border border-gray-200 dark:border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">\uD83C\uDFAF Target</span>
                        <span className="block text-sm font-black font-mono text-emerald-400">{fmt(position.target_price)}</span>
                    </div>
                </div>

                {/* SL + R:R */}
                <div className="flex items-center justify-between text-[10px] px-0.5">
                    <span className="text-slate-500 font-bold">\u26D4 SL <span className="text-red-400 font-mono">{fmt(position.stop_loss)}</span> {position.sl_pct != null && <span className="text-red-400/60">-{position.sl_pct.toFixed(1)}%</span>}</span>
                    <span className="text-slate-500 font-bold">R:R <span className="text-slate-900 dark:text-white font-mono">{position.risk_reward_ratio || '\u2014'}</span></span>
                </div>

                {/* Progress bar */}
                <StockGateProgressBar position={position} />

                {/* DIP extras */}
                {isDip && (
                    <div className="space-y-2">
                        {position.dip_gates_passed && (
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                <span>DIP Gates</span>
                                <GateDots passed={position.dip_gates_passed} />
                            </div>
                        )}
                        <div className="text-[9px] font-mono font-bold text-slate-500">
                            {position.dip_retrace_pct != null && <span>Retrace {position.dip_retrace_pct.toFixed(1)}% </span>}
                            {position.dip_pullback_pct != null && <span>\u00B7 Pullback {position.dip_pullback_pct.toFixed(1)}% </span>}
                            {position.dip_invalidation_price != null && <span>\u00B7 Invalid below {fmt(position.dip_invalidation_price)}</span>}
                        </div>
                    </div>
                )}

                {/* Monitor footer */}
                <div className="flex items-center justify-between text-[9px] text-slate-600 font-bold pt-2 border-t border-gray-200 dark:border-[#1a1f2e]">
                    <span className="text-slate-700">{formatOpenedAt(position.opened_at)}</span>
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>\u27F3 {timeSince(position.last_checked_at)}</span>
                        <span>\u00B7</span>
                        <span>{position.check_count || 0} checks</span>
                        <span>\u00B7</span>
                        <span>{durationSince(position.opened_at)}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-0.5">
                    <button onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wide">
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gates ({position.gates_passed || '0/6'})
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        {onNavigateToLifecycle && (
                            <button onClick={() => onNavigateToLifecycle(position.symbol)}
                                className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-[#1a1f2e] border border-gray-300 dark:border-[#252c3b] text-slate-500 dark:text-slate-400 text-[10px] font-bold hover:text-blue-400 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/40 transition-all flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">timeline</span>
                                Lifecycle
                            </button>
                        )}
                        <button onClick={() => onManualClose(position)}
                            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-[#1a1f2e] border border-gray-300 dark:border-[#252c3b] text-slate-400 text-[10px] font-bold hover:text-white hover:border-slate-500 transition-all flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">close</span>
                            Close
                        </button>
                        <button onClick={() => onExecuteStock(position)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 ${isBuy
                                ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'}`}>
                            \u26A1 {isBuy ? 'BUY STOCK' : 'SHORT STOCK'}
                        </button>
                    </div>
                </div>

                {expanded && <GateDetails position={position} />}
            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ─────────────────────────────────────

const ManualCloseModal: React.FC<{
    position: StockGatePosition | null;
    onClose: () => void;
    onConfirm: (p: StockGatePosition) => void;
    closing: boolean;
}> = ({ position, onClose, onConfirm, closing }) => {
    if (!position) return null;
    const pnl = calcPnl(position);
    const isBuy = position.trade_direction?.toUpperCase() === 'BUY';
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-[#0d1117] border border-[#ff4757]/30 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()} style={{ animation: 'sgSlideUp 0.2s ease' }}>
                <div className="h-px bg-gradient-to-r from-transparent via-[#ff4757]/50 to-transparent" />
                <div className="p-4 flex justify-between items-center border-b border-[#ff4757]/10">
                    <h2 className="text-sm font-black uppercase tracking-tight text-[#ff4757] flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">warning</span> Close Position
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-gray-100 dark:bg-[#111620] rounded-xl p-4 border border-gray-200 dark:border-[#1e2430]">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-slate-900 dark:text-white">{position.symbol}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                                    {position.trade_direction?.toUpperCase()}
                                </span>
                            </div>
                            <span className={`text-lg font-black font-mono ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div><span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Entry</span><span className="text-amber-300 font-mono font-bold">{fmt(position.entry_price)}</span></div>
                            <div><span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Current</span><span className={`font-mono font-bold ${isProfitable(position) ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(position.current_price)}</span></div>
                            <div><span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">P&L</span><span className={`font-mono font-bold ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span></div>
                        </div>
                    </div>
                    <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 flex items-start gap-2.5">
                        <span className="text-lg shrink-0">\u26A0\uFE0F</span>
                        <p className="text-amber-200/80 text-xs leading-relaxed">This will manually close the position and record it in trade history. This action cannot be undone.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-[#1e2430] text-slate-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-[#1a1f2e] transition-colors text-xs uppercase tracking-wide">Cancel</button>
                        <button onClick={() => onConfirm(position)} disabled={closing}
                            className="flex-[2] py-3 bg-[#ff4757] hover:bg-[#ff4757]/80 text-white font-black rounded-xl transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                            {closing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Closing...</> : <><span className="material-symbols-outlined text-sm">close</span>Confirm Close</>}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes sgSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
};

// ─── SKELETONS ──────────────────────────────────────────────

const PositionSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430] p-5 space-y-3 animate-pulse">
        <div className="flex justify-between"><div className="flex gap-2"><div className="h-6 w-16 bg-gray-200 dark:bg-[#1e2430] rounded" /><div className="h-5 w-12 bg-gray-200 dark:bg-[#1e2430] rounded" /></div><div className="h-6 w-14 bg-gray-200 dark:bg-[#1e2430] rounded" /></div>
        <div className="h-5 w-36 bg-gray-200 dark:bg-[#1e2430] rounded-full" />
        <div className="grid grid-cols-3 gap-2"><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /></div>
        <div className="h-5 bg-gray-200 dark:bg-[#1e2430] rounded-full" />
    </div>
);

const SignalSkeleton: React.FC = () => (
    <div style={{ background: '#131C1C', border: '1px solid #1F2A2A', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 60, height: 24, borderRadius: 6, background: '#182222' }} />
            <div style={{ width: 80, height: 24, borderRadius: 6, background: '#182222' }} />
        </div>
        <div style={{ height: 16, width: '70%', borderRadius: 4, background: '#182222' }} />
        <div style={{ height: 8, borderRadius: 4, background: '#182222' }} />
        <div style={{ height: 28, borderRadius: 6, background: '#182222' }} />
    </div>
);

// ─── HISTORY SUMMARY ────────────────────────────────────────

const HistorySummaryStats: React.FC<{ history: StockGateHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;
    const wins = history.filter(h => h.result === 'WIN');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
    const best = history.reduce((b, h) => (h.pnl_pct || 0) > (b.pnl_pct || 0) ? h : b, history[0]);
    const worst = history.reduce((w, h) => (h.pnl_pct || 0) < (w.pnl_pct || 0) ? h : w, history[0]);
    const avgDur = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
                { label: 'Total Trades', value: String(history.length), color: 'text-white' },
                { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Best Trade', value: `${best.symbol} +${(best.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#00d97e]' },
                { label: 'Worst Trade', value: `${worst.symbol} ${(worst.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#ff4757]' },
                { label: 'Avg Duration', value: formatDuration(avgDur), color: 'text-white' },
                { label: 'Wins / Losses', value: `${wins.length}W / ${history.length - wins.length}L`, color: 'text-amber-400' },
            ].map(s => (
                <div key={s.label} className="bg-white dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-[#1e2430] p-3 text-center">
                    <span className="block text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1">{s.label}</span>
                    <span className={`block text-sm font-black font-mono ${s.color}`}>{s.value}</span>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const positionToSmartSignal = (pos: StockGatePosition): SmartSignal => ({
    id: pos.id,
    symbol: pos.symbol,
    market_status: pos.trade_direction?.toUpperCase() === 'BUY' ? 'uptrend' : 'downtrend',
    signal_type: pos.trade_direction?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
    confidence: pos.tier === 'A+' ? 'strong' : 'moderate',
    current_price: pos.current_price,
    entry_price: pos.entry_price,
    target_price: pos.target_price,
    stop_loss: pos.stop_loss,
    risk_reward_ratio: pos.risk_reward_ratio,
    indicators: {
        adx: pos.adx_value,
        plus_di: pos.plus_di,
        minus_di: pos.minus_di,
        vwap: pos.vwap_position?.toUpperCase() === 'ABOVE' ? 'UP' : pos.vwap_position?.toUpperCase() === 'BELOW' ? 'DOWN' : 'NEUTRAL',
        supertrend_1h: pos.st_1h_direction,
        supertrend_4h: pos.st_15m_direction,
    },
    ai_summary: pos.signal || `${pos.trade_direction?.toUpperCase()} signal \u2014 Tier ${pos.tier} \u00B7 ${pos.gates_passed} gates passed`,
    ai_reasoning: pos.gate_reason || '',
    when_to_buy: `Entry near $${pos.entry_price?.toFixed(2) ?? '\u2014'}`,
    risk_factors: `Stop Loss: $${pos.stop_loss?.toFixed(2) ?? '\u2014'}`,
    analyzed_at: pos.opened_at,
});

const N8N_BASE = import.meta.env.VITE_N8N_BASE_URL || '';
const TK_SECRET = import.meta.env.VITE_TK_WEBHOOK_SECRET || '';

const StockGateTracker: React.FC<{ onExecute?: (signal: OptionSignal) => void; role?: string; onNavigateToLifecycle?: (symbol: string) => void }> = ({ role, onNavigateToLifecycle }) => {
    // ── State ──
    const [config, setConfig] = useState<StrategyConfig | null>(null);
    const [board, setBoard] = useState<BoardRow[]>([]);
    const [positions, setPositions] = useState<StockGatePosition[]>([]);
    const [history, setHistory] = useState<StockGateHistory[]>([]);
    const [loadingBoard, setLoadingBoard] = useState(true);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [positionsError, setPositionsError] = useState<string | null>(null);
    const [closingPosition, setClosingPosition] = useState<StockGatePosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [executingPosition, setExecutingPosition] = useState<StockGatePosition | null>(null);

    // Top-level tab
    const [topTab, setTopTab] = useState<'signals' | 'positions'>('signals');
    // Signal board filter
    const [boardFilter, setBoardFilter] = useState<BoardFilter>('ALL');
    // Position filters
    const [setupFilter, setSetupFilter] = useState<SetupFilter>('ALL');
    const [posSubTab, setPosSubTab] = useState<'open' | 'history'>('open');
    const [signalFilter, setSignalFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'performance' | 'progress' | 'newest' | 'strength'>(() => {
        try { const v = localStorage.getItem('stockFeedSort'); if (v === 'performance' || v === 'progress' || v === 'newest' || v === 'strength') return v; } catch {}
        return 'performance';
    });
    const [historyTodayOnly, setHistoryTodayOnly] = useState(false);
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    // Scan now
    const [scanning, setScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetchers ──
    const fetchBoard = useCallback(async () => {
        const { data, error } = await supabase.from('stock_gate_signal_board').select('*');
        if (!error && data) {
            // Sort: state order, rr_value desc, atr_pct desc
            const sorted = (data as BoardRow[]).sort((a, b) => {
                const so = (STATE_ORDER[a.signal_state] ?? 99) - (STATE_ORDER[b.signal_state] ?? 99);
                if (so !== 0) return so;
                const rr = (b.rr_value ?? 0) - (a.rr_value ?? 0);
                if (rr !== 0) return rr;
                return (b.atr_pct ?? 0) - (a.atr_pct ?? 0);
            });
            setBoard(sorted);
        }
        setLoadingBoard(false);
    }, []);

    const fetchPositions = useCallback(async () => {
        const { data, error } = await supabase.from('stock_gate_positions').select('*').eq('status', 'OPEN').order('opened_at', { ascending: false });
        if (error) {
            console.error('[StockGate] fetchPositions error:', error);
            setPositionsError(error.message);
        } else {
            setPositions(data ?? []);
            setPositionsError(null);
        }
        setLoadingPositions(false);
    }, []);

    const fetchHistory = useCallback(async () => {
        const { data, error } = await supabase.from('stock_gate_history').select('*').order('closed_at', { ascending: false });
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    }, []);

    const fetchConfig = useCallback(async () => {
        const { data } = await supabase.from('strategy_configs').select('*').eq('strategy', 'stock_gate').limit(1).single();
        if (data) setConfig(data);
    }, []);

    // ── Init + realtime ──
    useEffect(() => {
        fetchConfig();
        fetchBoard();
        fetchPositions();
        fetchHistory();
    }, [fetchConfig, fetchBoard, fetchPositions, fetchHistory]);

    useEffect(() => {
        const i = setInterval(fetchPositions, 30000);
        return () => clearInterval(i);
    }, [fetchPositions]);

    // Realtime on signal_board — debounce 1s
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const channel = supabase.channel('sg-board-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_gate_signal_board' }, () => {
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => {
                    fetchBoard();
                    setScanning(false);
                }, 1000);
            })
            .subscribe();

        return () => {
            if (timeout) clearTimeout(timeout);
            supabase.removeChannel(channel);
        };
    }, [fetchBoard]);

    // ── Scan now ──
    const handleScanNow = async () => {
        if (scanCooldown || scanning) return;
        setScanning(true);
        setScanCooldown(true);
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => setScanCooldown(false), 90000);

        try {
            await fetch(`${N8N_BASE}/webhook/stockgate-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-TK-Secret': TK_SECRET },
                body: JSON.stringify({ source: 'ui' }),
            });
        } catch (e) {
            console.error('[StockGate] Scan request failed:', e);
            setScanning(false);
        }
    };

    // ── Manual close ──
    const handleManualClose = async (position: StockGatePosition) => {
        setIsClosing(true);
        try {
            const pnl = calcPnl(position);
            const pnlDollars = position.entry_price ? +((pnl / 100) * position.entry_price).toFixed(2) : 0;
            const { error } = await supabase
                .from('stock_gate_positions')
                .update({ status: 'MANUAL_CLOSE', close_reason: 'MANUAL', closed_at: new Date().toISOString(), pnl_pct: pnl, pnl_dollars: pnlDollars })
                .eq('id', position.id)
                .eq('status', 'OPEN');
            if (error) console.error('[StockGate] Close failed:', error);
            await Promise.all([fetchPositions(), fetchHistory()]);
            setClosingPosition(null);
        } catch (err) { console.error('Manual close failed:', err); }
        finally { setIsClosing(false); }
    };

    // ── Derived data ──
    const lockedSymbols = new Set(positions.map(p => p.symbol));
    const latestScan = board.length > 0 ? board.reduce((latest, r) => r.scanned_at > latest ? r.scanned_at : latest, board[0].scanned_at) : null;
    const priceSource = board.length > 0 ? board[0].price_source : null;

    // Stale check: > 45 min during market hours
    const isStale = latestScan && isMarketHoursCT() && (Date.now() - new Date(latestScan).getTime()) > 45 * 60 * 1000;

    // Board filter
    const BOARD_CHIPS: { id: BoardFilter; label: string; emoji: string; color: string; bg: string; activeBg: string; activeBorder: string }[] = [
        { id: 'ALL',         label: 'All',         emoji: '',   color: '#E0F0E0', bg: '#182222', activeBg: 'rgba(59,130,246,0.15)', activeBorder: 'rgba(59,130,246,0.5)' },
        { id: 'STRONG_BUY',  label: 'Strong Buy',  emoji: '\uD83D\uDD25', color: '#16a34a', bg: 'rgba(22,163,74,0.06)',  activeBg: 'rgba(22,163,74,0.15)',  activeBorder: 'rgba(22,163,74,0.5)' },
        { id: 'BUY',         label: 'Buy',         emoji: '\u2705',        color: '#22c55e', bg: 'rgba(34,197,94,0.05)',  activeBg: 'rgba(34,197,94,0.12)',  activeBorder: 'rgba(34,197,94,0.4)' },
        { id: 'DIP_BUY',     label: 'Dip Buy',     emoji: '\uD83D\uDFE2', color: '#14b8a6', bg: 'rgba(20,184,166,0.05)', activeBg: 'rgba(20,184,166,0.12)', activeBorder: 'rgba(20,184,166,0.4)' },
        { id: 'DIP_WATCH',   label: 'Dip Watch',   emoji: '\uD83D\uDC40', color: '#38bdf8', bg: 'rgba(56,189,248,0.04)', activeBg: 'rgba(56,189,248,0.12)', activeBorder: 'rgba(56,189,248,0.35)' },
        { id: 'SELL',        label: 'Sell',         emoji: '\u2705',        color: '#f97316', bg: 'rgba(249,115,22,0.05)', activeBg: 'rgba(249,115,22,0.12)', activeBorder: 'rgba(249,115,22,0.4)' },
        { id: 'STRONG_SELL', label: 'Strong Sell',  emoji: '\uD83D\uDD25', color: '#dc2626', bg: 'rgba(220,38,38,0.06)',  activeBg: 'rgba(220,38,38,0.15)',  activeBorder: 'rgba(220,38,38,0.5)' },
    ];

    const boardCounts = BOARD_CHIPS.reduce((acc, c) => {
        acc[c.id] = c.id === 'ALL' ? board.length : board.filter(r => r.signal_state === c.id).length;
        return acc;
    }, {} as Record<string, number>);

    const filteredBoard = boardFilter === 'ALL' ? board : board.filter(r => r.signal_state === boardFilter);

    // Position filters
    const posFilters = [
        { label: 'STRONG BUY', icon: '\uD83D\uDD25', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'BUY' && p.tier === 'A+', color: 'text-[#00d97e]', bg: 'bg-[#00d97e]/5 border-[#00d97e]/20', activeBg: 'bg-[#00d97e]/15 border-[#00d97e]/40', ring: 'ring-[#00d97e]' },
        { label: 'BUY', icon: '\u2705', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'BUY' && p.tier === 'A', color: 'text-emerald-400', bg: 'bg-emerald-900/10 border-emerald-800/20', activeBg: 'bg-emerald-900/25 border-emerald-700/40', ring: 'ring-emerald-500' },
        { label: 'STRONG SELL', icon: '\uD83D\uDD25', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'SHORT' && p.tier === 'A+', color: 'text-[#ff4757]', bg: 'bg-[#ff4757]/5 border-[#ff4757]/20', activeBg: 'bg-[#ff4757]/15 border-[#ff4757]/40', ring: 'ring-[#ff4757]' },
        { label: 'SELL', icon: '\u2705', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'SHORT' && p.tier === 'A', color: 'text-red-400', bg: 'bg-red-900/10 border-red-800/20', activeBg: 'bg-red-900/25 border-red-700/40', ring: 'ring-red-500' },
    ];

    const filteredPositions = positions.filter(p => {
        if (setupFilter !== 'ALL' && (p.setup_type || 'BREAKOUT') !== setupFilter) return false;
        if (signalFilter && !posFilters.find(f => f.label === signalFilter)?.test(p)) return false;
        return true;
    });

    const perfPct = (p: StockGatePosition): number => {
        if (!p.entry_price || !p.current_price) return -Infinity;
        const dir = p.trade_direction?.toUpperCase() === 'SHORT' ? -1 : 1;
        return dir * ((p.current_price - p.entry_price) / p.entry_price) * 100;
    };

    const sortedPositions = [...filteredPositions].sort((a, b) => {
        switch (sortBy) {
            case 'performance': return (perfPct(b) === -Infinity ? -Infinity : perfPct(b)) - (perfPct(a) === -Infinity ? -Infinity : perfPct(a));
            case 'progress': return (b.progress_pct ?? -Infinity) - (a.progress_pct ?? -Infinity);
            case 'newest': return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
            case 'strength': { const sr = (a.tier === 'A+' ? 0 : 1) - (b.tier === 'A+' ? 0 : 1); return sr !== 0 ? sr : perfPct(b) - perfPct(a); }
            default: return 0;
        }
    });

    // Live stats
    const totalPnl = positions.reduce((a, p) => a + calcPnl(p), 0) / Math.max(positions.length, 1);
    const profitCount = positions.filter(p => isProfitable(p)).length;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080b10] min-h-screen text-slate-900 dark:text-white font-sans">
            <style>{`
                @keyframes sgPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.3); } }
                @keyframes sgSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
                @keyframes sgSpin { to { transform: rotate(360deg); } }
            `}</style>
            <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">

                {/* ── HEADER ── */}
                <div className="relative bg-white dark:bg-gradient-to-br dark:from-[#0d1117] dark:to-[#0a0e16] rounded-2xl border border-gray-200 dark:border-[#1e2430] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/5 via-transparent to-transparent pointer-events-none" />
                    <div className="relative p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center text-2xl shrink-0">\uD83D\uDCC8</div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Stock Gate</h1>
                                    {latestScan && (
                                        <span className="text-[10px] font-bold text-slate-500">
                                            Last scan: {timeSince(latestScan)}
                                        </span>
                                    )}
                                    {/* Price source pill */}
                                    {priceSource && (
                                        <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                            priceSource === 'REAL-TIME'
                                                ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/25'
                                                : 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${priceSource === 'REAL-TIME' ? 'bg-[#00d97e]' : 'bg-amber-400'}`} style={{ animation: 'sgPulse 2s infinite' }} />
                                            {priceSource}
                                        </span>
                                    )}
                                    {/* Stale warning */}
                                    {isStale && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10 border border-amber-400/25">
                                            \u26A0 Board may be stale
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-500 text-xs font-medium mt-0.5">Automated stock trade tracking \u00B7 A+/A tier signals & locked positions</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Live stats */}
                            {positions.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-[#111620] border border-gray-200 dark:border-[#1e2430] text-xs font-bold">
                                        <span className="text-slate-500">Locked</span>
                                        <span className="text-slate-900 dark:text-white font-black text-sm">{positions.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-[#111620] border border-gray-200 dark:border-[#1e2430] text-xs font-bold">
                                        <span className="text-slate-500">In Profit</span>
                                        <span className={`font-black text-sm ${profitCount > 0 ? 'text-[#00d97e]' : 'text-slate-400'}`}>{profitCount}/{positions.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-[#111620] border border-gray-200 dark:border-[#1e2430] text-xs font-bold">
                                        <span className="text-slate-500">Avg P&L</span>
                                        <span className={`font-black text-sm font-mono ${totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}%</span>
                                    </div>
                                </>
                            )}
                            {/* Scan now */}
                            <button onClick={handleScanNow} disabled={scanCooldown || scanning}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border ${
                                    scanCooldown ? 'bg-slate-800/40 border-slate-700/30 text-slate-600 cursor-not-allowed'
                                    : 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/40 cursor-pointer'
                                }`}>
                                {scanning ? (
                                    <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full" style={{ animation: 'sgSpin 0.8s linear infinite' }} />
                                ) : (
                                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                                )}
                                {scanning ? 'Scanning...' : scanCooldown ? 'Cooldown' : 'Scan Now'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TOP TABS ── */}
                <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-[#1e2430] p-1 gap-1 w-fit">
                    {[
                        { id: 'signals' as const, label: `Signals (${board.length})`, icon: 'radar' },
                        { id: 'positions' as const, label: `Positions (${positions.length})`, icon: 'trending_up' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setTopTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${topTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-500 hover:text-slate-300'}`}>
                            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ══ SIGNALS TAB ══ */}
                {topTab === 'signals' && (
                    <div className="space-y-4">
                        {/* Filter chips */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {BOARD_CHIPS.map(chip => {
                                const count = boardCounts[chip.id];
                                if (chip.id !== 'ALL' && count === 0) return null;
                                const isActive = boardFilter === chip.id;
                                return (
                                    <button key={chip.id} onClick={() => setBoardFilter(chip.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '5px 12px', borderRadius: 20, border: `1px solid ${isActive ? chip.activeBorder : '#1F2A2A'}`,
                                            background: isActive ? chip.activeBg : chip.bg,
                                            color: isActive ? chip.color : '#7a8c8c',
                                            fontSize: 10, fontWeight: 800, cursor: 'pointer',
                                            letterSpacing: '0.05em', textTransform: 'uppercase',
                                            transition: 'all 0.15s',
                                        }}>
                                        {chip.emoji && <span>{chip.emoji}</span>}
                                        {chip.label}
                                        <span style={{
                                            background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '1px 7px',
                                            fontSize: 9, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace",
                                        }}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Signal cards */}
                        {loadingBoard ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                                {[1, 2, 3, 4, 5, 6].map(i => <SignalSkeleton key={i} />)}
                            </div>
                        ) : filteredBoard.length === 0 ? (
                            <div style={{
                                background: '#131C1C', border: '1px solid #1F2A2A', borderRadius: 16,
                                padding: '48px 32px', textAlign: 'center',
                            }}>
                                <div style={{ fontSize: 32, marginBottom: 12 }}>\uD83D\uDCE1</div>
                                <p style={{ fontSize: 14, color: '#7a8c8c', margin: 0 }}>
                                    {board.length === 0
                                        ? `No signals in the latest scan (${latestScan ? timeSince(latestScan) : 'no scan yet'}).`
                                        : `No ${boardFilter.replace('_', ' ')} signals in this scan.`
                                    }
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                                {filteredBoard.map(row => (
                                    <SignalCard key={row.id} row={row} lockedSymbols={lockedSymbols} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ POSITIONS TAB ══ */}
                {topTab === 'positions' && (
                    <div className="space-y-4">
                        {/* Sub-tabs: Open | History */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-[#1e2430] p-1 gap-1">
                                {[
                                    { id: 'open' as const, label: `Open (${positions.length})`, icon: 'radar', color: 'bg-blue-600 shadow-blue-600/25' },
                                    { id: 'history' as const, label: `History (${history.length})`, icon: 'history', color: 'bg-violet-600 shadow-violet-600/25' },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setPosSubTab(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${posSubTab === tab.id ? `${tab.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-300'}`}>
                                        <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Open Positions ── */}
                        {posSubTab === 'open' && (
                            <div className="space-y-4">
                                {loadingPositions ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map(i => <PositionSkeleton key={i} />)}
                                    </div>
                                ) : positionsError ? (
                                    <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-red-900/30">
                                        <div className="w-16 h-16 rounded-2xl bg-red-900/15 border border-red-800/20 flex items-center justify-center text-3xl mx-auto mb-4">\u26A0\uFE0F</div>
                                        <h3 className="text-base font-black text-red-400 uppercase tracking-tight mb-2">Failed to Load Positions</h3>
                                        <p className="text-slate-600 text-sm max-w-sm mx-auto mb-4 font-mono">{positionsError}</p>
                                        <button onClick={fetchPositions} className="px-4 py-2 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-bold hover:bg-red-900/30 transition-colors">Retry</button>
                                    </div>
                                ) : positions.length === 0 ? (
                                    <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-900/15 border border-emerald-800/20 flex items-center justify-center text-3xl mx-auto mb-4">\uD83D\uDCC8</div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No Open Positions</h3>
                                        <p className="text-slate-600 text-sm max-w-sm mx-auto">Qualifying positions will appear here with live tracking.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Setup + signal filters */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Filter:</span>
                                            {/* Setup type filter */}
                                            {(['ALL', 'BREAKOUT', 'DIP'] as const).map(sf => (
                                                <button key={sf} onClick={() => setSetupFilter(sf)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${setupFilter === sf
                                                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                                        : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:opacity-80'
                                                    }`}>
                                                    <span className="uppercase tracking-wide">{sf === 'ALL' ? 'All' : sf}</span>
                                                </button>
                                            ))}
                                            <span className="text-slate-700 dark:text-slate-600 text-[10px] select-none">|</span>
                                            {posFilters.map(f => {
                                                const count = positions.filter(f.test).length;
                                                const isActive = signalFilter === f.label;
                                                return (
                                                    <button key={f.label} onClick={() => { if (count === 0) return; setSignalFilter(isActive ? null : f.label); }}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${f.color} ${isActive ? `${f.activeBg} ${f.ring} ring-1` : f.bg} ${count === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}>
                                                        <span>{f.icon}</span>
                                                        <span className="uppercase tracking-wide">{f.label}</span>
                                                        <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                                                    </button>
                                                );
                                            })}
                                            {signalFilter && (
                                                <button onClick={() => setSignalFilter(null)} className="text-[10px] text-slate-500 hover:text-white font-bold underline transition-colors">clear</button>
                                            )}
                                            <span className="ml-auto flex items-center gap-1.5">
                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Sort:</span>
                                                <select value={sortBy} onChange={e => { const v = e.target.value as typeof sortBy; setSortBy(v); try { localStorage.setItem('stockFeedSort', v); } catch {} }}
                                                    className="bg-slate-100 dark:bg-[#111620] border border-gray-200 dark:border-[#1e2430] rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-6"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                                                    <option value="performance">Performance</option>
                                                    <option value="progress">Progress to Target</option>
                                                    <option value="newest">Newest</option>
                                                    <option value="strength">Signal Strength</option>
                                                </select>
                                            </span>
                                            <span className="text-[9px] text-slate-700 font-bold">{filteredPositions.length} of {positions.length} shown</span>
                                        </div>

                                        {sortedPositions.length === 0 ? (
                                            <div className="text-center py-12 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                                <p className="text-slate-500 text-sm">No positions match the current filters</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {sortedPositions.map(p => (
                                                    <PositionCard key={p.id} position={p} onManualClose={setClosingPosition} onExecuteStock={setExecutingPosition} onNavigateToLifecycle={onNavigateToLifecycle} />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── History ── */}
                        {posSubTab === 'history' && (
                            <div>
                                {loadingHistory ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map(i => <div key={i} className="h-11 bg-white dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-[#1e2430] animate-pulse" />)}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                        <div className="text-5xl mb-4">\uD83D\uDCCA</div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No Trade History</h3>
                                        <p className="text-slate-600 text-sm">Closed positions will appear here.</p>
                                    </div>
                                ) : (() => {
                                    const histTodayStr = new Date().toDateString();
                                    const todayCount = history.filter(h => new Date(h.closed_at).toDateString() === histTodayStr).length;
                                    const setPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
                                        if (preset === 'today') { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryTodayOnly(true); }
                                        else if (preset === 'week') { const f = new Date(); f.setDate(f.getDate() - 6); setHistoryDateFrom(f.toISOString().slice(0, 10)); setHistoryDateTo(new Date().toISOString().slice(0, 10)); setHistoryTodayOnly(false); }
                                        else if (preset === 'month') { const f = new Date(); f.setDate(f.getDate() - 29); setHistoryDateFrom(f.toISOString().slice(0, 10)); setHistoryDateTo(new Date().toISOString().slice(0, 10)); setHistoryTodayOnly(false); }
                                        else { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryTodayOnly(false); }
                                    };
                                    const filteredHistory = (() => {
                                        if (historyTodayOnly) return history.filter(h => new Date(h.closed_at).toDateString() === histTodayStr);
                                        if (!historyDateFrom && !historyDateTo) return history;
                                        return history.filter(h => {
                                            const d = h.closed_at ? h.closed_at.slice(0, 10) : '';
                                            if (historyDateFrom && d < historyDateFrom) return false;
                                            if (historyDateTo && d > historyDateTo) return false;
                                            return true;
                                        });
                                    })();
                                    const activePreset = historyTodayOnly ? 'today' : !historyDateFrom && !historyDateTo ? 'all' : null;

                                    return (
                                        <>
                                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Filter:</span>
                                                {[
                                                    { id: 'today', label: 'Today', count: todayCount },
                                                    { id: 'week', label: 'This Week', count: null },
                                                    { id: 'month', label: '30 Days', count: null },
                                                    { id: 'all', label: 'All', count: history.length },
                                                ].map(p => (
                                                    <button key={p.id} onClick={() => setPreset(p.id as any)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${activePreset === p.id
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                                            : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:opacity-80'
                                                        }`}>
                                                        <span className="uppercase tracking-wide">{p.label}</span>
                                                        {p.count != null && <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{p.count}</span>}
                                                    </button>
                                                ))}
                                                <span className="text-slate-700 dark:text-slate-600 text-[10px] select-none">|</span>
                                                <div className="flex items-center gap-1.5">
                                                    <input type="date" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setHistoryTodayOnly(false); }}
                                                        className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-white dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                                    <span className="text-[10px] text-slate-500">\u2013</span>
                                                    <input type="date" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setHistoryTodayOnly(false); }}
                                                        className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-white dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                                    {(historyDateFrom || historyDateTo) && !historyTodayOnly && (
                                                        <button onClick={() => setPreset('all')} className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold underline transition-colors">clear</button>
                                                    )}
                                                </div>
                                                <span className="ml-auto text-[9px] text-slate-600 font-bold">{filteredHistory.length} of {history.length} shown</span>
                                                {role === 'admin' && (
                                                    <button onClick={() => {
                                                        const headers = ['Symbol','Direction','Tier','Entry','Exit','P&L%','P&L$','Result','Duration','Exit Reason','Date'];
                                                        const rows = filteredHistory.map(h => [h.symbol, h.trade_direction?.toUpperCase() ?? '', h.tier, h.entry_price, h.exit_price, `${(h.pnl_pct || 0).toFixed(2)}%`, h.pnl_dollars, h.result, formatDuration(h.duration_minutes), h.exit_reason ?? '', h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '']);
                                                        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                                                        const blob = new Blob([csv], { type: 'text/csv' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a'); a.href = url; a.download = `stock-gate-history-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
                                                    }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-400 dark:border-blue-600/60 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                        Export CSV
                                                    </button>
                                                )}
                                            </div>
                                            <HistorySummaryStats history={filteredHistory} />
                                            <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430] overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="border-b border-gray-100 dark:border-[#1e2430] bg-gray-100 dark:bg-[#080b10]">
                                                                {['Symbol', 'Direction', 'Tier', 'Entry', 'Exit', 'P&L%', 'P&L$', 'Result', 'Duration', 'Exit Reason', 'Date'].map(col => (
                                                                    <th key={col} className="px-4 py-3 text-left text-[9px] font-bold text-slate-600 uppercase tracking-wider">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredHistory.map(h => {
                                                                const isWin = h.result === 'WIN';
                                                                const isBuy = h.trade_direction?.toUpperCase() === 'BUY';
                                                                return (
                                                                    <tr key={h.id} className={`border-b border-gray-100 dark:border-[#111620] transition-colors hover:bg-gray-100 dark:hover:bg-[#111620] ${isWin ? 'bg-[#00d97e]/[0.02]' : 'bg-[#ff4757]/[0.02]'}`}>
                                                                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{h.symbol}</td>
                                                                        <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{h.trade_direction?.toUpperCase()}</span></td>
                                                                        <td className="px-4 py-3 text-slate-400 font-bold">{h.tier}</td>
                                                                        <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.entry_price)}</td>
                                                                        <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.exit_price)}</td>
                                                                        <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%</td>
                                                                        <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(h.pnl_dollars)}</td>
                                                                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{h.result}</span></td>
                                                                        <td className="px-4 py-3 text-slate-400 font-mono">{formatDuration(h.duration_minutes)}</td>
                                                                        <td className="px-4 py-3 text-slate-500 uppercase text-[9px] font-bold">{h.exit_reason}</td>
                                                                        <td className="px-4 py-3 text-slate-600 font-mono">{h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <ManualCloseModal position={closingPosition} onClose={() => setClosingPosition(null)} onConfirm={handleManualClose} closing={isClosing} />
            <ExecuteStockTradeModal isOpen={!!executingPosition} signal={executingPosition ? positionToSmartSignal(executingPosition) : null}
                onClose={() => setExecutingPosition(null)} onSuccess={() => { setExecutingPosition(null); fetchPositions(); }} />
        </div>
    );
};

export default StockGateTracker;
