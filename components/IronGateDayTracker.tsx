import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';

// ─── TYPES ────────────────────────────────────────────────────

interface DayStrategyConfig {
    id: string;
    strategy: string;
    display_name: string;
    icon: string;
    is_active: boolean;
    params: { scan_times?: string[];[k: string]: any };
}

interface DayPosition {
    id: string;
    symbol: string;
    action: string; // BUY or SELL
    signal_type: string; // BREAKOUT, MOMENTUM, PULLBACK
    tier: string;
    gate_score: number;
    signal: string;
    trading_recommendation: string;
    entry_price: number;
    target_1: number;
    target_2: number;
    stop_loss: number;
    risk_reward_ratio: number;
    adx_value: number;
    plus_di: number;
    minus_di: number;
    vwap_value: number;
    vwap_position: string;
    supertrend_5m: string;
    atr: number;
    volume_ratio: number;
    gate_1_supertrend: boolean;
    gate_2_vwap: boolean;
    gate_3_adx: boolean;
    gate_4_volume: boolean;
    ai_verdict: string;
    ai_confidence: number;
    ai_entry_hint: string;
    ai_risk_note: string;
    source: string;
    is_trending: boolean;
    percent_change: number;
    opened_at: string;
    // Live fields
    current_price: number;
    progress_pct: number;
    high_water_mark: number;
    low_water_mark: number;
    pnl_pct: number;
    pnl_dollars: number;
    last_checked_at: string;
    check_count: number;
    status: string;
    closed_at: string | null;
    close_reason: string | null;
}

interface DayHistory {
    id: string;
    position_id: string;
    symbol: string;
    action: string;
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
    gate_score: number;
}

// ─── HELPERS ─────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toFixed(2)}` : '—';

const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes) return '—';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
};

const timeSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    return formatDuration(mins) + ' ago';
};

const formatOpenedAt = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} ${timePart} (${timeSince(dateStr)})`;
};

const isStaleSignal = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() !== new Date().toDateString();
};

const calcDayPnl = (pos: DayPosition): { pct: number; dollars: number; isProfit: boolean } => {
    if (pos.pnl_pct != null && pos.pnl_pct !== 0) return { pct: pos.pnl_pct, dollars: pos.pnl_dollars || 0, isProfit: pos.pnl_pct > 0 };
    if (!pos.entry_price || !pos.current_price) return { pct: 0, dollars: 0, isProfit: false };
    const isBuy = pos.action?.toUpperCase() === 'BUY';
    const dollars = isBuy ? pos.current_price - pos.entry_price : pos.entry_price - pos.current_price;
    return { pct: (dollars / pos.entry_price) * 100, dollars, isProfit: dollars > 0 };
};

const adxColor = (v: number): string => v >= 25 ? 'text-green-400' : v >= 20 ? 'text-yellow-400' : 'text-red-400';

// ─── MARKET TIME HELPERS ────────────────────────────────────

const getETNow = (): Date => {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(etStr);
};

const getMarketStatus = (): { label: string; color: string; isOpen: boolean } => {
    const et = getETNow();
    const h = et.getHours();
    const m = et.getMinutes();
    const day = et.getDay();
    if (day === 0 || day === 6) return { label: 'MARKET CLOSED', color: 'text-red-400 bg-red-900/20 border-red-800/40', isOpen: false };
    const mins = h * 60 + m;
    if (mins < 570) return { label: 'PRE-MARKET', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40', isOpen: false }; // before 9:30
    if (mins >= 960) return { label: 'MARKET CLOSED', color: 'text-red-400 bg-red-900/20 border-red-800/40', isOpen: false }; // after 16:00
    return { label: 'MARKET OPEN', color: 'text-green-400 bg-green-900/20 border-green-800/40', isOpen: true };
};

const getEODCountdown = (): { mins: number; label: string; urgency: 'none' | 'gray' | 'amber' | 'red' } => {
    const et = getETNow();
    const eodMinute = 15 * 60 + 50; // 3:50 PM ET
    const nowMinute = et.getHours() * 60 + et.getMinutes();
    const remaining = eodMinute - nowMinute;
    if (remaining <= 0) return { mins: 0, label: 'EOD Close Complete', urgency: 'none' };
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
    if (remaining <= 15) return { mins: remaining, label, urgency: 'red' };
    if (remaining <= 60) return { mins: remaining, label, urgency: 'amber' };
    return { mins: remaining, label, urgency: 'gray' };
};

// ─── EOD COUNTDOWN BANNER ───────────────────────────────────

const EODBanner: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
    const [countdown, setCountdown] = useState(getEODCountdown());
    useEffect(() => {
        const i = setInterval(() => setCountdown(getEODCountdown()), 30000);
        return () => clearInterval(i);
    }, []);
    if (!isOpen || countdown.urgency === 'none') return null;
    const styles = {
        gray: 'bg-gray-100 dark:bg-[#21262d] border-gray-200 dark:border-[#30363d] text-gray-400',
        amber: 'bg-amber-900/20 border-amber-600/40 text-amber-400',
        red: 'bg-red-900/30 border-red-600/50 text-red-400 animate-pulse',
    };
    return (
        <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between text-xs font-bold ${styles[countdown.urgency]}`}>
            <span>{countdown.urgency === 'red' ? '🚨' : countdown.urgency === 'amber' ? '⚠️' : '⏰'} EOD auto-close at 3:50 PM ET</span>
            <span className="font-mono font-black">{countdown.label} remaining</span>
        </div>
    );
};

// ─── PROGRESS BAR ───────────────────────────────────────────

const DayProgressBar: React.FC<{ pos: DayPosition }> = ({ pos }) => {
    const { entry_price, current_price, target_1, stop_loss, progress_pct, high_water_mark, low_water_mark, action } = pos;
    const pct = Math.max(-5, Math.min(105, progress_pct || 0));
    const hwm = Math.max(0, Math.min(100, high_water_mark || 0));
    const lwm = Math.max(0, Math.min(100, low_water_mark || 0));
    const range = Math.abs(target_1 - stop_loss);
    const entryPct = range > 0 ? (Math.abs(entry_price - stop_loss) / range) * 100 : 50;

    return (
        <div className="space-y-2">
            <div className="relative h-8 rounded-lg overflow-visible bg-gray-200 dark:bg-[#1e2430] border border-gray-200 dark:border-[#30363d]">
                <div className="absolute top-0 bottom-0 left-0 rounded-l-lg transition-all duration-700 ease-out"
                    style={{
                        width: `${Math.max(0, Math.min(100, pct))}%`,
                        background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 25%, #ffd32a 45%, #7bed9f 70%, #00d97e 100%)',
                        borderRadius: pct >= 100 ? '0.5rem' : '0.5rem 0 0 0.5rem',
                    }} />
                <div className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${entryPct}%`, borderLeft: '2px dashed rgba(255, 211, 42, 0.6)' }} />
                <div className="absolute -top-1 w-3 h-3 bg-[#ffd32a] rounded-full border-2 border-white dark:border-[#1e2430] z-10"
                    style={{ left: `calc(${entryPct}% - 6px)` }} />
                {hwm > 0 && <div className="absolute -top-3 z-10 text-[9px] text-green-400 font-black" style={{ left: `calc(${hwm}% - 4px)` }}>▲</div>}
                {lwm > 0 && lwm < 100 && <div className="absolute -bottom-3 z-10 text-[9px] text-red-400 font-black" style={{ left: `calc(${lwm}% - 4px)` }}>▼</div>}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 transition-all duration-700 ease-out"
                    style={{ left: `${Math.max(0, Math.min(100, pct))}%` }} />
                <div className="absolute inset-0 flex items-center justify-center z-30">
                    <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{pct.toFixed(1)}%</span>
                </div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold px-0.5">
                <span className="text-red-400">🛑 SL {fmt(stop_loss)}</span>
                <span className="text-yellow-400">🔒 Entry {fmt(entry_price)}</span>
                <span className="text-green-400">🎯 T1 {fmt(target_1)}</span>
            </div>
        </div>
    );
};

// ─── GATE DETAILS (4 BOOLEAN GATES) ─────────────────────────

const DayGateDetails: React.FC<{ pos: DayPosition }> = ({ pos }) => {
    const gates = [
        { label: 'G1 SuperTrend', passed: pos.gate_1_supertrend, detail: `${pos.supertrend_5m || '—'} (5m+15m aligned)` },
        { label: 'G2 VWAP', passed: pos.gate_2_vwap, detail: `${pos.vwap_position || '—'} ${pos.vwap_value ? fmt(pos.vwap_value) : ''}` },
        { label: 'G3 ADX', passed: pos.gate_3_adx, detail: `${(pos.adx_value || 0).toFixed(1)} (+DI:${(pos.plus_di || 0).toFixed(1)} -DI:${(pos.minus_di || 0).toFixed(1)})` },
        { label: 'G4 Volume', passed: pos.gate_4_volume, detail: `${(pos.volume_ratio || 0).toFixed(1)}x avg` },
    ];
    return (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#30363d] space-y-1.5">
            {gates.map(g => (
                <div key={g.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border ${g.passed
                    ? 'bg-green-950/20 border-green-800/40 text-green-300'
                    : 'bg-red-950/15 border-red-800/30 text-red-300/70'}`}>
                    <span>{g.passed ? '✅' : '❌'}</span>
                    <span className="font-bold text-gray-400 w-24">{g.label}:</span>
                    <span>{g.detail}</span>
                </div>
            ))}
        </div>
    );
};

// ─── POSITION CARD ──────────────────────────────────────────

const DayPositionCard: React.FC<{ pos: DayPosition; onClose: (p: DayPosition) => void; onExecute?: (signal: OptionSignal) => void }> = ({ pos, onClose, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const isBuy = pos.action?.toUpperCase() === 'BUY';
    const pnl = calcDayPnl(pos);
    // Never show "WEAK" for Iron Gate Day — override with correct tier label
    let rec = pos.trading_recommendation;
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        if (pos.tier === 'A+') rec = isBuy ? 'STRONG BUY' : 'STRONG SELL';
        else if (pos.tier === 'A') rec = isBuy ? 'BUY' : 'SELL';
        else rec = isBuy ? 'BUY' : 'SELL';
    }
    const isStrong = rec.includes('STRONG');

    const signalTypeColors: Record<string, string> = {
        BREAKOUT: 'text-blue-400 bg-blue-900/20 border-blue-800/40',
        MOMENTUM: 'text-purple-400 bg-purple-900/20 border-purple-800/40',
        PULLBACK: 'text-amber-400 bg-amber-900/20 border-amber-800/40',
    };

    return (
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-[#30363d] hover:border-gray-400 dark:hover:border-[#484f58] transition-all overflow-hidden">
            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{pos.symbol}</span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${isBuy
                            ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40'
                            : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                            {pos.action?.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${pos.tier?.includes('+')
                            ? 'text-amber-400 bg-amber-950/40 border-amber-600'
                            : 'text-gray-200 bg-gray-800/80 border-gray-600'}`}>
                            {pos.tier}
                        </span>
                        {pos.signal_type && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${signalTypeColors[pos.signal_type?.toUpperCase()] || 'text-gray-400 bg-gray-800 border-gray-700'}`}>
                                {pos.signal_type}
                            </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-800/40">
                            {pos.gate_score || 0}/4 GATES ✅
                        </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-gray-500 block">{formatOpenedAt(pos.opened_at)}</span>
                        {isStaleSignal(pos.opened_at) && (
                            <span className="text-[9px] text-amber-400 font-bold block mt-0.5">⚠️ Stale signal (not from today)</span>
                        )}
                    </div>
                </div>

                {/* Signal Badge + AI */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isBuy
                        ? (isStrong ? 'bg-green-900/30 border-green-600/50 text-green-400' : 'bg-green-900/20 border-green-700/40 text-green-400')
                        : (isStrong ? 'bg-red-900/30 border-red-600/50 text-red-400' : 'bg-red-900/20 border-red-700/40 text-red-400')}`}>
                        {isStrong ? '🔥' : '✅'} {rec} (LOCKED)
                    </span>
                    {pos.ai_verdict && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${pos.ai_verdict === 'CONFIRM' ? 'text-green-400 bg-green-900/20 border-green-800/40'
                            : pos.ai_verdict === 'MONITOR' ? 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40'
                                : 'text-red-400 bg-red-900/20 border-red-800/40'}`}>
                            🤖 {pos.ai_verdict} {pos.ai_confidence ? `(${pos.ai_confidence}%)` : ''}
                        </span>
                    )}
                </div>

                {/* Price Levels */}
                <div className="bg-gray-50 dark:bg-[#0d1117] rounded-xl p-4 border border-gray-200 dark:border-[#21262d]">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">🔒 ENTRY (Locked)</span><span className="font-mono font-black text-yellow-400">{fmt(pos.entry_price)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">📍 CURRENT</span><span className={`font-mono font-black ${pnl.isProfit ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(pos.current_price)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">🎯 TARGET 1</span><span className="font-mono font-black text-green-400">{fmt(pos.target_1)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">🎯 TARGET 2</span><span className="font-mono font-bold text-green-400/60">{fmt(pos.target_2)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">🛑 STOP LOSS</span><span className="font-mono font-black text-red-400">{fmt(pos.stop_loss)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-bold">📊 R:R</span><span className="font-mono font-bold text-slate-900 dark:text-white">1:{(pos.risk_reward_ratio || 0).toFixed(1)}</span></div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#21262d] flex justify-between items-center">
                        <span className="text-gray-500 text-xs font-bold">P&L</span>
                        <div className="flex items-center gap-3">
                            <span className={`text-lg font-black font-mono ${pnl.isProfit ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                                {pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%
                            </span>
                            <span className={`text-sm font-bold font-mono ${pnl.isProfit ? 'text-[#00d97e]/70' : 'text-[#ff4757]/70'}`}>
                                {pnl.dollars >= 0 ? '+' : ''}{fmt(pnl.dollars)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <DayProgressBar pos={pos} />

                {/* Indicator Row */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 dark:bg-[#0d1117] rounded-lg p-2.5 border border-gray-200 dark:border-[#21262d] text-center">
                        <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">ADX</span>
                        <span className={`block text-lg font-black font-mono ${adxColor(pos.adx_value || 0)}`}>{(pos.adx_value || 0).toFixed(1)}</span>
                        <div className="mt-1 flex justify-center gap-2 text-[9px] font-mono text-gray-500">
                            <span>+DI:<span className="text-green-400 font-bold">{(pos.plus_di || 0).toFixed(1)}</span></span>
                            <span>-DI:<span className="text-red-400 font-bold">{(pos.minus_di || 0).toFixed(1)}</span></span>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#0d1117] rounded-lg p-2.5 border border-gray-200 dark:border-[#21262d] text-center">
                        <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">VOLUME</span>
                        <span className={`block text-lg font-black font-mono ${(pos.volume_ratio || 0) >= 1.5 ? 'text-green-400' : 'text-gray-300'}`}>{(pos.volume_ratio || 0).toFixed(1)}x</span>
                        <span className="text-[9px] text-gray-500">ATR: {(pos.atr || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#0d1117] rounded-lg p-2.5 border border-gray-200 dark:border-[#21262d] text-center">
                        <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">SUPERTREND</span>
                        <span className={`block text-sm font-black uppercase ${pos.supertrend_5m === 'BULL' ? 'text-green-400' : pos.supertrend_5m === 'BEAR' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {pos.supertrend_5m || '—'}
                        </span>
                        <span className={`text-[9px] font-bold ${pos.vwap_position === 'ABOVE' ? 'text-green-400' : 'text-red-400'}`}>
                            VWAP: {pos.vwap_position || '—'}
                        </span>
                    </div>
                </div>

                {/* AI Insights */}
                {(pos.ai_entry_hint || pos.ai_risk_note) && (
                    <div className="space-y-2">
                        {pos.ai_entry_hint && (
                            <div className="bg-blue-900/10 border border-blue-800/30 rounded-lg px-3 py-2 flex items-start gap-2">
                                <span className="text-sm">💡</span>
                                <span className="text-blue-300 text-xs italic leading-relaxed">"{pos.ai_entry_hint}"</span>
                            </div>
                        )}
                        {pos.ai_risk_note && (
                            <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg px-3 py-2 flex items-start gap-2">
                                <span className="text-sm">⚠️</span>
                                <span className="text-amber-300 text-xs italic leading-relaxed">"{pos.ai_risk_note}"</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Monitor Footer */}
                <div className="bg-gray-50 dark:bg-[#0d1117] rounded-lg p-3 border border-gray-200 dark:border-[#21262d]">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] text-gray-500 font-bold">
                        <span>Last checked: <span className="text-gray-300">{timeSince(pos.last_checked_at)}</span></span>
                        <span>Checks: <span className="text-gray-300 font-mono">{pos.check_count || 0}</span></span>
                        <span>Duration: <span className="text-gray-300">{timeSince(pos.opened_at)?.replace(' ago', '')}</span></span>
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] font-bold">
                        <span className="text-green-400">HWM: {(pos.high_water_mark || 0).toFixed(1)}% ▲</span>
                        <span className="text-red-400">LWM: {(pos.low_water_mark || 0).toFixed(1)}% ▼</span>
                        {pos.percent_change != null && (
                            <span className={pos.percent_change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                Gap: {pos.percent_change >= 0 ? '+' : ''}{pos.percent_change.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-1">
                    <button onClick={() => setExpanded(!expanded)}
                        className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider">
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gate Details ({pos.gate_score || 0}/4)
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => onClose(pos)}
                            className="px-3 py-1.5 rounded-lg bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] text-[10px] font-bold uppercase tracking-wider hover:bg-[#ff4757]/20 transition-all flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">close</span>
                            Manual Close
                        </button>
                        <button
                            onClick={() => onExecute?.({
                                id: pos.id,
                                symbol: pos.symbol,
                                current_price: pos.current_price,
                                option_type: (pos.action?.toUpperCase() === 'BUY' ? 'CALL' : 'PUT') as 'CALL' | 'PUT',
                                tier: pos.tier as 'A+' | 'A' | 'B+' | 'NO_TRADE',
                                trading_recommendation: pos.trading_recommendation || '',
                                gates_passed: `${pos.gate_score || 0}/4`,
                                adx_value: pos.adx_value || 0,
                                adx_trend: 'MODERATE',
                                fib_target1: pos.target_1 || 0,
                                fib_target2: pos.target_2 || 0,
                                fib_stop_loss: pos.stop_loss || 0,
                                risk_reward_ratio: `1:${(pos.risk_reward_ratio || 0).toFixed(1)}`,
                                analyzed_at: pos.opened_at || '',
                                ai_entry_hint: pos.ai_entry_hint || '',
                                // Iron Gate Day linkage
                                signal_source: 'iron_gate_day',
                                signal_position_id: pos.id,
                                entry_price: pos.entry_price,
                                target_price: pos.target_1,
                                stop_loss: pos.stop_loss,
                                signal_text: pos.signal || '',
                                opened_at: pos.opened_at,
                            })}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${isBuy
                                ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'}`}
                        >
                            ⚡ EXECUTE {isBuy ? 'CALL' : 'PUT'}
                        </button>
                    </div>
                </div>

                {expanded && <DayGateDetails pos={pos} />}
            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ─────────────────────────────────────

const DayCloseModal: React.FC<{ pos: DayPosition | null; onClose: () => void; onConfirm: (p: DayPosition) => void; closing: boolean }> = ({ pos, onClose, onConfirm, closing }) => {
    if (!pos) return null;
    const pnl = calcDayPnl(pos);
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}
                style={{ animation: 'igdSlideUp 0.25s ease' }}>
                <div className="p-4 border-b border-[#ff4757]/20 bg-[#ff4757]/5 flex justify-between items-center">
                    <h2 className="text-sm font-black uppercase tracking-tight text-[#ff4757] flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">warning</span> Manual Close
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-gray-50 dark:bg-[#0d1117] rounded-xl p-4 border border-gray-200 dark:border-[#21262d]">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{pos.symbol}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${pos.action === 'BUY' ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>{pos.action}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div><span className="block text-[9px] text-gray-500 font-bold uppercase">Entry</span><span className="text-yellow-400 font-mono font-bold">{fmt(pos.entry_price)}</span></div>
                            <div><span className="block text-[9px] text-gray-500 font-bold uppercase">Current</span><span className={`font-mono font-bold ${pnl.isProfit ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(pos.current_price)}</span></div>
                            <div><span className="block text-[9px] text-gray-500 font-bold uppercase">P&L</span><span className={`font-mono font-bold ${pnl.isProfit ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%</span></div>
                        </div>
                    </div>
                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <p className="text-amber-200 text-xs leading-relaxed">This will manually close the position and record it in today's history.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-[#30363d] text-gray-400 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-[#21262d] text-xs uppercase">Cancel</button>
                        <button onClick={() => onConfirm(pos)} disabled={closing}
                            className="flex-[2] py-3 bg-[#ff4757] hover:bg-[#ff4757]/80 text-white font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50">
                            {closing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Closing...</> : <><span className="material-symbols-outlined text-sm">close</span> Confirm Close</>}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes igdSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
};

// ─── SKELETON ───────────────────────────────────────────────

const DaySkeleton: React.FC = () => (
    <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-[#30363d] p-5 space-y-4 animate-pulse">
        <div className="flex gap-2"><div className="h-7 w-20 bg-gray-100 dark:bg-[#21262d] rounded" /><div className="h-5 w-14 bg-gray-100 dark:bg-[#21262d] rounded" /></div>
        <div className="h-5 w-48 bg-gray-100 dark:bg-[#21262d] rounded-full" />
        <div className="h-24 bg-gray-50 dark:bg-[#0d1117] rounded-xl" />
        <div className="h-8 bg-gray-100 dark:bg-[#21262d] rounded-lg" />
    </div>
);

// ─── HISTORY SUMMARY STATS ──────────────────────────────────

const DaySummaryStats: React.FC<{ history: DayHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;
    const wins = history.filter(h => h.result === 'WIN');
    const eodCloses = history.filter(h => h.exit_reason === 'EOD');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
    const best = history.reduce((b, h) => (h.pnl_pct || 0) > (b.pnl_pct || 0) ? h : b, history[0]);
    const worst = history.reduce((w, h) => (h.pnl_pct || 0) < (w.pnl_pct || 0) ? h : w, history[0]);
    const avgDur = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;

    const stats = [
        { label: "Today's Trades", value: String(history.length), color: 'text-white' },
        { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, color: winRate >= 50 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-[#00d97e]' : 'text-[#ff4757]' },
        { label: 'Best', value: `${best.symbol} +${(best.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#00d97e]' },
        { label: 'Worst', value: `${worst.symbol} ${(worst.pnl_pct || 0).toFixed(1)}%`, color: 'text-[#ff4757]' },
        { label: 'Avg Hold', value: formatDuration(avgDur), color: 'text-white' },
        { label: 'EOD Closes', value: String(eodCloses.length), color: 'text-amber-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map(s => (
                <div key={s.label} className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-[#30363d] p-3 text-center">
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

const IronGateDayTracker: React.FC<{ onExecute?: (signal: OptionSignal) => void }> = ({ onExecute }) => {
    const [config, setConfig] = useState<DayStrategyConfig | null>(null);
    const [positions, setPositions] = useState<DayPosition[]>([]);
    const [history, setHistory] = useState<DayHistory[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [closingPos, setClosingPos] = useState<DayPosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [activeSection, setActiveSection] = useState<'positions' | 'history'>('positions');
    const [activeFilter, setActiveFilter] = useState<string>('ALL');
    const [marketTime, setMarketTime] = useState(getETNow());
    const marketStatus = useMemo(() => getMarketStatus(), [marketTime]);

    // Live clock
    useEffect(() => {
        const i = setInterval(() => setMarketTime(getETNow()), 1000);
        return () => clearInterval(i);
    }, []);

    // Data fetching
    const fetchConfig = async () => {
        const { data, error } = await supabase.from('strategy_configs').select('*').eq('strategy', 'iron_gate_day').limit(1).single();
        console.log('[IronGateDay] fetchConfig:', { data, error });
        if (data) setConfig(data);
    };

    const fetchPositions = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('iron_gate_day_positions').select('*')
            .eq('status', 'OPEN')
            .gte('opened_at', today)
            .order('opened_at', { ascending: false });
        console.log('[IronGateDay] fetchPositions:', { count: data?.length, error });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    };

    const fetchHistory = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('iron_gate_day_history').select('*')
            .gte('closed_at', today)
            .order('closed_at', { ascending: false });
        console.log('[IronGateDay] fetchHistory:', { count: data?.length, error });
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    };

    useEffect(() => { fetchConfig(); fetchPositions(); fetchHistory(); }, []);
    useEffect(() => { const i = setInterval(fetchPositions, 15000); return () => clearInterval(i); }, []);

    // Manual close
    const handleManualClose = async (pos: DayPosition) => {
        setIsClosing(true);
        try {
            const pnl = calcDayPnl(pos);
            const durMs = Date.now() - new Date(pos.opened_at).getTime();
            await supabase.from('iron_gate_day_positions').update({ status: 'MANUAL_CLOSE', closed_at: new Date().toISOString(), close_reason: 'MANUAL', pnl_pct: pnl.pct, pnl_dollars: pnl.dollars }).eq('id', pos.id);
            await supabase.from('iron_gate_day_history').insert({
                position_id: pos.id, symbol: pos.symbol, action: pos.action, tier: pos.tier,
                entry_price: pos.entry_price, exit_price: pos.current_price,
                pnl_pct: pnl.pct, pnl_dollars: pnl.dollars, result: pnl.isProfit ? 'WIN' : 'LOSS',
                exit_reason: 'MANUAL', duration_minutes: Math.floor(durMs / 60000),
                high_water_mark: pos.high_water_mark, low_water_mark: pos.low_water_mark,
                opened_at: pos.opened_at, closed_at: new Date().toISOString(), gate_score: pos.gate_score,
            });
            await Promise.all([fetchPositions(), fetchHistory()]);
            setClosingPos(null);
        } catch (err) { console.error('Manual close failed:', err); }
        finally { setIsClosing(false); }
    };

    // Summary counts
    const counts = useMemo(() => {
        const open = positions.filter(p => p.status === 'OPEN');
        return {
            strongBuy: open.filter(p => p.action === 'BUY' && p.tier === 'A+').length,
            buy: open.filter(p => p.action === 'BUY' && p.tier === 'A').length,
            strongSell: open.filter(p => p.action === 'SELL' && p.tier === 'A+').length,
            sell: open.filter(p => p.action === 'SELL' && p.tier === 'A').length,
        };
    }, [positions]);

    const filteredPositions = useMemo(() => {
        const open = positions.filter(p => p.status === 'OPEN');
        if (activeFilter === 'STRONG_BUY') return open.filter(p => p.action === 'BUY' && p.tier === 'A+');
        if (activeFilter === 'BUY') return open.filter(p => p.action === 'BUY' && p.tier !== 'A+');
        if (activeFilter === 'STRONG_SELL') return open.filter(p => p.action === 'SELL' && p.tier === 'A+');
        if (activeFilter === 'SELL') return open.filter(p => p.action === 'SELL' && p.tier !== 'A+');
        return open;
    }, [positions, activeFilter]);

    const scanTimes = Array.isArray(config?.params?.scan_times) ? config!.params.scan_times : [];


    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0d1117] min-h-screen text-slate-900 dark:text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">

                {/* ── Header ── */}
                <div className="bg-white dark:bg-gradient-to-r dark:from-[#161b22] dark:to-[#1c2333] rounded-2xl border border-gray-200 dark:border-[#30363d] p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-900/20 border border-blue-700/40 flex items-center justify-center text-3xl">⚡</div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                                    {config?.display_name || 'Iron Gate Day Trade'}
                                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${marketStatus.color}`}>
                                        <span className={`w-2 h-2 rounded-full ${marketStatus.isOpen ? 'bg-green-400 animate-pulse' : 'bg-current'}`} />
                                        {marketStatus.label}
                                    </span>
                                </h1>
                                <p className="text-gray-500 text-sm font-medium mt-1">Intraday scalp tracking • 4-Gate + AI Judge</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="block text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                                    {marketTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ET Market Time</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary counts / filter buttons */}
                    <div className="grid grid-cols-4 gap-3 mt-5">
                        {[
                            { id: 'STRONG_BUY', label: 'STRONG BUY', count: counts.strongBuy, color: 'text-[#00d97e] border-[#00d97e]/30 bg-[#00d97e]/5', activeColor: 'ring-2 ring-[#00d97e]' },
                            { id: 'BUY', label: 'BUY', count: counts.buy, color: 'text-green-400 border-green-700/30 bg-green-900/10', activeColor: 'ring-2 ring-green-400' },
                            { id: 'STRONG_SELL', label: 'STRONG SELL', count: counts.strongSell, color: 'text-[#ff4757] border-[#ff4757]/30 bg-[#ff4757]/5', activeColor: 'ring-2 ring-[#ff4757]' },
                            { id: 'SELL', label: 'SELL', count: counts.sell, color: 'text-red-400 border-red-700/30 bg-red-900/10', activeColor: 'ring-2 ring-red-400' },
                        ].map(s => (
                            <button key={s.id} onClick={() => setActiveFilter(activeFilter === s.id ? 'ALL' : s.id)}
                                className={`rounded-xl border p-3 text-center transition-all ${s.color} ${activeFilter === s.id ? s.activeColor : 'opacity-80 hover:opacity-100'}`}>
                                <span className="block text-2xl font-black font-mono">{s.count}</span>
                                <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── EOD Banner ── */}
                <EODBanner isOpen={marketStatus.isOpen} />

                {/* ── Section Toggle ── */}
                <div className="flex bg-gray-100 dark:bg-[#161b22] rounded-lg border border-gray-200 dark:border-[#30363d] p-0.5 w-fit">
                    <button onClick={() => setActiveSection('positions')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'positions' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}>
                        <span className="material-symbols-outlined text-sm">radar</span>
                        Open Positions ({positions.length})
                    </button>
                    <button onClick={() => setActiveSection('history')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'history' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}>
                        <span className="material-symbols-outlined text-sm">history</span>
                        Today's History ({history.length})
                    </button>
                </div>

                {/* ── Open Positions ── */}
                {activeSection === 'positions' && (
                    <div>
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{[1, 2, 3, 4].map(i => <DaySkeleton key={i} />)}</div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-[#30363d]">
                                <div className="text-6xl mb-4">⚡</div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Iron Gate Day is Scanning</h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">Watching for A+ and A scalp signals. When a qualifying signal is detected with AI confirmation, it will appear here.</p>
                                {scanTimes.length > 0 && (
                                    <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-gray-600">
                                        <span className="font-bold">Scan window:</span>
                                        {scanTimes.map((t: string, i: number) => {
                                            const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
                                            const hhmm = cst.toTimeString().slice(0, 5);
                                            const nextScan = scanTimes.find((st: string) => st > hhmm);
                                            const isFired = t < hhmm;
                                            return (
                                                <span key={i} className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold transition-colors ${
                                                    isFired
                                                        ? 'bg-[#00d97e]/10 border-[#00d97e]/40 text-[#00d97e]'
                                                        : t === nextScan
                                                            ? 'bg-blue-900/15 border-blue-700/40 text-blue-400'
                                                            : 'bg-gray-100 dark:bg-[#21262d] border-gray-200 dark:border-[#30363d] text-gray-400'
                                                }`}>{t}</span>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-600">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />Auto-polling every 15 seconds
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {filteredPositions.map(p => <DayPositionCard key={p.id} pos={p} onClose={setClosingPos} onExecute={onExecute} />)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Today's History ── */}
                {activeSection === 'history' && (
                    <div>
                        {loadingHistory ? (
                            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-white dark:bg-[#161b22] rounded-lg border border-gray-200 dark:border-[#30363d] animate-pulse" />)}</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-[#30363d]">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-lg font-black uppercase tracking-tight mb-2">No Trades Today</h3>
                                <p className="text-gray-500 text-sm">Closed day trade positions will appear here.</p>
                            </div>
                        ) : (
                            <>
                                <DaySummaryStats history={history} />
                                <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-[#30363d] overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-[#30363d] bg-gray-100 dark:bg-[#0d1117]">
                                                    {['Symbol', 'Action', 'Tier', 'Entry', 'Exit', 'P&L%', 'P&L$', 'Result', 'Duration', 'Exit Reason', 'Time'].map(c => (
                                                        <th key={c} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{c}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(h => {
                                                    const isWin = h.result === 'WIN';
                                                    const isEod = h.exit_reason === 'EOD';
                                                    return (
                                                        <tr key={h.id} className={`border-b border-gray-100 dark:border-[#21262d] ${isWin ? 'bg-[#00d97e]/[0.03]' : isEod ? 'bg-amber-500/[0.03]' : 'bg-[#ff4757]/[0.03]'}`}>
                                                            <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{h.symbol}</td>
                                                            <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${h.action === 'BUY' ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>{h.action}</span></td>
                                                            <td className="px-4 py-3 text-gray-400 font-bold">{h.tier}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.entry_price)}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.exit_price)}</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{(h.pnl_pct || 0) >= 0 ? '+' : ''}{(h.pnl_pct || 0).toFixed(2)}%</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>{fmt(h.pnl_dollars)}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${isWin ? 'text-[#00d97e] bg-[#00d97e]/10 border-[#00d97e]/40' : isEod ? 'text-amber-400 bg-amber-900/10 border-amber-800/40' : 'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/40'}`}>
                                                                    {isEod ? 'EOD' : h.result}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400">{formatDuration(h.duration_minutes)}</td>
                                                            <td className="px-4 py-3 text-gray-500 uppercase text-[10px] font-bold">{h.exit_reason}</td>
                                                            <td className="px-4 py-3 text-gray-500 font-mono">{h.closed_at ? new Date(h.closed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
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

            <DayCloseModal pos={closingPos} onClose={() => setClosingPos(null)} onConfirm={handleManualClose} closing={isClosing} />
        </div>
    );
};

export default IronGateDayTracker;
