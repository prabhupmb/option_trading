import React, { useState, useEffect } from 'react';
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
    params: {
        min_gates?: number;
        min_tier?: string;
        monitor_interval?: string;
        scan_times?: string[];
        [key: string]: any;
    };
}

interface StockGatePosition {
    id: string;
    symbol: string;
    trade_direction: string; // BUY | SHORT
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

// ─── PROGRESS BAR ────────────────────────────────────────────

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
                <span>SL → Target Progress</span>
                <span className="font-mono" style={{ color: zoneColor }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="relative h-5 rounded-full overflow-visible bg-[#0d1117] border border-[#1e2430]">
                <div className="absolute inset-0 rounded-full opacity-20"
                    style={{ background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 25%, #ffd32a 50%, #7bed9f 75%, #00d97e 100%)' }} />
                <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #ff475720 0%, ${zoneColor}80 100%)`,
                        borderRight: `2px solid ${zoneColor}`,
                    }} />
                <div className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${entryPct}%`, background: 'rgba(255,211,42,0.5)', borderLeft: '1px dashed rgba(255,211,42,0.7)' }} />
                {hwm > 0 && <div className="absolute -top-2.5 text-[8px] text-emerald-400 font-black z-10" style={{ left: `calc(${hwm}% - 3px)` }} title={`HWM ${hwm.toFixed(1)}%`}>▲</div>}
                {lwm > 0 && lwm < 100 && <div className="absolute -bottom-2.5 text-[8px] text-red-400 font-black z-10" style={{ left: `calc(${lwm}% - 3px)` }} title={`LWM ${lwm.toFixed(1)}%`}>▼</div>}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#0d1117] z-20 transition-all duration-700 ease-out shadow-lg"
                    style={{ left: `calc(${pct}% - 6px)`, background: zoneColor, boxShadow: `0 0 8px ${zoneColor}80` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold mt-0.5">
                <span className="text-red-400">⛔ {fmt(stop_loss)}</span>
                <span className="text-yellow-400/70">Entry {fmt(entry_price)}</span>
                <span className="text-emerald-400">🎯 {fmt(target_price)}</span>
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

const GateDetails: React.FC<{ position: StockGatePosition }> = ({ position }) => (
    <div className="pt-3 border-t border-[#1e2430] space-y-1.5">
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Gate Conditions</span>
        {GATE_INFO.map(({ key, label }) => {
            const value = (position as any)[key] as string || '—';
            const passed = gateIsPassed(value);
            return (
                <div key={key} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[10px] font-mono border ${passed ? 'bg-emerald-950/25 border-emerald-800/30 text-emerald-300' : 'bg-red-950/15 border-red-900/20 text-red-400/60'}`}>
                    <span className="flex-shrink-0 text-[11px]">{passed ? '✅' : '❌'}</span>
                    <span className="font-bold text-slate-500 flex-shrink-0 w-14">{label}:</span>
                    <span className="break-all leading-relaxed">{value}</span>
                </div>
            );
        })}
    </div>
);

// ─── POSITION CARD ────────────────────────────────────────────

const GATE_KEYS = ['g1_sma', 'g2_1h', 'g3_15m', 'g4_5m', 'g5_vwap', 'g6_adx'];

const PositionCard: React.FC<{
    position: StockGatePosition;
    onManualClose: (p: StockGatePosition) => void;
    onExecuteStock: (p: StockGatePosition) => void;
}> = ({ position, onManualClose, onExecuteStock }) => {
    const [expanded, setExpanded] = useState(false);
    const isBuy = position.trade_direction?.toUpperCase() === 'BUY';
    const pnl = calcPnl(position);
    const profitable = isProfitable(position);

    let rec = position.trading_recommendation;
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        if (position.tier === 'A+') rec = isBuy ? 'STRONG BUY' : 'STRONG SELL';
        else rec = isBuy ? 'BUY' : 'SELL';
    }
    const isStrong = rec.includes('STRONG');

    const accentColor = isBuy ? '#00d97e' : '#ff4757';
    const pnlPositive = pnl >= 0;

    return (
        <div className="relative bg-[#0d1117] rounded-2xl overflow-hidden border border-[#1e2430] hover:border-[#2a3142] transition-all duration-200 group">
            {/* Direction accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />

            {/* Top glow line based on P&L */}
            <div className="h-px w-full" style={{ background: pnlPositive ? 'linear-gradient(90deg,transparent,rgba(0,217,126,0.3),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,71,87,0.2),transparent)' }} />

            <div className="pl-5 pr-4 pt-4 pb-4 space-y-3">

                {/* ── Row 1: Symbol + Badges + P&L ── */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[22px] font-black text-white tracking-tight leading-none">{position.symbol}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                            {position.trade_direction?.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${position.tier?.includes('+') ? 'text-amber-300 bg-amber-900/30 border-amber-600/40' : 'text-slate-300 bg-slate-800/60 border-slate-600/60'}`}>
                            {position.tier}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800/30">
                            {position.gates_passed || '0/6'} ✅
                        </span>
                        {position.consensus_vote && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-violet-400 bg-violet-900/20 border border-violet-800/30">
                                {position.consensus_vote}
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

                {/* ── Row 2: Signal Badge ── */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isBuy
                    ? (isStrong ? 'text-emerald-300 bg-emerald-950/40 border-emerald-700/40' : 'text-green-400 bg-green-950/30 border-green-800/30')
                    : (isStrong ? 'text-red-300 bg-red-950/40 border-red-700/40' : 'text-red-400 bg-red-950/30 border-red-800/30')}`}>
                    {isStrong ? '🔥' : '✅'} {rec} (LOCKED)
                </div>

                {/* ── Row 3: Price Trio ── */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#111620] rounded-xl p-2.5 border border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">🔒 Entry</span>
                        <span className="block text-sm font-black font-mono text-amber-300">{fmt(position.entry_price)}</span>
                    </div>
                    <div className={`rounded-xl p-2.5 border ${profitable ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/15 border-red-900/20'}`}>
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">📍 Current</span>
                        <span className={`block text-sm font-black font-mono ${profitable ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(position.current_price)}</span>
                        <span className={`block text-[8px] font-mono font-bold ${profitable ? 'text-[#00d97e]/60' : 'text-[#ff4757]/60'}`}>{profitable ? '▲' : '▼'} {Math.abs(pnl).toFixed(2)}%</span>
                    </div>
                    <div className="bg-[#111620] rounded-xl p-2.5 border border-[#1e2430]">
                        <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">🎯 Target</span>
                        <span className="block text-sm font-black font-mono text-emerald-400">{fmt(position.target_price)}</span>
                    </div>
                </div>

                {/* ── Row 4: SL + Profit Zone + R:R ── */}
                <div className="flex items-center justify-between text-[10px] px-0.5">
                    <span className="text-slate-500 font-bold">⛔ SL <span className="text-red-400 font-mono">{fmt(position.stop_loss)}</span></span>
                    {(position.profit_zone_low || position.profit_zone_high) && (
                        <span className="text-slate-500 font-bold">💰 <span className="text-emerald-400 font-mono">{fmt(position.profit_zone_low)}–{fmt(position.profit_zone_high)}</span></span>
                    )}
                    <span className="text-slate-500 font-bold">R:R <span className="text-white font-mono">{position.risk_reward_ratio || '—'}</span></span>
                </div>

                {/* ── Row 5: Progress Bar ── */}
                <StockGateProgressBar position={position} />


                {/* ── Row 8: Monitor Footer ── */}
                <div className="flex items-center justify-between text-[9px] text-slate-600 font-bold pt-2 border-t border-[#1a1f2e]">
                    <span className="text-slate-700">{formatOpenedAt(position.opened_at)}</span>
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>⟳ {timeSince(position.last_checked_at)}</span>
                        <span className="text-slate-800">·</span>
                        <span>{position.check_count || 0} checks</span>
                        <span className="text-slate-800">·</span>
                        <span>{durationSince(position.opened_at)}</span>
                    </div>
                </div>

                {/* ── Row 9: Actions ── */}
                <div className="flex items-center gap-2 pt-0.5">
                    <button onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wide">
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gates ({position.gates_passed || '0/6'})
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => onManualClose(position)}
                            className="px-3 py-1.5 rounded-lg bg-[#1a1f2e] border border-[#252c3b] text-slate-400 text-[10px] font-bold hover:text-white hover:border-slate-500 transition-all flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">close</span>
                            Close
                        </button>
                        <button
                            onClick={() => onExecuteStock(position)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 ${isBuy
                                ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'}`}>
                            ⚡ {isBuy ? 'BUY STOCK' : 'SHORT STOCK'}
                        </button>
                    </div>
                </div>

                {expanded && <GateDetails position={position} />}
            </div>
        </div>
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
                                    {position.trade_direction?.toUpperCase()}
                                </span>
                                <span className="text-[10px] font-black text-amber-300 bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded">{position.tier}</span>
                            </div>
                            <span className={`text-lg font-black font-mono ${pnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                                <span className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Entry</span>
                                <span className="text-amber-300 font-mono font-bold">{fmt(position.entry_price)}</span>
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
                    <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 flex items-start gap-2.5">
                        <span className="text-lg shrink-0">⚠️</span>
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

// ─── SKELETON ─────────────────────────────────────────────────

const PositionSkeleton: React.FC = () => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-5 space-y-3 animate-pulse">
        <div className="flex justify-between"><div className="flex gap-2"><div className="h-6 w-16 bg-[#1e2430] rounded" /><div className="h-5 w-12 bg-[#1e2430] rounded" /></div><div className="h-6 w-14 bg-[#1e2430] rounded" /></div>
        <div className="h-5 w-36 bg-[#1e2430] rounded-full" />
        <div className="grid grid-cols-3 gap-2"><div className="h-14 bg-[#111620] rounded-xl" /><div className="h-14 bg-[#111620] rounded-xl" /><div className="h-14 bg-[#111620] rounded-xl" /></div>
        <div className="h-5 bg-[#1e2430] rounded-full" />
        <div className="h-10 bg-[#111620] rounded-lg" />
    </div>
);

// ─── HISTORY SUMMARY ─────────────────────────────────────────

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
                <div key={s.label} className="bg-[#0d1117] rounded-xl border border-[#1e2430] p-3 text-center">
                    <span className="block text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1">{s.label}</span>
                    <span className={`block text-sm font-black font-mono ${s.color}`}>{s.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── SCAN TIMES (hardcoded) ───────────────────────────────────

const STOCK_SCAN_TIMES = ['08:45', '09:10', '09:40', '10:15', '10:45', '12:10', '13:30', '14:15'];

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
    ai_summary: pos.signal || `${pos.trade_direction?.toUpperCase()} signal — Tier ${pos.tier} · ${pos.gates_passed} gates passed`,
    ai_reasoning: pos.gate_reason || '',
    when_to_buy: `Entry near $${pos.entry_price?.toFixed(2) ?? '—'}`,
    risk_factors: `Stop Loss: $${pos.stop_loss?.toFixed(2) ?? '—'}`,
    analyzed_at: pos.opened_at,
});

const StockGateTracker: React.FC<{ onExecute?: (signal: OptionSignal) => void }> = () => {
    const [config, setConfig] = useState<StrategyConfig | null>(null);
    const [positions, setPositions] = useState<StockGatePosition[]>([]);
    const [history, setHistory] = useState<StockGateHistory[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [closingPosition, setClosingPosition] = useState<StockGatePosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [activeSection, setActiveSection] = useState<'positions' | 'history'>('positions');
    const [signalFilter, setSignalFilter] = useState<string | null>(null);
    const [executingPosition, setExecutingPosition] = useState<StockGatePosition | null>(null);

    const fetchConfig = async () => {
        const { data } = await supabase.from('strategy_configs').select('*').eq('strategy', 'stock_gate').limit(1).single();
        if (data) setConfig(data);
    };

    const fetchPositions = async () => {
        const { data, error } = await supabase.from('stock_gate_positions').select('*').eq('status', 'OPEN').order('opened_at', { ascending: false });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    };

    const fetchHistory = async () => {
        const { data, error } = await supabase.from('stock_gate_history').select('*').order('closed_at', { ascending: false }).limit(50);
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    };

    useEffect(() => { fetchConfig(); fetchPositions(); fetchHistory(); }, []);
    useEffect(() => { const i = setInterval(fetchPositions, 30000); return () => clearInterval(i); }, []);

    const handleManualClose = async (position: StockGatePosition) => {
        setIsClosing(true);
        try {
            const pnl = calcPnl(position);
            const durationMinutes = Math.floor((Date.now() - new Date(position.opened_at).getTime()) / 60000);
            await supabase.from('stock_gate_positions').update({ status: 'MANUAL_CLOSE', closed_at: new Date().toISOString(), close_reason: 'MANUAL', pnl_pct: pnl }).eq('id', position.id);
            await supabase.from('stock_gate_history').insert({
                position_id: position.id, symbol: position.symbol, trade_direction: position.trade_direction, tier: position.tier,
                entry_price: position.entry_price, exit_price: position.current_price, pnl_pct: pnl,
                pnl_dollars: position.pnl_dollars || 0, result: pnl >= 0 ? 'WIN' : 'LOSS', exit_reason: 'MANUAL',
                duration_minutes: durationMinutes, high_water_mark: position.high_water_mark,
                low_water_mark: position.low_water_mark, opened_at: position.opened_at,
                closed_at: new Date().toISOString(), gates_passed: position.gates_passed,
            });
            await Promise.all([fetchPositions(), fetchHistory()]);
            setClosingPosition(null);
        } catch (err) { console.error('Manual close failed:', err); }
        finally { setIsClosing(false); }
    };

    // Live stats
    const totalPnl = positions.reduce((a, p) => a + calcPnl(p), 0) / Math.max(positions.length, 1);
    const profitCount = positions.filter(p => isProfitable(p)).length;
    const dominantTier = positions.filter(p => p.tier === 'A+').length >= positions.length / 2 ? 'A+' : 'A';

    const filters = [
        { label: 'STRONG BUY', icon: '🔥', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'BUY' && p.tier === 'A+', color: 'text-[#00d97e]', ring: 'ring-[#00d97e]', bg: 'bg-[#00d97e]/5 border-[#00d97e]/20', activeBg: 'bg-[#00d97e]/15 border-[#00d97e]/40' },
        { label: 'BUY', icon: '✅', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'BUY' && p.tier === 'A', color: 'text-emerald-400', ring: 'ring-emerald-500', bg: 'bg-emerald-900/10 border-emerald-800/20', activeBg: 'bg-emerald-900/25 border-emerald-700/40' },
        { label: 'STRONG SELL', icon: '🔥', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'SHORT' && p.tier === 'A+', color: 'text-[#ff4757]', ring: 'ring-[#ff4757]', bg: 'bg-[#ff4757]/5 border-[#ff4757]/20', activeBg: 'bg-[#ff4757]/15 border-[#ff4757]/40' },
        { label: 'SELL', icon: '✅', test: (p: StockGatePosition) => p.trade_direction?.toUpperCase() === 'SHORT' && p.tier === 'A', color: 'text-red-400', ring: 'ring-red-500', bg: 'bg-red-900/10 border-red-800/20', activeBg: 'bg-red-900/25 border-red-700/40' },
    ];

    const filteredPositions = signalFilter
        ? positions.filter(p => filters.find(f => f.label === signalFilter)?.test(p))
        : positions;

    return (
        <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">

                {/* ── HEADER ── */}
                <div className="relative bg-gradient-to-br from-[#0d1117] to-[#0a0e16] rounded-2xl border border-[#1e2430] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/5 via-transparent to-transparent pointer-events-none" />
                    <div className="relative p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center text-2xl shrink-0">📈</div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight uppercase text-white">
                                        {config?.display_name || 'Stock Gate Tracker'}
                                    </h1>
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/25 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />ACTIVE
                                    </span>
                                </div>
                                <p className="text-slate-500 text-xs font-medium mt-0.5">Automated stock trade tracking · A+/A tier locked positions</p>
                            </div>
                        </div>

                        {/* Live position stats */}
                        {positions.length > 0 && (
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold">
                                    <span className="text-slate-500">Locked</span>
                                    <span className="text-white font-black text-sm">{positions.length}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold">
                                    <span className="text-slate-500">In Profit</span>
                                    <span className={`font-black text-sm ${profitCount > 0 ? 'text-[#00d97e]' : 'text-slate-400'}`}>{profitCount}/{positions.length}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold">
                                    <span className="text-slate-500">Avg P&L</span>
                                    <span className={`font-black text-sm font-mono ${totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}%</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111620] border border-[#1e2430] text-xs font-bold">
                                    <span className="text-slate-500">Tier</span>
                                    <span className={`font-black text-sm ${dominantTier === 'A+' ? 'text-amber-300' : 'text-slate-300'}`}>{dominantTier}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scan times row */}
                    <div className="px-5 pb-4 flex items-center gap-2 flex-wrap border-t border-[#1a1f2e] pt-3">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Scan Times:</span>
                        {STOCK_SCAN_TIMES.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-[#111620] border border-[#1e2430] text-slate-400 text-[10px] font-mono font-bold">{t}</span>
                        ))}
                        <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-600 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />polling every 30s
                        </span>
                    </div>
                </div>

                {/* ── SECTION TOGGLE ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex bg-[#0d1117] rounded-xl border border-[#1e2430] p-1 gap-1">
                        {[
                            { id: 'positions', label: `Positions (${positions.length})`, icon: 'radar', color: 'bg-blue-600 shadow-blue-600/25' },
                            { id: 'history', label: `History (${history.length})`, icon: 'history', color: 'bg-violet-600 shadow-violet-600/25' },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveSection(tab.id as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeSection === tab.id ? `${tab.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-300'}`}>
                                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── OPEN POSITIONS ── */}
                {activeSection === 'positions' && (
                    <div className="space-y-4">
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => <PositionSkeleton key={i} />)}
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-900/15 border border-emerald-800/20 flex items-center justify-center text-3xl mx-auto mb-4">📈</div>
                                <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">Stock Gate is Watching</h3>
                                <p className="text-slate-600 text-sm max-w-sm mx-auto mb-5">Waiting for A+ or A tier signals to lock. Qualifying positions will appear here with live tracking.</p>
                                <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-700">
                                    <span className="font-bold">Next scans:</span>
                                    {STOCK_SCAN_TIMES.map((t, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-[#111620] rounded border border-[#1e2430] font-mono text-slate-500">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Filter chips */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Filter:</span>
                                    {filters.map(f => {
                                        const count = positions.filter(f.test).length;
                                        const isActive = signalFilter === f.label;
                                        return (
                                            <button key={f.label} onClick={() => setSignalFilter(isActive ? null : f.label)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${f.color} ${isActive ? `${f.activeBg} ${f.ring} ring-1` : f.bg} ${count === 0 ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}>
                                                <span>{f.icon}</span>
                                                <span className="uppercase tracking-wide">{f.label}</span>
                                                <span className="font-black bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                                            </button>
                                        );
                                    })}
                                    {signalFilter && (
                                        <button onClick={() => setSignalFilter(null)} className="text-[10px] text-slate-500 hover:text-white font-bold underline transition-colors">
                                            clear
                                        </button>
                                    )}
                                    <span className="ml-auto text-[9px] text-slate-700 font-bold">
                                        {filteredPositions.length} of {positions.length} shown
                                    </span>
                                </div>

                                {/* Position grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {filteredPositions.map(p => (
                                        <PositionCard key={p.id} position={p} onManualClose={setClosingPosition} onExecuteStock={setExecutingPosition} />
                                    ))}
                                </div>

                                {filteredPositions.length === 0 && signalFilter && (
                                    <div className="text-center py-12 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                        <p className="text-slate-500 text-sm">No <span className="text-white font-bold">{signalFilter}</span> positions open</p>
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
                                {[1, 2, 3].map(i => <div key={i} className="h-11 bg-[#0d1117] rounded-lg border border-[#1e2430] animate-pulse" />)}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-24 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
                                <div className="text-5xl mb-4">📊</div>
                                <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">No Trade History</h3>
                                <p className="text-slate-600 text-sm">Closed positions will appear here.</p>
                            </div>
                        ) : (
                            <>
                                <HistorySummaryStats history={history} />
                                <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[#1e2430] bg-[#080b10]">
                                                    {['Symbol', 'Direction', 'Tier', 'Entry', 'Exit', 'P&L%', 'P&L$', 'Result', 'Duration', 'Exit Reason', 'Date'].map(col => (
                                                        <th key={col} className="px-4 py-3 text-left text-[9px] font-bold text-slate-600 uppercase tracking-wider">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(h => {
                                                    const isWin = h.result === 'WIN';
                                                    const isBuy = h.trade_direction?.toUpperCase() === 'BUY';
                                                    return (
                                                        <tr key={h.id} className={`border-b border-[#111620] transition-colors hover:bg-[#111620] ${isWin ? 'bg-[#00d97e]/[0.02]' : 'bg-[#ff4757]/[0.02]'}`}>
                                                            <td className="px-4 py-3 font-black text-white">{h.symbol}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${isBuy ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>
                                                                    {h.trade_direction?.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-400 font-bold">{h.tier}</td>
                                                            <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.entry_price)}</td>
                                                            <td className="px-4 py-3 text-slate-300 font-mono">{fmt(h.exit_price)}</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(h.pnl_dollars)}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/30' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30'}`}>{h.result}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-400 font-mono">{formatDuration(h.duration_minutes)}</td>
                                                            <td className="px-4 py-3 text-slate-500 uppercase text-[9px] font-bold">{h.exit_reason}</td>
                                                            <td className="px-4 py-3 text-slate-600 font-mono">{h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
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

            {/* ── MANUAL CLOSE MODAL ── */}
            <ManualCloseModal
                position={closingPosition}
                onClose={() => setClosingPosition(null)}
                onConfirm={handleManualClose}
                closing={isClosing}
            />

            {/* ── EXECUTE STOCK TRADE MODAL ── */}
            <ExecuteStockTradeModal
                isOpen={!!executingPosition}
                signal={executingPosition ? positionToSmartSignal(executingPosition) : null}
                onClose={() => setExecutingPosition(null)}
                onSuccess={() => { setExecutingPosition(null); fetchPositions(); }}
            />
        </div>
    );
};

export default StockGateTracker;
