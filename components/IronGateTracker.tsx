import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';

// ─── TYPES ────────────────────────────────────────────────────

interface StrategyConfig {
    id: string;
    strategy: string;
    display_name: string;
    icon: string;
    is_active: boolean;
    params: {
        min_gates?: number;
        min_tier?: string;
        monitor_interval?: string;
        scan_times?: string[];
        [key: string]: any;
    };
}

interface IronGatePosition {
    id: string;
    symbol: string;
    option_type: string;
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
    trade_direction: string;
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
    // Execution timing — updated every ~5 min by the monitor workflow
    execution_hint: 'READY_BUY' | 'READY_SELL' | 'WAIT' | null;
    execution_reason: string | null;  // e.g. "5m✓ 15m✓"
    st_5m_aligned: boolean | null;
    st_15m_aligned: boolean | null;
    // st_5m_direction / st_15m_direction already declared above (existing fields)
    // Two-stage exit fields
    target_stage: number | null;        // 1 = chasing T1, 2 = T1 hit chasing T2
    t1_hit_at: string | null;           // Timestamp when position advanced to stage 2
    t1_hit_price: number | null;        // Price at T1 hit moment
    original_stop_loss: number | null;  // Entry SL (current stop_loss = breakeven in stage 2)
    round_number: number | null;        // Re-entry round on same ticker
}

interface IronGateHistory {
    id: string;
    position_id: string;
    symbol: string;
    option_type: string;
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
    gate_reason?: string | null;
    version?: string | null;
}

interface AutoTradeSkip {
    id: string;
    symbol: string;
    option_type: string | null;
    tier: string | null;
    skip_reason: string;
    detail: string | null;
    created_at: string;
}

// ─── HELPERS ─────────────────────────────────────────────────

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

const durationSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    return formatDuration(Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
};

const formatOpenedAt = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} ${timePart} (${timeSince(dateStr)})`;
};

const gateIsPassed = (g: string | null | undefined): boolean => {
    if (!g) return false;
    return g.includes('✓') || g.includes('✅') || g.includes('PASS');
};

const calcPnl = (pos: IronGatePosition): number => {
    if (pos.pnl_pct != null && pos.pnl_pct !== 0) return pos.pnl_pct;
    if (!pos.entry_price || !pos.current_price) return 0;
    const isCall = pos.option_type?.toUpperCase() === 'CALL';
    return isCall
        ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
        : ((pos.entry_price - pos.current_price) / pos.entry_price) * 100;
};

const isProfitable = (pos: IronGatePosition): boolean => {
    const isCall = pos.option_type?.toUpperCase() === 'CALL';
    return isCall ? pos.current_price > pos.entry_price : pos.current_price < pos.entry_price;
};

const adxColor = (v: number | null | undefined): string => {
    if (!v) return 'text-red-400';
    if (v >= 25) return 'text-emerald-400';
    if (v >= 20) return 'text-yellow-400';
    return 'text-red-400';
};

const dirColor = (d: string | null | undefined): string => {
    const u = (d || '').toUpperCase();
    if (u === 'BULLISH' || u === 'RISING' || u === 'ABOVE') return 'text-emerald-400';
    if (u === 'BEARISH' || u === 'FALLING' || u === 'BELOW') return 'text-red-400';
    return 'text-slate-400';
};

// ─── CLOSE REASON BADGE ──────────────────────────────────────

const CloseReasonBadge: React.FC<{ reason: string | null | undefined }> = ({ reason }) => {
    if (!reason) return <span className="text-slate-500">—</span>;
    const r = reason.toUpperCase();
    if (r === 'TARGET_HIT_T2') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/40">
            🏆 Full Target (T2)
        </span>
    );
    if (r === 'BREAKEVEN_AFTER_T1') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600/60">
            🛡️ BE Stop (T1 banked)
        </span>
    );
    if (r === 'TARGET_HIT') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30">
            🎯 T1 Hit
        </span>
    );
    if (r === 'STOP_LOSS') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800/40">
            ⛔ Stop Loss
        </span>
    );
    if (r === 'ST_1H_FLIP') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30">
            ⚡ 1H Flip
        </span>
    );
    if (r === 'MANUAL') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1a1f2e] border-slate-300 dark:border-[#252c3b]">
            Manual
        </span>
    );
    return <span className="text-slate-500 uppercase text-[9px] font-bold">{reason}</span>;
};

// ─── TARGET LEG BADGE ────────────────────────────────────────

const TargetLegBadge: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const { target_stage, t1_hit_at, t1_hit_price, round_number } = position;
    const stage = target_stage ?? 1;
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {stage === 2 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border
                    text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600/50 ring-1 ring-emerald-400/40"
                    style={{ boxShadow: '0 0 8px rgba(52,211,153,0.12)' }}>
                    🎯 T1 Hit · Leg 2 of 2
                </div>
            ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                    text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30">
                    Leg 1 of 2
                </div>
            )}
            {round_number != null && round_number > 0 && (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Round #{round_number}</span>
            )}
            {stage === 2 && t1_hit_at && (
                <span className="text-[9px] text-slate-500 dark:text-slate-500 font-mono">
                    T1 at {t1_hit_price != null ? fmt(t1_hit_price) : '—'} · {timeSince(t1_hit_at)}
                </span>
            )}
        </div>
    );
};

// ─── PROGRESS BAR ────────────────────────────────────────────

const IronGateProgressBar: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const { entry_price, target_price, stop_loss, progress_pct, high_water_mark, low_water_mark } = position;
    const stage = position.target_stage ?? 1;
    const pct = Math.max(0, Math.min(100, progress_pct || 0));
    const hwm = Math.max(0, Math.min(100, high_water_mark || 0));
    const lwm = Math.max(0, Math.min(100, low_water_mark || 0));
    const range = Math.abs(target_price - stop_loss);
    const entryPct = range > 0 ? Math.max(0, Math.min(100, (Math.abs(entry_price - stop_loss) / range) * 100)) : 50;

    const zoneColor = pct >= 80 ? '#00d97e' : pct >= 60 ? '#7bed9f' : pct >= 40 ? '#ffd32a' : pct >= 20 ? '#ff9f43' : '#ff4757';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                <span>{stage === 2 ? 'Stage 2 progress: BE → T2' : 'SL → Target Progress'}</span>
                <span className="font-mono" style={{ color: zoneColor }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="relative h-5 rounded-full overflow-visible bg-gray-200 dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2430]">
                {/* Track gradient background */}
                <div className="absolute inset-0 rounded-full opacity-20"
                    style={{ background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 25%, #ffd32a 50%, #7bed9f 75%, #00d97e 100%)' }} />
                {/* Fill */}
                <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #ff475720 0%, ${zoneColor}80 100%)`,
                        borderRight: `2px solid ${zoneColor}`,
                    }} />
                {/* Entry marker */}
                <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${entryPct}%`, background: 'rgba(255,211,42,0.5)', borderLeft: '1px dashed rgba(255,211,42,0.7)' }} />
                {/* HWM */}
                {hwm > 0 && <div className="absolute -top-2.5 text-[8px] text-emerald-600 dark:text-emerald-400 font-black z-10" style={{ left: `calc(${hwm}% - 3px)` }} title={`HWM ${hwm.toFixed(1)}%`}>▲</div>}
                {/* LWM */}
                {lwm > 0 && lwm < 100 && <div className="absolute -bottom-2.5 text-[8px] text-red-500 dark:text-red-400 font-black z-10" style={{ left: `calc(${lwm}% - 3px)` }} title={`LWM ${lwm.toFixed(1)}%`}>▼</div>}
                {/* Current dot */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-[#0d1117] z-20 transition-all duration-700 ease-out shadow-lg"
                    style={{ left: `calc(${pct}% - 6px)`, background: zoneColor, boxShadow: `0 0 8px ${zoneColor}80` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold mt-0.5">
                <span className="text-red-500 dark:text-red-400">{stage === 2 ? '🛡️ BE' : '⛔'} {fmt(stop_loss)}</span>
                <span className="text-amber-600 dark:text-yellow-400/70">Entry {fmt(entry_price)}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{stage === 2 ? '🏁 T2' : '🎯 T1'} {fmt(target_price)}</span>
            </div>
        </div>
    );
};

// ─── GATE DETAILS (EXPANDABLE) ───────────────────────────────

const GATE_INFO = [
    { key: 'g1_sma', label: 'G1 SMA' },
    { key: 'g2_1h', label: 'G2 1H' },
    { key: 'g3_15m', label: 'G3 15M' },
    { key: 'g4_5m', label: 'G4 5M' },
    { key: 'g5_vwap', label: 'G5 VWAP' },
    { key: 'g6_adx', label: 'G6 ADX' },
];

const GateDetails: React.FC<{ position: IronGatePosition }> = ({ position }) => (
    <div className="pt-3 border-t border-gray-200 dark:border-[#1e2430] space-y-1.5">
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Gate Conditions</span>
        {GATE_INFO.map(({ key, label }) => {
            const value = (position as any)[key] as string || '—';
            const passed = gateIsPassed(value);
            return (
                <div key={key} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[10px] font-mono border ${passed ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/15 border-red-200 dark:border-red-900/20 text-red-500 dark:text-red-400/60'}`}>
                    <span className="flex-shrink-0 text-[11px]">{passed ? '✅' : '❌'}</span>
                    <span className="font-bold text-slate-500 flex-shrink-0 w-14">{label}:</span>
                    <span className="break-all leading-relaxed">{value}</span>
                </div>
            );
        })}
    </div>
);

// ─── EXECUTION HINT BADGE ─────────────────────────────────────

const ExecutionHintBadge: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const { execution_hint, execution_reason, st_5m_aligned, st_15m_aligned, st_5m_direction, st_15m_direction } = position;
    if (!execution_hint) return null;

    const isReady = execution_hint === 'READY_BUY' || execution_hint === 'READY_SELL';
    const label = execution_hint === 'READY_BUY' ? 'Ready Buy'
                : execution_hint === 'READY_SELL' ? 'Ready Sell'
                : 'Wait';

    const tooltip = [
        `5m ST: ${st_5m_aligned ? 'aligned' : 'not aligned'}${st_5m_direction ? ` (${st_5m_direction})` : ''}`,
        `15m ST: ${st_15m_aligned ? 'aligned' : 'not aligned'}${st_15m_direction ? ` (${st_15m_direction})` : ''}`,
    ].join(' | ');

    if (isReady) {
        return (
            <div
                title={tooltip}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border font-mono transition-all duration-300 cursor-default
                    text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-600/50"
                style={{ boxShadow: '0 0 10px rgba(52,211,153,0.18)' }}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                🟢 {label}
                {execution_reason && (
                    <span className="opacity-70 text-[9px] font-mono ml-0.5 normal-case">{execution_reason}</span>
                )}
            </div>
        );
    }

    // WAIT state
    return (
        <div
            title={tooltip}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border font-mono transition-all duration-300 cursor-default opacity-80
                text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            🟡 Wait
            {execution_reason && (
                <span className="opacity-70 text-[9px] font-mono ml-0.5 normal-case">{execution_reason}</span>
            )}
        </div>
    );
};

// ─── POSITION CARD ────────────────────────────────────────────

const GATE_KEYS = ['g1_sma', 'g2_1h', 'g3_15m', 'g4_5m', 'g5_vwap', 'g6_adx'];

const PositionCard: React.FC<{
    position: IronGatePosition;
    onManualClose: (p: IronGatePosition) => void;
    onExecute?: (signal: OptionSignal) => void;
}> = ({ position, onManualClose, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const isCall = position.option_type?.toUpperCase() === 'CALL';
    const pnl = calcPnl(position);
    const profitable = isProfitable(position);

    let rec = position.trading_recommendation;
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        if (position.tier === 'A+') rec = isCall ? 'STRONG BUY' : 'STRONG SELL';
        else rec = isCall ? 'BUY' : 'SELL';
    }
    const isStrong = rec.includes('STRONG');

    const accentColor = isCall ? '#00d97e' : '#ff4757';
    const pnlPositive = pnl >= 0;

    const execHint = position.execution_hint;
    const isExecReady = execHint === 'READY_BUY' || execHint === 'READY_SELL';
    const isExecWait  = execHint === 'WAIT';

    const cardBorderClass = isExecReady
        ? 'border-emerald-400/40 dark:border-emerald-500/30 hover:border-emerald-400/60 dark:hover:border-emerald-500/50'
        : isExecWait
        ? 'border-amber-400/30 dark:border-amber-500/20 hover:border-amber-400/50 dark:hover:border-amber-500/35'
        : 'border-gray-200 dark:border-[#1e2430] hover:border-gray-300 dark:hover:border-[#2a3142]';
    const cardGlow = isExecReady
        ? '0 0 0 1px rgba(52,211,153,0.1), 0 2px 12px rgba(52,211,153,0.07)'
        : undefined;

    return (
        <div
            className={`relative bg-white dark:bg-[#0d1117] rounded-2xl overflow-hidden border transition-all duration-300 group shadow-sm dark:shadow-none ${cardBorderClass}`}
            style={{ boxShadow: cardGlow }}
        >
            {/* Direction accent bar — unchanged CALL/PUT color */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />

            {/* Top glow line based on P&L */}
            <div className="h-px w-full" style={{ background: pnlPositive ? 'linear-gradient(90deg,transparent,rgba(0,217,126,0.3),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,71,87,0.2),transparent)' }} />

            <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">

                {/* ── Row 1: Symbol + Badges + P&L ── */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight leading-none">{position.symbol}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${isCall ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                            {position.option_type?.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${position.tier?.includes('+') ? 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600/40' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600/60'}`}>
                            {position.tier}
                        </span>
                        <LifecycleBadge gateReason={position.gate_reason} />
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
                            {position.gates_passed || '0/6'} ✅
                        </span>
                        {position.consensus_vote && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30">
                                {position.consensus_vote}
                            </span>
                        )}
                    </div>
                    {/* P&L — prominent top right */}
                    <div className="flex-shrink-0 text-right">
                        <span className={`block text-xl font-black font-mono tabular-nums leading-tight ${pnlPositive ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                        {position.pnl_dollars != null && position.pnl_dollars !== 0 && (
                            <span className={`block text-[11px] font-bold font-mono ${position.pnl_dollars >= 0 ? 'text-[#00d97e]/60' : 'text-[#ff4757]/60'}`}>
                                {position.pnl_dollars >= 0 ? '+' : ''}{fmt(position.pnl_dollars)}
                            </span>
                        )}
                        <span className="block text-[9px] text-slate-600 font-mono font-bold mt-0.5">{timeSince(position.opened_at)}</span>
                    </div>
                </div>

                {/* ── Row 2: Leg Badge ── */}
                <TargetLegBadge position={position} />

                {/* ── Row 3: Signal Badge + Execution Hint ── */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isCall
                        ? (isStrong ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/40' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800/30')
                        : (isStrong ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/40' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/30')}`}>
                        {isStrong ? '🔥' : '✅'} {rec} (LOCKED)
                    </div>
                    <ExecutionHintBadge position={position} />
                </div>

                {/* ── Row 3: Price Trio ── */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-100 dark:bg-[#111620] rounded-xl p-2.5 border border-gray-200 dark:border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">🔒 Entry</span>
                        <span className="block text-sm font-black font-mono text-amber-600 dark:text-amber-300">{fmt(position.entry_price)}</span>
                    </div>
                    <div className={`rounded-xl p-2.5 border ${profitable ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-950/15 border-red-200 dark:border-red-900/20'}`}>
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">📍 Current</span>
                        <span className={`block text-sm font-black font-mono ${profitable ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(position.current_price)}</span>
                        <span className={`block text-[8px] font-mono font-bold ${profitable ? 'text-[#00d97e]/60' : 'text-[#ff4757]/60'}`}>{profitable ? '▲' : '▼'} {Math.abs(pnl).toFixed(2)}%</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-[#111620] rounded-xl p-2.5 border border-gray-200 dark:border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">
                            {(position.target_stage ?? 1) === 2 ? '🏁 T2 Final' : '🎯 Target T1'}
                        </span>
                        <span className="block text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{fmt(position.target_price)}</span>
                    </div>
                </div>

                {/* ── Row 4: SL + Profit Zone + R:R ── */}
                <div className="flex items-center justify-between text-[10px] px-0.5 gap-2">
                    {(position.target_stage ?? 1) === 2 ? (
                        <div className="flex flex-col">
                            <span className="text-slate-500 font-bold">🛡️ SL @ BE <span className="text-amber-400 font-mono font-bold">{fmt(position.stop_loss)}</span></span>
                            {position.original_stop_loss != null && (
                                <span className="text-[8px] text-slate-500 font-mono ml-4">moved from {fmt(position.original_stop_loss)}</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-500 font-bold">⛔ SL <span className="text-red-400 font-mono font-bold">{fmt(position.stop_loss)}</span></span>
                    )}
                    {(position.profit_zone_low || position.profit_zone_high) && (
                        <span className="text-slate-500 font-bold">💰 <span className="text-emerald-400 font-mono font-bold">{fmt(position.profit_zone_low)}–{fmt(position.profit_zone_high)}</span></span>
                    )}
                    <span className="text-slate-500 font-bold">R:R <span className="text-slate-900 dark:text-white font-mono font-bold">{position.risk_reward_ratio || '—'}</span></span>
                </div>

                {/* ── Row 5: Progress Bar ── */}
                <IronGateProgressBar position={position} />



                {/* ── Row 8: Monitor Footer ── */}
                <div className="flex items-center justify-between text-[9px] text-slate-600 font-bold pt-2 border-t border-gray-200 dark:border-[#1a1f2e]">
                    <span className="text-slate-700 font-bold">{formatOpenedAt(position.opened_at)}</span>
                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                        <span>⟳ {timeSince(position.last_checked_at)}</span>
                        <span className="text-slate-800">·</span>
                        <span>{position.check_count || 0} checks</span>
                        <span className="text-slate-800">·</span>
                        <span>{durationSince(position.opened_at)}</span>
                    </div>
                </div>

                {/* ── Row 9: Actions ── */}
                <div className="flex items-center gap-2 pt-0.5">
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => onManualClose(position)}
                            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-[#1a1f2e] border border-gray-300 dark:border-[#252c3b] text-slate-500 dark:text-slate-400 text-[10px] font-bold hover:text-red-500 dark:hover:text-white hover:border-red-300 dark:hover:border-slate-500 transition-all flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">close</span>
                            Close
                        </button>
                        <button
                            onClick={() => onExecute?.({
                                id: position.id,
                                symbol: position.symbol,
                                current_price: position.current_price,
                                option_type: position.option_type?.toUpperCase() as 'CALL' | 'PUT',
                                tier: position.tier as 'A+' | 'A' | 'B+' | 'NO_TRADE',
                                trading_recommendation: position.trading_recommendation || '',
                                gates_passed: position.gates_passed || '',
                                adx_value: position.adx_value || 0,
                                adx_trend: 'MODERATE',
                                fib_target1: position.fib_target1 || position.target_price || 0,
                                fib_target2: position.fib_target2 || 0,
                                fib_stop_loss: position.stop_loss || 0,
                                risk_reward_ratio: position.risk_reward_ratio || '',
                                analyzed_at: position.opened_at || '',
                                signal_source: 'iron_gate',
                                signal_position_id: position.id,
                                entry_price: position.entry_price,
                                target_price: position.target_price,
                                stop_loss: position.stop_loss,
                                profit_zone_low: position.profit_zone_low,
                                profit_zone_high: position.profit_zone_high,
                                signal_text: position.signal || '',
                                opened_at: position.opened_at,
                            })}
                            title={isExecWait ? `Wait — 5m or 15m ST not aligned, but you can still execute` : undefined}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5
                                ${isExecReady
                                    ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-400/70 hover:shadow-emerald-500/20 hover:shadow-md'
                                    : isExecWait
                                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/18 hover:border-amber-400/50'
                                    : isCall
                                    ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                    : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'
                                }`}
                        >
                            {isExecReady ? '⚡' : isExecWait ? '⏸' : '⚡'} Execute {position.option_type?.toUpperCase()}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ──────────────────────────────────────

const ManualCloseModal: React.FC<{
    position: IronGatePosition | null;
    onClose: () => void;
    onConfirm: (p: IronGatePosition) => void;
    closing: boolean;
}> = ({ position, onClose, onConfirm, closing }) => {
    if (!position) return null;
    const pnl = calcPnl(position);
    const isCall = position.option_type?.toUpperCase() === 'CALL';
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-[#0d1117] border border-[#ff4757]/30 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()} style={{ animation: 'igSlideUp 0.2s ease' }}>
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${isCall ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                                    {position.option_type?.toUpperCase()}
                                </span>
                                <span className="text-[10px] font-black text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/30 px-2 py-0.5 rounded">{position.tier}</span>
                            </div>
                            <span className={`text-lg font-black font-mono ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                                <span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Entry</span>
                                <span className="text-amber-600 dark:text-amber-300 font-mono font-bold">{fmt(position.entry_price)}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Current</span>
                                <span className={`font-mono font-bold ${isProfitable(position) ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(position.current_price)}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">P&L</span>
                                <span className={`font-mono font-bold ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 flex items-start gap-2.5">
                        <span className="text-lg shrink-0">⚠️</span>
                        <p className="text-amber-700 dark:text-amber-200/80 text-xs leading-relaxed">This will manually close the position and record it in trade history. This action cannot be undone.</p>
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
            <style>{`@keyframes igSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
};

// ─── SKELETON ─────────────────────────────────────────────────

const PositionSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430] p-5 space-y-3 animate-pulse">
        <div className="flex justify-between"><div className="flex gap-2"><div className="h-6 w-16 bg-gray-200 dark:bg-[#1e2430] rounded" /><div className="h-5 w-12 bg-gray-200 dark:bg-[#1e2430] rounded" /></div><div className="h-6 w-14 bg-gray-200 dark:bg-[#1e2430] rounded" /></div>
        <div className="h-5 w-36 bg-gray-200 dark:bg-[#1e2430] rounded-full" />
        <div className="grid grid-cols-3 gap-2"><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /><div className="h-14 bg-gray-100 dark:bg-[#111620] rounded-xl" /></div>
        <div className="h-5 bg-gray-200 dark:bg-[#1e2430] rounded-full" />
        <div className="h-10 bg-gray-100 dark:bg-[#111620] rounded-lg" />
    </div>
);

// ─── LIFECYCLE BADGE ─────────────────────────────────────────

const parseLC = (gateReason: string | null | undefined): string | null => {
    if (!gateReason) return null;
    const m = gateReason.match(/LC:([A-Z_]+)\s*$/);
    return m ? m[1] : null;
};

const LifecycleBadge: React.FC<{ gateReason?: string | null }> = ({ gateReason }) => {
    const stage = parseLC(gateReason);
    if (!stage) return <span className="text-slate-500 dark:text-slate-600 text-[9px] font-bold">—</span>;
    const isGreen = stage === 'BUY_ZONE' || stage === 'BREAKOUT';
    const isRed   = stage === 'SUPPORT_BROKEN' || stage === 'BREAKDOWN';
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${
            isGreen ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30'
            : isRed ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/20'
            : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600/60'
        }`}>
            {stage.replace(/_/g, ' ')}
        </span>
    );
};

// ─── WIN TYPE PILL ────────────────────────────────────────────

const WinTypePill: React.FC<{ exitReason?: string | null; result?: string }> = ({ exitReason, result }) => {
    const r = (exitReason || '').toUpperCase();
    if (r === 'TARGET_HIT' || r === 'TARGET_HIT_T2')
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black border text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30">WIN</span>;
    if (r === 'BREAKEVEN_AFTER_T1')
        return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black border text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/30">🛡️ BE WIN</span>;
    if (r === 'STOP_LOSS' || r === 'ST_1H_FLIP')
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black border text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30">LOSS</span>;
    const isWin = result === 'WIN';
    return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{result || '—'}</span>;
};

// ─── HISTORY SUMMARY ─────────────────────────────────────────

const HistorySummaryStats: React.FC<{ history: IronGateHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;
    const wins = history.filter(h => h.result === 'WIN');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
    const best = history.reduce((b, h) => (h.pnl_pct || 0) > (b.pnl_pct || 0) ? h : b, history[0]);
    const worst = history.reduce((w, h) => (h.pnl_pct || 0) < (w.pnl_pct || 0) ? h : w, history[0]);
    const avgDur = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;
    const t1Banked = history.filter(h => {
        const r = (h.exit_reason || '').toUpperCase();
        return r === 'BREAKEVEN_AFTER_T1' || r === 'TARGET_HIT_T2';
    }).length;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
            {[
                { label: 'Total Trades', value: String(history.length), color: 'text-slate-900 dark:text-white' },
                { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
                { label: 'T1 Banked', value: `${t1Banked}`, color: 'text-teal-600 dark:text-teal-400' },
                { label: 'Best Trade', value: `${best.symbol} +${(best.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#00d97e]' },
                { label: 'Worst Trade', value: `${worst.symbol} ${(worst.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#ff4757]' },
                { label: 'Avg Duration', value: formatDuration(avgDur), color: 'text-slate-900 dark:text-white' },
                { label: 'Wins / Losses', value: `${wins.length}W / ${history.length - wins.length}L`, color: 'text-amber-600 dark:text-amber-400' },
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

// ─── IRON GATE SCAN SCHEDULE ─────────────────────────────────
const IRON_GATE_WEBHOOK = 'https://prabhupadala01.app.n8n.cloud/webhook/irongate-swingtrade1';
const IRON_GATE_SCAN_TIMES = ['08:31', '08:45', '09:00', '09:10', '09:20', '09:35', '09:50', '10:15', '10:45', '12:10', '13:30', '14:15', '14:50'];

const getCSTHHMM = () => {
    const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    return cst.toTimeString().slice(0, 5);
};

const isCSTWeekday = () => {
    const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const day = cst.getDay();
    return day !== 0 && day !== 6;
};

const IronGateTracker: React.FC<{ onExecute?: (signal: OptionSignal) => void; role?: string }> = ({ onExecute, role }) => {
    const [config, setConfig] = useState<StrategyConfig | null>(null);
    const [positions, setPositions] = useState<IronGatePosition[]>([]);
    const [history, setHistory] = useState<IronGateHistory[]>([]);
    const [skips, setSkips] = useState<AutoTradeSkip[]>([]);
    const [skipsError, setSkipsError] = useState<string | null>(null);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingSkips, setLoadingSkips] = useState(true);
    const [closingPosition, setClosingPosition] = useState<IronGatePosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [activeSection, setActiveSection] = useState<'positions' | 'history' | 'vetoed'>('positions');
    const [signalFilter, setSignalFilter] = useState<string | null>(null);
    const [executionFilter, setExecutionFilter] = useState<'READY' | 'WAIT' | null>(null);
    const [todayOnly, setTodayOnly] = useState(false);
    const [historyTodayOnly, setHistoryTodayOnly] = useState(false);
    const [historyDateFrom, setHistoryDateFrom] = useState<string>('');
    const [historyDateTo, setHistoryDateTo] = useState<string>('');
    const [versionFilter, setVersionFilter] = useState<string>('all');
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'triggering' | 'ok' | 'err'>('idle');
    const [lastTriggeredTime, setLastTriggeredTime] = useState<string | null>(null);
    const [firedTimes, setFiredTimes] = useState<Set<string>>(new Set());

    const triggerWebhook = async (reason: string, scheduledTime?: string) => {
        console.log(`[IronGate] Triggering webhook: ${reason}`);
        setWebhookStatus('triggering');
        try {
            await fetch(IRON_GATE_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ triggered_by: 'manual' }),
            });
            const fired = scheduledTime || getCSTHHMM();
            setWebhookStatus('ok');
            setLastTriggeredTime(fired);
            setFiredTimes(prev => new Set(prev).add(fired));
            console.log(`[IronGate] Webhook triggered OK at ${fired} CST`);
            setTimeout(() => setWebhookStatus('idle'), 4000);
        } catch (err) {
            console.error('[IronGate] Webhook trigger failed:', err);
            setWebhookStatus('err');
            setTimeout(() => setWebhookStatus('idle'), 4000);
        }
    };

    // Sync firedTimes UI state with the global scheduler in App.tsx
    // Updates scan time badge colors every 30s based on elapsed times
    useEffect(() => {
        const sync = () => {
            const hhmm = getCSTHHMM();
            setFiredTimes(new Set(IRON_GATE_SCAN_TIMES.filter(t => t < hhmm)));
        };
        sync();
        const i = setInterval(sync, 30000);
        const midnight = setInterval(() => {
            if (getCSTHHMM() === '00:00') setFiredTimes(new Set());
        }, 60000);
        return () => { clearInterval(i); clearInterval(midnight); };
    }, []);

    const fetchConfig = async () => {
        const { data } = await supabase.from('strategy_configs').select('*').eq('strategy', 'iron_gate').limit(1).single();
        if (data) setConfig(data);
    };

    const fetchPositions = async () => {
        const { data, error } = await supabase.from('iron_gate_positions').select('*').eq('status', 'OPEN').order('opened_at', { ascending: false });
        console.log('[IronGate] fetchPositions:', { count: data?.length, error, data });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    };

    const fetchHistory = async () => {
        const { data, error } = await supabase.from('iron_gate_history').select('*').order('closed_at', { ascending: false }).limit(500);
        console.log('[IronGate] fetchHistory:', { count: data?.length, error });
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    };

    const fetchSkips = async () => {
        const { data, error } = await supabase
            .from('auto_trade_skips')
            .select('*')
            .eq('skip_reason', 'lifecycle_gate')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) { setSkipsError(error.message); setLoadingSkips(false); return; }
        setSkips(data || []);
        setSkipsError(null);
        setLoadingSkips(false);
    };

    useEffect(() => { fetchConfig(); fetchPositions(); fetchHistory(); fetchSkips(); }, []);
    useEffect(() => { const i = setInterval(fetchPositions, 30000); return () => clearInterval(i); }, []);
    useEffect(() => {
        fetchSkips();
        // Try realtime subscription; fall back to 60s polling
        const channel = supabase
            .channel('auto_trade_skips_lc')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auto_trade_skips' }, () => fetchSkips())
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // realtime not available — polling handles it
                }
            });
        const pollInterval = setInterval(fetchSkips, 60000);
        return () => { supabase.removeChannel(channel); clearInterval(pollInterval); };
    }, []);

    // Auto-disable TODAY filter if no positions were opened today
    useEffect(() => {
        if (positions.length > 0) {
            const todayStr = new Date().toDateString();
            const hasToday = positions.some(p => new Date(p.opened_at).toDateString() === todayStr);
            if (!hasToday) setTodayOnly(false);
        }
    }, [positions]);

    const handleManualClose = async (position: IronGatePosition) => {
        setIsClosing(true);
        try {
            const pnlDollars = position.option_type === 'CALL'
                ? (position.current_price - position.entry_price)
                : (position.entry_price - position.current_price);
            const pnlPct = +((pnlDollars / position.entry_price) * 100).toFixed(2);

            // DB trigger handles iron_gate_history insert automatically
            const { error } = await supabase
                .from('iron_gate_positions')
                .update({
                    status: 'MANUAL_CLOSE',
                    close_reason: 'MANUAL',
                    closed_at: new Date().toISOString(),
                    pnl_dollars: +pnlDollars.toFixed(2),
                    pnl_pct: pnlPct,
                })
                .eq('id', position.id)
                .eq('status', 'OPEN');

            if (error) {
                console.error('[IronGate] Close failed:', error);
            }

            await Promise.all([fetchPositions(), fetchHistory()]);
        } catch (err) {
            console.error('[IronGate] Close position failed:', err);
        } finally {
            setClosingPosition(null);
            setIsClosing(false);
        }
    };



    const scanTimes = config?.params?.scan_times || [];

    // Live stats for header
    const totalPnl = positions.reduce((a, p) => a + calcPnl(p), 0) / Math.max(positions.length, 1);
    const profitCount = positions.filter(p => isProfitable(p)).length;
    const filters = [
        { label: 'STRONG BUY', icon: '🔥', test: (p: IronGatePosition) => p.option_type?.toUpperCase() === 'CALL' && p.tier === 'A+', color: 'text-[#00d97e]', ring: 'ring-[#00d97e]', bg: 'bg-[#00d97e]/5 border-[#00d97e]/20', activeBg: 'bg-[#00d97e]/15 border-[#00d97e]/40' },
        { label: 'BUY', icon: '✅', test: (p: IronGatePosition) => p.option_type?.toUpperCase() === 'CALL' && p.tier === 'A', color: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/20', activeBg: 'bg-emerald-100 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700/40' },
        { label: 'STRONG SELL', icon: '🔥', test: (p: IronGatePosition) => p.option_type?.toUpperCase() === 'PUT' && p.tier === 'A+', color: 'text-[#ff4757]', ring: 'ring-[#ff4757]', bg: 'bg-[#ff4757]/5 border-[#ff4757]/20', activeBg: 'bg-[#ff4757]/15 border-[#ff4757]/40' },
        { label: 'SELL', icon: '✅', test: (p: IronGatePosition) => p.option_type?.toUpperCase() === 'PUT' && p.tier === 'A', color: 'text-red-600 dark:text-red-400', ring: 'ring-red-500', bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/20', activeBg: 'bg-red-100 dark:bg-red-900/25 border-red-300 dark:border-red-700/40' },
    ];

    const todayStr = new Date().toDateString();

    // Base set used for ALL chip counts — must match the version filter applied in filteredPositions
    // so that badge numbers equal the row count when that chip is the only active filter.
    const versionBase = positions.filter(p =>
        versionFilter === 'all' || !versionFilter || !p.version || p.version === versionFilter
    );

    const filteredPositions = positions.filter(p => {
        if (todayOnly && new Date(p.opened_at).toDateString() !== todayStr) return false;
        if (signalFilter && !filters.find(f => f.label === signalFilter)?.test(p)) return false;
        if (executionFilter === 'READY' && p.execution_hint !== 'READY_BUY' && p.execution_hint !== 'READY_SELL') return false;
        if (executionFilter === 'WAIT'  && p.execution_hint !== 'WAIT') return false;
        if (versionFilter !== 'all' && versionFilter && p.version && p.version !== versionFilter) return false;
        return true;
    });
    const todayCount = versionBase.filter(p => new Date(p.opened_at).toDateString() === todayStr).length;
    const cstToday = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    const isSkipToday = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) === cstToday;
    const todaySkips = skips.filter(s => isSkipToday(s.created_at));
    const skipsTodayCount = todaySkips.length;

    const readyCount = versionBase.filter(p => p.execution_hint === 'READY_BUY' || p.execution_hint === 'READY_SELL').length;
    const waitCount  = versionBase.filter(p => p.execution_hint === 'WAIT').length;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080b10] min-h-screen text-slate-900 dark:text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">

                {/* ── HEADER ── */}
                <div className="relative bg-white dark:bg-gradient-to-br dark:from-[#0d1117] dark:to-[#0a0e16] rounded-2xl border border-gray-200 dark:border-[#1e2430] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-900/5 via-transparent to-transparent pointer-events-none" />
                    <div className="relative p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/30 flex items-center justify-center text-2xl shrink-0">🔒</div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white">{config?.display_name || 'Iron Gate Tracker'}</h1>
                                    {config?.is_active ? (
                                        <span className="flex items-center gap-1 text-[9px] font-bold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/25 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />ACTIVE
                                        </span>
                                    ) : config ? (
                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 px-2 py-0.5 rounded-full">INACTIVE</span>
                                    ) : null}
                                </div>
                                <p className="text-slate-500 text-xs font-medium mt-0.5">Automated swing trade tracking · A+/A tier locked positions</p>
                            </div>
                        </div>

                        {/* Live position stats */}
                        {positions.length > 0 && (
                            <div className="flex items-center gap-3 flex-wrap">
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
                                {config?.params && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {config.params.min_gates && <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold">Gates ≥{config.params.min_gates}</span>}
                                        {config.params.min_tier && <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 text-amber-600 dark:text-amber-400 text-[9px] font-bold">Tier ≥{config.params.min_tier}</span>}
                                        {config.params.monitor_interval && <span className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 text-purple-600 dark:text-purple-400 text-[9px] font-bold">⟳ {config.params.monitor_interval}</span>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="px-5 pb-4 flex items-center gap-2 flex-wrap border-t border-gray-200 dark:border-[#1a1f2e] pt-3">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Scan Times (CST):</span>
                        {IRON_GATE_SCAN_TIMES.map((t, i) => {
                            const hhmm = getCSTHHMM();
                            const nextScan = IRON_GATE_SCAN_TIMES.find(st => st > hhmm);
                            const isFired = firedTimes.has(t);
                            const isPast = t < hhmm && !isFired;
                            return (
                                <span key={i} className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-colors ${isFired
                                    ? 'bg-[#00d97e]/10 border-[#00d97e]/40 text-[#00d97e]'
                                    : t === nextScan
                                        ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-700/40 text-amber-600 dark:text-amber-400'
                                        : isPast
                                            ? 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-300 dark:text-slate-600'
                                            : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400'
                                    }`}>{t}</span>
                            );
                        })}
                        <div className="ml-auto flex items-center gap-2">
                            {lastTriggeredTime && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">last: {lastTriggeredTime}</span>
                            )}
                            <button
                                onClick={() => triggerWebhook('manual')}
                                disabled={webhookStatus === 'triggering' || !isCSTWeekday()}
                                title={!isCSTWeekday() ? 'Only available on weekdays (CST)' : 'Trigger scan now'}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${webhookStatus === 'ok'
                                    ? 'bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e]'
                                    : webhookStatus === 'err'
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                        : isCSTWeekday()
                                            ? 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:text-amber-400 hover:border-amber-700/40'
                                            : 'bg-slate-50 dark:bg-[#0d1117] border-gray-100 dark:border-[#1a1f2e] text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-sm ${webhookStatus === 'triggering' ? 'animate-spin' : ''}`}>
                                    {webhookStatus === 'ok' ? 'check_circle' : webhookStatus === 'err' ? 'error' : 'play_arrow'}
                                </span>
                                {webhookStatus === 'ok' ? 'Triggered!' : webhookStatus === 'err' ? 'Failed' : webhookStatus === 'triggering' ? 'Triggering...' : 'Scan Now'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── SECTION TOGGLE ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-[#1e2430] p-1 gap-1">
                        {[
                            { id: 'positions', label: `Positions (${versionBase.length})`, icon: 'radar', color: 'bg-blue-600 shadow-blue-600/25', badge: null },
                            { id: 'history',   label: `History (${history.length})`,   icon: 'history', color: 'bg-violet-600 shadow-violet-600/25', badge: null },
                            { id: 'vetoed',    label: 'Vetoed',                        icon: 'block', color: 'bg-rose-600 shadow-rose-600/25', badge: skipsTodayCount },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveSection(tab.id as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeSection === tab.id ? `${tab.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
                                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                {tab.label}
                                {tab.badge != null && tab.badge > 0 && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeSection === tab.id ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── OPEN POSITIONS ── */}
                {activeSection === 'positions' && (
                    <div className="space-y-4">
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4].map(i => <PositionSkeleton key={i} />)}
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/15 border border-amber-300 dark:border-amber-800/20 flex items-center justify-center text-3xl mx-auto mb-4">🔒</div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Iron Gate is Watching</h3>
                                <p className="text-slate-600 text-sm max-w-sm mx-auto mb-5">Waiting for A+ or A tier signals to lock. Qualifying positions will appear here with live tracking.</p>
                                {scanTimes.length > 0 && (
                                    <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-700">
                                        <span className="font-bold">Next scans:</span>
                                        {scanTimes.map((t: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-[#111620] rounded border border-gray-200 dark:border-[#1e2430] font-mono text-slate-500">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Filter chips */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Filter:</span>

                                    {/* TODAY chip — clears signal/execution filters when activated */}
                                    <button
                                        onClick={() => { setTodayOnly(v => { if (!v) { setSignalFilter(null); setExecutionFilter(null); } return !v; }); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${todayOnly
                                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                            : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:opacity-80'
                                        }`}
                                    >
                                        <span>📅</span>
                                        <span className="uppercase tracking-wide">Today</span>
                                        <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{todayCount}</span>
                                    </button>

                                    <span className="text-slate-700 dark:text-slate-600 text-[10px] select-none">|</span>

                                    {/* Tier / signal filters — clicking any clears TODAY */}
                                    {filters.map(f => {
                                        const count = versionBase.filter(f.test).length;
                                        const isActive = signalFilter === f.label;
                                        return (
                                            <button key={f.label} onClick={() => { if (count === 0) return; setTodayOnly(false); setSignalFilter(isActive ? null : f.label); }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${f.color} ${isActive ? `${f.activeBg} ${f.ring} ring-1` : f.bg} ${count === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}>
                                                <span>{f.icon}</span>
                                                <span className="uppercase tracking-wide">{f.label}</span>
                                                <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Divider */}
                                    <span className="text-slate-700 dark:text-slate-600 text-[10px] select-none">|</span>

                                    {/* READY chip */}
                                    <button
                                        onClick={() => { setTodayOnly(false); setExecutionFilter(executionFilter === 'READY' ? null : 'READY'); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all
                                            text-emerald-600 dark:text-emerald-400
                                            ${executionFilter === 'READY'
                                                ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600/60 ring-1 ring-emerald-400'
                                                : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/20'
                                            }
                                            ${readyCount === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
                                        style={executionFilter === 'READY' ? { boxShadow: '0 0 8px rgba(52,211,153,0.2)' } : undefined}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="uppercase tracking-wide">Ready</span>
                                        <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{readyCount}</span>
                                    </button>

                                    {/* WAIT chip */}
                                    <button
                                        onClick={() => { setTodayOnly(false); setExecutionFilter(executionFilter === 'WAIT' ? null : 'WAIT'); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all
                                            text-amber-600 dark:text-amber-400
                                            ${executionFilter === 'WAIT'
                                                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600/60 ring-1 ring-amber-400'
                                                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/20'
                                            }
                                            ${waitCount === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span className="uppercase tracking-wide">Wait</span>
                                        <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{waitCount}</span>
                                    </button>

                                    {/* Clear all */}
                                    {(signalFilter || executionFilter) && (
                                        <button
                                            onClick={() => { setSignalFilter(null); setExecutionFilter(null); }}
                                            className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold underline transition-colors"
                                        >
                                            clear filters
                                        </button>
                                    )}

                                    <span className="ml-auto text-[9px] text-slate-700 font-bold">
                                        {filteredPositions.length} of {positions.length} shown
                                    </span>
                                </div>

                                {/* Position grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredPositions.map(p => (
                                        <PositionCard key={p.id} position={p} onManualClose={setClosingPosition} onExecute={onExecute} />
                                    ))}
                                </div>

                                {filteredPositions.length === 0 && signalFilter && (
                                    <div className="text-center py-12 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                        <p className="text-slate-500 text-sm">No <span className="text-slate-900 dark:text-white font-bold">{signalFilter}</span> positions open</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── TRADE HISTORY ── */}
                {activeSection === 'history' && (
                    <div>
                        {loadingHistory ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => <div key={i} className="h-11 bg-white dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-[#1e2430] animate-pulse" />)}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                <div className="text-5xl mb-4">📊</div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No Trade History</h3>
                                <p className="text-slate-600 text-sm">Closed positions will appear here.</p>
                            </div>
                        ) : (() => {
                            const todayStr = new Date().toDateString();
                            const todayCount = history.filter(h => new Date(h.closed_at).toDateString() === todayStr).length;

                            // Preset helpers
                            const setPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
                                const now = new Date();
                                if (preset === 'today') {
                                    const d = now.toISOString().slice(0, 10);
                                    setHistoryDateFrom(d); setHistoryDateTo(d); setHistoryTodayOnly(true);
                                } else if (preset === 'week') {
                                    const from = new Date(now); from.setDate(now.getDate() - 6);
                                    setHistoryDateFrom(from.toISOString().slice(0, 10)); setHistoryDateTo(now.toISOString().slice(0, 10)); setHistoryTodayOnly(false);
                                } else if (preset === 'month') {
                                    const from = new Date(now); from.setDate(now.getDate() - 29);
                                    setHistoryDateFrom(from.toISOString().slice(0, 10)); setHistoryDateTo(now.toISOString().slice(0, 10)); setHistoryTodayOnly(false);
                                } else {
                                    setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryTodayOnly(false);
                                }
                            };

                            const filteredHistory = (() => {
                                let base = history;
                                if (versionFilter !== 'all' && versionFilter) {
                                    base = base.filter(h => h.version === versionFilter || (!h.version && versionFilter === 'v1.7'));
                                }
                                if (historyTodayOnly) return base.filter(h => new Date(h.closed_at).toDateString() === todayStr);
                                if (!historyDateFrom && !historyDateTo) return base;
                                return base.filter(h => {
                                    const d = h.closed_at ? h.closed_at.slice(0, 10) : '';
                                    if (historyDateFrom && d < historyDateFrom) return false;
                                    if (historyDateTo && d > historyDateTo) return false;
                                    return true;
                                });
                            })();

                            const activePreset = historyTodayOnly ? 'today'
                                : !historyDateFrom && !historyDateTo ? 'all'
                                : null; // custom range

                            return (
                            <>
                                {/* History filter bar */}
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Filter:</span>

                                    {/* Preset chips */}
                                    {[
                                        { id: 'today', label: 'Today', count: todayCount },
                                        { id: 'week',  label: 'This Week', count: null },
                                        { id: 'month', label: '30 Days', count: null },
                                        { id: 'all',   label: 'All', count: history.length },
                                    ].map(p => (
                                        <button key={p.id}
                                            onClick={() => setPreset(p.id as any)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${activePreset === p.id
                                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                                : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:opacity-80'
                                            }`}
                                        >
                                            <span className="uppercase tracking-wide">{p.label}</span>
                                            {p.count != null && <span className="font-black bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{p.count}</span>}
                                        </button>
                                    ))}

                                    <span className="text-slate-700 dark:text-slate-600 text-[10px] select-none">|</span>

                                    {/* Custom date range inputs */}
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="date"
                                            value={historyDateFrom}
                                            onChange={e => { setHistoryDateFrom(e.target.value); setHistoryTodayOnly(false); }}
                                            className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-white dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                        <span className="text-[10px] text-slate-500">–</span>
                                        <input
                                            type="date"
                                            value={historyDateTo}
                                            onChange={e => { setHistoryDateTo(e.target.value); setHistoryTodayOnly(false); }}
                                            className="px-2 py-1 rounded-lg border text-[10px] font-mono bg-white dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                        {(historyDateFrom || historyDateTo) && !historyTodayOnly && (
                                            <button
                                                onClick={() => setPreset('all')}
                                                className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold underline transition-colors"
                                            >
                                                clear
                                            </button>
                                        )}
                                    </div>

                                    {/* Version filter */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Version:</span>
                                        <select
                                            value={versionFilter}
                                            onChange={e => setVersionFilter(e.target.value)}
                                            className="px-2 py-1 rounded-lg border text-[10px] font-mono font-bold bg-white dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        >
                                            <option value="all">All</option>
                                            <option value="v1.7">v1.7</option>
                                            <option value="v1.8">v1.8</option>
                                        </select>
                                    </div>

                                    <span className="ml-auto text-[9px] text-slate-600 font-bold">{filteredHistory.length} of {history.length} shown</span>

                                    {role === 'admin' && (
                                        <button
                                            onClick={() => {
                                                const headers = ['Symbol','Type','Tier','Entry','Exit','P&L%','P&L$','Result','Duration','Exit Reason','Date'];
                                                const rows = filteredHistory.map(h => [
                                                    h.symbol,
                                                    h.option_type?.toUpperCase() ?? '',
                                                    h.tier,
                                                    h.entry_price,
                                                    h.exit_price,
                                                    `${(h.pnl_pct || 0).toFixed(2)}%`,
                                                    h.pnl_dollars,
                                                    h.result,
                                                    formatDuration(h.duration_minutes),
                                                    h.exit_reason ?? '',
                                                    h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
                                                ]);
                                                const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                                                const blob = new Blob([csv], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `iron-gate-history-${new Date().toISOString().slice(0,10)}.csv`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-400 dark:border-blue-600/60 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
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
                                                    {['Symbol', 'Type', 'Tier', 'Stage', 'Entry', 'Exit', 'P&L%', 'P&L$', 'Result', 'Duration', 'Exit Reason', 'Date'].map(col => (
                                                        <th key={col} className="px-4 py-3 text-left text-[9px] font-bold text-slate-600 uppercase tracking-wider">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredHistory.map(h => {
                                                    const isWin = h.result === 'WIN';
                                                    const pnlColor = isWin ? 'text-[#00d97e]' : 'text-[#ff4757]';
                                                    return (
                                                        <tr key={h.id} className={`border-b border-gray-100 dark:border-[#111620] transition-colors hover:bg-gray-100 dark:hover:bg-[#111620] ${isWin ? 'bg-[#00d97e]/[0.02]' : 'bg-[#ff4757]/[0.02]'}`}>
                                                            <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{h.symbol}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${h.option_type?.toUpperCase() === 'CALL' ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                                                                    {h.option_type?.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-bold">{h.tier}</td>
                                                            <td className="px-4 py-3"><LifecycleBadge gateReason={h.gate_reason} /></td>
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono font-bold">{fmt(h.entry_price)}</td>
                                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono font-bold">{fmt(h.exit_price)}</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${pnlColor}`}>{(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${pnlColor}`}>{fmt(h.pnl_dollars)}</td>
                                                            <td className="px-4 py-3"><WinTypePill exitReason={h.exit_reason} result={h.result} /></td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono font-bold">{formatDuration(h.duration_minutes)}</td>
                                                            <td className="px-4 py-3"><CloseReasonBadge reason={h.exit_reason} /></td>
                                                            <td className="px-4 py-3 text-slate-600 font-mono">{h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
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

                {/* ── VETOED ── */}
                {activeSection === 'vetoed' && (() => {
                    // Dedup today's vetoes: group by symbol+option_type, keep latest, count repeats
                    const dedupMap = new Map<string, { skip: AutoTradeSkip; count: number }>();
                    for (const s of todaySkips) {
                        const key = `${s.symbol}|${s.option_type ?? ''}`;
                        if (!dedupMap.has(key)) {
                            dedupMap.set(key, { skip: s, count: 1 });
                        } else {
                            dedupMap.get(key)!.count++;
                        }
                    }
                    const dedupedSkips = Array.from(dedupMap.values()).sort(
                        (a, b) => new Date(b.skip.created_at).getTime() - new Date(a.skip.created_at).getTime()
                    );
                    const toCST = (iso: string) => new Date(iso).toLocaleTimeString('en-US', {
                        timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                    const stageBlock = (detail: string | null) => {
                        if (!detail) return '—';
                        return detail.split('|')[0].trim();
                    };
                    return (
                        <div>
                            {loadingSkips ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-11 bg-white dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-[#1e2430] animate-pulse" />)}
                                </div>
                            ) : skipsError ? (
                                <div className="text-center py-24 bg-red-950/20 rounded-2xl border border-red-800/30">
                                    <div className="text-4xl mb-4">⚠️</div>
                                    <h3 className="text-base font-black text-red-400 uppercase tracking-tight mb-2">Failed to load vetoes</h3>
                                    <p className="text-red-400/70 text-sm font-mono max-w-md mx-auto">{skipsError}</p>
                                    <button onClick={fetchSkips} className="mt-4 px-4 py-2 bg-red-900/30 border border-red-700/40 text-red-400 text-xs font-bold rounded-lg hover:bg-red-900/50 transition-colors">Retry</button>
                                </div>
                            ) : dedupedSkips.length === 0 ? (
                                <div className="text-center py-24 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430]">
                                    <div className="text-4xl mb-4">🛡️</div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No lifecycle vetoes yet today</h3>
                                    <p className="text-slate-600 text-sm">Signals blocked by the lifecycle gate will appear here.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                            Lifecycle gate vetoes · today (CST)
                                        </span>
                                        <span className="ml-auto text-[9px] text-slate-600 font-bold">
                                            {dedupedSkips.length} unique · {skipsTodayCount} total events
                                        </span>
                                    </div>
                                    <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-gray-200 dark:border-[#1e2430] overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-gray-100 dark:border-[#1e2430] bg-gray-100 dark:bg-[#080b10]">
                                                        {['Symbol', 'Type', 'Tier', 'Stage Blocked', 'Time (CST)'].map(col => (
                                                            <th key={col} className="px-4 py-3 text-left text-[9px] font-bold text-slate-600 uppercase tracking-wider">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dedupedSkips.map(({ skip: s, count }) => (
                                                        <tr key={s.id} className="border-b border-gray-100 dark:border-[#111620] hover:bg-gray-50 dark:hover:bg-[#111620] transition-colors">
                                                            <td className="px-4 py-3 font-black text-slate-900 dark:text-white font-mono">
                                                                {s.symbol}
                                                                {count > 1 && <span className="ml-1.5 text-[9px] font-bold text-rose-400 bg-rose-900/20 px-1.5 py-0.5 rounded-full">×{count}</span>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {s.option_type ? (
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.option_type.toUpperCase() === 'CALL' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30' : 'text-red-400 bg-red-900/20 border-red-700/30'}`}>
                                                                        {s.option_type.toUpperCase()}
                                                                    </span>
                                                                ) : <span className="text-slate-500">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {s.tier ? (
                                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">{s.tier}</span>
                                                                ) : <span className="text-slate-500">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-400 font-mono text-[10px] max-w-xs break-words leading-relaxed">{stageBlock(s.detail)}</td>
                                                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">{toCST(s.created_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()}
            </div>

            <ManualCloseModal position={closingPosition} onClose={() => setClosingPosition(null)} onConfirm={handleManualClose} closing={isClosing} />
        </div>
    );
};

export default IronGateTracker;
