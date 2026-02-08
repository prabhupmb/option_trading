
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
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[#6D28D9] to-surface-dark rounded-[24px] p-8 glow-purple h-full flex flex-col justify-between">
        <div className="relative z-10">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60 mb-2">Total Equity</p>
            <div className="mb-6">
                <h2 className="text-[48px] font-[900] text-white tracking-tighter leading-none">
                    ${stats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h2>
            </div>
            <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
                <span className="material-symbols-outlined text-green-400 text-[18px]">trending_up</span>
                <span className="text-sm font-black text-green-400 tracking-tight">
                    +${stats.dailyGainAmount.toLocaleString()} ({stats.dailyGainPercent}%)
                </span>
                <span className="text-[10px] text-white/40 ml-1 font-bold tracking-widest uppercase">Today</span>
            </div>
        </div>
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-[60px]"></div>
        <div className="absolute left-1/2 top-0 w-32 h-32 bg-primary/20 rounded-full blur-[40px]"></div>
    </section>
);

const StatsColumn: React.FC<{ stats: PortfolioStats }> = ({ stats }) => (
    <div className="flex flex-col gap-4 h-full">
        <div className="bg-surface-dark p-6 rounded-[20px] border border-white/5 flex-1 flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Realized Profit</p>
            <div className="flex items-center gap-3">
                <span className="text-[28px] font-black text-white tracking-tight">${stats.realizedProfit}</span>
                <span className="text-[11px] text-green-400 font-mono font-bold bg-green-500/10 px-2 py-1 rounded-md">+{stats.profitGrowth}%</span>
            </div>
        </div>
        <div className="bg-surface-dark p-6 rounded-[20px] border border-white/5 flex-1 flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Open Positions</p>
            <div className="flex items-center gap-3">
                <span className="text-[28px] font-black text-white tracking-tight">{stats.openPositions.toString().padStart(2, '0')}</span>
                <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] rounded-md font-[900] uppercase tracking-wider">Active</span>
            </div>
        </div>
    </div>
);

const TradeCard: React.FC<{ trade: Trade }> = ({ trade }) => {
    const isProfit = trade.gainAmount >= 0;
    const statusColor = trade.status === 'Neutral' ? 'bg-slate-700 text-slate-300' : 'bg-green-500/10 text-green-400';
    const accentBorder = isProfit ? 'border-l-[4px] border-green-500' : 'border-l-[4px] border-red-500';
    const glowClass = isProfit ? 'glow-green shadow-green-500/5' : '';

    return (
        <div className={`trade-card-gradient rounded-[22px] p-5 space-y-4 border border-white/5 ${accentBorder} ${glowClass} hover:translate-y-[-4px] transition-all duration-300`}>
            <div className="flex justify-between items-start">
                <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
                        <span className="material-symbols-outlined text-white text-[20px]">{trade.icon}</span>
                    </div>
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-black text-white tracking-tight truncate">{trade.ticker}</h4>
                            <span className={`${statusColor} text-[9px] px-1.5 py-0.5 rounded-full font-[900] uppercase tracking-wider shrink-0`}>
                                {trade.status}
                            </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 truncate">{trade.name}</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/5 pt-3 mt-1">
                <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Price
                    </p>
                    <p className="text-[16px] font-mono font-bold text-white tracking-tighter">
                        ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        P&L
                    </p>
                    <p className={`text-[16px] font-mono font-bold tracking-tighter ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}${Math.abs(trade.gainAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-[900] tracking-widest uppercase">
                    <span className="text-slate-400">Progress</span>
                    <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
                        {trade.gainPercent}%
                    </span>
                </div>
                <div className="w-full h-[6px] bg-slate-800/50 rounded-full overflow-hidden relative">
                    <div
                        className={`h-full ${isProfit ? 'bg-green-500' : 'bg-red-500'} rounded-full transition-all duration-700`}
                        style={{
                            width: `${trade.progress}%`,
                            boxShadow: isProfit ? '0 0 10px rgba(34, 197, 94, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.3)'
                        }}
                    ></div>
                </div>
            </div>

            <button className={`w-full ${isProfit ? 'bg-primary' : 'bg-primary/20 border border-primary/30 text-primary'} hover:brightness-110 active:scale-[0.98] text-white font-[900] text-[10px] py-3 rounded-[14px] flex items-center justify-center gap-2 uppercase tracking-[0.2em] transition-all shadow-lg shadow-black/20 mt-2`}>
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Execute
            </button>
        </div>
    );
};

const Portfolio: React.FC = () => {
    const [trades] = useState(MOCK_TRADES);
    const [stats] = useState(MOCK_STATS);

    return (
        <div className="flex-1 overflow-y-auto p-8 animate-in no-scrollbar">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* Top Section: Equity & Stats */}
                <div className="grid grid-cols-12 gap-6 h-[220px]">
                    <div className="col-span-8 h-full">
                        <TotalEquityCard stats={stats} />
                    </div>
                    <div className="col-span-4 h-full">
                        <StatsColumn stats={stats} />
                    </div>
                </div>

                {/* AI Suggestion Banner */}
                <section className="bg-surface-dark/40 rounded-[22px] p-4 border border-white/5 border-dashed flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
                        <span className="material-symbols-outlined text-[20px]">psychology</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">AI Insight</p>
                        <p className="text-sm text-white/90 leading-relaxed italic font-medium">
                            "Market sentiment shifting. Consider hedging your TSLA position before the Q4 earnings call next week due to increased volatility."
                        </p>
                    </div>
                    <button className="text-[10px] font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors uppercase tracking-widest border border-primary/20">
                        View Analysis
                    </button>
                </section>

                {/* Active Trades Grid */}
                <section className="space-y-5">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[12px] font-[900] uppercase tracking-[0.25em] text-slate-500">Active Positions</h3>
                            <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{trades.length}</span>
                        </div>

                        <div className="flex gap-2">
                            <button className="text-slate-400 text-[10px] font-black flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors uppercase tracking-widest">
                                <span className="material-symbols-outlined text-[14px]">filter_list</span>
                                Filter
                            </button>
                            <button className="text-primary text-[10px] font-black flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors uppercase tracking-widest">
                                <span className="material-symbols-outlined text-[14px]">sort</span>
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
