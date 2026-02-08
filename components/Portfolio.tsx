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
}

// --- CONSTANTS & MOCK DATA ---
const MOCK_STATS: PortfolioStats = {
    totalEquity: 124592.84,
    dailyGainAmount: 4210.30,
    dailyGainPercent: 3.2,
    realizedProfit: "12.4k",
    profitGrowth: 8,
    openPositions: 8
};

const MOCK_TRADES: Trade[] = [
    {
        id: '1',
        ticker: 'NVDA',
        name: 'NVIDIA Corporation',
        price: 185.41,
        entryPrice: 172.10,
        status: 'Strong Buy',
        gainAmount: 1240.50,
        gainPercent: 7.2,
        progress: 75,
        icon: 'memory'
    },
    {
        id: '2',
        ticker: 'AAPL',
        name: 'Apple Inc.',
        price: 212.89,
        entryPrice: 215.10,
        status: 'Neutral',
        gainAmount: -240.20,
        gainPercent: -1.2,
        progress: 45,
        icon: 'phone_iphone'
    },
    {
        id: '3',
        ticker: 'TSLA',
        name: 'Tesla, Inc.',
        price: 248.15,
        entryPrice: 240.00,
        status: 'Strong Buy',
        gainAmount: 815.00,
        gainPercent: 3.4,
        progress: 50,
        icon: 'electric_car'
    },
    {
        id: '4',
        ticker: 'AMD',
        name: 'Advanced Micro Devices',
        price: 156.78,
        entryPrice: 145.20,
        status: 'Strong Buy',
        gainAmount: 512.40,
        gainPercent: 4.5,
        progress: 60,
        icon: 'developer_board'
    },
    {
        id: '5',
        ticker: 'GOOGL',
        name: 'Alphabet Inc.',
        price: 178.35,
        entryPrice: 180.00,
        status: 'Neutral',
        gainAmount: -120.50,
        gainPercent: -0.9,
        progress: 30,
        icon: 'search'
    },
];

// --- COMPONENTS ---

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

const Portfolio: React.FC = () => {
    const [trades] = useState(MOCK_TRADES);
    const [stats] = useState(MOCK_STATS);

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
                <section className="bg-slate-50 dark:bg-white/5 rounded-xl p-6 border border-gray-200 dark:border-white/5 border-dashed flex flex-col md:flex-row items-center gap-6">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                        <span className="material-symbols-outlined text-2xl">psychology</span>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">AI Insight</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium italic">
                            "Market sentiment shifting. Consider hedging your TSLA position before the Q4 earnings call next week due to increased volatility."
                        </p>
                    </div>
                    <button className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-6 py-3 rounded-lg hover:bg-indigo-500/20 transition-colors uppercase tracking-widest">
                        View Analysis
                    </button>
                </section>

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {trades.map(trade => (
                            <TradeCard key={trade.id} trade={trade} />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Portfolio;
