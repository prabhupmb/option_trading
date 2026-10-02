import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';
import { useMdBars, type Timeframe } from '../hooks/useMdBars';
import TradeChart from './signals/TradeChart';
import type { Bar } from '../lib/supertrend';
import ExecuteStockTradeModal from './ExecuteStockTradeModal';
import { SmartSignal } from '../hooks/useSignals';

// ─── TYPES ────────────────────────────────────────────────────

interface BoardRow {
    id: number;
    symbol: string;
    trade_direction: 'BUY' | 'SHORT';
    setup_type: 'BREAKOUT' | 'DIP';
    signal_state: 'STRONG_BUY' | 'BUY' | 'DIP_BUY' | 'DIP_WATCH' | 'SELL' | 'STRONG_SELL';
    qualified: boolean;
    block_reason: string | null;
    watch_reason: string | null;
    current_price: number;
    entry_price: number;
    target_price: number;
    fib_target2: number;
    stop_loss: number;
    support_1: number | null;
    support_1_src: string | null;
    support_2: number | null;
    support_2_src: string | null;
    execution_hint: 'READY_BUY' | 'READY_SELL' | 'WAIT';
    execution_reason: string;
    scanned_at: string;
    // Info popover fields
    tier: string;
    gates_passed: string;
    dip_gates_passed: string | null;
    gate_reason: string;
    dip_gate_reason: string | null;
    sl_pct: number;
    rr_value: number | null;
    risk_reward_ratio: string;
    t1_dist_pct: number;
    adx_value: number;
    plus_di: number;
    minus_di: number;
    atr_pct: number;
    rvol: number | null;
    volume_trend: string;
    horizon_target: number | null;
    horizon_move_pct: number | null;
    horizon_confidence: string;
    price_source: string;
    retrace_pct: number | null;
    pullback_pct: number | null;
    invalidation_price: number | null;
    entry_location_pct: number | null;
    scan_id: string;
}

interface StockGatePosition {
    id: string;
    symbol: string;
    trade_direction: string;
    setup_type: string | null;
    signal_state: string | null;
    tier: string;
    status: string;
    signal: string;
    trading_recommendation: string;
    entry_price: number;
    current_price: number;
    target_price: number;
    fib_target2: number;
    stop_loss: number;
    support_1: number | null;
    support_1_src: string | null;
    support_2: number | null;
    support_2_src: string | null;
    progress_pct: number | null;
    execution_hint: string | null;
    execution_reason: string | null;
    is_stale: boolean | null;
    opened_at: string;
    closed_at: string | null;
    close_reason: string | null;
    pnl_pct: number | null;
    pnl_dollars: number | null;
    risk_reward_ratio: string;
    gates_passed: string;
    adx_value: number;
    plus_di: number;
    minus_di: number;
    vwap_value: number;
    vwap_trend: string;
    vwap_position: string;
    check_count: number;
    last_checked_at: string;
    high_water_mark: number;
    low_water_mark: number;
    round_number: number | null;
    source: string;
    version: string;
    gate_reason: string;
    rvol: number | null;
    volume_trend: string | null;
    atr_pct: number | null;
    horizon_target: number | null;
    horizon_move_pct: number | null;
    horizon_confidence: string | null;
    dip_gates_passed: string | null;
    dip_gate_reason: string | null;
    dip_retrace_pct: number | null;
    dip_pullback_pct: number | null;
    dip_invalidation_price: number | null;
    st_1h_direction: string;
    st_15m_direction: string;
    st_5m_direction: string;
    option_type: string | null;
    [key: string]: any;
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
    setup_type?: string | null;
}

interface StrategyConfig {
    id: string;
    strategy: string;
    display_name: string;
    icon: string;
    is_active: boolean;
    params: { [key: string]: any };
}

// ─── CONSTANTS ────────────────────────────────────────────────

const STATE_ORDER: Record<string, number> = {
    STRONG_BUY: 0, BUY: 1, DIP_BUY: 2, DIP_WATCH: 3, SELL: 4, STRONG_SELL: 5,
};

const STATE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    STRONG_BUY:  { label: 'Strong Buy',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)' },
    BUY:         { label: 'Buy',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)' },
    DIP_BUY:     { label: 'Dip Buy',     color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',   border: 'rgba(20,184,166,0.25)' },
    DIP_WATCH:   { label: 'Dip Watch',   color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.25)' },
    SELL:        { label: 'Sell',         color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.25)' },
    STRONG_SELL: { label: 'Strong Sell',  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.25)' },
};

const SCAN_TIMES_CT = ['08:39', '08:54', '09:19', '09:49', '10:24', '10:54', '11:34', '12:34', '13:34', '14:19', '14:49'];

const BLOCK_LABELS: Record<string, string> = {
    SHORT_BLOCKLIST: 'Blocked: commodity/leveraged ETF',
    SHORT_ON_SUPPORT: 'Blocked: short sitting on support',
    STOP_TOO_WIDE: 'Blocked: stop too wide',
};
const WATCH_LABELS: Record<string, string> = {
    NO_TRIGGER: 'Waiting for 5m trigger',
    RR_BELOW_FLOOR: 'R:R below floor',
    T1_TOO_CLOSE: 'Target too close',
};

// ─── HELPERS ──────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toFixed(2)}` : '—';

const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes) return '—';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h < 24) return `${h}h ${m}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
};

const timeSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    return formatDuration(mins) + ' ago';
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

const getCTNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
const getCTHHMM = () => getCTNow().toTimeString().slice(0, 5);

const isMarketHoursCT = (): boolean => {
    const cst = getCTNow();
    const d = cst.getDay();
    if (d === 0 || d === 6) return false;
    const hm = cst.getHours() * 100 + cst.getMinutes();
    return hm >= 830 && hm < 1500;
};

// ─── SIGNAL STATE BADGE ──────────────────────────────────────

const StateBadge: React.FC<{ state: string; locked?: boolean }> = ({ state, locked }) => {
    const s = STATE_CFG[state];
    if (!s) return null;
    return (
        <span style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 900,
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
            {s.label}{locked ? ' (locked)' : ''}
        </span>
    );
};

// ─── LEVEL LADDER ────────────────────────────────────────────

interface LadderRung {
    key: string;
    label: string;
    price: number;
    color: string;
    source?: string | null;
    isVeryStrong?: boolean;
}

const buildRungs = (
    entry: number, sl: number, t1: number, t2: number | null,
    s1: number | null, s2: number | null,
    s1Src: string | null, s2Src: string | null,
    isShort: boolean,
): LadderRung[] => {
    const rungs: LadderRung[] = [];
    if (t2 != null) rungs.push({ key: 'T2', label: 'T2', price: t2, color: '#16a34a' });
    rungs.push({ key: 'T1', label: 'T1', price: t1, color: '#22c55e' });
    rungs.push({ key: 'ENTRY', label: 'ENTRY', price: entry, color: '#facc15' });
    rungs.push({ key: 'SL', label: 'SL', price: sl, color: '#ef4444' });
    return rungs;
};

const LevelLadder: React.FC<{ rungs: LadderRung[]; currentPrice: number }> = ({ rungs, currentPrice }) => {
    const sorted = [...rungs].sort((a, b) => b.price - a.price);

    // Find where NOW sits
    let nowIdx = sorted.length;
    for (let i = 0; i < sorted.length; i++) {
        if (currentPrice >= sorted[i].price) { nowIdx = i; break; }
    }

    const items: (LadderRung | 'NOW')[] = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i === nowIdx) items.push('NOW');
        items.push(sorted[i]);
    }
    if (nowIdx === sorted.length) items.push('NOW');

    return (
        <div className="flex flex-row md:flex-col gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible py-1 md:py-2 px-1">
            {items.map((item, i) => {
                if (item === 'NOW') {
                    return (
                        <div key="now" className="flex items-center gap-1.5 py-1 px-2 border-t border-b border-white/20 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                            <span className="text-[10px] font-black text-white font-mono whitespace-nowrap">
                                NOW {fmt(currentPrice)}
                            </span>
                        </div>
                    );
                }
                const pct = ((item.price - currentPrice) / currentPrice * 100);
                const hasConfluence = item.source?.includes('+');
                return (
                    <div key={item.key} className="flex items-start gap-1.5 px-2 py-0.5 md:py-1 flex-shrink-0">
                        <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ background: item.color }} />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: item.color }}>{item.label}</span>
                                {item.isVeryStrong && <span className="text-[7px] font-bold text-violet-400/60">very strong</span>}
                                {hasConfluence && <span className="text-[8px] text-amber-400" title="Confluence">◆◆</span>}
                            </div>
                            <span className="text-[11px] font-mono font-bold text-white/90 block">{fmt(item.price)}</span>
                            <span className="text-[9px] font-mono text-slate-500">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                            {item.source && <span className="text-[8px] text-slate-600 block truncate max-w-[100px]">{item.source}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── PROGRESS BAR (thin) ─────────────────────────────────────

const ProgressBar: React.FC<{ pct: number; isStale?: boolean }> = ({ pct: rawPct, isStale }) => {
    const pct = Math.max(0, Math.min(110, rawPct || 0));
    const clampedWidth = Math.min(pct, 100);
    const color = pct >= 80 ? '#00d97e' : pct >= 60 ? '#7bed9f' : pct >= 40 ? '#ffd32a' : pct >= 20 ? '#ff9f43' : '#ff4757';
    return (
        <div className="flex items-center gap-2">
            {isStale && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Stale data" />}
            <div className="flex-1 h-1.5 rounded-full bg-[#111620] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clampedWidth}%`, background: color }} />
            </div>
            <span className="text-[9px] font-mono font-bold flex-shrink-0" style={{ color }}>{pct.toFixed(0)}%</span>
        </div>
    );
};

// ─── INFO POPOVER ────────────────────────────────────────────

const InfoPopover: React.FC<{ data: [string, string | number | null | undefined][] }> = ({ data }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(!open)} className="text-slate-600 hover:text-slate-300 transition-colors text-[13px] leading-none" title="Details">
                &#9432;
            </button>
            {open && (
                <div className="absolute right-0 top-6 z-50 w-64 bg-[#0d1117] border border-[#1e2430] rounded-xl p-3 shadow-xl space-y-0">
                    {data.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[9px] py-1.5 border-b border-[#1e2430] last:border-0">
                            <span className="text-slate-500 uppercase font-bold">{k}</span>
                            <span className="text-white font-mono font-bold">{String(v)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── LEVEL LADDER CARD ───────────────────────────────────────

interface CardProps {
    mode: 'position' | 'signal';
    symbol: string;
    tradeDirection: string;
    signalState: string | null;
    setupType: string | null;
    entryPrice: number;
    currentPrice: number;
    stopLoss: number;
    target1: number;
    target2: number | null;
    support1: number | null;
    support2: number | null;
    support1Src: string | null;
    support2Src: string | null;
    bars: Bar[];
    tf: Timeframe;
    onTfChange: (tf: Timeframe) => void;
    // Position
    pnlPct?: number;
    openedAt?: string;
    progressPct?: number;
    isStale?: boolean;
    // Signal
    executionHint?: string;
    qualified?: boolean;
    blockReason?: string | null;
    watchReason?: string | null;
    isLocked?: boolean;
    gatesStr?: string;
    // Info
    infoData: [string, string | number | null | undefined][];
    // Actions
    onManualClose?: () => void;
    onExecute?: () => void;
}

const LevelLadderCard: React.FC<CardProps> = (p) => {
    const isBuy = p.tradeDirection?.toUpperCase() === 'BUY';
    const isShort = !isBuy;
    const isDip = (p.setupType || 'BREAKOUT') === 'DIP';
    const pnlPositive = (p.pnlPct ?? 0) >= 0;
    const stateColor = STATE_CFG[p.signalState || '']?.border || 'rgba(107,114,128,0.25)';
    const accentColor = p.mode === 'position'
        ? (pnlPositive ? '#00d97e' : '#ff4757')
        : (isBuy ? '#00d97e' : '#ff4757');

    const rungs = buildRungs(p.entryPrice, p.stopLoss, p.target1, p.target2, p.support1, p.support2, p.support1Src, p.support2Src, isShort);

    // Signal status line
    let statusLine: React.ReactNode = null;
    if (p.mode === 'signal') {
        if (p.isLocked) {
            statusLine = <span className="text-emerald-400 font-bold">Locked — see Positions tab</span>;
        } else if (p.qualified) {
            statusLine = <span className="text-amber-400">Locks next scan</span>;
        } else if (p.blockReason) {
            statusLine = <span className="text-slate-500">{BLOCK_LABELS[p.blockReason] || `Blocked: ${p.blockReason}`}</span>;
        } else if (p.watchReason) {
            statusLine = <span className="text-sky-400">{WATCH_LABELS[p.watchReason] || p.watchReason}</span>;
        } else if (p.gatesStr) {
            statusLine = <span className="text-slate-600">{p.gatesStr} — board only</span>;
        }
    }

    return (
        <div
            className="relative bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden border transition-all duration-200 group"
            style={{ borderColor: stateColor }}
        >
            {/* 3px left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />

            {/* Top glow */}
            <div className="h-px w-full" style={{ background: pnlPositive ? 'linear-gradient(90deg,transparent,rgba(0,217,126,0.3),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,71,87,0.2),transparent)' }} />

            <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">

                {/* ── Row 1: Symbol + Badges + P&L / Exec ── */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight leading-none">{p.symbol}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                            {isBuy ? 'LONG' : 'SHORT'}
                        </span>
                        {p.signalState && <StateBadge state={p.signalState} locked={p.mode === 'position'} />}
                        {isDip && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black border text-teal-400 bg-teal-900/20 border-teal-600/30 uppercase">DIP</span>
                        )}
                    </div>

                    <div className="flex items-start gap-2 flex-shrink-0">
                        <InfoPopover data={p.infoData} />
                        {p.mode === 'position' ? (
                            <div className="text-right">
                                <span className={`block text-xl font-black font-mono tabular-nums leading-tight ${pnlPositive ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                    {(p.pnlPct ?? 0) >= 0 ? '+' : ''}{(p.pnlPct ?? 0).toFixed(2)}%
                                </span>
                                <span className="block text-[9px] text-slate-600 font-mono mt-0.5">{timeSince(p.openedAt)}</span>
                            </div>
                        ) : (
                            <ExecPill hint={p.executionHint || 'WAIT'} />
                        )}
                    </div>
                </div>

                {/* ── Row 2: Chart + Ladder ── */}
                <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex-1 min-w-0 md:w-3/4">
                        <TradeChart
                            bars={p.bars}
                            entryPrice={p.entryPrice}
                            stopLoss={p.stopLoss}
                            target1={p.target1}
                            target2={p.target2 || undefined}
                            currentPrice={p.currentPrice}
                            optionType={isBuy ? 'CALL' : 'PUT'}
                            tf={p.tf}
                            onTfChange={p.onTfChange}
                            isShort={isShort}
                        />
                    </div>
                    <div className="md:w-1/4 bg-[#080b10] rounded-xl border border-[#1e2430]">
                        <LevelLadder rungs={rungs} currentPrice={p.currentPrice} />
                    </div>
                </div>

                {/* ── Row 3: Progress bar (positions only) ── */}
                {p.mode === 'position' && p.progressPct != null && (
                    <ProgressBar pct={p.progressPct} isStale={p.isStale || false} />
                )}

                {/* ── Signal status line ── */}
                {statusLine && (
                    <div className="text-[10px] font-bold">{statusLine}</div>
                )}

                {/* ── Position actions (subtle) ── */}
                {p.mode === 'position' && (
                    <div className="flex items-center justify-between text-[9px] text-slate-600 font-bold pt-1 border-t border-[#1e2430]">
                        <span>{timeSince(p.openedAt)}</span>
                        <div className="flex items-center gap-2">
                            {p.onManualClose && (
                                <button onClick={p.onManualClose} className="text-slate-500 hover:text-white transition-colors uppercase tracking-wide">
                                    Close
                                </button>
                            )}
                            {p.onExecute && (
                                <button onClick={p.onExecute}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all border ${isBuy
                                        ? 'bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20'
                                        : 'bg-[#ff4757]/10 border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20'}`}>
                                    {isBuy ? 'Buy Stock' : 'Short Stock'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── EXEC PILL ───────────────────────────────────────────────

const ExecPill: React.FC<{ hint: string }> = ({ hint }) => {
    const isReady = hint === 'READY_BUY' || hint === 'READY_SELL';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isReady
            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-600/50'
            : 'text-slate-500 bg-slate-800/40 border-slate-700/30'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {isReady ? 'Ready' : 'Wait'}
        </span>
    );
};

// ─── MANUAL CLOSE MODAL ──────────────────────────────────────

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
            <div className="w-full max-w-md bg-[#0d1117] border border-[#ff4757]/30 rounded-2xl shadow-2xl overflow-hidden"
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
                    <div className="bg-[#111620] rounded-xl p-4 border border-[#1e2430]">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-white">{position.symbol}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                                    {isBuy ? 'LONG' : 'SHORT'}
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
                        <span className="text-lg shrink-0">&#9888;&#65039;</span>
                        <p className="text-amber-200/80 text-xs leading-relaxed">This will manually close the position and record it in trade history. This action cannot be undone.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-[#1e2430] text-slate-400 font-bold rounded-xl hover:bg-[#1a1f2e] transition-colors text-xs uppercase tracking-wide">Cancel</button>
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

// ─── HISTORY SUMMARY ─────────────────────────────────────────

const HistorySummaryStats: React.FC<{ history: StockGateHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;
    const wins = history.filter(h => h.result === 'WIN');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
                { label: 'Total Trades', value: String(history.length), color: 'text-white' },
                { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
            ].map(s => (
                <div key={s.label} className="bg-[#0d1117] rounded-xl border border-[#1e2430] p-3 text-center">
                    <span className="block text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1">{s.label}</span>
                    <span className={`block text-sm font-black font-mono ${s.color}`}>{s.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── SKELETONS ───────────────────────────────────────────────

const CardSkeleton: React.FC = () => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-5 space-y-3 animate-pulse">
        <div className="flex justify-between"><div className="flex gap-2"><div className="h-6 w-16 bg-[#1e2430] rounded" /><div className="h-5 w-12 bg-[#1e2430] rounded" /></div><div className="h-6 w-14 bg-[#1e2430] rounded" /></div>
        <div className="h-[280px] bg-[#111620] rounded-xl" />
        <div className="h-1.5 bg-[#1e2430] rounded-full" />
    </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const N8N_BASE = import.meta.env.VITE_N8N_BASE_URL || '';
const TK_SECRET = import.meta.env.VITE_TK_WEBHOOK_SECRET || '';

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
    ai_summary: pos.signal || `${pos.trade_direction?.toUpperCase()} signal — Tier ${pos.tier} · ${pos.gates_passed} gates passed`,
    ai_reasoning: pos.gate_reason || '',
    when_to_buy: `Entry near $${pos.entry_price?.toFixed(2) ?? '—'}`,
    risk_factors: `Stop Loss: $${pos.stop_loss?.toFixed(2) ?? '—'}`,
    analyzed_at: pos.opened_at,
});

type TopTab = 'positions' | 'signals' | 'history';
type StateFilter = string | null;
type ExecFilter = 'READY' | 'WAIT' | null;
type SortMode = 'default' | 'pnl' | 'closest_t1' | 'closest_sl';

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

    const [topTab, setTopTab] = useState<TopTab>('positions');
    const [stateFilter, setStateFilter] = useState<StateFilter>(null);
    const [execFilter, setExecFilter] = useState<ExecFilter>(null);
    const [sortMode, setSortMode] = useState<SortMode>('default');

    // History filters
    const [historyTodayOnly, setHistoryTodayOnly] = useState(false);
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    const [histPage, setHistPage] = useState(0);

    // Scan
    const [scanning, setScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Chart
    const [chartTf, setChartTf] = useState<Timeframe>('4h');
    const allSymbols = useMemo(() => {
        const set = new Set<string>();
        positions.forEach(p => set.add(p.symbol));
        board.forEach(r => set.add(r.symbol));
        return Array.from(set);
    }, [positions, board]);
    const { barsBySymbol } = useMdBars(allSymbols, chartTf);

    // ── Fetchers ──
    const fetchBoard = useCallback(async () => {
        const { data, error } = await supabase.from('stock_gate_signal_board').select('*');
        if (!error && data) {
            const sorted = (data as BoardRow[]).sort((a, b) => {
                const so = (STATE_ORDER[a.signal_state] ?? 99) - (STATE_ORDER[b.signal_state] ?? 99);
                if (so !== 0) return so;
                return (b.rr_value ?? 0) - (a.rr_value ?? 0);
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

    // ── Init + intervals ──
    useEffect(() => { fetchConfig(); fetchBoard(); fetchPositions(); fetchHistory(); }, [fetchConfig, fetchBoard, fetchPositions, fetchHistory]);
    useEffect(() => { const i = setInterval(fetchPositions, 30000); return () => clearInterval(i); }, [fetchPositions]);

    // Realtime on signal_board
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const channel = supabase.channel('sg-board-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_gate_signal_board' }, () => {
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => { fetchBoard(); setScanning(false); }, 1000);
            })
            .subscribe();
        return () => { if (timeout) clearTimeout(timeout); supabase.removeChannel(channel); };
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
        } catch (e) { console.error('[StockGate] Scan failed:', e); setScanning(false); }
    };

    // ── Manual close ──
    const handleManualClose = async (position: StockGatePosition) => {
        setIsClosing(true);
        try {
            const pnl = calcPnl(position);
            const pnlDollars = position.entry_price ? +((pnl / 100) * position.entry_price).toFixed(2) : 0;
            await supabase
                .from('stock_gate_positions')
                .update({ status: 'MANUAL_CLOSE', close_reason: 'MANUAL', closed_at: new Date().toISOString(), pnl_pct: pnl, pnl_dollars: pnlDollars })
                .eq('id', position.id).eq('status', 'OPEN');
            await Promise.all([fetchPositions(), fetchHistory()]);
            setClosingPosition(null);
        } catch (err) { console.error('Manual close failed:', err); }
        finally { setIsClosing(false); }
    };

    // ── Derived ──
    const lockedSymbols = new Set(positions.map(p => p.symbol));
    const latestScan = board.length > 0 ? board.reduce((latest, r) => r.scanned_at > latest ? r.scanned_at : latest, board[0].scanned_at) : null;
    const priceSource = board.length > 0 ? board[0].price_source : null;
    const isStale = latestScan && isMarketHoursCT() && (Date.now() - new Date(latestScan).getTime()) > 45 * 60 * 1000;

    // Stats
    const profitCount = positions.filter(p => isProfitable(p)).length;
    const avgPnl = positions.length > 0 ? positions.reduce((a, p) => a + calcPnl(p), 0) / positions.length : 0;
    const brkCount = positions.filter(p => (p.setup_type || 'BREAKOUT') === 'BREAKOUT').length;
    const dipCount = positions.filter(p => (p.setup_type || 'BREAKOUT') === 'DIP').length;

    // Filter + sort helpers
    const resolveState = (p: StockGatePosition): string => {
        if (p.signal_state) return p.signal_state;
        const isBuy = p.trade_direction?.toUpperCase() === 'BUY';
        return p.tier === 'A+' ? (isBuy ? 'STRONG_BUY' : 'STRONG_SELL') : (isBuy ? 'BUY' : 'SELL');
    };
    const matchFilters = (state: string | null, hint: string | null | undefined): boolean => {
        if (stateFilter && state !== stateFilter) return false;
        if (execFilter === 'READY' && hint !== 'READY_BUY' && hint !== 'READY_SELL') return false;
        if (execFilter === 'WAIT' && hint !== 'WAIT') return false;
        return true;
    };

    // Filter counts for chips
    const posStateCounts = Object.keys(STATE_CFG).reduce((acc, k) => {
        acc[k] = positions.filter(p => resolveState(p) === k).length;
        return acc;
    }, {} as Record<string, number>);
    const boardStateCounts = Object.keys(STATE_CFG).reduce((acc, k) => {
        acc[k] = board.filter(r => r.signal_state === k).length;
        return acc;
    }, {} as Record<string, number>);

    const posReadyCount = positions.filter(p => p.execution_hint === 'READY_BUY' || p.execution_hint === 'READY_SELL').length;
    const posWaitCount = positions.filter(p => p.execution_hint === 'WAIT').length;
    const boardReadyCount = board.filter(r => r.execution_hint === 'READY_BUY' || r.execution_hint === 'READY_SELL').length;
    const boardWaitCount = board.filter(r => r.execution_hint === 'WAIT').length;

    const filteredPositions = positions.filter(p => matchFilters(resolveState(p), p.execution_hint));
    const filteredBoard = board.filter(r => matchFilters(r.signal_state, r.execution_hint));

    const sortedPositions = [...filteredPositions].sort((a, b) => {
        switch (sortMode) {
            case 'pnl': return calcPnl(b) - calcPnl(a);
            case 'closest_t1': return Math.abs((a.progress_pct ?? 0) - 100) - Math.abs((b.progress_pct ?? 0) - 100);
            case 'closest_sl': return (a.progress_pct ?? 50) - (b.progress_pct ?? 50);
            default: return 0;
        }
    });

    // Scan times
    const ctHHMM = getCTHHMM();
    const nextScanTime = SCAN_TIMES_CT.find(t => t > ctHHMM);

    // Build info data for a position
    const posInfoData = (p: StockGatePosition): [string, string | number | null | undefined][] => [
        ['Tier', p.tier],
        ['R:R', p.risk_reward_ratio],
        ['Gates', p.gates_passed],
        ['ADX', p.adx_value?.toFixed(0)],
        ['RVOL', p.rvol != null ? `${p.rvol.toFixed(1)}x` : null],
        ['ATR', p.atr_pct != null ? `${p.atr_pct.toFixed(1)}%` : null],
        ['Volume', p.volume_trend],
        ['30D Target', p.horizon_target != null ? fmt(p.horizon_target) : null],
        ['30D Move', p.horizon_move_pct != null ? `+${p.horizon_move_pct.toFixed(1)}%` : null],
        ['Round', p.round_number != null && p.round_number > 1 ? `#${p.round_number}` : null],
    ];
    const boardInfoData = (r: BoardRow): [string, string | number | null | undefined][] => [
        ['Tier', r.tier],
        ['R:R', r.risk_reward_ratio],
        ['Gates', r.gates_passed],
        ['SL%', `${r.sl_pct?.toFixed(1)}%`],
        ['T1 dist', `${r.t1_dist_pct?.toFixed(1)}%`],
        ['ADX', r.adx_value?.toFixed(0)],
        ['RVOL', r.rvol != null ? `${r.rvol.toFixed(1)}x` : null],
        ['ATR', `${r.atr_pct?.toFixed(1)}%`],
        ['Volume', r.volume_trend],
        ['30D Target', r.horizon_target != null ? fmt(r.horizon_target) : null],
        ['30D Move', r.horizon_move_pct != null ? `+${r.horizon_move_pct.toFixed(1)}%` : null],
    ];

    // History filtering
    const histTodayStr = new Date().toDateString();
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
    const HIST_PAGE_SIZE = 50;
    const pagedHistory = filteredHistory.slice(histPage * HIST_PAGE_SIZE, (histPage + 1) * HIST_PAGE_SIZE);
    const histPages = Math.ceil(filteredHistory.length / HIST_PAGE_SIZE);

    // Filter chip counts for current tab
    const stateCounts = topTab === 'positions' ? posStateCounts : boardStateCounts;
    const readyCount = topTab === 'positions' ? posReadyCount : boardReadyCount;
    const waitCount = topTab === 'positions' ? posWaitCount : boardWaitCount;

    // ── RENDER ──
    return (
        <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
            <style>{`
                @keyframes sgPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.3); } }
                @keyframes sgSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
                @keyframes sgSpin { to { transform: rotate(360deg); } }
            `}</style>
            <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">

                {/* ── HEADER ── */}
                <div className="relative bg-gradient-to-br from-[#0d1117] to-[#0a0e16] rounded-2xl border border-[#1e2430] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/5 via-transparent to-transparent pointer-events-none" />
                    <div className="relative p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-2xl text-emerald-400">trending_up</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight uppercase">Stock Gate</h1>
                                    {config?.is_active && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/25 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />ACTIVE
                                        </span>
                                    )}
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
                                    {isStale && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10 border border-amber-400/25">
                                            &#9888; Board may be stale
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-500 text-xs font-medium mt-0.5">Swing trades · 1–4 weeks</p>
                            </div>
                        </div>

                        {/* Stat tiles */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {positions.length > 0 && (
                                <>
                                    <div className="px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold text-center">
                                        <span className="text-slate-500 block">Locked</span>
                                        <span className="text-white font-black text-sm">{positions.length}</span>
                                        <span className="text-[9px] text-slate-500 font-mono block">{brkCount} BRK · {dipCount} DIP</span>
                                    </div>
                                    <div className="px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold text-center">
                                        <span className="text-slate-500 block">In Profit</span>
                                        <span className={`font-black text-sm ${profitCount > 0 ? 'text-[#00d97e]' : 'text-slate-400'}`}>{profitCount}/{positions.length}</span>
                                    </div>
                                    <div className="px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold text-center">
                                        <span className="text-slate-500 block">Avg P&L</span>
                                        <span className={`font-black text-sm font-mono ${avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(2)}%</span>
                                    </div>
                                </>
                            )}
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

                    {/* Scan times row */}
                    <div className="px-5 pb-4 flex items-center gap-2 flex-wrap border-t border-[#1a1f2e] pt-3">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Scan Times (CT):</span>
                        {SCAN_TIMES_CT.map((t, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-colors ${
                                t === nextScanTime
                                    ? 'bg-amber-900/15 border-amber-700/40 text-amber-400'
                                    : t < ctHHMM
                                        ? 'bg-[#111620] border-[#1e2430] text-slate-600'
                                        : 'bg-[#111620] border-[#1e2430] text-slate-400'
                            }`}>{t}</span>
                        ))}
                        {latestScan && <span className="text-[9px] text-slate-500 font-bold ml-auto">Last scan: {timeSince(latestScan)}</span>}
                    </div>
                </div>

                {/* ── TOP TABS ── */}
                <div className="flex bg-[#0d1117] rounded-xl border border-[#1e2430] p-1 gap-1 w-fit">
                    {([
                        { id: 'positions' as TopTab, label: `Positions (${positions.length})`, icon: 'radar' },
                        { id: 'signals' as TopTab, label: `Signals (${board.length})`, icon: 'sensors' },
                        { id: 'history' as TopTab, label: `History (${history.length})`, icon: 'history' },
                    ]).map(tab => (
                        <button key={tab.id} onClick={() => { setTopTab(tab.id); setStateFilter(null); setExecFilter(null); setHistPage(0); }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${topTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-500 hover:text-slate-300'}`}>
                            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── FILTER CHIPS (positions + signals) ── */}
                {(topTab === 'positions' || topTab === 'signals') && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(STATE_CFG).map(([key, cfg]) => {
                            const count = stateCounts[key] || 0;
                            const isActive = stateFilter === key;
                            return (
                                <button key={key} onClick={() => { if (count === 0) return; setStateFilter(isActive ? null : key); }}
                                    style={{ borderColor: isActive ? cfg.border : '#1e2430', background: isActive ? cfg.bg : 'transparent', color: isActive ? cfg.color : (count === 0 ? '#4a5959' : '#7a8c8c') }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all uppercase tracking-wide ${count === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
                                    {cfg.label}
                                    <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                                </button>
                            );
                        })}

                        <span className="text-slate-700 text-[10px] select-none">|</span>

                        {/* READY / WAIT */}
                        <button onClick={() => { if (readyCount === 0) return; setExecFilter(execFilter === 'READY' ? null : 'READY'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all uppercase tracking-wide ${
                                execFilter === 'READY' ? 'text-emerald-400 bg-emerald-950/40 border-emerald-600/50 ring-1 ring-emerald-500' : readyCount === 0 ? 'text-slate-700 border-[#1e2430] opacity-40 cursor-default' : 'text-emerald-400 border-[#1e2430] cursor-pointer hover:opacity-80'
                            }`}>
                            Ready <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{readyCount}</span>
                        </button>
                        <button onClick={() => { if (waitCount === 0) return; setExecFilter(execFilter === 'WAIT' ? null : 'WAIT'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all uppercase tracking-wide ${
                                execFilter === 'WAIT' ? 'text-slate-400 bg-slate-800/40 border-slate-600/50 ring-1 ring-slate-500' : waitCount === 0 ? 'text-slate-700 border-[#1e2430] opacity-40 cursor-default' : 'text-slate-400 border-[#1e2430] cursor-pointer hover:opacity-80'
                            }`}>
                            Wait <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{waitCount}</span>
                        </button>

                        {(stateFilter || execFilter) && (
                            <button onClick={() => { setStateFilter(null); setExecFilter(null); }} className="text-[10px] text-slate-500 hover:text-white font-bold underline">clear</button>
                        )}

                        {/* Sort (positions only) */}
                        {topTab === 'positions' && (
                            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                                className="ml-auto bg-[#111620] border border-[#1e2430] rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-300 focus:outline-none cursor-pointer appearance-none pr-6"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                                <option value="default">Default</option>
                                <option value="pnl">P&L</option>
                                <option value="closest_t1">Closest to T1</option>
                                <option value="closest_sl">Closest to Stop</option>
                            </select>
                        )}
                    </div>
                )}

                {/* ══ POSITIONS TAB ══ */}
                {topTab === 'positions' && (
                    <div className="space-y-4">
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
                        ) : positionsError ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-red-900/30">
                                <h3 className="text-base font-black text-red-400 uppercase tracking-tight mb-2">Failed to Load Positions</h3>
                                <p className="text-slate-600 text-sm max-w-sm mx-auto mb-4 font-mono">{positionsError}</p>
                                <button onClick={fetchPositions} className="px-4 py-2 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-bold hover:bg-red-900/30">Retry</button>
                            </div>
                        ) : sortedPositions.length === 0 ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                <span className="material-symbols-outlined text-5xl text-emerald-600 mb-4 block">trending_up</span>
                                <h3 className="text-base font-black uppercase tracking-tight mb-2">No open positions</h3>
                                <p className="text-slate-600 text-sm max-w-sm mx-auto">Qualifying positions will appear here with live tracking.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {sortedPositions.map(pos => (
                                    <LevelLadderCard
                                        key={pos.id}
                                        mode="position"
                                        symbol={pos.symbol}
                                        tradeDirection={pos.trade_direction}
                                        signalState={resolveState(pos)}
                                        setupType={pos.setup_type}
                                        entryPrice={pos.entry_price}
                                        currentPrice={pos.current_price}
                                        stopLoss={pos.stop_loss}
                                        target1={pos.target_price}
                                        target2={pos.fib_target2 || null}
                                        support1={pos.support_1}
                                        support2={pos.support_2}
                                        support1Src={pos.support_1_src}
                                        support2Src={pos.support_2_src}
                                        bars={barsBySymbol[pos.symbol] ?? []}
                                        tf={chartTf}
                                        onTfChange={setChartTf}
                                        pnlPct={calcPnl(pos)}
                                        openedAt={pos.opened_at}
                                        progressPct={pos.progress_pct ?? undefined}
                                        isStale={pos.is_stale || false}
                                        infoData={posInfoData(pos)}
                                        onManualClose={() => setClosingPosition(pos)}
                                        onExecute={() => setExecutingPosition(pos)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ SIGNALS TAB ══ */}
                {topTab === 'signals' && (
                    <div className="space-y-4">
                        {loadingBoard ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
                        ) : filteredBoard.length === 0 ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4 block">sensors</span>
                                <p className="text-slate-500 text-sm">
                                    {board.length === 0
                                        ? `No signals in the latest scan (${latestScan ? timeSince(latestScan) : 'no scan yet'}).`
                                        : 'No signals match the current filters.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {filteredBoard.map(row => (
                                    <LevelLadderCard
                                        key={row.id}
                                        mode="signal"
                                        symbol={row.symbol}
                                        tradeDirection={row.trade_direction}
                                        signalState={row.signal_state}
                                        setupType={row.setup_type}
                                        entryPrice={row.entry_price}
                                        currentPrice={row.current_price}
                                        stopLoss={row.stop_loss}
                                        target1={row.target_price}
                                        target2={row.fib_target2 || null}
                                        support1={row.support_1}
                                        support2={row.support_2}
                                        support1Src={row.support_1_src}
                                        support2Src={row.support_2_src}
                                        bars={barsBySymbol[row.symbol] ?? []}
                                        tf={chartTf}
                                        onTfChange={setChartTf}
                                        executionHint={row.execution_hint}
                                        qualified={row.qualified}
                                        blockReason={row.block_reason}
                                        watchReason={row.watch_reason}
                                        isLocked={lockedSymbols.has(row.symbol)}
                                        gatesStr={row.gates_passed}
                                        infoData={boardInfoData(row)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ HISTORY TAB ══ */}
                {topTab === 'history' && (
                    <div className="space-y-4">
                        {loadingHistory ? (
                            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-11 bg-[#0d1117] rounded-lg border border-[#1e2430] animate-pulse" />)}</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4 block">history</span>
                                <h3 className="text-base font-black uppercase tracking-tight mb-2">No Trade History</h3>
                                <p className="text-slate-600 text-sm">Closed positions will appear here.</p>
                            </div>
                        ) : (() => {
                            const todayCount = history.filter(h => new Date(h.closed_at).toDateString() === histTodayStr).length;
                            const setPreset = (p: string) => {
                                setHistPage(0);
                                if (p === 'today') { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryTodayOnly(true); }
                                else if (p === 'week') { const f = new Date(); f.setDate(f.getDate() - 6); setHistoryDateFrom(f.toISOString().slice(0, 10)); setHistoryDateTo(new Date().toISOString().slice(0, 10)); setHistoryTodayOnly(false); }
                                else if (p === 'month') { const f = new Date(); f.setDate(f.getDate() - 29); setHistoryDateFrom(f.toISOString().slice(0, 10)); setHistoryDateTo(new Date().toISOString().slice(0, 10)); setHistoryTodayOnly(false); }
                                else { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryTodayOnly(false); }
                            };
                            const activePreset = historyTodayOnly ? 'today' : !historyDateFrom && !historyDateTo ? 'all' : null;

                            return (
                                <>
                                    {/* Filters */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {[
                                            { id: 'today', label: 'Today', count: todayCount },
                                            { id: 'week', label: 'This Week', count: null },
                                            { id: 'month', label: '30 Days', count: null },
                                            { id: 'all', label: 'All', count: history.length },
                                        ].map(pr => (
                                            <button key={pr.id} onClick={() => setPreset(pr.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${activePreset === pr.id
                                                    ? 'bg-blue-900/30 border-blue-600/60 text-blue-300 ring-1 ring-blue-400'
                                                    : 'bg-[#111620] border-[#1e2430] text-slate-400 hover:opacity-80'
                                                }`}>
                                                <span className="uppercase tracking-wide">{pr.label}</span>
                                                {pr.count != null && <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{pr.count}</span>}
                                            </button>
                                        ))}
                                        <span className="text-slate-700 text-[10px] select-none">|</span>
                                        <input type="date" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setHistoryTodayOnly(false); setHistPage(0); }}
                                            className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-[#111620] border-[#1e2430] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                        <span className="text-[10px] text-slate-500">–</span>
                                        <input type="date" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setHistoryTodayOnly(false); setHistPage(0); }}
                                            className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-[#111620] border-[#1e2430] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                        <span className="ml-auto text-[9px] text-slate-600 font-bold">{filteredHistory.length} of {history.length}</span>
                                        {role === 'admin' && (
                                            <button onClick={() => {
                                                const headers = ['Symbol', 'Dir', 'Setup', 'Entry', 'Exit', 'P&L%', 'Result', 'Reason', 'Opened', 'Closed'];
                                                const rows = filteredHistory.map(h => [h.symbol, h.trade_direction, h.setup_type || '', h.entry_price, h.exit_price, `${(h.pnl_pct || 0).toFixed(2)}%`, h.result, h.exit_reason ?? '', h.opened_at?.slice(0, 10) || '', h.closed_at?.slice(0, 10) || '']);
                                                const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                                                const blob = new Blob([csv], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a'); a.href = url; a.download = `stock-gate-history-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
                                            }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-600/60 bg-blue-900/20 text-blue-300 text-[10px] font-bold hover:bg-blue-900/40 transition-colors">
                                                Export CSV
                                            </button>
                                        )}
                                    </div>

                                    <HistorySummaryStats history={filteredHistory} />

                                    {/* Table */}
                                    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-[#1e2430] bg-[#080b10]">
                                                        {['Symbol', 'Dir', 'Setup', 'Entry', 'Exit', 'P&L %', 'Result', 'Reason', 'Opened', 'Closed'].map(col => (
                                                            <th key={col} className="px-4 py-3 text-left text-[9px] font-bold text-slate-600 uppercase tracking-wider">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pagedHistory.map(h => {
                                                        const isWin = h.result === 'WIN';
                                                        const isBuy = h.trade_direction?.toUpperCase() === 'BUY';
                                                        return (
                                                            <tr key={h.id} className={`border-b border-[#111620] transition-colors hover:bg-[#111620] ${isWin ? 'bg-[#00d97e]/[0.02]' : 'bg-[#ff4757]/[0.02]'}`}>
                                                                <td className="px-4 py-3 font-black text-white">{h.symbol}</td>
                                                                <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{isBuy ? 'LONG' : 'SHORT'}</span></td>
                                                                <td className="px-4 py-3 text-slate-500 text-[9px] font-bold uppercase">{h.setup_type || '—'}</td>
                                                                <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.entry_price)}</td>
                                                                <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.exit_price)}</td>
                                                                <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%</td>
                                                                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{h.result}</span></td>
                                                                <td className="px-4 py-3 text-slate-500 uppercase text-[9px] font-bold">{h.exit_reason || '—'}</td>
                                                                <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">{h.opened_at ? new Date(h.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                                                                <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">{h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {histPages > 1 && (
                                            <div className="flex items-center justify-center gap-2 py-3 border-t border-[#1e2430]">
                                                <button disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}
                                                    className="px-3 py-1 rounded border border-[#1e2430] text-[10px] font-bold text-slate-400 disabled:opacity-30 hover:text-white transition-colors">Prev</button>
                                                <span className="text-[10px] text-slate-500 font-mono">{histPage + 1} / {histPages}</span>
                                                <button disabled={histPage >= histPages - 1} onClick={() => setHistPage(p => p + 1)}
                                                    className="px-3 py-1 rounded border border-[#1e2430] text-[10px] font-bold text-slate-400 disabled:opacity-30 hover:text-white transition-colors">Next</button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
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
