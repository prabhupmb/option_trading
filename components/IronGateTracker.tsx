import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';

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
        stop_loss_pct?: number;
        take_profit_pct?: number;
        [key: string]: any;
    };
}

interface IronGatePosition {
    id: string;
    symbol: string;
    option_type: 'CALL' | 'PUT';
    tier: string;
    status: string;
    entry_price: number;
    current_price: number;
    target_price: number;
    stop_loss: number;
    progress_pct: number;
    pnl_pct: number;
    high_water_mark: number;
    low_water_mark: number;
    check_count: number;
    opened_at: string;
    closed_at: string | null;
    close_reason: string | null;
    gates_passed: number;
    g1_sma: boolean;
    g2_rsi: boolean;
    g3_macd: boolean;
    g4_volume: boolean;
    g5_bb: boolean;
    g6_adx: boolean;
    contract_symbol?: string;
    quantity?: number;
    strike?: number;
    expiry?: string;
}

interface IronGateHistory {
    id: string;
    position_id: string;
    symbol: string;
    option_type: 'CALL' | 'PUT';
    tier: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    pnl_dollar: number;
    result: 'WIN' | 'LOSS';
    exit_reason: string;
    duration_minutes: number;
    high_water_mark: number;
    low_water_mark: number;
    opened_at: string;
    closed_at: string;
    gates_passed: number;
}

// ─── HELPERS ─────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;

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

const timeSince = (dateStr: string): string => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    return formatDuration(mins);
};

// ─── PROGRESS BAR COMPONENT ─────────────────────────────────

const ProgressBar: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const { entry_price, current_price, target_price, stop_loss, progress_pct } = position;
    const pct = Math.max(0, Math.min(100, progress_pct));

    // Entry is at ~50% of the bar conceptually
    const entryPct = 50;

    return (
        <div className="space-y-2">
            {/* Labels row */}
            <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-red-400 flex items-center gap-1">🛑 SL {fmt(stop_loss)}</span>
                <span className="text-green-400 flex items-center gap-1">🎯 Target {fmt(target_price)}</span>
            </div>

            {/* Bar */}
            <div className="relative h-6 rounded-lg overflow-hidden bg-gray-800/80 border border-gray-700/60">
                {/* Gradient background */}
                <div className="absolute inset-0" style={{
                    background: 'linear-gradient(90deg, #991b1b 0%, #c2410c 20%, #ca8a04 45%, #16a34a 70%, #22c55e 100%)'
                }} />

                {/* Dark overlay for unfilled portion */}
                <div
                    className="absolute inset-0 bg-gray-900/70 transition-all duration-700 ease-out"
                    style={{ left: `${pct}%` }}
                />

                {/* Entry price marker line at ~50% */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/80 z-10"
                    style={{ left: `${entryPct}%` }}
                />
                <div
                    className="absolute -top-0.5 z-10 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-yellow-300"
                    style={{ left: `calc(${entryPct}% - 5px)` }}
                />

                {/* Current position indicator */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] z-20 transition-all duration-700 ease-out"
                    style={{ left: `${pct}%` }}
                />

                {/* % label overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-30">
                    <span className="text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        {pct.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Price annotations */}
            <div className="flex justify-between items-center text-[10px] text-gray-400">
                <span>Entry: <span className="text-yellow-400 font-mono font-bold">{fmt(entry_price)}</span></span>
                <span>Current: <span className={`font-mono font-bold ${current_price >= entry_price ? 'text-green-400' : 'text-red-400'}`}>{fmt(current_price)}</span></span>
                <span>Target: <span className="text-green-400 font-mono font-bold">{fmt(target_price)}</span></span>
            </div>
        </div>
    );
};

// ─── GATE DETAILS COMPONENT ─────────────────────────────────

const GATE_LABELS: Record<string, string> = {
    g1_sma: 'SMA Trend',
    g2_rsi: 'RSI Signal',
    g3_macd: 'MACD Cross',
    g4_volume: 'Volume Surge',
    g5_bb: 'BB Squeeze',
    g6_adx: 'ADX Strength',
};

const GateDetails: React.FC<{ position: IronGatePosition }> = ({ position }) => {
    const gates = ['g1_sma', 'g2_rsi', 'g3_macd', 'g4_volume', 'g5_bb', 'g6_adx'] as const;
    return (
        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-gray-800/60">
            {gates.map(g => {
                const passed = position[g];
                return (
                    <div key={g} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold border ${passed
                        ? 'bg-green-950/30 border-green-800/50 text-green-400'
                        : 'bg-red-950/20 border-red-800/30 text-red-400/60'
                        }`}>
                        <span>{passed ? '✅' : '❌'}</span>
                        <span>{GATE_LABELS[g]}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── POSITION CARD COMPONENT ────────────────────────────────

const PositionCard: React.FC<{
    position: IronGatePosition;
    onManualClose: (p: IronGatePosition) => void;
}> = ({ position, onManualClose }) => {
    const [expanded, setExpanded] = useState(false);
    const isCall = position.option_type === 'CALL';
    const tierColor = position.tier?.includes('+') ? 'text-amber-400 bg-amber-950/30 border-amber-700'
        : position.tier === 'A' ? 'text-gray-300 bg-gray-800 border-gray-600'
            : 'text-gray-500 bg-gray-900 border-gray-700';

    return (
        <div className="bg-[#0d1117] rounded-xl border border-gray-800 hover:border-gray-700 transition-all overflow-hidden">
            <div className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl font-black text-white">{position.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${isCall ? 'text-green-400 bg-green-950/30 border-green-800' : 'text-red-400 bg-red-950/30 border-red-800'}`}>
                            {position.option_type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${tierColor}`}>
                            {position.tier}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className={`text-lg font-black font-mono ${position.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.pnl_pct >= 0 ? '+' : ''}{position.pnl_pct?.toFixed(2)}%
                        </span>
                        <span className="block text-[10px] text-gray-500">P&L</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <ProgressBar position={position} />

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="text-center">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">High</span>
                        <span className="block text-xs font-bold text-green-400 font-mono">{position.high_water_mark?.toFixed(1)}%</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">Low</span>
                        <span className="block text-xs font-bold text-red-400 font-mono">{position.low_water_mark?.toFixed(1)}%</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">Duration</span>
                        <span className="block text-xs font-bold text-white">{timeSince(position.opened_at)}</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">Checks</span>
                        <span className="block text-xs font-bold text-white font-mono">{position.check_count || 0}</span>
                    </div>
                </div>

                {/* Actions row */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-800/60">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                        <span className={`material-symbols-outlined text-sm transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
                        Gate Details ({position.gates_passed || 0}/6)
                    </button>
                    <button
                        onClick={() => onManualClose(position)}
                        className="px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/40 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-900/40 hover:border-red-600/50 transition-all flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                        Close
                    </button>
                </div>

                {/* Expandable gate details */}
                {expanded && <GateDetails position={position} />}
            </div>
        </div>
    );
};

// ─── MANUAL CLOSE MODAL ─────────────────────────────────────

const ManualCloseModal: React.FC<{
    position: IronGatePosition | null;
    onClose: () => void;
    onConfirm: (position: IronGatePosition) => void;
    closing: boolean;
}> = ({ position, onClose, onConfirm, closing }) => {
    if (!position) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#0f1219] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
                style={{ animation: 'slideUp 0.25s ease' }}>
                <div className="p-4 border-b border-red-500/20 bg-red-900/10 flex justify-between items-center">
                    <h2 className="text-base font-black uppercase tracking-tight text-red-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        Manual Close Position
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-[#0d1117] rounded-xl p-4 border border-gray-700/60">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-lg font-black text-white">{position.symbol}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${position.option_type === 'CALL' ? 'text-green-400 bg-green-950/30 border-green-800' : 'text-red-400 bg-red-950/30 border-red-800'}`}>
                                {position.option_type}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">Entry</span>
                                <span className="text-white font-mono font-bold">{fmt(position.entry_price)}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">Current</span>
                                <span className={`font-mono font-bold ${position.current_price >= position.entry_price ? 'text-green-400' : 'text-red-400'}`}>
                                    {fmt(position.current_price)}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-gray-500 font-bold uppercase">P&L</span>
                                <span className={`font-mono font-bold ${position.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {position.pnl_pct >= 0 ? '+' : ''}{position.pnl_pct?.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                        <span className="text-amber-400 text-lg">⚠️</span>
                        <p className="text-amber-200 text-xs leading-relaxed">
                            This will manually close the position and record it in trade history. This action cannot be undone.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 border border-gray-700 text-gray-400 font-bold rounded-xl hover:bg-gray-800 transition-colors text-xs uppercase tracking-wide"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(position)}
                            disabled={closing}
                            className="flex-[2] py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {closing ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Closing...</>
                            ) : (
                                <><span className="material-symbols-outlined text-sm">close</span> Confirm Close</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

// ─── SKELETON LOADER ─────────────────────────────────────────

const PositionSkeleton: React.FC = () => (
    <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-4 space-y-3 animate-pulse">
        <div className="flex justify-between">
            <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-800 rounded" />
                <div className="h-5 w-12 bg-gray-800 rounded" />
                <div className="h-5 w-8 bg-gray-800 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-800 rounded" />
        </div>
        <div className="h-6 bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-gray-800 rounded" />)}
        </div>
    </div>
);

// ─── HISTORY SUMMARY STATS ──────────────────────────────────

const HistorySummaryStats: React.FC<{ history: IronGateHistory[] }> = ({ history }) => {
    if (history.length === 0) return null;

    const wins = history.filter(h => h.result === 'WIN');
    const losses = history.filter(h => h.result === 'LOSS');
    const winRate = (wins.length / history.length) * 100;
    const avgPnl = history.reduce((a, h) => a + (h.pnl_pct || 0), 0) / history.length;
    const totalPnlDollar = history.reduce((a, h) => a + (h.pnl_dollar || 0), 0);
    const bestTrade = history.reduce((best, h) => h.pnl_pct > best.pnl_pct ? h : best, history[0]);
    const worstTrade = history.reduce((worst, h) => h.pnl_pct < worst.pnl_pct ? h : worst, history[0]);
    const avgDuration = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;
    const avgHWM = wins.length > 0 ? wins.reduce((a, h) => a + (h.high_water_mark || 0), 0) / wins.length : 0;

    const stats = [
        { label: 'Total Trades', value: history.length.toString(), color: 'text-white' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-green-400' : 'text-red-400' },
        { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(1)}%`, color: avgPnl >= 0 ? 'text-green-400' : 'text-red-400' },
        { label: 'Total P&L', value: `${totalPnlDollar >= 0 ? '+' : ''}$${totalPnlDollar.toFixed(0)}`, color: totalPnlDollar >= 0 ? 'text-green-400' : 'text-red-400' },
        { label: 'Best Trade', value: `${bestTrade.symbol} +${bestTrade.pnl_pct.toFixed(1)}%`, color: 'text-green-400' },
        { label: 'Worst Trade', value: `${worstTrade.symbol} ${worstTrade.pnl_pct.toFixed(1)}%`, color: 'text-red-400' },
        { label: 'Avg Duration', value: formatDuration(avgDuration), color: 'text-white' },
        { label: 'Avg HWM (Wins)', value: `${avgHWM.toFixed(1)}%`, color: 'text-amber-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {stats.map(s => (
                <div key={s.label} className="bg-[#0d1117] rounded-xl border border-gray-800 p-3 text-center">
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

const IronGateTracker: React.FC = () => {
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
        console.log('[IronGate] fetchPositions:', { count: data?.length, error, data });
        if (!error && data) setPositions(data);
        setLoadingPositions(false);
    };

    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('iron_gate_history')
            .select('*')
            .order('closed_at', { ascending: false })
            .limit(50);
        console.log('[IronGate] fetchHistory:', { count: data?.length, error, data });
        if (!error && data) setHistory(data);
        setLoadingHistory(false);
    };

    // Initial load
    useEffect(() => {
        fetchConfig();
        fetchPositions();
        fetchHistory();
    }, []);

    // Poll open positions every 30s
    useEffect(() => {
        const interval = setInterval(fetchPositions, 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── Manual Close ─────────────────────────────────────

    const handleManualClose = async (position: IronGatePosition) => {
        setIsClosing(true);
        try {
            const pnl = ((position.current_price - position.entry_price) / position.entry_price) * 100;
            const durationMs = Date.now() - new Date(position.opened_at).getTime();
            const durationMinutes = Math.floor(durationMs / 60000);

            // Update position
            await supabase
                .from('iron_gate_positions')
                .update({
                    status: 'MANUAL_CLOSE',
                    closed_at: new Date().toISOString(),
                    close_reason: 'MANUAL',
                    pnl_pct: pnl,
                })
                .eq('id', position.id);

            // Insert into history
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
                    pnl_dollar: (position.current_price - position.entry_price) * (position.quantity || 1) * 100,
                    result: pnl >= 0 ? 'WIN' : 'LOSS',
                    exit_reason: 'MANUAL',
                    duration_minutes: durationMinutes,
                    high_water_mark: position.high_water_mark,
                    low_water_mark: position.low_water_mark,
                    opened_at: position.opened_at,
                    closed_at: new Date().toISOString(),
                    gates_passed: position.gates_passed,
                });

            // Refresh data
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

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0f1219] min-h-screen text-slate-900 dark:text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">

                {/* ── Section 1: Strategy Header ── */}
                <div className="bg-gradient-to-r from-[#0d1117] to-[#111827] rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-amber-900/20 border border-amber-700/40 flex items-center justify-center text-3xl">
                                    🔒
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                                        {config?.display_name || 'Iron Gate Tracker'}
                                        {config?.is_active && (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-950/30 border border-green-800/50 px-2.5 py-1 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                ACTIVE
                                            </span>
                                        )}
                                        {config && !config.is_active && (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-gray-500" />
                                                INACTIVE
                                            </span>
                                        )}
                                    </h1>
                                    <p className="text-gray-500 text-sm font-medium mt-1">
                                        Automated position tracking for A+/A tier signals
                                    </p>
                                </div>
                            </div>

                            {/* Key params */}
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

                        {/* Scan time badges */}
                        {config?.params?.scan_times && config.params.scan_times.length > 0 && (
                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scan Times:</span>
                                {config.params.scan_times.map((t: string, i: number) => (
                                    <span key={i} className="px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-mono font-bold">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Section Toggle ── */}
                <div className="flex bg-[#0d1117] rounded-lg border border-gray-800 p-0.5 w-fit">
                    <button
                        onClick={() => setActiveSection('positions')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'positions'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">radar</span>
                        Open Positions ({positions.length})
                    </button>
                    <button
                        onClick={() => setActiveSection('history')}
                        className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeSection === 'history'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">history</span>
                        Trade History ({history.length})
                    </button>
                </div>

                {/* ── Section 2: Open Positions ── */}
                {activeSection === 'positions' && (
                    <div>
                        {loadingPositions ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => <PositionSkeleton key={i} />)}
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-4">🔒</div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">No Open Positions</h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto">
                                    Iron Gate is watching your watchlist for A+/A signals. When a qualifying signal is detected, it will appear here with live tracking.
                                </p>
                                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-600">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span>Auto-polling every 30 seconds</span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {positions.map(p => (
                                    <PositionCard
                                        key={p.id}
                                        position={p}
                                        onManualClose={setClosingPosition}
                                    />
                                ))}
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
                                    <div key={i} className="h-12 bg-[#0d1117] rounded-lg border border-gray-800 animate-pulse" />
                                ))}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">No Trade History Yet</h3>
                                <p className="text-gray-500 text-sm">Closed positions will appear here with full performance data.</p>
                            </div>
                        ) : (
                            <>
                                <HistorySummaryStats history={history} />

                                {/* History Table */}
                                <div className="bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-800 bg-[#080c11]">
                                                    {['Symbol', 'Type', 'Tier', 'Entry', 'Exit', 'P&L%', 'Result', 'Duration', 'Exit Reason', 'Date'].map(col => (
                                                        <th key={col} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map(h => {
                                                    const isWin = h.result === 'WIN';
                                                    return (
                                                        <tr key={h.id} className={`border-b border-gray-800/50 ${isWin ? 'bg-green-950/5' : 'bg-red-950/5'}`}>
                                                            <td className="px-4 py-3 font-black text-white">{h.symbol}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${h.option_type === 'CALL' ? 'text-green-400 bg-green-950/30 border-green-800' : 'text-red-400 bg-red-950/30 border-red-800'}`}>
                                                                    {h.option_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400 font-bold">{h.tier}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.entry_price)}</td>
                                                            <td className="px-4 py-3 text-gray-300 font-mono">{fmt(h.exit_price)}</td>
                                                            <td className={`px-4 py-3 font-mono font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                                                {h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct?.toFixed(2)}%
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isWin
                                                                    ? 'text-green-400 bg-green-950/40 border border-green-800'
                                                                    : 'text-red-400 bg-red-950/40 border border-red-800'
                                                                    }`}>
                                                                    {h.result}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-400">{formatDuration(h.duration_minutes)}</td>
                                                            <td className="px-4 py-3 text-gray-500 uppercase text-[10px] font-bold">{h.exit_reason}</td>
                                                            <td className="px-4 py-3 text-gray-500 font-mono">
                                                                {new Date(h.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
