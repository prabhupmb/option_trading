import React, { useState, useMemo } from 'react';
import { useSignals, SmartSignal } from '../hooks/useSignals';
import { useAuth } from '../services/useAuth';
import SignalCard from './signals/SignalCard';
import SignalFilters from './signals/SignalFilters';
import SignalStats from './signals/SignalStats';
import SignalSkeleton from './signals/SignalSkeleton';
import UploadWatchlistModal from './signals/UploadWatchlistModal';
import WatchlistManager from './signals/WatchlistManager';
import ExecuteStockTradeModal from './ExecuteStockTradeModal';
import DataDelayBanner from './DataDelayBanner';
import { supabase } from '../services/supabase';

/* ════════════════════════════════════════════════════════
   DAY TRADE: types, mock data, sub-components
   ════════════════════════════════════════════════════════ */

interface DayTradeSignal {
    id: string;
    symbol: string;
    price: number;
    action: 'BUY' | 'SELL';
    signalType: string;
    signalIcon: string;
    tier: string;
    gatesPassed: number;
    totalGates: number;
    gates: { g1: boolean; g2: boolean; g3: boolean; g4: boolean };
    entry: number;
    target: number;
    target2?: number;
    stopLoss: number;
    rr: number;
    volume: number;
    vwap?: number;
    vwapPosition?: 'ABOVE' | 'BELOW';
    adx?: number;
    gap?: number;
    analysis: string;
    risk: string;
    source: 'watchlist' | 'trending';
    trendScore?: number;
    trendSources?: string[];
    isTrending?: boolean;
}

function getMarketClock() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const h = et.getHours(), m = et.getMinutes();
    const day = et.getDay();
    const timeInMins = h * 60 + m;
    const isWeekday = day >= 1 && day <= 5;
    const isOpen = isWeekday && timeInMins >= 570 && timeInMins < 960;
    const isPowerHour = isWeekday && timeInMins >= 900 && timeInMins < 960;
    const minsLeft = isOpen ? 960 - timeInMins : 0;
    const timeStr = et.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { isOpen, isPowerHour, minsLeft, timeStr };
}

const WATCHLIST_SIGNALS: DayTradeSignal[] = [
    { id: 'w1', symbol: 'NVDA', price: 878.42, action: 'BUY', signalType: 'BREAKOUT', signalIcon: '📈', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 876, target: 895, target2: 910, stopLoss: 868, rr: 2.4, volume: 1.8, vwap: 872.30, vwapPosition: 'ABOVE', adx: 34.2, gap: 1.2, analysis: 'SuperTrend bullish flip confirmed with strong VWAP reclaim above $872. Volume surge 1.8x signals institutional participation.', risk: 'Extended from 20 EMA; gap fill possible if momentum stalls', source: 'watchlist' },
    { id: 'w2', symbol: 'AMD', price: 162.30, action: 'BUY', signalType: 'MOMENTUM', signalIcon: '↗', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 161.5, target: 168, target2: 172, stopLoss: 158.8, rr: 2.4, volume: 2.1, vwap: 160.15, vwapPosition: 'ABOVE', adx: 28.7, gap: 0.8, analysis: 'All 4 gates confirmed. Strong ADX trend with volume spike 2.1x above average. VWAP acting as support at $160.', risk: 'Approaching resistance at $165 — partial profit advised', source: 'watchlist' },
    { id: 'w3', symbol: 'META', price: 512.10, action: 'SELL', signalType: 'REVERSAL', signalIcon: '🔄', tier: 'A', gatesPassed: 3, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: false }, entry: 513, target: 502, stopLoss: 518.5, rr: 2.0, volume: 0.9, vwap: 515.80, vwapPosition: 'BELOW', adx: 21.4, gap: -0.5, analysis: 'Bearish reversal pattern forming below VWAP. SuperTrend flipped red but volume below average at 0.9x.', risk: 'Low volume reduces conviction — use tighter stop', source: 'watchlist' },
    { id: 'w4', symbol: 'TSLA', price: 178.90, action: 'BUY', signalType: 'PULLBACK', signalIcon: '↘', tier: 'A', gatesPassed: 3, totalGates: 4, gates: { g1: true, g2: false, g3: true, g4: true }, entry: 178, target: 185.5, target2: 190, stopLoss: 174.2, rr: 1.95, volume: 0.7, vwap: 180.20, vwapPosition: 'BELOW', adx: 18.3, gap: -0.3, analysis: 'Healthy pullback to 9 EMA support. Gate 2 (VWAP) not yet reclaimed — wait for confirmation above $180.', risk: 'Below VWAP; needs $180 reclaim or risk further decline', source: 'watchlist' },
];

const TRENDING_SIGNALS: DayTradeSignal[] = [
    { id: 't1', symbol: 'SMCI', price: 892, action: 'BUY', signalType: 'BREAKOUT', signalIcon: '📈', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 888, target: 920, stopLoss: 875, rr: 2.5, volume: 3.2, vwap: 878.50, vwapPosition: 'ABOVE', adx: 41.8, gap: 4.1, analysis: 'Massive gap-up breakout on AI server demand news. All gates firing with 3.2x volume.', risk: 'Highly extended — chase risk elevated above $900', source: 'trending', trendScore: 98, trendSources: ['GAINER', 'ACTIVE'], isTrending: true },
    { id: 't2', symbol: 'PLTR', price: 24.18, action: 'BUY', signalType: 'MOMENTUM', signalIcon: '↗', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 23.90, target: 25.50, stopLoss: 23.20, rr: 2.3, volume: 2.4, vwap: 23.65, vwapPosition: 'ABOVE', adx: 32.1, gap: 3.2, analysis: 'Continued momentum on government contract pipeline. Strong ADX trend with consistent volume.', risk: 'Near $25 psychological resistance — partial exits recommended', source: 'trending', trendScore: 92, trendSources: ['GAINER', 'ACTIVE'], isTrending: true },
    { id: 't3', symbol: 'IONQ', price: 14.82, action: 'BUY', signalType: 'BREAKOUT', signalIcon: '📈', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 14.50, target: 16.20, stopLoss: 13.80, rr: 2.4, volume: 4.1, vwap: 14.10, vwapPosition: 'ABOVE', adx: 38.4, gap: 5.8, analysis: 'Quantum computing momentum driving massive breakout. 4.1x volume confirms institutional interest.', risk: 'Low float stock — expect volatility; size positions smaller', source: 'trending', trendScore: 95, trendSources: ['GAINER', 'ACTIVE'], isTrending: true },
    { id: 't4', symbol: 'COIN', price: 228.4, action: 'SELL', signalType: 'FADE', signalIcon: '🌊', tier: 'A', gatesPassed: 3, totalGates: 4, gates: { g1: true, g2: true, g3: false, g4: true }, entry: 229, target: 220, stopLoss: 233, rr: 2.3, volume: 1.3, vwap: 231.50, vwapPosition: 'BELOW', adx: 15.2, gap: -1.2, analysis: 'Fading gap-down with weak ADX trend. Below VWAP with bearish momentum building.', risk: 'Crypto correlation risk — BTC bounce could reverse setup', source: 'trending', trendScore: 71, trendSources: ['ACTIVE'], isTrending: false },
    { id: 't5', symbol: 'MSTR', price: 1342, action: 'BUY', signalType: 'MOMENTUM', signalIcon: '↗', tier: 'A', gatesPassed: 3, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: false }, entry: 1335, target: 1400, stopLoss: 1305, rr: 2.2, volume: 1.1, vwap: 1328, vwapPosition: 'ABOVE', adx: 25.6, gap: 2.7, analysis: 'BTC proxy trade riding crypto momentum. 3 of 4 gates confirmed but volume lagging.', risk: 'Volume gate not passed — momentum could fade', source: 'trending', trendScore: 76, trendSources: ['ACTIVE'], isTrending: false },
    { id: 't6', symbol: 'SOUN', price: 8.16, action: 'BUY', signalType: 'BREAKOUT', signalIcon: '📈', tier: 'A+', gatesPassed: 4, totalGates: 4, gates: { g1: true, g2: true, g3: true, g4: true }, entry: 8.00, target: 9.20, stopLoss: 7.50, rr: 2.4, volume: 3.8, vwap: 7.85, vwapPosition: 'ABOVE', adx: 36.9, gap: 3.9, analysis: 'AI voice tech breakout on partnership news. Massive 3.8x volume with all gates confirmed.', risk: 'Small-cap volatility — no options liquidity for hedging', source: 'trending', trendScore: 89, trendSources: ['GAINER', 'ACTIVE'], isTrending: true },
];

/* Day Trade Sub-Components */

const DtStatCard: React.FC<{ label: string; value: React.ReactNode; icon: string; iconColor?: string }> = ({ label, value, icon, iconColor = 'text-blue-500' }) => (
    <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
        <span className={`material-symbols-outlined absolute top-3 right-3 text-lg opacity-20 ${iconColor}`}>{icon}</span>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <div className="text-xl font-black text-white">{value}</div>
    </div>
);

const GateBadge: React.FC<{ label: string; passed: boolean }> = ({ label, passed }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${passed ? 'bg-teal-500/10 text-teal-400' : 'bg-gray-700/30 text-gray-600'}`}>
        {label} {passed ? '✓' : '✗'}
    </span>
);

const DayTradeCard: React.FC<{ signal: DayTradeSignal }> = ({ signal }) => {
    const [expanded, setExpanded] = useState(false);
    const isBuy = signal.action === 'BUY';
    const avatarBg = isBuy ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400';
    const volColor = signal.volume >= 1.5 ? 'text-green-400' : signal.volume >= 1 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-all cursor-pointer group" onClick={() => setExpanded(!expanded)}>
            {/* Top Row */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-black text-sm ${avatarBg}`}>{signal.symbol.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-black text-sm tracking-tight">{signal.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{signal.action}</span>
                        <span className="text-gray-500 text-[10px]">{signal.signalIcon} {signal.signalType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${signal.tier === 'A+' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>{signal.tier}</span>
                        {signal.isTrending && <span className="text-[10px]">🔥</span>}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${signal.gatesPassed === 4 ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{signal.gatesPassed}/{signal.totalGates}</span>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-white font-mono font-bold text-sm">${signal.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-gray-600 text-[9px] uppercase tracking-wider">Current</p>
                </div>
            </div>

            {/* Levels Row */}
            <div className="grid grid-cols-5 gap-2 mb-3">
                {[
                    { label: 'ENTRY', value: signal.entry, color: 'text-white' },
                    { label: 'TARGET', value: signal.target, color: 'text-green-400' },
                    { label: 'STOP', value: signal.stopLoss, color: 'text-red-400' },
                    { label: 'R/R', value: `1:${signal.rr.toFixed(1)}`, color: 'text-blue-400', isStr: true },
                    { label: 'VOL', value: `${signal.volume.toFixed(1)}x`, color: volColor, isStr: true },
                ].map(({ label, value, color, isStr }) => (
                    <div key={label} className="text-center">
                        <p className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">{label}</p>
                        <p className={`text-xs font-mono font-bold mt-0.5 ${color}`}>
                            {isStr ? value : `$${(value as number).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </p>
                    </div>
                ))}
            </div>

            {/* Analysis */}
            <div className="border-l-2 border-blue-500/30 pl-3 mb-2">
                <p className="text-gray-300 text-[11px] leading-relaxed">{signal.analysis}</p>
                <p className="text-gray-500 text-[10px] italic mt-1">⚠ Risk: {signal.risk}</p>
            </div>

            {/* Gate Status */}
            <div className="flex items-center gap-1.5 mt-2">
                <GateBadge label="G1" passed={signal.gates.g1} />
                <GateBadge label="G2" passed={signal.gates.g2} />
                <GateBadge label="G3" passed={signal.gates.g3} />
                <GateBadge label="G4" passed={signal.gates.g4} />
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-800/40">
                    {[
                        { label: 'VWAP', value: signal.vwap ? `$${signal.vwap.toFixed(2)}` : '—', sub: signal.vwapPosition || '', subColor: signal.vwapPosition === 'ABOVE' ? 'text-green-400' : 'text-red-400' },
                        { label: 'ADX', value: signal.adx?.toFixed(1) || '—', sub: (signal.adx || 0) >= 25 ? 'TRENDING' : 'WEAK', subColor: (signal.adx || 0) >= 25 ? 'text-teal-400' : 'text-gray-500' },
                        { label: 'TARGET 2', value: signal.target2 ? `$${signal.target2.toFixed(2)}` : '—', sub: '', subColor: '' },
                        { label: 'GAP', value: signal.gap ? `${signal.gap > 0 ? '+' : ''}${signal.gap.toFixed(1)}%` : '—', sub: '', subColor: (signal.gap || 0) > 0 ? 'text-green-400' : 'text-red-400' },
                    ].map(({ label, value, sub, subColor }) => (
                        <div key={label} className="bg-[#0d1117] rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">{label}</p>
                            <p className="text-white font-mono font-bold text-xs mt-0.5">{value}</p>
                            {sub && <p className={`text-[9px] font-bold ${subColor}`}>{sub}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Trending Bar */}
            {signal.source === 'trending' && signal.trendScore && (
                <div className="mt-3 pt-2 border-t border-orange-500/10 flex items-center gap-2">
                    <span className="text-[10px]">🔥</span>
                    <span className="text-[10px] text-orange-400 font-bold">Score: {signal.trendScore}</span>
                    <span className="text-gray-700 text-[10px]">·</span>
                    <span className="text-[10px] text-gray-500">{signal.trendSources?.join(' + ')}</span>
                </div>
            )}
        </div>
    );
};

/* ════════════════════════════════════════════════════════
   DAY TRADE VIEW (rendered inside SignalFeed)
   ════════════════════════════════════════════════════════ */

const DayTradeView: React.FC = () => {
    const [dtFilter, setDtFilter] = useState('ALL');
    const [dtSort, setDtSort] = useState('Confidence');
    const [dtSearch, setDtSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const clock = getMarketClock();

    const handleDayTradeRefresh = async () => {
        setRefreshing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await fetch('https://prabhupadala01.app.n8n.cloud/webhook/refresh-daytrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: user?.email })
            });
        } catch (err) {
            console.error('Day trade refresh failed:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const allSignals = [...WATCHLIST_SIGNALS, ...TRENDING_SIGNALS];
    const buyCount = allSignals.filter(s => s.action === 'BUY').length;
    const sellCount = allSignals.filter(s => s.action === 'SELL').length;
    const confirmedCount = allSignals.filter(s => s.gatesPassed >= 4).length;
    const monitorCount = allSignals.filter(s => s.gatesPassed < 4).length;
    const trendingCount = TRENDING_SIGNALS.filter(s => s.isTrending).length;

    const filterSort = (signals: DayTradeSignal[]) => {
        let result = [...signals];
        if (dtSearch.trim()) { const q = dtSearch.trim().toUpperCase(); result = result.filter(s => s.symbol.includes(q)); }
        if (dtFilter === 'BUY') result = result.filter(s => s.action === 'BUY');
        else if (dtFilter === 'SELL') result = result.filter(s => s.action === 'SELL');
        else if (dtFilter === 'TRIGGERED') result = result.filter(s => s.gatesPassed >= 4);
        else if (dtFilter === 'WATCHING') result = result.filter(s => s.gatesPassed < 4);
        result.sort((a, b) => {
            if (dtSort === 'Symbol') return a.symbol.localeCompare(b.symbol);
            if (dtSort === 'R:R') return b.rr - a.rr;
            if (dtSort === 'Tier') return (b.tier === 'A+' ? 1 : 0) - (a.tier === 'A+' ? 1 : 0);
            if (dtSort === 'Trend Score') return (b.trendScore || 0) - (a.trendScore || 0);
            return (b.gatesPassed * 10 + (b.tier === 'A+' ? 5 : 0)) - (a.gatesPassed * 10 + (a.tier === 'A+' ? 5 : 0));
        });
        return result;
    };

    const filteredWL = useMemo(() => filterSort(WATCHLIST_SIGNALS), [dtFilter, dtSort, dtSearch]);
    const filteredTR = useMemo(() => filterSort(TRENDING_SIGNALS), [dtFilter, dtSort, dtSearch]);

    return (
        <>
            {/* Day Trade Banner */}
            <div className="mb-6 bg-amber-950/20 border border-amber-900/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm">⚡</span>
                    <p className="text-amber-300/90 text-xs font-medium truncate">
                        Day trade signals refresh every <strong className="text-amber-200">5 min</strong> via Twelvedata. Trending stocks sourced from Gainers + Most Active.
                    </p>
                </div>
                <button onClick={handleDayTradeRefresh} disabled={refreshing}
                    className="px-3 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-[11px] font-bold border border-amber-800/40 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                    <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin' : ''}`}>refresh</span> {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Day Trade Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <DtStatCard label="Total Signals" value={allSignals.length} icon="monitoring" iconColor="text-blue-500" />
                <DtStatCard label="Buy / Sell" value={<>{buyCount} <span className="text-gray-600">/</span> {sellCount}</>} icon="swap_vert" iconColor="text-green-500" />
                <DtStatCard label="Confirmed / Monitor" value={<>{confirmedCount} <span className="text-gray-600">/</span> {monitorCount}</>} icon="verified" iconColor="text-teal-500" />
                <DtStatCard label="Trending Today" value={<>{trendingCount} <span className="text-sm">🔥</span></>} icon="trending_up" iconColor="text-orange-500" />
            </div>

            {/* Gate Legend */}
            <div className="mb-6 flex items-center gap-3 bg-[#161b27]/60 rounded-xl px-4 py-2 border border-white/[0.03] flex-wrap">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">5-Gate System:</span>
                {[
                    { label: 'G1 SuperTrend', color: 'bg-teal-500' },
                    { label: 'G2 VWAP', color: 'bg-blue-500' },
                    { label: 'G3 ADX+DI', color: 'bg-purple-500' },
                    { label: 'G4 Volume', color: 'bg-amber-500' },
                ].map(({ label, color }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0d1117] text-[10px] text-gray-400 font-medium border border-gray-800/40">
                        <span className={`w-1.5 h-1.5 rounded-full ${color}`}></span>{label}
                    </span>
                ))}
            </div>

            {/* Day Trade Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 bg-[#1a1f2e] border border-gray-800 rounded-xl p-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {['ALL', 'BUY', 'SELL', 'WATCHING', 'TRIGGERED'].map(f => (
                        <button key={f} onClick={() => setDtFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${dtFilter === f ? 'bg-blue-600 text-white border-blue-500' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800 hover:text-white'}`}>
                            {f === 'ALL' ? 'All Signals' : f}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Sort by:</span>
                    {['Confidence', 'Symbol', 'R:R', 'Tier', 'Trend Score'].map(s => (
                        <button key={s} onClick={() => setDtSort(s)}
                            className={`text-[11px] font-bold transition-colors ${dtSort === s ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Market Clock + Search Row */}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${clock.isOpen ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${clock.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        {clock.isOpen ? `OPEN  ${clock.timeStr} ET  ${clock.minsLeft}m left` : `CLOSED  ${clock.timeStr} ET`}
                    </div>
                    {clock.isPowerHour && (
                        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-2">
                            <span>⚡</span> POWER HOUR
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 bg-[#1a1f2e] border border-gray-800 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-gray-500 text-sm">search</span>
                    <input type="text" value={dtSearch} onChange={e => setDtSearch(e.target.value)} placeholder="Search Ticker..."
                        className="bg-transparent border-none outline-none text-xs text-white placeholder-gray-600 w-32 focus:w-48 transition-all" />
                    {dtSearch && <button onClick={() => setDtSearch('')} className="text-gray-400 hover:text-white"><span className="material-symbols-outlined text-sm">close</span></button>}
                </div>
            </div>

            {/* Two Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Watchlist Panel */}
                <div>
                    <div className="flex items-center gap-3 mb-4 pl-3 border-l-2 border-blue-500">
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                                📋 Watchlist Signals <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">{filteredWL.length}</span>
                            </h2>
                            <p className="text-gray-600 text-[10px] mt-0.5">Your curated symbols</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {filteredWL.map(s => <DayTradeCard key={s.id} signal={s} />)}
                        {filteredWL.length === 0 && <div className="text-center py-12 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">No watchlist signals match your filter</div>}
                    </div>
                </div>

                {/* Trending Panel */}
                <div>
                    <div className="flex items-center gap-3 mb-4 pl-3 border-l-2 border-orange-500">
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                                🔥 Trending Signals <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px] font-bold">{filteredTR.length}</span>
                            </h2>
                            <p className="text-gray-600 text-[10px] mt-0.5 flex items-center gap-2">
                                Twelvedata Gainers + Most Active
                                <span className="flex items-center gap-1 ml-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span><span className="text-[9px] text-gray-600">GAINER</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1"></span><span className="text-[9px] text-gray-600">ACTIVE</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-1"></span><span className="text-[9px] text-gray-600">BOTH</span>
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {filteredTR.map(s => <DayTradeCard key={s.id} signal={s} />)}
                        {filteredTR.length === 0 && <div className="text-center py-12 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">No trending signals match your filter</div>}
                    </div>
                </div>
            </div>
        </>
    );
};

/* ════════════════════════════════════════════════════════
   MAIN SIGNAL FEED COMPONENT (merged)
   ════════════════════════════════════════════════════════ */

type FeedMode = 'swing' | 'daytrade';

const SignalFeed: React.FC = () => {
    const { signals, loading, error, lastUpdated, refresh } = useSignals();
    const { accessLevel, role } = useAuth();

    const [feedMode, setFeedMode] = useState<FeedMode>('swing');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('Confidence');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showWatchlists, setShowWatchlists] = useState(false);
    const [executingSignal, setExecutingSignal] = useState<SmartSignal | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Swing trade filter + sort
    const processedSignals = useMemo(() => {
        let result = [...signals];
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toUpperCase();
            result = result.filter(s => s.symbol.toUpperCase().includes(q));
        }
        if (activeFilter !== 'ALL') result = result.filter(s => s.signal_type === activeFilter);
        result.sort((a, b) => {
            if (sortBy === 'Symbol') return a.symbol.localeCompare(b.symbol);
            if (sortBy === 'Signal') return a.signal_type.localeCompare(b.signal_type);
            if (sortBy === 'Confidence') {
                const rank: Record<string, number> = { strong: 3, moderate: 2, weak: 1 };
                return (rank[b.confidence] || 0) - (rank[a.confidence] || 0);
            }
            return 0;
        });
        return result;
    }, [signals, activeFilter, sortBy, searchQuery]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0f1219] min-h-screen text-slate-900 dark:text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8">

                {/* ── Mode Toggle + Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-3">
                            {feedMode === 'swing' ? (
                                <span className="material-symbols-outlined text-4xl text-blue-500">smart_toy</span>
                            ) : (
                                <span className="text-2xl">⚡</span>
                            )}
                            {feedMode === 'swing' ? 'Stock Feed' : 'Day Trade'}
                        </h1>
                        <p className="text-gray-500 text-sm font-medium mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            {feedMode === 'swing'
                                ? 'Live Analysis • All active watchlists refresh daily'
                                : 'Intraday Scalp Scanner • 5-Gate v5.3 refreshes every 5 min'}
                            <span className="text-gray-600">•</span>
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Mode Toggle */}
                        <div className="flex bg-[#0d1117] rounded-lg border border-gray-800 p-0.5">
                            <button onClick={() => setFeedMode('swing')}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${feedMode === 'swing'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-gray-500 hover:text-white'
                                    }`}>
                                <span className="material-symbols-outlined text-sm">query_stats</span> Swing
                            </button>
                            <button onClick={() => setFeedMode('daytrade')}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${feedMode === 'daytrade'
                                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                                    : 'text-gray-500 hover:text-white'
                                    }`}>
                                <span className="text-xs">⚡</span> Day Trade
                            </button>
                        </div>

                        {/* Swing-only buttons */}
                        {feedMode === 'swing' && (
                            <>
                                <button onClick={() => setShowUploadModal(true)}
                                    className="bg-blue-50 dark:bg-[#1a1f2e] hover:bg-blue-100 dark:hover:bg-blue-600/10 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-sm">upload_file</span> Upload Watchlist
                                </button>
                                <button onClick={() => setShowWatchlists(!showWatchlists)}
                                    className={`bg-gray-100 dark:bg-[#1a1f2e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${showWatchlists ? 'text-slate-900 dark:text-white border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-800' : ''}`}>
                                    <span className="material-symbols-outlined text-sm">list</span> Watchlists
                                </button>
                                <button onClick={refresh} disabled={loading}
                                    className="bg-gray-100 dark:bg-[#1a1f2e] hover:bg-gray-200 dark:hover:bg-green-600/10 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-500/30 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50">
                                    <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span> Refresh
                                </button>
                                <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-[#1a1f2e] border border-gray-300 dark:border-gray-800 rounded-lg px-3 py-2">
                                    <span className="material-symbols-outlined text-gray-500 text-sm">search</span>
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Ticker..."
                                        className="bg-transparent border-none outline-none text-xs text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 w-32 focus:w-48 transition-all" />
                                    {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white transition-colors"><span className="material-symbols-outlined text-sm">close</span></button>}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Body: Swing Trade or Day Trade ── */}
                {feedMode === 'swing' ? (
                    <>
                        {/* Swing Trade Data Delay Banner */}
                        <DataDelayBanner onRefresh={refresh} loading={loading} isAdmin={role === 'admin'} />

                        {/* Collapsible Watchlist Manager */}
                        {showWatchlists && (
                            <div className="mb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                                <WatchlistManager onUpdate={refresh} />
                            </div>
                        )}

                        <UploadWatchlistModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadSuccess={refresh} />

                        {/* Loading / Error / Content */}
                        {loading && signals.length === 0 ? (
                            <div className="space-y-6">
                                <div className="h-24 bg-gray-200 dark:bg-[#1a1f2e] rounded-xl animate-pulse"></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3, 4, 5, 6].map(i => <SignalSkeleton key={i} />)}
                                </div>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 border border-red-500/20 rounded-xl">
                                <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error_outline</span>
                                <h3 className="text-xl font-bold">Analysis Failed</h3>
                                <p className="text-red-400 mt-2">{error}</p>
                                <button onClick={refresh} className="mt-6 bg-red-600 text-white px-6 py-2 rounded-lg font-bold uppercase hover:bg-red-500 transition-colors">Try Again</button>
                            </div>
                        ) : (
                            <>
                                <SignalStats signals={signals} />
                                <SignalFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} sortBy={sortBy} onSortChange={setSortBy} />
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                                    {processedSignals.map((signal) => (
                                        <SignalCard key={signal.id} signal={signal} accessLevel={accessLevel || 'signal'} onExecute={setExecutingSignal} />
                                    ))}
                                </div>
                                {processedSignals.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-32 text-gray-500 border border-dashed border-gray-300 dark:border-gray-800 rounded-xl bg-gray-100/50 dark:bg-[#1a1f2e]/50">
                                        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">filter_list_off</span>
                                        <p className="text-lg font-medium">No signals match your filter</p>
                                        <button onClick={() => setActiveFilter('ALL')} className="mt-4 text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest text-sm">Clear Filters</button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    /* Day Trade Mode */
                    <DayTradeView />
                )}

            </div>

            {/* Stock Trade Modal (swing mode) */}
            <ExecuteStockTradeModal
                isOpen={!!executingSignal}
                signal={executingSignal}
                onClose={() => setExecutingSignal(null)}
                onSuccess={() => { setExecutingSignal(null); refresh(); }}
            />
        </div>
    );
};

export default SignalFeed;
