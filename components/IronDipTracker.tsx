import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ────────────────────────────────────────────────────

interface IronDipScan {
    id: number;
    ticker: string;
    scan_time: string;
    t1_sma50_slope: boolean;
    t2_weekly_above_sma200: boolean;
    t3_spy_above_sma20: boolean;
    trend_score: number;
    d1_rsi_oversold: boolean;
    d2_below_vwap: boolean;
    d3_bollinger_breach: boolean;
    d4_volume_spike: boolean;
    d5_st_5m_flip: boolean;
    dip_score: number;
    tier: string;
    signal_type: string;
    current_price: number;
    vwap_price: number;
    vwap_distance_pct: number;
    rsi_value: number;
    upper_bb: number;
    lower_bb: number;
    atr_value: number;
    sma50_daily: number;
    sma200_weekly: number;
    target_1: number;
    target_2: number;
    target_3: number;
    stop_loss: number;
    created_at: string;
}

interface IronDipPosition {
    id: number;
    ticker: string;
    option_type: string;
    entry_price: number;
    entry_time: string;
    trend_score: number;
    dip_score: number;
    tier: string;
    target_1: number;
    target_2: number;
    target_3: number;
    stop_loss: number;
    current_price: number;
    current_pnl_pct: number;
    rsi_current: number;
    st_1h_direction: string;
    dte_remaining: number;
    status: string;
    close_reason: string;
    scan_id: number;
    created_at: string;
    updated_at: string;
}

interface IronDipHistory {
    id: number;
    position_id: number;
    ticker: string;
    option_type: string;
    entry_price: number;
    entry_time: string;
    tier: string;
    trend_score: number;
    dip_score: number;
    exit_price: number;
    exit_time: string;
    close_reason: string;
    pnl_amount: number;
    pnl_pct: number;
    hold_duration_minutes: number;
    rsi_at_entry: number;
    vwap_distance_at_entry: number;
    created_at: string;
}

// ─── HELPERS ──────────────────────────────────────────────────

const fmt = (n?: number | null) => (n != null ? `$${Number(n).toFixed(2)}` : '—');
const fmtPct = (n?: number | null) => (n != null ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—');

const timeSince = (d?: string | null) => {
    if (!d) return '—';
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

const formatDuration = (mins?: number | null) => {
    if (!mins) return '—';
    return mins < 60 ? `${Math.round(mins)}m` : `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
};

const formatDate = (d?: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const tierStyle = (tier: string) => {
    if (tier === 'A+') return 'text-amber-300 bg-amber-900/30 border-amber-600/40';
    if (tier === 'A') return 'text-emerald-300 bg-emerald-900/20 border-emerald-700/30';
    return 'text-blue-300 bg-blue-900/20 border-blue-700/30';
};

const closeReasonLabel: Record<string, string> = {
    STOP_LOSS: '🛑 STOP LOSS',
    ST_1H_FLIP: '🔄 ST FLIP',
    RSI_OVERBOUGHT: '📈 RSI HIGH',
    TARGET_1_HIT: '🎯 T1 HIT',
    TARGET_3_HIT: '🎯 T3 HIT',
    TIME_DECAY: '⏳ TIME DECAY',
    MANUAL: '✋ MANUAL',
};

// ─── RSI MINI BAR ─────────────────────────────────────────────

const RSIMiniBar: React.FC<{ value?: number | null }> = ({ value }) => {
    const v = value ?? 50;
    const pct = Math.min(100, Math.max(0, v));
    const color = v < 30 ? '#06b6d4' : v < 35 ? '#eab308' : v < 50 ? '#94a3b8' : v < 65 ? '#eab308' : '#ef4444';
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="relative w-20 h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                <span className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="text-[10px] font-mono font-bold" style={{ color }}>{v.toFixed(1)}</span>
        </span>
    );
};

// ─── DIP PROGRESS BAR ─────────────────────────────────────────

const DipProgressBar: React.FC<{
    entryPrice: number; currentPrice: number; stopLoss: number;
    target1: number; target2: number; target3: number;
}> = ({ entryPrice, currentPrice, stopLoss, target1, target2, target3 }) => {
    const total = target3 - stopLoss;
    if (total <= 0) return null;
    const clamp = (v: number) => Math.min(100, Math.max(0, ((v - stopLoss) / total) * 100));
    const entryPct = clamp(entryPrice);
    const currentPct = clamp(currentPrice);
    const t1Pct = clamp(target1);
    const t2Pct = clamp(target2);
    const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                <span>SL → T3 Progress</span>
                <span className={`font-mono ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(pnlPct)}</span>
            </div>
            <div className="relative h-4 rounded-full overflow-visible bg-[#0d1117] border border-[#1e2430]">
                {/* Zone colors */}
                <div className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: `${entryPct}%`, background: 'linear-gradient(90deg,#ef444440,#ef444420)' }} />
                <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${entryPct}%`, width: `${t1Pct - entryPct}%`, background: '#eab30820' }} />
                <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${t1Pct}%`, width: `${t2Pct - t1Pct}%`, background: '#22c55e30' }} />
                <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${t2Pct}%`, width: `${100 - t2Pct}%`, background: '#16a34a40' }} />
                {/* Entry line */}
                <div className="absolute top-0 bottom-0 w-px bg-amber-400/60 border-l border-dashed border-amber-400/40 z-10" style={{ left: `${entryPct}%` }} />
                {/* T1 tick */}
                <div className="absolute -top-2 text-[8px] text-emerald-500 z-10" style={{ left: `${t1Pct}%` }}>|</div>
                {/* T2 tick */}
                <div className="absolute -top-2 text-[8px] text-emerald-400 z-10" style={{ left: `${t2Pct}%` }}>|</div>
                {/* Current price dot */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#06b6d4] bg-[#06b6d4] shadow-[0_0_8px_#06b6d480] z-20 transition-all duration-500 animate-pulse"
                    style={{ left: `calc(${currentPct}% - 6px)` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold font-mono">
                <span className="text-red-400">⛔ {fmt(stopLoss)}</span>
                <span className="text-amber-400 text-[8px]">Entry {fmt(entryPrice)}</span>
                <span className="text-emerald-400">🎯 {fmt(target3)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                <span>T1: {fmt(target1)}</span>
                <span className="text-[#06b6d4] font-bold">▲ {fmt(currentPrice)}</span>
                <span>T2: {fmt(target2)}</span>
            </div>
        </div>
    );
};

// ─── GATE ROW ─────────────────────────────────────────────────

const GateRow: React.FC<{ label: string; passed: boolean; detail: string }> = ({ label, passed, detail }) => (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] border ${passed ? 'bg-emerald-950/20 border-emerald-800/25 text-emerald-300' : 'bg-red-950/15 border-red-900/20 text-red-400/60'}`}>
        <span>{passed ? '✅' : '❌'}</span>
        <span className="font-bold text-slate-400 w-24 shrink-0">{label}</span>
        <span className="font-mono">{detail}</span>
    </div>
);

// ─── SCAN CARD ────────────────────────────────────────────────

const ScanCard: React.FC<{ scan: IronDipScan; onLock: (s: IronDipScan) => void; locking: boolean }> = ({ scan, onLock, locking }) => {
    const [expanded, setExpanded] = useState(false);
    const tierCls = tierStyle(scan.tier);

    return (
        <div className="bg-[#1a1f2e] rounded-2xl border border-[#2a2f3e] hover:border-[#3a3f4e] transition-all overflow-hidden">
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,#06b6d440,transparent)' }} />
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-black text-white tracking-tight">{scan.ticker}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${tierCls}`}>
                            {scan.tier}{scan.tier === 'A+' ? ' 🔥🔥🔥' : scan.tier === 'A' ? ' 🔥' : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black border text-cyan-300 bg-cyan-900/20 border-cyan-700/30">CALL</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border text-slate-400 bg-white/5 border-white/10">{scan.dip_score}/5 DIP GATES</span>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-lg font-black font-mono text-white">{fmt(scan.current_price)}</div>
                        <div className="text-[9px] text-slate-500">{timeSince(scan.scan_time)}</div>
                    </div>
                </div>

                {/* Trend Gates (collapsible) */}
                <button onClick={() => setExpanded(e => !e)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-[10px] font-bold transition-all">
                    <span className={`flex items-center gap-1.5 ${scan.trend_score === 3 ? 'text-emerald-400' : 'text-red-400'}`}>
                        TREND GATES ({scan.trend_score}/3) {scan.trend_score === 3 ? '✅' : '⚠️'}
                    </span>
                    <span className="material-symbols-outlined text-sm text-slate-500">{expanded ? 'expand_less' : 'expand_more'}</span>
                </button>
                {expanded && (
                    <div className="space-y-1.5">
                        <GateRow label="T1 SMA50 Slope" passed={!!scan.t1_sma50_slope} detail={scan.t1_sma50_slope ? 'Rising' : 'Flat/Falling'} />
                        <GateRow label="T2 Weekly>200" passed={!!scan.t2_weekly_above_sma200} detail={scan.sma200_weekly ? `$${scan.sma50_daily?.toFixed(2)} vs $${scan.sma200_weekly?.toFixed(2)}` : '—'} />
                        <GateRow label="T3 SPY>SMA20" passed={!!scan.t3_spy_above_sma20} detail={scan.t3_spy_above_sma20 ? 'SPY above 20-day SMA' : 'SPY below 20-day SMA'} />
                    </div>
                )}

                {/* Dip Gates */}
                <div className="space-y-1">
                    <div className="text-[10px] font-black text-cyan-400 tracking-wider mb-1.5">🏊 DIP GATES ({scan.dip_score}/5)</div>
                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] border ${scan.d1_rsi_oversold ? 'bg-emerald-950/20 border-emerald-800/25' : 'bg-red-950/15 border-red-900/20'}`}>
                        <span>{scan.d1_rsi_oversold ? '✅' : '❌'}</span>
                        <span className="font-bold text-slate-400 w-24 shrink-0">D1 RSI ≤ 35</span>
                        <RSIMiniBar value={scan.rsi_value} />
                    </div>
                    <GateRow label="D2 Below VWAP" passed={!!scan.d2_below_vwap}
                        detail={scan.vwap_distance_pct != null ? `${scan.vwap_distance_pct > 0 ? '+' : ''}${scan.vwap_distance_pct.toFixed(2)}% vs VWAP` : '—'} />
                    <GateRow label="D3 BB Breach" passed={!!scan.d3_bollinger_breach}
                        detail={scan.d3_bollinger_breach ? 'Below lower band' : 'Above lower band'} />
                    <GateRow label="D4 Vol Spike" passed={!!scan.d4_volume_spike} detail={scan.d4_volume_spike ? '≥2× avg volume' : 'Normal volume'} />
                    <GateRow label="D5 ST 5M Flip" passed={!!scan.d5_st_5m_flip}
                        detail={scan.d5_st_5m_flip ? 'SELL → BUY 🔄' : 'No flip'} />
                </div>

                {/* Targets */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-1.5">
                    <div className="text-[10px] font-black text-slate-400 tracking-wider mb-2">TARGETS</div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold font-mono mb-2">
                        <div className="text-emerald-400">T1: {fmt(scan.target_1)}<div className="text-[8px] text-slate-500 font-sans font-normal">Upper BB</div></div>
                        <div className="text-emerald-500">T2: {fmt(scan.target_2)}<div className="text-[8px] text-slate-500 font-sans font-normal">VWAP</div></div>
                        <div className="text-emerald-600">T3: {fmt(scan.target_3)}<div className="text-[8px] text-slate-500 font-sans font-normal">BB+ATR</div></div>
                    </div>
                    <div className="text-[10px] text-red-400 font-mono font-bold">⛔ Stop Loss: {fmt(scan.stop_loss)} (1.5× ATR)</div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500">Scanned {timeSince(scan.scan_time)}</span>
                    <button
                        onClick={() => onLock(scan)}
                        disabled={locking}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border bg-cyan-900/20 border-cyan-700/40 text-cyan-300 hover:bg-cyan-900/40 hover:border-cyan-500/60 disabled:opacity-50"
                    >
                        {locking ? 'Locking...' : '🔒 LOCK'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── POSITION CARD ─────────────────────────────────────────────

const PositionCard: React.FC<{ position: IronDipPosition; onClose: (p: IronDipPosition) => void }> = ({ position, onClose }) => {
    const pnl = position.current_pnl_pct ?? ((position.current_price - position.entry_price) / position.entry_price * 100);
    const pnlPositive = pnl >= 0;
    const tierCls = tierStyle(position.tier);
    const stDir = position.st_1h_direction?.toUpperCase();

    return (
        <div className="bg-[#1a1f2e] rounded-2xl border border-[#2a2f3e] overflow-hidden">
            <div className="h-px w-full" style={{ background: pnlPositive ? 'linear-gradient(90deg,transparent,#22c55e40,transparent)' : 'linear-gradient(90deg,transparent,#ef444440,transparent)' }} />
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-black text-white">{position.ticker}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black border text-cyan-300 bg-cyan-900/20 border-cyan-700/30">CALL</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${tierCls}`}>{position.tier}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border text-slate-400 bg-white/5 border-white/10">{position.dip_score}/5 🏊</span>
                    </div>
                    <div className="text-right shrink-0">
                        <span className={`block text-xl font-black font-mono ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                        <span className="block text-[9px] text-slate-500">{timeSince(position.entry_time)}</span>
                    </div>
                </div>

                {/* Price trio */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: '🔒 Entry', value: fmt(position.entry_price), cls: 'text-amber-300' },
                        { label: '📍 Current', value: fmt(position.current_price), cls: pnlPositive ? 'text-emerald-400' : 'text-red-400' },
                        { label: '🎯 T1', value: fmt(position.target_1), cls: 'text-emerald-400' },
                    ].map(item => (
                        <div key={item.label} className="bg-white/[0.04] rounded-xl p-2.5 border border-white/5">
                            <div className="text-[8px] text-slate-500 font-bold uppercase mb-1">{item.label}</div>
                            <div className={`text-sm font-black font-mono ${item.cls}`}>{item.value}</div>
                        </div>
                    ))}
                </div>

                {/* Progress bar */}
                {position.entry_price && position.stop_loss && position.target_3 && (
                    <DipProgressBar
                        entryPrice={position.entry_price}
                        currentPrice={position.current_price ?? position.entry_price}
                        stopLoss={position.stop_loss}
                        target1={position.target_1}
                        target2={position.target_2}
                        target3={position.target_3}
                    />
                )}

                {/* Monitor row */}
                <div className="flex items-center gap-3 flex-wrap text-[10px] font-bold py-1 border-t border-white/5">
                    {position.rsi_current != null && (
                        <span className="text-slate-400">RSI: <RSIMiniBar value={position.rsi_current} /></span>
                    )}
                    {stDir && (
                        <span className={stDir === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>ST 1H: {stDir}</span>
                    )}
                    {position.dte_remaining != null && (
                        <span className={position.dte_remaining <= 2 ? 'text-red-400 font-black' : 'text-slate-400'}>DTE: {position.dte_remaining}</span>
                    )}
                    <span className="ml-auto text-slate-500">Updated {timeSince(position.updated_at)}</span>
                </div>

                {/* Manual close */}
                <div className="flex justify-end">
                    <button onClick={() => onClose(position)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border text-red-400 bg-red-950/20 border-red-800/30 hover:bg-red-950/40 transition-all">
                        🔴 Manual Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ───────────────────────────────────────

const ManualCloseModal: React.FC<{
    position: IronDipPosition | null;
    onClose: () => void;
    onConfirm: (p: IronDipPosition) => void;
    closing: boolean;
}> = ({ position, onClose, onConfirm, closing }) => {
    if (!position) return null;
    const pnl = position.current_pnl_pct ?? ((position.current_price - position.entry_price) / position.entry_price * 100);
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div className="w-full max-w-md bg-[#1a1f2e] border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
                <div className="p-4 flex justify-between items-center border-b border-red-500/10">
                    <h2 className="text-sm font-black uppercase text-red-400 flex items-center gap-2">⚠️ Close Position</h2>
                    <button onClick={onClose}><span className="material-symbols-outlined text-slate-500">close</span></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-lg font-black text-white">{position.ticker} CALL</span>
                            <span className={`text-lg font-black font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div><div className="text-[9px] text-slate-500 mb-1">Entry</div><div className="text-amber-300 font-mono font-bold">{fmt(position.entry_price)}</div></div>
                            <div><div className="text-[9px] text-slate-500 mb-1">Current</div><div className={`font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(position.current_price)}</div></div>
                            <div><div className="text-[9px] text-slate-500 mb-1">P&L</div><div className={`font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(pnl)}</div></div>
                        </div>
                    </div>
                    <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 text-amber-200/80 text-xs">
                        ⚠️ This will manually close the position and record it in trade history. This action cannot be undone.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-white/10 text-slate-400 font-bold rounded-xl hover:bg-white/5 transition text-xs uppercase">Cancel</button>
                        <button onClick={() => onConfirm(position)} disabled={closing}
                            className="flex-[2] py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-xs uppercase disabled:opacity-50 transition">
                            {closing ? 'Closing...' : 'Confirm Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── HISTORY STATS ─────────────────────────────────────────────

const HistoryStats: React.FC<{ history: IronDipHistory[] }> = ({ history }) => {
    if (!history.length) return null;
    const wins = history.filter(h => (h.pnl_pct ?? 0) > 0);
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct ?? 0), 0) / history.length;
    const totalPnl = history.reduce((a, h) => a + (h.pnl_amount ?? 0), 0);
    const best = history.reduce((b, h) => (h.pnl_pct ?? 0) > (b.pnl_pct ?? 0) ? h : b, history[0]);
    const worst = history.reduce((w, h) => (h.pnl_pct ?? 0) < (w.pnl_pct ?? 0) ? h : w, history[0]);
    const avgDur = history.reduce((a, h) => a + (h.hold_duration_minutes ?? 0), 0) / history.length;

    const stats = [
        { label: 'Total Trades', value: String(history.length), cls: 'text-white' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, cls: winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Avg P&L', value: fmtPct(avgPnl), cls: avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Total P&L $', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, cls: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Avg Hold', value: formatDuration(avgDur), cls: 'text-white' },
        { label: 'Best', value: `${best.ticker} +${(best.pnl_pct ?? 0).toFixed(1)}%`, cls: 'text-emerald-400' },
        { label: 'Worst', value: `${worst.ticker} ${(worst.pnl_pct ?? 0).toFixed(1)}%`, cls: 'text-red-400' },
        { label: 'W / L', value: `${wins.length}W / ${history.length - wins.length}L`, cls: 'text-amber-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map(s => (
                <div key={s.label} className="bg-[#1a1f2e] rounded-xl border border-[#2a2f3e] p-3 text-center">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">{s.label}</div>
                    <div className={`text-sm font-black font-mono ${s.cls}`}>{s.value}</div>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

type ActiveTab = 'scans' | 'positions' | 'history';
type TierFilter = 'ALL' | 'A+' | 'A' | 'B+';
type SortBy = 'newest' | 'dip_score' | 'rsi';

let toastTimer: ReturnType<typeof setTimeout>;

const IronDipTracker: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('scans');
    const [scans, setScans] = useState<IronDipScan[]>([]);
    const [positions, setPositions] = useState<IronDipPosition[]>([]);
    const [history, setHistory] = useState<IronDipHistory[]>([]);
    const [loadingScans, setLoadingScans] = useState(true);
    const [loadingPositions, setLoadingPositions] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [lockingId, setLockingId] = useState<number | null>(null);
    const [closingPosition, setClosingPosition] = useState<IronDipPosition | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToast(null), 4000);
    };

    const fetchScans = useCallback(async () => {
        const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('iron_dip_scans')
            .select('*')
            .gte('scan_time', since)
            .in('tier', ['A+', 'A', 'B+'])
            .order('scan_time', { ascending: false });

        if (!error && data) {
            // Dedupe by ticker — keep newest
            const seen = new Set<string>();
            const deduped = data.filter(s => { if (seen.has(s.ticker)) return false; seen.add(s.ticker); return true; });
            setScans(deduped);
        }
        setLoadingScans(false);
    }, []);

    const fetchPositions = useCallback(async () => {
        const { data, error } = await supabase
            .from('iron_dip_positions')
            .select('*')
            .eq('status', 'OPEN')
            .order('entry_time', { ascending: false });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from('iron_dip_history')
            .select('*')
            .order('exit_time', { ascending: false })
            .limit(50);
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    }, []);

    useEffect(() => {
        fetchScans();
        fetchPositions();
    }, [fetchScans, fetchPositions]);

    useEffect(() => {
        if (activeTab === 'history' && !history.length) fetchHistory();
    }, [activeTab, fetchHistory, history.length]);

    useEffect(() => {
        if (!autoRefresh) return;
        const i = setInterval(() => { fetchScans(); fetchPositions(); }, 30000);
        return () => clearInterval(i);
    }, [autoRefresh, fetchScans, fetchPositions]);

    // Default tab: positions if open, else scans
    useEffect(() => {
        if (!loadingPositions) {
            setActiveTab(positions.length > 0 ? 'positions' : 'scans');
        }
    }, [loadingPositions]); // eslint-disable-line

    const handleLock = async (scan: IronDipScan) => {
        setLockingId(scan.id);
        try {
            const { error } = await supabase.from('iron_dip_positions').insert({
                ticker: scan.ticker,
                option_type: 'CALL',
                entry_price: scan.current_price,
                entry_time: new Date().toISOString(),
                trend_score: scan.trend_score,
                dip_score: scan.dip_score,
                tier: scan.tier,
                target_1: scan.target_1,
                target_2: scan.target_2,
                target_3: scan.target_3,
                stop_loss: scan.stop_loss,
                status: 'OPEN',
                scan_id: scan.id,
            });
            if (error) throw error;
            showToast(`🏊 ${scan.ticker} locked at ${fmt(scan.current_price)} — Monitoring started`);
            await fetchPositions();
            setActiveTab('positions');
        } catch (err: any) {
            showToast(err?.message || 'Failed to lock position', 'error');
        } finally {
            setLockingId(null);
        }
    };

    const handleCloseConfirm = async (position: IronDipPosition) => {
        setIsClosing(true);
        try {
            const closedAt = new Date().toISOString();
            const pnlAmount = (position.current_price - position.entry_price);
            const pnlPct = +((pnlAmount / position.entry_price) * 100).toFixed(2);

            await supabase.from('iron_dip_positions').update({
                status: 'CLOSED',
                close_reason: 'MANUAL',
                updated_at: closedAt,
            }).eq('id', position.id);

            await supabase.from('iron_dip_history').insert({
                position_id: position.id,
                ticker: position.ticker,
                option_type: position.option_type,
                entry_price: position.entry_price,
                entry_time: position.entry_time,
                tier: position.tier,
                trend_score: position.trend_score,
                dip_score: position.dip_score,
                exit_price: position.current_price,
                exit_time: closedAt,
                close_reason: 'MANUAL',
                pnl_amount: +pnlAmount.toFixed(2),
                pnl_pct: pnlPct,
            });

            showToast(`✅ ${position.ticker} position closed`);
            await fetchPositions();
            setClosingPosition(null);
        } catch (err: any) {
            showToast(err?.message || 'Failed to close position', 'error');
        } finally {
            setIsClosing(false);
        }
    };

    // Header stats
    const today = new Date().toISOString().slice(0, 10);
    const todaySignals = scans.filter(s => s.scan_time?.startsWith(today) && ['A+', 'A'].includes(s.tier)).length;
    const totalTrades = history.length;
    const wins = history.filter(h => (h.pnl_pct ?? 0) > 0).length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(0) : '—';

    // Filter & sort scans
    const filteredScans = scans
        .filter(s => tierFilter === 'ALL' || s.tier === tierFilter)
        .sort((a, b) => {
            if (sortBy === 'dip_score') return (b.dip_score ?? 0) - (a.dip_score ?? 0);
            if (sortBy === 'rsi') return (a.rsi_value ?? 100) - (b.rsi_value ?? 100);
            return new Date(b.scan_time).getTime() - new Date(a.scan_time).getTime();
        });

    const tabs: { id: ActiveTab; label: string; icon: string; count?: number }[] = [
        { id: 'scans', label: 'Scans', icon: '📡', count: scans.length },
        { id: 'positions', label: 'Positions', icon: '📊', count: positions.length },
        { id: 'history', label: 'History', icon: '📜' },
    ];

    return (
        <div className="flex-1 overflow-y-auto min-h-screen font-sans" style={{ background: '#0f1219', color: '#e2e8f0' }}>
            <div className="max-w-[1400px] mx-auto p-5 lg:p-7 space-y-5">

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl border text-sm font-bold shadow-2xl transition-all ${toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-300' : 'bg-red-950/90 border-red-700/60 text-red-300'}`}>
                        {toast.msg}
                    </div>
                )}

                {/* ── HEADER ── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: '#1a1f2e', borderColor: '#2a2f3e' }}>
                    <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,#06b6d460,transparent)' }} />
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: '#06b6d415', border: '1px solid #06b6d430' }}>🏊</div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight uppercase text-white">Iron Dip — Dip Buying</h1>
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-900/20 border border-cyan-700/30 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />LIVE
                                    </span>
                                </div>
                                <p style={{ color: '#94a3b8' }} className="text-xs font-medium mt-0.5">Catches oversold dips in healthy uptrends — CALL options only</p>
                            </div>
                        </div>
                        {/* Stat chips */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {[
                                { label: 'Active Scans', value: scans.length, cls: 'text-cyan-400' },
                                { label: 'Open Positions', value: positions.length, cls: 'text-emerald-400' },
                                { label: "Today's Signals", value: todaySignals, cls: 'text-amber-400' },
                                { label: 'Win Rate', value: totalTrades > 0 ? `${winRate}%` : '—', cls: 'text-emerald-400' },
                            ].map(chip => (
                                <div key={chip.label} className="px-3 py-2 rounded-xl border text-center min-w-[80px]" style={{ background: '#111620', borderColor: '#1e2430' }}>
                                    <div className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#64748b' }}>{chip.label}</div>
                                    <div className={`text-lg font-black font-mono ${chip.cls}`}>{chip.value}</div>
                                </div>
                            ))}
                            {/* Auto-refresh toggle */}
                            <button onClick={() => setAutoRefresh(v => !v)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-all ${autoRefresh ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30' : 'text-slate-500 bg-white/5 border-white/10'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TAB NAV ── */}
                <div className="flex items-center gap-1 border-b" style={{ borderColor: '#2a2f3e' }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeTab === tab.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
                            {tab.icon} {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.id ? 'bg-cyan-900/30 text-cyan-400' : 'bg-white/10 text-slate-400'}`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── SCANS TAB ── */}
                {activeTab === 'scans' && (
                    <div className="space-y-4">
                        {/* Filter bar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                                {(['ALL', 'A+', 'A', 'B+'] as TierFilter[]).map(t => (
                                    <button key={t} onClick={() => setTierFilter(t)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${tierFilter === t
                                            ? t === 'A+' ? 'bg-amber-900/40 border-amber-600/60 text-amber-300'
                                                : t === 'A' ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                                                    : t === 'B+' ? 'bg-blue-900/30 border-blue-700/50 text-blue-300'
                                                        : 'bg-cyan-900/20 border-cyan-700/40 text-cyan-300'
                                            : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                Sort:
                                {(['newest', 'dip_score', 'rsi'] as SortBy[]).map(s => (
                                    <button key={s} onClick={() => setSortBy(s)}
                                        className={`px-2 py-1 rounded border transition-all capitalize ${sortBy === s ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 hover:text-white'}`}>
                                        {s === 'newest' ? 'Newest' : s === 'dip_score' ? 'Dip Score' : 'RSI'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingScans ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2].map(i => (
                                    <div key={i} className="rounded-2xl border p-5 space-y-3 animate-pulse" style={{ background: '#1a1f2e', borderColor: '#2a2f3e' }}>
                                        <div className="flex gap-2"><div className="h-6 w-16 rounded" style={{ background: '#2a2f3e' }} /><div className="h-5 w-12 rounded" style={{ background: '#2a2f3e' }} /></div>
                                        <div className="h-24 rounded-xl" style={{ background: '#111620' }} />
                                    </div>
                                ))}
                            </div>
                        ) : filteredScans.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="text-5xl mb-4">🏊</div>
                                <p className="font-bold uppercase tracking-widest text-sm" style={{ color: '#64748b' }}>No dip signals detected yet</p>
                                <p className="text-xs mt-2" style={{ color: '#475569' }}>Scanner runs every 30 minutes during market hours · Last 4 hours</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredScans.map(scan => (
                                    <ScanCard key={scan.id} scan={scan} onLock={handleLock} locking={lockingId === scan.id} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── POSITIONS TAB ── */}
                {activeTab === 'positions' && (
                    <div className="space-y-4">
                        {loadingPositions ? (
                            <div className="py-20 text-center"><div className="text-2xl animate-spin inline-block">⟳</div></div>
                        ) : positions.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="text-5xl mb-4">📊</div>
                                <p className="font-bold uppercase tracking-widest text-sm" style={{ color: '#64748b' }}>No open dip positions</p>
                                <p className="text-xs mt-2" style={{ color: '#475569' }}>Lock an A+ or A signal from the Scans tab to start tracking</p>
                                <button onClick={() => setActiveTab('scans')} className="mt-4 text-cyan-400 font-bold text-xs uppercase hover:underline">Go to Scans →</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {positions.map(pos => (
                                    <PositionCard key={pos.id} position={pos} onClose={setClosingPosition} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── HISTORY TAB ── */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <HistoryStats history={history} />
                        {loadingHistory ? (
                            <div className="py-20 text-center"><div className="text-2xl animate-spin inline-block">⟳</div></div>
                        ) : history.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="text-5xl mb-4">📜</div>
                                <p className="font-bold uppercase tracking-widest text-sm" style={{ color: '#64748b' }}>No completed trades yet</p>
                                <p className="text-xs mt-2" style={{ color: '#475569' }}>Your dip buying history will appear here</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#2a2f3e' }}>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[9px] font-black uppercase tracking-widest" style={{ background: '#111620', color: '#64748b' }}>
                                            {['Ticker', 'Tier', 'Dip', 'Entry', 'Exit', 'P&L %', 'P&L $', 'Result', 'Duration', 'Exit Reason', 'Date'].map(h => (
                                                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(row => {
                                            const win = (row.pnl_pct ?? 0) > 0;
                                            return (
                                                <tr key={row.id} className="border-t transition-colors hover:bg-white/5" style={{ borderColor: '#1e2430', background: win ? '#22c55e08' : '#ef444408' }}>
                                                    <td className="px-3 py-3 font-black text-white">{row.ticker}</td>
                                                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black border ${tierStyle(row.tier)}`}>{row.tier}</span></td>
                                                    <td className="px-3 py-3 text-slate-400 font-mono">{row.dip_score ?? '—'}/5</td>
                                                    <td className="px-3 py-3 font-mono text-amber-300">{fmt(row.entry_price)}</td>
                                                    <td className="px-3 py-3 font-mono text-slate-300">{fmt(row.exit_price)}</td>
                                                    <td className={`px-3 py-3 font-black font-mono ${win ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(row.pnl_pct)}</td>
                                                    <td className={`px-3 py-3 font-mono ${win ? 'text-emerald-400' : 'text-red-400'}`}>{row.pnl_amount != null ? `${row.pnl_amount >= 0 ? '+' : ''}$${row.pnl_amount.toFixed(2)}` : '—'}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${win ? 'text-emerald-300 bg-emerald-900/20 border-emerald-700/30' : 'text-red-300 bg-red-900/20 border-red-700/30'}`}>
                                                            {win ? 'WIN' : 'LOSS'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono text-slate-400">{formatDuration(row.hold_duration_minutes)}</td>
                                                    <td className="px-3 py-3 text-slate-400">{closeReasonLabel[row.close_reason] ?? row.close_reason ?? '—'}</td>
                                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.exit_time)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <ManualCloseModal
                position={closingPosition}
                onClose={() => setClosingPosition(null)}
                onConfirm={handleCloseConfirm}
                closing={isClosing}
            />
        </div>
    );
};

export default IronDipTracker;
