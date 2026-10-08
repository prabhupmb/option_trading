import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ──────────────────────────────────────────────────────
type TrendingRow = {
    symbol: string;
    name: string | null;
    sector: string | null;
    price: number;
    previous_close: number;
    change_pct: number;
    change_amount: number;
    gap_pct: number | null;
    volume: number;
    rel_vol: number | null;
    vwap: number | null;
    vs_vwap_pct: number | null;
    range_pos: number | null;
    day_high: number | null;
    day_low: number | null;
    trend_score: number | null;
    is_up: boolean;        up_rank: number | null;
    is_down: boolean;      down_rank: number | null;
    is_trending: boolean;  trend_rank: number | null;
    in_stock_list: boolean;
    in_option_list: boolean;
    stock_signal_dir: string | null;
    stock_signal_tier: string | null;
    option_signal_dir: string | null;
    option_signal_tier: string | null;
    signal_aligned: boolean;
    scan_id: string;
    scanned_at: string;
};

type Tab = 'up' | 'down' | 'trending';
type SignalFilter = 'all' | 'has_signal' | 'aligned';

// ─── Helpers ────────────────────────────────────────────────────
const fmt2 = (v: number | null | undefined): string =>
    v != null ? v.toFixed(2) : '—';

const fmtPrice = (v: number | null | undefined): string =>
    v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const fmtPct = (v: number | null | undefined): string => {
    if (v == null) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
};

const fmtVol = (v: number): string => {
    if (v >= 1e9)  return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3)  return `${(v / 1e3).toFixed(0)}K`;
    return v.toString();
};

const fmtTimeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
};

const isMarketHours = (): boolean => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const totalMins = now.getHours() * 60 + now.getMinutes();
    return totalMins >= 570 && totalMins < 960;
};

const isStale = (iso: string): boolean => {
    if (!isMarketHours()) return false;
    return Date.now() - new Date(iso).getTime() > 20 * 60 * 1000;
};

// ─── Sub-components ─────────────────────────────────────────────

const DayRangeBar: React.FC<{ pos: number | null }> = ({ pos }) => {
    if (pos == null) return <span className="text-slate-600">—</span>;
    const pct = Math.max(0, Math.min(1, pos)) * 100;
    return (
        <div className="relative w-20 h-1.5 bg-white/10 rounded-full">
            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rh-green shadow-[0_0_4px_rgba(0,200,5,0.5)]" style={{ left: `calc(${pct}% - 4px)` }} />
        </div>
    );
};

const SignalBadges: React.FC<{ row: TrendingRow }> = ({ row }) => {
    const hasAny = row.stock_signal_dir || row.option_signal_dir;
    if (!hasAny) return <span className="text-slate-600 text-[10px]">—</span>;

    return (
        <div className="flex flex-wrap gap-1">
            {row.stock_signal_dir && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                    row.stock_signal_dir === 'LONG'
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-red-400 bg-red-500/10 border-red-500/20'
                }`}>
                    STK {row.stock_signal_dir} {row.stock_signal_tier || ''}
                </span>
            )}
            {row.option_signal_dir && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                    row.option_signal_dir === 'CALL'
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-red-400 bg-red-500/10 border-red-500/20'
                }`}>
                    OPT {row.option_signal_dir} {row.option_signal_tier || ''}
                </span>
            )}
            {row.signal_aligned && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                    ✓ aligned
                </span>
            )}
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────
const TrendingStocks: React.FC<{ onNavigateToLifecycle?: (symbol: string) => void }> = ({ onNavigateToLifecycle }) => {
    const [rows, setRows] = useState<TrendingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'err'>('idle');
    const [tab, setTab] = useState<Tab>('up');
    const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
    const [, setTick] = useState(0); // force re-render for relative time

    const fetchData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('trending_latest')
                .select('*');
            if (!error && data) setRows(data as TrendingRow[]);
        } catch (e) {
            console.error('[Trending] fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const fetchInterval = setInterval(fetchData, 60_000);
        const tickInterval = setInterval(() => setTick(t => t + 1), 30_000);
        return () => { clearInterval(fetchInterval); clearInterval(tickInterval); };
    }, [fetchData]);

    const scannedAt = rows[0]?.scanned_at ?? null;
    const stale = scannedAt ? isStale(scannedAt) : false;

    // Check if any row has vs_vwap_pct
    const hasVwap = useMemo(() => rows.some(r => r.vs_vwap_pct != null), [rows]);

    // Tab counts
    const upCount = useMemo(() => rows.filter(r => r.is_up).length, [rows]);
    const downCount = useMemo(() => rows.filter(r => r.is_down).length, [rows]);
    const trendCount = useMemo(() => rows.filter(r => r.is_trending).length, [rows]);

    // Filtered + sorted rows for current tab
    const displayed = useMemo(() => {
        let filtered: TrendingRow[];
        if (tab === 'up') {
            filtered = rows.filter(r => r.is_up).sort((a, b) => (a.up_rank ?? 999) - (b.up_rank ?? 999));
        } else if (tab === 'down') {
            filtered = rows.filter(r => r.is_down).sort((a, b) => (a.down_rank ?? 999) - (b.down_rank ?? 999));
        } else {
            filtered = rows.filter(r => r.is_trending).sort((a, b) => (a.trend_rank ?? 999) - (b.trend_rank ?? 999));
        }

        if (signalFilter === 'has_signal') {
            filtered = filtered.filter(r => r.stock_signal_dir || r.option_signal_dir);
        } else if (signalFilter === 'aligned') {
            filtered = filtered.filter(r => r.signal_aligned);
        }

        return filtered;
    }, [rows, tab, signalFilter]);

    const getRank = (r: TrendingRow): number | null =>
        tab === 'up' ? r.up_rank : tab === 'down' ? r.down_rank : r.trend_rank;

    const hasSignalCount = useMemo(() => displayed.filter(r => r.stock_signal_dir || r.option_signal_dir).length, [displayed]);
    const alignedCount = useMemo(() => displayed.filter(r => r.signal_aligned).length, [displayed]);

    const handleScanNow = async () => {
        if (scanning) return;
        setScanning(true);
        setScanStatus('idle');
        try {
            await fetch('https://prabhupadala01.app.n8n.cloud/webhook/trending', { method: 'POST' });
            setScanStatus('ok');
            setTimeout(() => { fetchData(); setScanning(false); setScanStatus('idle'); }, 15_000);
        } catch {
            setScanStatus('err');
            setTimeout(() => { setScanning(false); setScanStatus('idle'); }, 3000);
        }
    };

    const handleSymbolClick = (symbol: string) => {
        if (onNavigateToLifecycle) onNavigateToLifecycle(symbol);
    };

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div className="p-6 md:px-8 max-w-[1500px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-rh-green/10 border border-rh-green/25 rounded-xl p-2.5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-rh-green text-xl">trending_up</span>
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                            Trending — our universe
                            {stale && (
                                <span className="text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-md px-2 py-0.5 uppercase tracking-widest">
                                    stale
                                </span>
                            )}
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {scannedAt ? `Updated ${fmtTimeAgo(scannedAt)}` : 'Waiting for first scan...'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleScanNow}
                    disabled={scanning}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all ${
                        scanStatus === 'ok'
                            ? 'bg-rh-green/10 border-rh-green/30 text-rh-green'
                            : scanStatus === 'err'
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : scanning
                                    ? 'bg-rh-green/5 border-rh-green/20 text-rh-green/60 cursor-not-allowed'
                                    : 'border-rh-green/40 text-rh-green hover:bg-rh-green/10'
                    }`}
                >
                    <span className={`material-symbols-outlined text-sm ${scanning ? 'animate-spin' : ''}`}>
                        {scanStatus === 'ok' ? 'check_circle' : scanStatus === 'err' ? 'error' : 'play_arrow'}
                    </span>
                    {scanStatus === 'ok' ? 'Scanning...' : scanStatus === 'err' ? 'Failed' : scanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-white/5 mb-4">
                {([
                    { id: 'up' as Tab,       label: 'Top Movers ↑', count: upCount },
                    { id: 'down' as Tab,     label: 'Top Movers ↓', count: downCount },
                    { id: 'trending' as Tab, label: 'Trending 🔥',  count: trendCount },
                ] as const).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            tab === t.id
                                ? 'border-rh-green text-rh-green'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            tab === t.id ? 'bg-rh-green/15 text-rh-green' : 'bg-white/5 text-slate-600'
                        }`}>{t.count}</span>
                    </button>
                ))}
            </div>

            {/* Signal filter chips */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {([
                    { id: 'all' as SignalFilter, label: 'All' },
                    { id: 'has_signal' as SignalFilter, label: `Has Signal (${hasSignalCount})` },
                    { id: 'aligned' as SignalFilter, label: `Aligned (${alignedCount})` },
                ] as const).map(f => (
                    <button
                        key={f.id}
                        onClick={() => setSignalFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${
                            signalFilter === f.id
                                ? 'bg-rh-green/10 border-rh-green/30 text-rh-green'
                                : 'bg-transparent border-[#1e2430] text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
                <span className="ml-auto text-[10px] text-slate-600 font-bold">{displayed.length} shown</span>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-4xl text-rh-green animate-spin">progress_activity</span>
                        <p className="text-slate-500 mt-3 text-sm font-medium animate-pulse">Loading trending data...</p>
                    </div>
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-20">
                    <span className="material-symbols-outlined text-5xl text-slate-700 mb-4 block">schedule</span>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">No scan yet today</p>
                    <p className="text-slate-600 text-xs mt-1">Runs every 15 min during market hours</p>
                </div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-16">
                    <span className="material-symbols-outlined text-4xl text-slate-700 mb-3 block">filter_list_off</span>
                    <p className="text-slate-500 text-sm font-bold">No matches for this filter</p>
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden sm:block bg-[#0d1117] border border-[#1e2430] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-[#1e2430] bg-[#111620]">
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest">Symbol</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Price</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Change %</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Gap %</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">Rel Vol</th>
                                        {hasVwap && <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-right">vs VWAP</th>}
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center">Day Range</th>
                                        <th className="px-3 py-2.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest">Signals</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayed.map((r) => {
                                        const rank = getRank(r);
                                        return (
                                            <tr key={r.symbol} className="border-b border-[#1e2430]/50 hover:bg-white/[0.02] transition-colors">
                                                <td className="px-3 py-3 text-[11px] text-slate-600 font-mono">{rank ?? '—'}</td>
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={() => handleSymbolClick(r.symbol)}
                                                        className="text-left group"
                                                    >
                                                        <span className="text-[13px] font-black text-white font-mono group-hover:text-rh-green transition-colors">{r.symbol}</span>
                                                        <span className="block text-[10px] text-slate-600 mt-0.5 max-w-[140px] truncate">{r.name || '—'}</span>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-semibold text-slate-200 font-mono">{fmtPrice(r.price)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                                        r.change_pct >= 0
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                        {fmtPct(r.change_pct)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right text-[11px] font-mono text-slate-400">{fmtPct(r.gap_pct)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    {r.rel_vol != null ? (
                                                        <span className={`text-[11px] font-mono ${r.rel_vol >= 2 ? 'font-black text-amber-400' : 'text-slate-400'}`}>
                                                            {r.rel_vol.toFixed(1)}×
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-[11px]">—</span>
                                                    )}
                                                </td>
                                                {hasVwap && (
                                                    <td className="px-3 py-3 text-right text-[11px] font-mono text-slate-400">{fmtPct(r.vs_vwap_pct)}</td>
                                                )}
                                                <td className="px-3 py-3 flex items-center justify-center h-full">
                                                    <DayRangeBar pos={r.range_pos} />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <SignalBadges row={r} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                        {displayed.map(r => {
                            const rank = getRank(r);
                            return (
                                <div key={r.symbol} className="bg-[#0d1117] border border-[#1e2430] rounded-xl p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <button onClick={() => handleSymbolClick(r.symbol)} className="text-left">
                                            <div className="flex items-center gap-2">
                                                {rank != null && <span className="text-[10px] text-slate-600 font-mono">#{rank}</span>}
                                                <span className="text-sm font-black text-white font-mono">{r.symbol}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 mt-0.5 block">{r.name || '—'}</span>
                                        </button>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-white font-mono block">{fmtPrice(r.price)}</span>
                                            <span className={`text-[11px] font-bold font-mono ${r.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {fmtPct(r.change_pct)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        {r.rel_vol != null && (
                                            <span className={`text-[10px] font-mono ${r.rel_vol >= 2 ? 'font-black text-amber-400' : 'text-slate-500'}`}>
                                                RV {r.rel_vol.toFixed(1)}×
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-600 font-mono">Vol {fmtVol(r.volume)}</span>
                                    </div>
                                    <SignalBadges row={r} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default TrendingStocks;
