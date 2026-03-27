import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';

// ─── TYPES ─────────────────────────────────────────────────────

interface V2Signal {
    id: string;
    symbol: string;
    option_type: 'CALL' | 'PUT';
    tier: 'A+' | 'A' | 'NO_TRADE';
    gates_passed: string;
    trend_passed: string;
    pullback_passed: string;
    signal: string;
    trading_recommendation: string;
    trade_direction: string;
    trade_reason: string;
    // Prices
    current_price: number;
    entry_price: number;
    stop_loss: number;
    target1: number;
    target2: number;
    profit_zone_low: number;
    profit_zone_high: number;
    risk_reward_ratio: string;
    atr14: number;
    stop_distance_dollars: number;
    stop_distance_pct: number;
    // Trend gates
    t1_sma: string;
    t2_4h_st: string;
    t3_adx: string;
    // Pullback gates
    p1_pullback: string;
    p2_value_zone: string;
    p3_structure: string;
    // Indicators
    sma20: number;
    sma50: number;
    sma_spread: number;
    adx_value: number;
    adx_trend: string;
    plus_di: number;
    minus_di: number;
    st_4h_direction: string;
    st_4h_value: number;
    st_1h_direction: string;
    st_1h_value: number;
    st_15m_direction: string;
    st_15m_value: number;
    vwap_value: number;
    vwap_distance: number;
    // AI
    ai_verdict: string;
    ai_confidence: string;
    ai_reason: string;
    ai_entry_hint: string;
    ai_adjusted: boolean;
    // Meta
    source: string;
    version: string;
    is_latest: boolean;
    analyzed_at: string;
}

// ─── HELPERS ──────────────────────────────────────────────────

const fmt = (n: number | null | undefined, decimals = 2) =>
    n != null ? `$${Number(n).toFixed(decimals)}` : '—';

const fmtPct = (n: number | null | undefined) =>
    n != null ? `${Number(n).toFixed(1)}%` : '—';

const timeSince = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const gateIsPassed = (g: string | null | undefined) =>
    (g || '').includes('✓') || (g || '').includes('✅') || (g || '').includes('PASS');

const adxColor = (v: number) => v >= 25 ? '#00d97e' : v >= 20 ? '#ffc107' : '#ff4757';

// ─── PROGRESS BAR ─────────────────────────────────────────────

const V2ProgressBar: React.FC<{ signal: V2Signal }> = ({ signal }) => {
    const isCall = signal.option_type === 'CALL';
    const sl = signal.stop_loss;
    const entry = signal.entry_price;
    const target = signal.target1;
    const current = signal.current_price;

    if (!sl || !entry || !target) return null;

    const totalRange = isCall ? (target - sl) : (sl - target);
    const rawProgress = isCall
        ? ((current - sl) / totalRange) * 100
        : ((sl - current) / totalRange) * 100;
    const progress = Math.max(0, Math.min(100, rawProgress));
    const entryPct = isCall
        ? ((entry - sl) / totalRange) * 100
        : ((sl - entry) / totalRange) * 100;
    const entryPctClamped = Math.max(0, Math.min(100, entryPct));

    const barColor = progress >= 75 ? '#00d97e'
        : progress >= 50 ? '#ffd32a'
            : progress >= 25 ? '#ff9f43'
                : '#ff4757';

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold" style={{ color: '#8b949e' }}>
                <span>SL → Target Progress</span>
                <span style={{ color: barColor }}>{progress.toFixed(1)}%</span>
            </div>

            {/* Track */}
            <div className="relative h-5 rounded-md overflow-visible" style={{ background: '#21262d' }}>
                {/* Gradient fill */}
                <div
                    className="absolute top-0 bottom-0 left-0 rounded-md transition-all duration-700"
                    style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #ff4757 0%, #ff9f43 30%, #ffd32a 55%, #00d97e 100%)',
                    }}
                />
                {/* Entry marker */}
                <div
                    className="absolute top-0 bottom-0 z-10"
                    style={{ left: `${entryPctClamped}%`, borderLeft: '1.5px dashed rgba(255,255,255,0.5)' }}
                />
                {/* Current price dot */}
                <div
                    className="absolute top-1/2 z-20 w-3 h-3 rounded-full border-2 shadow-lg"
                    style={{
                        left: `calc(${progress}% - 6px)`,
                        top: 'calc(50% - 6px)',
                        background: '#fff',
                        borderColor: '#30363d',
                        boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                    }}
                />
                {/* % overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-30">
                    <span className="text-[10px] font-black text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                        {progress.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Labels */}
            <div className="flex justify-between text-[10px] font-bold px-0.5">
                <span style={{ color: '#ff4757' }}>🛑 {fmt(isCall ? sl : target)}</span>
                <span style={{ color: '#ffd32a' }}>🔒 Entry {fmt(entry)}</span>
                <span style={{ color: '#00d97e' }}>🎯 {fmt(isCall ? target : sl)}</span>
            </div>
        </div>
    );
};

// ─── GATE ITEM ────────────────────────────────────────────────

const GateItem: React.FC<{ label: string; detail: string | null | undefined }> = ({ label, detail }) => {
    const passed = gateIsPassed(detail);
    return (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] border font-mono ${passed
            ? 'bg-green-950/20 border-green-800/40 text-green-300'
            : 'bg-red-950/15 border-red-800/30 text-red-300/70'}`}>
            <span className="flex-shrink-0">{passed ? '✅' : '❌'}</span>
            <span className="font-bold text-gray-400 flex-shrink-0 w-20">{label}:</span>
            <span className="break-all">{detail || '—'}</span>
        </div>
    );
};

// ─── AI REVIEW ────────────────────────────────────────────────

const AIReview: React.FC<{ signal: V2Signal }> = ({ signal }) => {
    if (!signal.ai_verdict) return null;
    const isConfirm = signal.ai_verdict === 'CONFIRM';
    return (
        <div className="rounded-xl p-3 border space-y-2" style={{
            background: isConfirm ? 'rgba(0,217,126,0.05)' : 'rgba(255,71,87,0.05)',
            borderColor: isConfirm ? 'rgba(0,217,126,0.2)' : 'rgba(255,71,87,0.2)',
        }}>
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">🤖</span>
                <span className="font-black text-xs uppercase tracking-wider" style={{ color: isConfirm ? '#00d97e' : '#ff4757' }}>
                    {signal.ai_verdict}
                </span>
                {signal.ai_confidence && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{
                        color: '#8b949e', borderColor: '#30363d', background: '#21262d',
                    }}>
                        {signal.ai_confidence} confidence
                    </span>
                )}
                {signal.ai_adjusted && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2 py-0.5 rounded-full">
                        AI-adjusted
                    </span>
                )}
            </div>
            {signal.ai_reason && (
                <p className="text-xs leading-relaxed" style={{ color: '#8b949e' }}>
                    "{signal.ai_reason}"
                </p>
            )}
            {signal.ai_entry_hint && (
                <p className="text-xs" style={{ color: '#ffc107' }}>
                    💡 {signal.ai_entry_hint}
                </p>
            )}
        </div>
    );
};

// ─── SIGNAL CARD ──────────────────────────────────────────────

const V2SignalCard: React.FC<{
    signal: V2Signal;
    onExecute?: (s: OptionSignal) => void;
}> = ({ signal, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const isCall = signal.option_type === 'CALL';
    const isAPlus = signal.tier === 'A+';
    const priceDiff = signal.current_price - signal.entry_price;
    const priceDiffPct = signal.entry_price > 0 ? (priceDiff / signal.entry_price) * 100 : 0;
    const favorable = isCall ? priceDiff >= 0 : priceDiff <= 0;

    // Signal label — never show WEAK
    let rec = signal.trading_recommendation || '';
    if (!rec || rec.toUpperCase().includes('WEAK')) {
        rec = isAPlus ? (isCall ? 'STRONG BUY' : 'STRONG SELL') : (isCall ? 'BUY' : 'SELL');
    }
    const isStrong = rec.includes('STRONG');
    const signalLabel = `${isStrong ? '🔥' : '✅'} ${rec} (PULLBACK)`;

    return (
        <div className="rounded-xl border hover:border-[#484f58] transition-all overflow-hidden" style={{
            background: '#161b22',
            borderColor: isCall ? 'rgba(0,217,126,0.2)' : 'rgba(255,71,87,0.2)',
            borderLeftWidth: 3,
            borderLeftColor: isCall ? '#00d97e' : '#ff4757',
        }}>
            <div className="p-5 space-y-4">

                {/* ── Header ── */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl font-black text-white tracking-tight">{signal.symbol}</span>
                        {/* Option type */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-black border" style={{
                            color: isCall ? '#00d97e' : '#ff4757',
                            background: isCall ? 'rgba(0,217,126,0.1)' : 'rgba(255,71,87,0.1)',
                            borderColor: isCall ? 'rgba(0,217,126,0.4)' : 'rgba(255,71,87,0.4)',
                        }}>{signal.option_type}</span>
                        {/* Tier */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-black border" style={{
                            color: isAPlus ? '#ffc107' : '#8b949e',
                            background: isAPlus ? 'rgba(255,193,7,0.1)' : 'rgba(139,148,158,0.1)',
                            borderColor: isAPlus ? 'rgba(255,193,7,0.4)' : 'rgba(139,148,158,0.3)',
                        }}>{signal.tier}</span>
                        {/* Gates combined */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border text-green-400 bg-green-900/20 border-green-800/40">
                            T:{signal.trend_passed} P:{signal.pullback_passed} ✅
                        </span>
                        {/* AI verdict */}
                        {signal.ai_verdict && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border" style={{
                                color: signal.ai_verdict === 'CONFIRM' ? '#00d97e' : '#ff4757',
                                background: signal.ai_verdict === 'CONFIRM' ? 'rgba(0,217,126,0.08)' : 'rgba(255,71,87,0.08)',
                                borderColor: signal.ai_verdict === 'CONFIRM' ? 'rgba(0,217,126,0.3)' : 'rgba(255,71,87,0.3)',
                            }}>🤖 {signal.ai_verdict}</span>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className={`text-sm font-black font-mono ${favorable ? 'text-[#00d97e]' : 'text-[#ff4757]'}`}>
                            {priceDiff >= 0 ? '+' : ''}{priceDiffPct.toFixed(2)}%
                        </span>
                        <span className="block text-[10px]" style={{ color: '#8b949e' }}>{timeSince(signal.analyzed_at)}</span>
                    </div>
                </div>

                {/* ── Signal Badge ── */}
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${isCall
                        ? (isStrong ? 'bg-green-900/30 border-green-600/50 text-green-400' : 'bg-green-900/20 border-green-700/40 text-green-400')
                        : (isStrong ? 'bg-red-900/30 border-red-600/50 text-red-400' : 'bg-red-900/20 border-red-700/40 text-red-400')
                    }`}>
                    {signalLabel}
                </div>

                {/* ── Price Levels ── */}
                <div className="rounded-xl p-4 border space-y-2" style={{ background: '#0d1117', borderColor: '#21262d' }}>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: '🔒 ENTRY', value: fmt(signal.entry_price), color: '#ffd32a' },
                            { label: '📍 CURRENT', value: fmt(signal.current_price), color: favorable ? '#00d97e' : '#ff4757' },
                            { label: '🎯 TARGET', value: fmt(signal.target1), color: '#00d97e' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="text-center">
                                <span className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>{label}</span>
                                <span className="font-mono font-black text-sm" style={{ color }}>{value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: '#21262d' }}>
                        <div className="text-center">
                            <span className="block text-[9px] font-bold uppercase mb-1" style={{ color: '#8b949e' }}>🛑 STOP LOSS</span>
                            <span className="font-mono font-bold text-xs text-red-400">{fmt(signal.stop_loss)}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[9px] font-bold uppercase mb-1" style={{ color: '#8b949e' }}>💰 PROFIT ZONE</span>
                            <span className="font-mono font-bold text-[10px] text-emerald-400">
                                {signal.profit_zone_low && signal.profit_zone_high
                                    ? `${fmt(signal.profit_zone_low)}–${fmt(signal.profit_zone_high)}`
                                    : '—'}
                            </span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[9px] font-bold uppercase mb-1" style={{ color: '#8b949e' }}>📊 R:R</span>
                            <span className="font-mono font-bold text-xs text-white">{signal.risk_reward_ratio || '—'}</span>
                        </div>
                    </div>

                    {/* ATR Info */}
                    {signal.atr14 && (
                        <div className="pt-2 border-t text-[10px] font-mono" style={{ borderColor: '#21262d', color: '#8b949e' }}>
                            ATR(14): <span className="text-white font-bold">{fmt(signal.atr14)}</span>
                            {signal.stop_distance_dollars && (
                                <> &nbsp;•&nbsp; SL: 1.5×ATR (<span className="text-red-400">{fmt(signal.stop_distance_dollars)}</span> away, <span className="text-red-400">{fmtPct(signal.stop_distance_pct)}</span>)</>
                            )}
                            {signal.target2 && (
                                <> &nbsp;•&nbsp; T2: <span className="text-green-400">{fmt(signal.target2)}</span></>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Progress Bar ── */}
                <V2ProgressBar signal={signal} />

                {/* ── AI Review ── */}
                <AIReview signal={signal} />

                {/* ── Indicators Row ── */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg p-2.5 border text-center" style={{ background: '#0d1117', borderColor: '#21262d' }}>
                        <span className="block text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8b949e' }}>ADX</span>
                        <span className="block text-lg font-black font-mono" style={{ color: adxColor(signal.adx_value || 0) }}>
                            {(signal.adx_value || 0).toFixed(1)}
                        </span>
                        <div className="mt-1 flex justify-center gap-1.5 text-[9px] font-mono" style={{ color: '#8b949e' }}>
                            <span>+DI:<span className="text-green-400 font-bold">{(signal.plus_di || 0).toFixed(1)}</span></span>
                            <span>-DI:<span className="text-red-400 font-bold">{(signal.minus_di || 0).toFixed(1)}</span></span>
                        </div>
                    </div>
                    <div className="rounded-lg p-2.5 border text-center" style={{ background: '#0d1117', borderColor: '#21262d' }}>
                        <span className="block text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8b949e' }}>SMA</span>
                        <div className="flex justify-center gap-1.5 text-[10px] font-mono">
                            <span style={{ color: '#8b949e' }}>20:<span className="text-white font-bold">{signal.sma20?.toFixed(1) || '—'}</span></span>
                            <span style={{ color: '#8b949e' }}>50:<span className="text-white font-bold">{signal.sma50?.toFixed(1) || '—'}</span></span>
                        </div>
                        {signal.sma_spread != null && (
                            <span className="text-[9px] font-mono font-bold" style={{ color: signal.sma_spread >= 0 ? '#00d97e' : '#ff4757' }}>
                                Spread: {signal.sma_spread >= 0 ? '+' : ''}{signal.sma_spread.toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div className="rounded-lg p-2.5 border text-center" style={{ background: '#0d1117', borderColor: '#21262d' }}>
                        <span className="block text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8b949e' }}>SUPERTREND</span>
                        {[
                            { label: '4H', dir: signal.st_4h_direction, val: signal.st_4h_value },
                            { label: '1H', dir: signal.st_1h_direction },
                            { label: '15m', dir: signal.st_15m_direction },
                        ].map(({ label, dir }) => (
                            <div key={label} className="flex justify-between text-[9px] font-bold">
                                <span style={{ color: '#8b949e' }}>{label}:</span>
                                <span style={{ color: (dir || '').toUpperCase() === 'BULLISH' ? '#00d97e' : (dir || '').toUpperCase() === 'BEARISH' ? '#ff4757' : '#8b949e' }}>
                                    {dir || '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="flex items-center gap-2 pt-1">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[10px] font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider"
                        style={{ color: '#8b949e' }}
                    >
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gate Details
                    </button>
                    <div className="ml-auto">
                        <button
                            onClick={() => onExecute?.({
                                id: signal.id,
                                symbol: signal.symbol,
                                current_price: signal.current_price,
                                option_type: signal.option_type,
                                tier: signal.tier as 'A+' | 'A' | 'B+' | 'NO_TRADE',
                                trading_recommendation: rec,
                                gates_passed: signal.gates_passed || '',
                                adx_value: signal.adx_value || 0,
                                adx_trend: (signal.adx_trend || 'MODERATE') as OptionSignal['adx_trend'],
                                fib_target1: signal.target1 || 0,
                                fib_target2: signal.target2 || 0,
                                fib_stop_loss: signal.stop_loss || 0,
                                risk_reward_ratio: signal.risk_reward_ratio || '',
                                analyzed_at: signal.analyzed_at || '',
                                ai_entry_hint: signal.ai_entry_hint || '',
                                signal_source: 'iron_gate' as const,
                                signal_position_id: signal.id,
                                entry_price: signal.entry_price,
                                target_price: signal.target1,
                                stop_loss: signal.stop_loss,
                                profit_zone_low: signal.profit_zone_low,
                                profit_zone_high: signal.profit_zone_high,
                                signal_text: signal.signal || '',
                                opened_at: signal.analyzed_at,
                            })}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${isCall
                                    ? 'bg-[#00d97e]/10 border border-[#00d97e]/30 text-[#00d97e] hover:bg-[#00d97e]/20 hover:border-[#00d97e]/50'
                                    : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/50'
                                }`}
                        >
                            ⚡ EXECUTE {signal.option_type}
                        </button>
                    </div>
                </div>

                {/* ── Gate Details (Expandable) ── */}
                {expanded && (
                    <div className="mt-2 space-y-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: '#8b949e' }}>
                                📈 TREND GATES ({signal.trend_passed || '?/3'})
                            </p>
                            <div className="space-y-1.5">
                                <GateItem label="T1 SMA" detail={signal.t1_sma} />
                                <GateItem label="T2 4H ST" detail={signal.t2_4h_st} />
                                <GateItem label="T3 ADX" detail={signal.t3_adx} />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: '#8b949e' }}>
                                📉 PULLBACK GATES ({signal.pullback_passed || '?/3'})
                            </p>
                            <div className="space-y-1.5">
                                <GateItem label="P1 Signal" detail={signal.p1_pullback} />
                                <GateItem label="P2 Zone" detail={signal.p2_value_zone} />
                                <GateItem label="P3 Structure" detail={signal.p3_structure} />
                            </div>
                        </div>
                        {signal.trade_reason && (
                            <div className="text-[11px] font-mono px-3 py-2 rounded-lg border" style={{ background: '#0d1117', borderColor: '#21262d', color: '#8b949e' }}>
                                {signal.trade_reason}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── SKELETON ────────────────────────────────────────────────

const V2Skeleton: React.FC = () => (
    <div className="rounded-xl border p-5 space-y-4 animate-pulse" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="flex gap-2">
            <div className="h-7 w-20 rounded" style={{ background: '#21262d' }} />
            <div className="h-5 w-14 rounded" style={{ background: '#21262d' }} />
            <div className="h-5 w-14 rounded" style={{ background: '#21262d' }} />
        </div>
        <div className="h-5 w-48 rounded-full" style={{ background: '#21262d' }} />
        <div className="h-24 rounded-xl" style={{ background: '#0d1117' }} />
        <div className="h-5 rounded-lg" style={{ background: '#21262d' }} />
    </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────

const SCAN_WEBHOOK = 'https://prabhupadala01.app.n8n.cloud/webhook/irongate-v2-scan';

const IronGateV2Scanner: React.FC<{ onExecute?: (signal: OptionSignal) => void }> = ({ onExecute }) => {
    const [signals, setSignals] = useState<V2Signal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [filter, setFilter] = useState<'ALL' | 'CALL' | 'PUT'>('ALL');
    const [sortBy, setSortBy] = useState<'tier' | 'adx' | 'rr' | 'symbol'>('tier');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSignals = useCallback(async () => {
        const { data, error } = await supabase
            .from('swing_trade_v2')
            .select('*')
            .eq('is_latest', true)
            .neq('tier', 'NO_TRADE')
            .order('analyzed_at', { ascending: false });

        if (!error && data) {
            // Sort A+ first, then A
            const sorted = [...data].sort((a, b) => {
                if (a.tier === 'A+' && b.tier !== 'A+') return -1;
                if (a.tier !== 'A+' && b.tier === 'A+') return 1;
                return 0;
            });
            setSignals(sorted as V2Signal[]);
            if (data.length > 0) setLastUpdated(new Date());
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSignals();
    }, [fetchSignals]);

    const stopPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollRef.current = null;
        timeoutRef.current = null;
    };

    const triggerScan = async () => {
        setIsScanning(true);
        setScanStatus('⏳ Sending scan request...');
        stopPolling();

        try {
            await fetch(SCAN_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            setScanStatus('⏳ Scanning in background... polling for results');
        } catch {
            setScanStatus('⚠️ Scan trigger failed — polling anyway');
        }

        // Poll every 5s for fresh data
        pollRef.current = setInterval(async () => {
            const { data } = await supabase
                .from('swing_trade_v2')
                .select('analyzed_at')
                .eq('is_latest', true)
                .order('analyzed_at', { ascending: false })
                .limit(1);

            if (data?.[0]?.analyzed_at) {
                const age = Date.now() - new Date(data[0].analyzed_at).getTime();
                if (age < 120000) {
                    stopPolling();
                    await fetchSignals();
                    setIsScanning(false);
                    setScanStatus(null);
                }
            }
        }, 5000);

        // Timeout after 2 min
        timeoutRef.current = setTimeout(() => {
            stopPolling();
            fetchSignals();
            setIsScanning(false);
            setScanStatus(null);
        }, 120000);
    };

    // Cleanup on unmount
    useEffect(() => () => stopPolling(), []);

    // Filtered + sorted signals
    const displayed = signals
        .filter(s => filter === 'ALL' || s.option_type === filter)
        .sort((a, b) => {
            if (sortBy === 'adx') return (b.adx_value || 0) - (a.adx_value || 0);
            if (sortBy === 'rr') {
                const rrA = parseFloat((a.risk_reward_ratio || '1:0').split(':')[1] || '0');
                const rrB = parseFloat((b.risk_reward_ratio || '1:0').split(':')[1] || '0');
                return rrB - rrA;
            }
            if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
            // Default: A+ first
            if (a.tier === 'A+' && b.tier !== 'A+') return -1;
            if (a.tier !== 'A+' && b.tier === 'A+') return 1;
            return 0;
        });

    const callCount = signals.filter(s => s.option_type === 'CALL').length;
    const sellCount = signals.filter(s => s.option_type === 'PUT').length;
    const aplusCount = signals.filter(s => s.tier === 'A+').length;

    return (
        <div className="flex-1 overflow-y-auto min-h-screen text-white" style={{ background: '#0d1117' }}>
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">

                {/* ── Header ── */}
                <div className="rounded-2xl border p-6" style={{
                    background: 'linear-gradient(135deg, #161b22 0%, #1c2333 100%)',
                    borderColor: '#30363d',
                }}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border" style={{
                                background: 'rgba(0,217,126,0.1)', borderColor: 'rgba(0,217,126,0.3)',
                            }}>🔒</div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                                    Iron Gate v2
                                    <span className="text-xs font-bold px-2 py-1 rounded-full border" style={{
                                        color: '#00d97e', background: 'rgba(0,217,126,0.1)', borderColor: 'rgba(0,217,126,0.3)',
                                    }}>PULLBACK SCANNER</span>
                                </h1>
                                <p className="text-sm font-medium mt-1" style={{ color: '#8b949e' }}>
                                    3-Gate Trend + 3-Gate Pullback + AI Confirmation • ATR-based levels
                                </p>
                            </div>
                        </div>

                        {/* Scan button */}
                        <button
                            onClick={triggerScan}
                            disabled={isScanning}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-60"
                            style={{
                                background: isScanning ? '#21262d' : 'rgba(0,217,126,0.15)',
                                border: `1px solid ${isScanning ? '#30363d' : 'rgba(0,217,126,0.4)'}`,
                                color: isScanning ? '#8b949e' : '#00d97e',
                            }}
                        >
                            {isScanning
                                ? <><div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" /> Scanning...</>
                                : <><span className="material-symbols-outlined text-lg">refresh</span> Scan Now</>
                            }
                        </button>
                    </div>

                    {/* Scan status */}
                    {scanStatus && (
                        <div className="mt-3 text-xs font-bold px-3 py-2 rounded-lg border animate-pulse" style={{
                            color: '#ffc107', background: 'rgba(255,193,7,0.08)', borderColor: 'rgba(255,193,7,0.2)',
                        }}>
                            {scanStatus}
                        </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                        {[
                            { label: 'Total Signals', value: String(signals.length), color: '#e6edf3' },
                            { label: 'CALL / PUT', value: `${callCount} / ${sellCount}`, color: '#8b949e' },
                            { label: 'A+ Tier', value: String(aplusCount), color: '#ffc107' },
                            { label: 'Last Scan', value: lastUpdated ? timeSince(lastUpdated.toISOString()) : '—', color: '#8b949e' },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl border p-3 text-center" style={{ background: '#0d1117', borderColor: '#21262d' }}>
                                <span className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>{s.label}</span>
                                <span className="block text-lg font-black font-mono" style={{ color: s.color }}>{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Filter / Sort bar ── */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Type filter */}
                    <div className="flex rounded-lg border p-0.5" style={{ background: '#161b22', borderColor: '#30363d' }}>
                        {(['ALL', 'CALL', 'PUT'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
                                style={{
                                    background: filter === f ? (f === 'CALL' ? '#00d97e' : f === 'PUT' ? '#ff4757' : '#30363d') : 'transparent',
                                    color: filter === f ? '#fff' : '#8b949e',
                                }}
                            >
                                {f === 'CALL' ? '📈 CALL' : f === 'PUT' ? '📉 PUT' : 'ALL'}
                            </button>
                        ))}
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#8b949e' }}>
                        <span>SORT:</span>
                        {(['tier', 'adx', 'rr', 'symbol'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortBy(s)}
                                className="px-3 py-1.5 rounded-lg border uppercase tracking-wider transition-all"
                                style={{
                                    background: sortBy === s ? '#21262d' : 'transparent',
                                    borderColor: sortBy === s ? '#484f58' : '#30363d',
                                    color: sortBy === s ? '#e6edf3' : '#8b949e',
                                }}
                            >
                                {s === 'rr' ? 'R:R' : s.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto text-[10px] font-bold" style={{ color: '#8b949e' }}>
                        {displayed.length} of {signals.length} shown
                    </div>
                </div>

                {/* ── Content ── */}
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {[1, 2, 3, 4].map(i => <V2Skeleton key={i} />)}
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="text-center py-24 rounded-2xl border" style={{ background: '#161b22', borderColor: '#30363d' }}>
                        <div className="text-6xl mb-4">🔒</div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                            {signals.length === 0 ? 'No Pullback Signals Found' : 'No Signals Match Filter'}
                        </h3>
                        <p className="text-sm max-w-md mx-auto mb-6" style={{ color: '#8b949e' }}>
                            {signals.length === 0
                                ? 'The market isn\'t showing qualified pullback entries right now. Signals require 3/3 trend gates + 2/3 pullback gates + AI confirmation.'
                                : 'Try changing the filter to see more signals.'}
                        </p>
                        {signals.length === 0 && (
                            <button
                                onClick={triggerScan}
                                disabled={isScanning}
                                className="px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider"
                                style={{
                                    background: 'rgba(0,217,126,0.15)',
                                    border: '1px solid rgba(0,217,126,0.4)',
                                    color: '#00d97e',
                                }}
                            >
                                🔄 Scan Now
                            </button>
                        )}
                        {signals.length > 0 && (
                            <button
                                onClick={() => setFilter('ALL')}
                                className="text-xs font-bold uppercase hover:underline"
                                style={{ color: '#00d97e' }}
                            >
                                Clear Filter
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {displayed.map(s => (
                            <V2SignalCard key={s.id} signal={s} onExecute={onExecute} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IronGateV2Scanner;
