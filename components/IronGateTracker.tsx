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
    // Frozen fields
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
    // ADX numeric columns
    adx_value: number;
    adx_trend: string;
    plus_di: number;
    minus_di: number;
    // VWAP numeric columns
    vwap_value: number;
    vwap_trend: string;
    vwap_position: string;
    vwap_distance: number;
    // SMA numeric columns
    sma20: number;
    sma50: number;
    sma_spread: number;
    // SuperTrend columns
    st_1h_direction: string;
    st_1h_value: number;
    st_15m_direction: string;
    st_15m_value: number;
    st_5m_direction: string;
    st_5m_value: number;
    // Gate text details
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
    // Live fields
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
    const rh = h % 24;
    return `${d}d ${rh}h`;
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
    const ms = Date.now() - new Date(dateStr).getTime();
    return formatDuration(Math.floor(ms / 60000));
};

const formatOpenedAt = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} ${timePart} (${timeSince(dateStr)})`;
};

// Check if a gate string contains a checkmark
const gateIsPassed = (g: string | null | undefined): boolean => {
    if (!g) return false;
    return g.includes('✓') || g.includes('✅') || g.includes('PASS');
};

// Calculate live P&L based on direction
const calcPnl = (pos: IronGatePosition): number => {
    if (pos.pnl_pct != null && pos.pnl_pct !== 0) return pos.pnl_pct;
    if (!pos.entry_price || !pos.current_price) return 0;
    const isCall = pos.option_type?.toUpperCase() === 'CALL';
    if (isCall) return ((pos.current_price - pos.entry_price) / pos.entry_price) * 100;
    return ((pos.entry_price - pos.current_price) / pos.entry_price) * 100;
};

// Is the current price moving favorably?
const isProfitable = (pos: IronGatePosition): boolean => {
    const isCall = pos.option_type?.toUpperCase() === 'CALL';
    return isCall ? pos.current_price > pos.entry_price : pos.current_price < pos.entry_price;
};

// ADX color based on value
const adxColor = (v: number | null | undefined): string => {
    if (!v) return 'text-red-400';
    if (v >= 25) return 'text-green-400';
    if (v >= 20) return 'text-yellow-400';
    return 'text-red-400';
};

// Direction color helper
const dirColor = (d: string | null | undefined): string => {
    const u = (d || '').toUpperCase();
    if (u === 'BULLISH' || u === 'RISING' || u === 'ABOVE') return 'text-green-400';
    if (u === 'BEARISH' || u === 'FALLING' || u === 'BELOW') return 'text-red-400';
    return 'text-gray-400';
};

// ─── PROGRESS BAR COMPONENT ─────────────────────────────────

const IronGateProgressBar: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const { entry_price, target_price, stop_loss, progress_pct, high_water_mark, low_water_mark } = position;
    const pct = Math.max(-5, Math.min(105, progress_pct || 0));
    const hwm = Math.max(0, Math.min(100, high_water_mark || 0));
    const lwm = Math.max(0, Math.min(100, low_water_mark || 0));

    // Calculate entry position on bar (where entry falls between SL and target)
    const range = Math.abs(target_price - stop_loss);
    const entryPct = range > 0 ? (Math.abs(entry_price - stop_loss) / range) * 100 : 50;

    return (
        <div className="space-y-2">
            {/* Bar container */}
            <div className="relative h-8 rounded-lg overflow-visible bg-[#1e2430] border border-[#30363d]">
                {/* Gradient fill */}
                <div
                    className="absolute top-0 bottom-0 left-0 rounded-l-lg transition-all duration-700 ease-out"
                    style={{
                        width: `${Math.max(0, Math.min(100, pct))}%`,
                        background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 25%, #ffd32a 45%, #7bed9f 70%, #00d97e 100%)',
                        borderRadius: pct >= 100 ? '0.5rem' : '0.5rem 0 0 0.5rem',
                    }}
                />

                {/* Entry price marker (dashed line) */}
                <div
                    className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${entryPct}%`, borderLeft: '2px dashed rgba(255, 211, 42, 0.6)' }}
                />
                <div
                    className="absolute -top-1 w-3 h-3 bg-[#ffd32a] rounded-full border-2 border-[#1e2430] z-10"
                    style={{ left: `calc(${entryPct}% - 6px)` }}
                />

                {/* High water mark triangle ▲ */}
                {hwm > 0 && (
                    <div className="absolute -top-3 z-10 text-[9px] text-green-400 font-black"
                        style={{ left: `calc(${hwm}% - 4px)` }} title={`HWM: ${hwm.toFixed(1)}%`}>▲</div>
                )}

                {/* Low water mark triangle ▼ */}
                {lwm > 0 && lwm < 100 && (
                    <div className="absolute -bottom-3 z-10 text-[9px] text-red-400 font-black"
                        style={{ left: `calc(${lwm}% - 4px)` }} title={`LWM: ${lwm.toFixed(1)}%`}>▼</div>
                )}

                {/* Current position indicator (white line) */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 transition-all duration-700 ease-out"
                    style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
                />

                {/* % label overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-30">
                    <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                        {pct.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Labels below bar */}
            <div className="flex justify-between items-center text-[10px] font-bold px-0.5">
                <span className="text-red-400">🛑 SL {fmt(stop_loss)}</span>
                <span className="text-yellow-400">🔒 Entry {fmt(entry_price)}</span>
                <span className="text-green-400">🎯 Target {fmt(target_price)}</span>
            </div>
        </div>
    );
};

// ─── GATE DETAILS COMPONENT ─────────────────────────────────

const GATE_INFO = [
    { key: 'g1_sma', label: 'G1 SMA' },
    { key: 'g2_1h', label: 'G2 1H' },
    { key: 'g3_15m', label: 'G3 15M' },
    { key: 'g4_5m', label: 'G4 5M' },
    { key: 'g5_vwap', label: 'G5 VWAP' },
    { key: 'g6_adx', label: 'G6 ADX' },
];

const GateDetails: React.FC<{ position: IronGatePosition }> = ({ position }) => (
    <div className="mt-3 pt-3 border-t border-[#30363d] space-y-1.5">
        {GATE_INFO.map(({ key, label }) => {
            const value = (position as any)[key] as string || '—';
            const passed = gateIsPassed(value);
            return (
                <div key={key} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border ${passed
                    ? 'bg-green-950/20 border-green-800/40 text-green-300'
                    : 'bg-red-950/15 border-red-800/30 text-red-300/70'}`}>
                    <span className="flex-shrink-0 mt-0.5">{passed ? '✅' : '❌'}</span>
                    <span className="font-bold text-gray-400 flex-shrink-0 w-16">{label}:</span>
                    <span className="break-all">{value}</span>
                </div>
            );
        })}
    </div>
);

// ─── INDICATOR PANELS ───────────────────────────────────────

const IndicatorPanels: React.FC<{ p: IronGatePosition }> = ({ p }) => (
    <div className="grid grid-cols-3 gap-2">
        {/* ADX Panel */}
        <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#21262d] text-center">
            <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">ADX</span>
            <span className={`block text-lg font-black font-mono ${adxColor(p.adx_value)}`}>
                {(p.adx_value || 0).toFixed(1)}
            </span>
            <span className={`text-[9px] font-bold uppercase ${adxColor(p.adx_value)}`}>
                {p.adx_trend || '—'}
            </span>
            <div className="mt-1 flex justify-center gap-2 text-[9px] font-mono text-gray-500">
                <span>+DI:<span className="text-green-400 font-bold">{(p.plus_di || 0).toFixed(1)}</span></span>
                <span>-DI:<span className="text-red-400 font-bold">{(p.minus_di || 0).toFixed(1)}</span></span>
            </div>
        </div>

        {/* VWAP Panel */}
        <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#21262d] text-center">
            <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">VWAP</span>
            <span className="block text-sm font-black font-mono text-white">
                {p.vwap_value ? fmt(p.vwap_value) : '—'}
            </span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className={`text-[9px] font-bold uppercase ${dirColor(p.vwap_trend)}`}>
                    {p.vwap_trend || '—'}
                </span>
                <span className="text-gray-600">|</span>
                <span className={`text-[9px] font-bold uppercase ${dirColor(p.vwap_position)}`}>
                    {p.vwap_position || '—'}
                </span>
            </div>
            {p.vwap_distance != null && (
                <span className={`text-[9px] font-mono font-bold ${p.vwap_distance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.vwap_distance >= 0 ? '+' : ''}{p.vwap_distance.toFixed(1)}%
                </span>
            )}
        </div>

        {/* SMA Panel */}
        <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#21262d] text-center">
            <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">SMA</span>
            <div className="flex justify-center gap-2 text-[10px] font-mono">
                <span className="text-gray-400">20:<span className="text-white font-bold">{p.sma20 ? p.sma20.toFixed(1) : '—'}</span></span>
                <span className="text-gray-400">50:<span className="text-white font-bold">{p.sma50 ? p.sma50.toFixed(1) : '—'}</span></span>
            </div>
            <div className={`mt-1 text-[9px] font-bold uppercase ${dirColor(p.sma_direction)}`}>
                {p.sma_direction || '—'}
            </div>
            {p.sma_spread != null && (
                <span className={`text-[9px] font-mono font-bold ${p.sma_spread >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Spread: {p.sma_spread >= 0 ? '+' : ''}{p.sma_spread.toFixed(1)}%
                </span>
            )}
        </div>
    </div>
);

// ─── SUPERTREND ROW ─────────────────────────────────────────

const SuperTrendRow: React.FC<{ p: IronGatePosition }> = ({ p }) => {
    const items = [
        { label: '1H', dir: p.st_1h_direction, val: p.st_1h_value },
        { label: '15M', dir: p.st_15m_direction, val: p.st_15m_value },
        { label: '5M', dir: p.st_5m_direction, val: p.st_5m_value },
    ];
    const hasAny = items.some(i => i.dir || i.val);
    if (!hasAny) return null;

    return (
        <div className="flex gap-2">
            {items.map(({ label, dir, val }) => (
                <div key={label} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold ${(dir || '').toUpperCase() === 'BULLISH'
                    ? 'bg-green-950/20 border-green-800/40 text-green-400'
                    : (dir || '').toUpperCase() === 'BEARISH'
                        ? 'bg-red-950/15 border-red-800/30 text-red-400'
                        : 'bg-[#21262d] border-[#30363d] text-gray-500'
                    }`}>
                    <span className="uppercase">ST {label}</span>
                    <span className={`${dirColor(dir)}`}>{dir ? (dir === 'BULLISH' ? '▲' : '▼') : '—'}</span>
                    {val ? <span className="font-mono text-gray-300">{val.toFixed(1)}</span> : null}
                </div>
            ))}
        </div>
    );
};

// ─── POSITION CARD COMPONENT ────────────────────────────────

const PositionCard: React.FC<{
    position: IronGatePosition;
    onManualClose: (p: IronGatePosition) => void;
    onExecute?: (signal: OptionSignal) => void;
}> = ({ position, onManualClose, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const isCall = position.option_type?.toUpperCase() === 'CALL';
    const pnl = calcPnl(position);
    const profitable = isProfitable(position);
    const tierColor = position.tier?.includes('+')
        ? 'text-amber-400 bg-amber-950/40 border-amber-600'
        : position.tier === 'A'
            ? 'text-gray-200 bg-gray-800/80 border-gray-600'
            : 'text-gray-500 bg-gray-900 border-gray-700';

    // Signal badge — derive from trading_recommendation, fallback to tier + option_type
    // Never show "WEAK SIGNAL" — Iron Gate only locks A+ and A signals
    let rec = position.trading_recommendation;
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        if (position.tier === 'A+') rec = isCall ? 'STRONG BUY' : 'STRONG SELL';
        else if (position.tier === 'A') rec = isCall ? 'BUY' : 'SELL';
        else rec = isCall ? 'BUY' : 'SELL';
    }
    const isStrong = rec.includes('STRONG');
    const signalBadge = {
        text: `${isStrong ? '🔥' : '✅'} ${rec} (LOCKED)`,
        color: !isCall
            ? (isStrong ? 'bg-red-900/30 border-red-600/50 text-red-400' : 'bg-red-900/20 border-red-700/40 text-red-400')
            : (isStrong ? 'bg-green-900/30 border-green-600/50 text-green-400' : 'bg-green-900/20 border-green-700/40 text-green-400'),
    };

    return (
        <div className="bg-[#161b22] rounded-xl border border-[#30363d] hover:border-[#484f58] transition-all overflow-hidden">
            <div className="p-5 space-y-4">

                {/* ── Header Row ── */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-2xl font-black text-white tracking-tight">{position.symbol}</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${isCall
                            ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40'
                            : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                            {position.option_type?.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${tierColor}`}>
                            {position.tier}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-800/40">
                            {position.gates_passed || '0/6'} GATES ✅
                        </span>
                        {position.consensus_vote && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-purple-400 bg-purple-900/20 border border-purple-800/40">
                                {position.consensus_vote}
                            </span>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-gray-500 block">{formatOpenedAt(position.opened_at)}</span>
                        {position.version && (
                            <span className="text-[9px] text-gray-600 font-mono block">v{position.version.replace('v', '')}</span>
                        )}
                    </div>
                </div>

                {/* ── Signal Badge ── */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${signalBadge.color}`}>
                    {signalBadge.text}
                </div>

                {/* ── Price Levels Section ── */}
                <div className="bg-[#0d1117] rounded-xl p-4 border border-[#21262d] space-y-2">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-bold">🔒 ENTRY (Locked)</span>
                            <span className="font-mono font-black text-yellow-400">{fmt(position.entry_price)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-bold">📍 CURRENT</span>
                            <span className={`font-mono font-black ${profitable ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                {fmt(position.current_price)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-bold">🎯 TARGET</span>
                            <span className="font-mono font-black text-green-400">{fmt(position.target_price)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-bold">🛑 STOP LOSS</span>
                            <span className="font-mono font-black text-red-400">{fmt(position.stop_loss)}</span>
                        </div>
                        {(position.profit_zone_low || position.profit_zone_high) && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-bold">💰 PROFIT ZONE</span>
                                <span className="font-mono font-bold text-emerald-400">
                                    {fmt(position.profit_zone_low)} → {fmt(position.profit_zone_high)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 font-bold">📊 R:R</span>
                            <span className="font-mono font-bold text-white">{position.risk_reward_ratio || '—'}</span>
                        </div>
                    </div>

                    {/* Live P&L */}
                    <div className="mt-3 pt-3 border-t border-[#21262d] flex justify-between items-center">
                        <span className="text-gray-500 text-xs font-bold">P&L</span>
                        <div className="flex items-center gap-3">
                            <span className={`text-lg font-black font-mono ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                            </span>
                            {position.pnl_dollars != null && position.pnl_dollars !== 0 && (
                                <span className={`text-sm font-bold font-mono ${position.pnl_dollars >= 0 ? 'text-[#00d97e]/70' : 'text-[#ff4757]/70'}`}>
                                    {position.pnl_dollars >= 0 ? '+' : ''}{fmt(position.pnl_dollars)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Progress Bar ── */}
                <IronGateProgressBar position={position} />

                {/* ── Indicator Panels (ADX, VWAP, SMA) ── */}
                <IndicatorPanels p={position} />

                {/* ── SuperTrend Row ── */}
                <SuperTrendRow p={position} />

                {/* ── Monitor Status Footer ── */}
                <div className="bg-[#0d1117] rounded-lg p-3 border border-[#21262d]">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] text-gray-500 font-bold">
                        <span>Last checked: <span className="text-gray-300">{timeSince(position.last_checked_at)}</span></span>
                        <span>Checks: <span className="text-gray-300 font-mono">{position.check_count || 0}</span></span>
                        <span>Duration: <span className="text-gray-300">{durationSince(position.opened_at)}</span></span>
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] font-bold">
                        <span className="text-green-400">HWM: {(position.high_water_mark || 0).toFixed(1)}% ▲</span>
                        <span className="text-red-400">LWM: {(position.low_water_mark || 0).toFixed(1)}% ▼</span>
                    </div>
                </div>

                {/* ── Actions Row ── */}
                <div className="flex items-center gap-2 pt-1">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gate Details ({position.gates_passed || '0/6'})
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => onManualClose(position)}
                            className="px-3 py-1.5 rounded-lg bg-[#21262d] border border-[#30363d] text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:bg-[#30363d] hover:text-white transition-all flex items-center gap-1"
                        >
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
                                // Iron Gate linkage
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
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${isCall
                                ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'}`}
                        >
                            ⚡ EXECUTE {position.option_type?.toUpperCase()}
                        </button>
                    </div>
                </div>

                {/* ── Gate Details (Expandable) ── */}
                {expanded && <GateDetails position={position} />}
            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ─────────────────────────────────────

const ManualCloseModal: React.FC<{
    position: IronGatePosition | null;
    onClose: () => void;
    onConfirm: (p: IronGatePosition) => void;
    closing: boolean;
}> = ({ position, onClose, onConfirm, closing }) => {
    if (!position) return null;
    const pnl = calcPnl(position);
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'igSlideUp 0.25s ease' }}>
                <div className="p-4 border-b border-[#ff4757]/20 bg-[#ff4757]/5 flex justify-between items-center">
                    <h2 className="text-sm font-black uppercase tracking-tight text-[#ff4757] flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        Manual Close Position
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-[#0d1117] rounded-xl p-4 border border-[#21262d]">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xl font-black text-white">{position.symbol}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${position.option_type?.toUpperCase() === 'CALL'
                                ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40'
                                : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                                {position.option_type?.toUpperCase()}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">Entry</span>
                                <span className="text-yellow-400 font-mono font-bold">{fmt(position.entry_price)}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">Current</span>
                                <span className={`font-mono font-bold ${isProfitable(position) ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                    {fmt(position.current_price)}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">P&L</span>
                                <span className={`font-mono font-bold ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <p className="text-amber-200 text-xs leading-relaxed">
                            This will manually close the position and record it in trade history. This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 border border-[#30363d] text-gray-400 font-bold rounded-xl hover:bg-[#21262d] transition-colors text-xs uppercase tracking-wide">
                            Cancel
                        </button>
                        <button onClick={() => onConfirm(position)} disabled={closing}
                            className="flex-[2] py-3 bg-[#ff4757] hover:bg-[#ff4757]/80 text-white font-black rounded-xl transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                            {closing
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Closing...</>
                                : <><span className="material-symbols-outlined text-sm">close</span> Confirm Close</>}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes igSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
};

// ─── SKELETON LOADER ─────────────────────────────────────────

const PositionSkeleton: React.FC = () => (
    <div className="bg-[#161b22] rounded-xl border border-[#30363d] p-5 space-y-4 animate-pulse">
        <div className="flex justify-between">
            <div className="flex gap-2"><div className="h-7 w-20 bg-[#21262d] rounded" /><div className="h-5 w-14 bg-[#21262d] rounded" /></div>
            <div className="h-4 w-16 bg-[#21262d] rounded" />
        </div>
        <div className="h-5 w-40 bg-[#21262d] rounded-full" />
        <div className="h-24 bg-[#0d1117] rounded-xl border border-[#21262d]" />
        <div className="h-8 bg-[#21262d] rounded-lg" />
        <div className="h-16 bg-[#0d1117] rounded-lg border border-[#21262d]" />
    </div>
);

// ─── HISTORY SUMMARY STATS ──────────────────────────────────

const HistorySummaryStats: React.FC<{ history: IronGateHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;
    const wins = history.filter(h => h.result === 'WIN');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
    const bestTrade = history.reduce((best, h) => (h.pnl_pct || 0) > (best.pnl_pct || 0) ? h : best, history[0]);
    const worstTrade = history.reduce((worst, h) => (h.pnl_pct || 0) < (worst.pnl_pct || 0) ? h : worst, history[0]);
    const avgDuration = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;
    const avgHWM = wins.length > 0 ? wins.reduce((a, h) => a + (h.high_water_mark || 0), 0) / wins.length : 0;

    const stats = [
        { label: 'Total Trades', value: String(history.length), color: 'text-white' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Best Trade', value: `${bestTrade.symbol} +${(bestTrade.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#00d97e]' },
        { label: 'Worst Trade', value: `${worstTrade.symbol} ${(worstTrade.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#ff4757]' },
        { label: 'Avg Duration', value: formatDuration(avgDuration), color: 'text-white' },
        { label: 'Avg HWM', value: `${avgHWM.toFixed(1)}%`, color: 'text-amber-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map(s => (
                <div key={s.label} className="bg-[#161b22] rounded-xl border border-[#30363d] p-3 text-center">
                    <span className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">{s.label}</span>
                    <span className={`block text-sm font-black font-mono ${s.color}`}>{s.value}</span>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const IronGateTracker: React.FC<{ onExecute?: (signal: OptionSignal) => void }> = ({ onExecute }) => {
    const [config, setConfig] = useState<StrategyConfig | null>(null);
    const [positions, setPositions] = useState<IronGatePosition[]>([]);
    const [history, setHistory] = useState<IronGateHistory[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [closingPosition, setClosingPosition] = useState<IronGatePosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [activeSection, setActiveSection] = useState<'positions' | 'history'>('positions');

    // ─── Data Fetching ────────────────────────────────────

    const fetchConfig = async () => {
        const { data, error } = await supabase
            .from('strategy_configs')
            .select('*')
            .eq('strategy', 'iron_gate')
            .limit(1)
            .single();
        console.log('[IronGate] fetchConfig:', { data, error });
        if (data) setConfig(data);
    };

    const fetchPositions = async () => {
        const { data, error } = await supabase
            .from('iron_gate_positions')
            .select('*')
            .eq('status', 'OPEN')
            .order('opened_at', { ascending: false });
        console.log('[IronGate] fetchPositions:', { count: data?.length, error });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    };

    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('iron_gate_history')
            .select('*')
            .order('closed_at', { ascending: false })
            .limit(50);
        console.log('[IronGate] fetchHistory:', { count: data?.length, error });
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    };

    useEffect(() => {
        fetchConfig();
        fetchPositions();
        fetchHistory();
    }, []);

    // Poll every 30s
    useEffect(() => {
        const interval = setInterval(fetchPositions, 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── Manual Close ─────────────────────────────────────

    const handleManualClose = async (position: IronGatePosition) => {
        setIsClosing(true);
        try {
            const pnl = calcPnl(position);
            const durationMs = Date.now() - new Date(position.opened_at).getTime();
            const durationMinutes = Math.floor(durationMs / 60000);

            await supabase
                .from('iron_gate_positions')
                .update({
                    status: 'MANUAL_CLOSE',
                    closed_at: new Date().toISOString(),
                    close_reason: 'MANUAL',
                    pnl_pct: pnl,
                })
                .eq('id', position.id);

            await supabase
                .from('iron_gate_history')
                .insert({
                    position_id: position.id,
                    symbol: position.symbol,
                    option_type: position.option_type,
                    tier: position.tier,
                    entry_price: position.entry_price,
                    exit_price: position.current_price,
                    pnl_pct: pnl,
                    pnl_dollars: position.pnl_dollars || 0,
                    result: pnl >= 0 ? 'WIN' : 'LOSS',
                    exit_reason: 'MANUAL',
                    duration_minutes: durationMinutes,
                    high_water_mark: position.high_water_mark,
                    low_water_mark: position.low_water_mark,
                    opened_at: position.opened_at,
                    closed_at: new Date().toISOString(),
                    gates_passed: position.gates_passed,
                });

            await Promise.all([fetchPositions(), fetchHistory()]);
            setClosingPosition(null);
        } catch (err) {
            console.error('Manual close failed:', err);
        } finally {
            setIsClosing(false);
        }
    };

    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════

    const scanTimes = config?.params?.scan_times || [];

    return (
        <div className="flex-1 overflow-y-auto bg-[#0d1117] min-h-screen text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">

                {/* ── Section 1: Strategy Header ── */}
                <div className="bg-gradient-to-r from-[#161b22] to-[#1c2333] rounded-2xl border border-[#30363d] overflow-hidden">
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-amber-900/20 border border-amber-700/40 flex items-center justify-center text-3xl">
                                    🔒
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                                        {config?.display_name || 'Iron Gate Tracker'}
                                        {config?.is_active ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/30 px-2.5 py-1 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-[#00d97e] animate-pulse" />
                                                ACTIVE
                                            </span>
                                        ) : config ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-gray-500" />
                                                INACTIVE
                                            </span>
                                        ) : null}
                                    </h1>
                                    <p className="text-gray-500 text-sm font-medium mt-1">
                                        Automated position tracking for A+/A tier signals
                                    </p>
                                </div>
                            </div>
                            {config?.params && (
                                <div className="flex flex-wrap gap-2">
                                    {config.params.min_gates && (
                                        <span className="px-3 py-1.5 rounded-lg bg-blue-900/20 border border-blue-800/40 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                            Min Gates: {config.params.min_gates}
                                        </span>
                                    )}
                                    {config.params.min_tier && (
                                        <span className="px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-800/40 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                            Min Tier: {config.params.min_tier}
                                        </span>
                                    )}
                                    {config.params.monitor_interval && (
                                        <span className="px-3 py-1.5 rounded-lg bg-purple-900/20 border border-purple-800/40 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                                            Monitor: {config.params.monitor_interval}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {scanTimes.length > 0 && (
                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scan Times:</span>
                                {scanTimes.map((t: string, i: number) => (
                                    <span key={i} className="px-2 py-1 rounded-md bg-[#21262d] border border-[#30363d] text-gray-300 text-[10px] font-mono font-bold">{t}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Section Toggle ── */}
                <div className="flex bg-[#161b22] rounded-lg border border-[#30363d] p-0.5 w-fit">
                    <button
                        onClick={() => setActiveSection('positions')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'positions'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-500 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-sm">radar</span>
                        Open Positions ({positions.length})
                    </button>
                    <button
                        onClick={() => setActiveSection('history')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'history'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                            : 'text-gray-500 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-sm">history</span>
                        Trade History ({history.length})
                    </button>
                </div>

                {/* ── Section 2: Open Positions ── */}
                {activeSection === 'positions' && (
                    <div>
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {[1, 2, 3, 4].map(i => <PositionSkeleton key={i} />)}
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-20 bg-[#161b22] rounded-2xl border border-[#30363d]">
                                <div className="text-6xl mb-4">🔒</div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                                    Iron Gate is Watching
                                </h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                                    Waiting for A+ or A signals to lock positions. When a qualifying signal is detected, it will appear here with live tracking.
                                </p>
                                {scanTimes.length > 0 && (
                                    <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-gray-600">
                                        <span className="font-bold">Next scans:</span>
                                        {scanTimes.map((t: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-[#21262d] rounded border border-[#30363d] font-mono text-gray-400">{t}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-600">
                                    <div className="w-2 h-2 rounded-full bg-[#00d97e] animate-pulse" />
                                    Auto-polling every 30 seconds
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* ── Signal Summary Counts ── */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {[
                                        {
                                            label: 'STRONG BUY', icon: '🔥',
                                            count: positions.filter(p => p.option_type?.toUpperCase() === 'CALL' && p.tier === 'A+').length,
                                            color: 'text-[#00d97e] border-[#00d97e]/30 bg-[#00d97e]/5',
                                        },
                                        {
                                            label: 'BUY', icon: '✅',
                                            count: positions.filter(p => p.option_type?.toUpperCase() === 'CALL' && p.tier === 'A').length,
                                            color: 'text-green-400 border-green-800/40 bg-green-900/10',
                                        },
                                        {
                                            label: 'STRONG SELL', icon: '🔥',
                                            count: positions.filter(p => p.option_type?.toUpperCase() === 'PUT' && p.tier === 'A+').length,
                                            color: 'text-[#ff4757] border-[#ff4757]/30 bg-[#ff4757]/5',
                                        },
                                        {
                                            label: 'SELL', icon: '✅',
                                            count: positions.filter(p => p.option_type?.toUpperCase() === 'PUT' && p.tier === 'A').length,
                                            color: 'text-red-400 border-red-800/40 bg-red-900/10',
                                        },
                                    ].map(s => (
                                        <div key={s.label} className={`rounded-xl border p-4 flex items-center justify-between ${s.color}`}>
                                            <div>
                                                <span className={`block text-[9px] font-black uppercase tracking-widest mb-1 ${s.color.split(' ')[0]}`}>{s.label}</span>
                                                <span className="block text-3xl font-black text-white">{s.count}</span>
                                            </div>
                                            <span className="text-2xl">{s.icon}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {positions.map(p => (
                                        <PositionCard key={p.id} position={p} onManualClose={setClosingPosition} onExecute={onExecute} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Section 3: Trade History ── */}
                {activeSection === 'history' && (
                    <div>
                        {loadingHistory ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-12 bg-[#161b22] rounded-lg border border-[#30363d] animate-pulse" />
                                ))}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-20 bg-[#161b22] rounded-2xl border border-[#30363d]">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">No Trade History Yet</h3>
                                <p className="text-gray-500 text-sm">Closed positions will appear here with full performance data.</p>
                            </div>
                        ) : (
                            <>
                                <HistorySummaryStats history={history} />
                                <div className="bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[#30363d] bg-[#0d1117]">
                                                    {['Symbol', 'Type', 'Tier', 'Entry', 'Exit', 'P&L%', 'P&L$', 'Result', 'Duration', 'Exit Reason', 'Date'].map(col => (
                                                        <th key={col} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(h => {
                                                    const isWin = h.result === 'WIN';
                                                    return (
                                                        <tr key={h.id} className={`border-b border-[#21262d] ${isWin ? 'bg-[#00d97e]/[0.03]' : 'bg-[#ff4757]/[0.03]'}`}>
                                                            <td className="px-4 py-3 font-black text-white">{h.symbol}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${h.option_type?.toUpperCase() === 'CALL'
                                                                    ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40'
                                                                    : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                                                                    {h.option_type?.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400 font-bold">{h.tier}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.entry_price)}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.exit_price)}</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                                                {(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%
                                                            </td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                                                {fmt(h.pnl_dollars)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin
                                                                    ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40'
                                                                    : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                                                                    {h.result}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400">{formatDuration(h.duration_minutes)}</td>
                                                            <td className="px-4 py-3 text-gray-500 uppercase text-[10px] font-bold">{h.exit_reason}</td>
                                                            <td className="px-4 py-3 text-gray-500 font-mono">
                                                                {h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Manual Close Modal */}
            <ManualCloseModal
                position={closingPosition}
                onClose={() => setClosingPosition(null)}
                onConfirm={handleManualClose}
                closing={isClosing}
            />
        </div>
    );
};

export default IronGateTracker;
