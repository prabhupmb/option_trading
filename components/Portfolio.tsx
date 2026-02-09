import React, { useState } from 'react';

// --- TYPES ---
type Status = 'Strong Buy' | 'Neutral' | 'Weak Sell' | 'Strong Sell';

interface Trade {
    id: string;
    ticker: string;
    name: string;
    price: number;
    entryPrice: number;
    status: Status;
    gainAmount: number;
    gainPercent: number;
    progress: number;
    icon: string;
}

interface PortfolioStats {
    totalEquity: number;
    dailyGainAmount: number;
    dailyGainPercent: number;
    realizedProfit: string;
    profitGrowth: number;
    openPositions: number;
    buyingPower?: number;
}

// --- COMPONENTS ---

const EmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">satellite_alt</span>
        </div>
        <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Waiting for Signal Status
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Connect your portfolio via n8n webhook to see live performance data.
                <br />Waiting for data stream...
            </p>
        </div>
    </div>
);

const TotalEquityCard: React.FC<{ stats: PortfolioStats }> = ({ stats }) => (
    <section className="bg-white dark:bg-[#111111] rounded-xl p-8 border border-gray-100 dark:border-white/10 h-full flex flex-col justify-between shadow-sm">
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Equity</p>
            <div className="mb-6">
                <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                    ${stats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h2>
            </div>
            <div className="inline-flex items-center gap-2 bg-rh-green/10 px-4 py-2 rounded-lg">
                <span className="material-symbols-outlined text-rh-green text-lg">trending_up</span>
                <span className="text-sm font-black text-rh-green tracking-tight">
                    +${stats.dailyGainAmount.toLocaleString()} ({stats.dailyGainPercent}%)
                </span>
                <span className="text-[10px] text-rh-green/70 ml-1 font-bold tracking-widest uppercase">Today</span>
            </div>
        </div>
    </section>
);

const StatsColumn: React.FC<{ stats: PortfolioStats }> = ({ stats }) => (
    <div className="flex flex-col gap-4 h-full">
        <div className="bg-white dark:bg-[#111111] p-6 rounded-xl border border-gray-100 dark:border-white/10 flex-1 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Realized Profit</p>
            <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">${stats.realizedProfit}</span>
                <span className="text-[11px] text-rh-green font-bold bg-rh-green/10 px-2 py-1 rounded-md">+{stats.profitGrowth}%</span>
            </div>
        </div>
        <div className="bg-white dark:bg-[#111111] p-6 rounded-xl border border-gray-100 dark:border-white/10 flex-1 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Open Positions</p>
            <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.openPositions.toString().padStart(2, '0')}</span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400 text-[10px] rounded-md font-bold uppercase tracking-wider">Active</span>
            </div>
        </div>
    </div>
);

const TradeCard: React.FC<{ trade: Trade }> = ({ trade }) => {
    const isProfit = trade.gainAmount >= 0;
    const isNeutral = trade.status === 'Neutral';

    // Status Styles
    let accentBorder = 'border-l-4 border-slate-300 dark:border-gray-600';
    let statusColor = 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-gray-400';

    if (trade.status === 'Strong Buy' || trade.status === 'Strong Sell') { // Assuming 'Strong Sell' might be noteworthy but keeping simple logic for now
        if (isProfit || trade.status === 'Strong Buy') {
            accentBorder = 'border-l-4 border-rh-green';
            statusColor = 'bg-rh-green text-white shadow-lg shadow-rh-green/20';
        }
    }

    if (!isProfit && !isNeutral) {
        // accentBorder = 'border-l-4 border-rh-red'; // Optional: Use red for loss/sell
    }

    return (
        <div className={`bg-white dark:bg-[#111111] rounded-xl p-5 space-y-4 border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${accentBorder}`}>
            <div className="flex justify-between items-start">
                <div className="flex gap-3 min-w-0">
                    <div className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-xl flex items-center justify-center border border-gray-100 dark:border-white/5 shrink-0">
                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-xl">{trade.icon}</span>
                    </div>
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight truncate">{trade.ticker}</h4>
                            <span className={`${statusColor} text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0`}>
                                {trade.status}
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 truncate">{trade.name}</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-end border-t border-gray-50 dark:border-white/5 pt-3 mt-1">
                <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Price
                    </p>
                    <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        P&L
                    </p>
                    <p className={`text-base font-bold tracking-tight ${isProfit ? 'text-rh-green' : 'text-rh-red'}`}>
                        {isProfit ? '+' : ''}${Math.abs(trade.gainAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black tracking-widest uppercase">
                    <span className="text-slate-400">Progress</span>
                    <span className={isProfit ? 'text-rh-green' : 'text-rh-red'}>
                        {trade.gainPercent}%
                    </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isProfit ? 'bg-rh-green' : 'bg-rh-red'} rounded-full transition-all duration-700`}
                        style={{
                            width: `${trade.progress}%`
                        }}
                    ></div>
                </div>
            </div>

            <button className={`w-full ${isProfit ? 'bg-rh-green text-white shadow-lg shadow-rh-green/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'} hover:brightness-110 active:scale-[0.98] font-black text-[10px] py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all mt-2`}>
                <span className="material-symbols-outlined text-base">bolt</span>
                Execute
            </button>
        </div>
    );
};

import { fetchPortfolioData, PortfolioData } from '../services/n8n'; // Import service

const Portfolio: React.FC = () => {
    // Initialize state from LocalStorage if available to prevent loading screen
    const CACHE_VERSION = 'v2'; // Increment to force invalidation

    const [trades, setTrades] = useState<Trade[] | null>(() => {
        const cached = localStorage.getItem('portfolio_cache');
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        return parsed.version === CACHE_VERSION ? parsed.trades : null;
    });
    const [stats, setStats] = useState<PortfolioStats | null>(() => {
        const cached = localStorage.getItem('portfolio_cache');
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        return parsed.version === CACHE_VERSION ? parsed.stats : null;
    });
    const [aiInsight, setAiInsight] = useState<{ message: string } | null>(() => {
        const cached = localStorage.getItem('portfolio_cache');
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        return parsed.version === CACHE_VERSION ? parsed.aiInsight : null;
    });

    // Only show loading if we didn't find anything in cache
    const [loading, setLoading] = useState(() => !localStorage.getItem('portfolio_cache'));

    React.useEffect(() => {
        const loadData = async () => {
            // Background fetch - UI is already showing cached data if available
            const data = await fetchPortfolioData();

            if (data) {
                // Update State
                if (data.trades && Array.isArray(data.trades)) {
                    setTrades(data.trades);
                }
                if (data.stats) {
                    setStats(data.stats);
                }
                if (data.aiInsight?.message) {
                    setAiInsight({ message: data.aiInsight.message });
                }

                // Update Cache
                localStorage.setItem('portfolio_cache', JSON.stringify({
                    trades: data.trades || trades,
                    stats: data.stats || stats,
                    aiInsight: data.aiInsight ? { message: data.aiInsight.message } : aiInsight,
                    timestamp: Date.now(),
                    version: CACHE_VERSION
                }));
            }
            setLoading(false);
        };

        loadData(); // Initial load

        // Auto-refresh every 15 minutes ONLY when screen is visible
        const FIFTEEN_MINUTES = 15 * 60 * 1000;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const startPolling = () => {
            if (!intervalId) {
                intervalId = setInterval(loadData, FIFTEEN_MINUTES);
            }
        };

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadData(); // Refresh immediately when returning
                startPolling();
            } else {
                stopPolling();
            }
        };

        // Start polling if initially visible
        if (document.visibilityState === 'visible') {
            startPolling();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Skeleton loading state could be added here, but for now we settle for keeping old data until new arrives
    // or just showing the UI updates when they happen.

    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-rh-green animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Portfolio...</p>
            </div>
        );
    }

    // Empty State (No data from API)
    if (!trades || !stats) {
        return <EmptyState />;
    }

    return (
        <div className="flex-1 overflow-y-auto animate-in no-scrollbar rounded-2xl">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* Top Section: Equity & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:h-[220px]">
                    <div className="md:col-span-8 h-full">
                        <TotalEquityCard stats={stats} />
                    </div>
                    <div className="md:col-span-4 h-full">
                        <StatsColumn stats={stats} />
                    </div>
                </div>

                {/* AI Suggestion Banner */}
                {aiInsight && (
                    <section className="bg-slate-50 dark:bg-white/5 rounded-xl p-6 border border-gray-200 dark:border-white/5 border-dashed flex flex-col md:flex-row items-center gap-6">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                            <span className="material-symbols-outlined text-2xl">psychology</span>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">AI Insight</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium italic">
                                "{aiInsight.message}"
                            </p>
                        </div>
                        <button className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-6 py-3 rounded-lg hover:bg-indigo-500/20 transition-colors uppercase tracking-widest">
                            View Analysis
                        </button>
                    </section>
                )}

                {/* Active Trades Grid */}
                <section className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Active Positions</h3>
                            <span className="bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white text-[10px] font-bold px-2 py-0.5 rounded-md">{trades.length}</span>
                        </div>

                        <div className="flex gap-2">
                            <button className="text-slate-500 dark:text-slate-400 text-[10px] font-bold flex items-center gap-1 bg-white dark:bg-[#1e2124] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/5 hover:border-rh-green hover:text-rh-green transition-all uppercase tracking-wider">
                                <span className="material-symbols-outlined text-base">filter_list</span>
                                Filter
                            </button>
                            <button className="text-slate-500 dark:text-slate-400 text-[10px] font-bold flex items-center gap-1 bg-white dark:bg-[#1e2124] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/5 hover:border-rh-green hover:text-rh-green transition-all uppercase tracking-wider">
                                <span className="material-symbols-outlined text-base">sort</span>
                                Sort
                            </button>
                        </div>
                    </div>
                    {trades.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {trades.map(trade => (
                                <TradeCard key={trade.id} trade={trade} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-400 dark:text-slate-600 text-sm font-bold uppercase tracking-widest">
                            No active trades found
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Portfolio;
