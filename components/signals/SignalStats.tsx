import React, { useMemo } from 'react';
import { SmartSignal } from '../../hooks/useSignals';

const SignalStats: React.FC<{ signals: SmartSignal[] }> = ({ signals }) => {
    const stats = useMemo(() => {
        const counts = {
            BUY: 0,
            SELL: 0,
            HOLD: 0,
            WAIT: 0,
        };
        signals.forEach((s) => {
            const type = s.signal_type.toUpperCase() as keyof typeof counts;
            if (counts[type] !== undefined) counts[type]++;
        });
        return counts;
    }, [signals]);

    const sentiment = useMemo(() => {
        if (stats.BUY > stats.SELL * 1.5) return { label: 'Bullish', color: 'text-green-500', icon: 'trending_up' };
        if (stats.SELL > stats.BUY * 1.5) return { label: 'Bearish', color: 'text-red-500', icon: 'trending_down' };
        return { label: 'Neutral', color: 'text-yellow-500', icon: 'remove_circle' };
    }, [stats]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">Total Signals</p>
                    <h3 className="text-2xl font-mono text-slate-900 dark:text-white mt-1">{signals.length}</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500">query_stats</span>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">Buy / Sell Ratio</p>
                    <div className="flex gap-4 mt-1">
                        <span className="text-lg font-mono text-green-500 font-bold">{stats.BUY}</span>
                        <span className="text-lg font-mono text-gray-400 dark:text-gray-500">/</span>
                        <span className="text-lg font-mono text-red-500 font-bold">{stats.SELL}</span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-500">compare_arrows</span>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">Hold / Wait</p>
                    <div className="flex gap-4 mt-1">
                        <span className="text-lg font-mono text-blue-500 font-bold">{stats.HOLD}</span>
                        <span className="text-lg font-mono text-gray-400 dark:text-gray-500">/</span>
                        <span className="text-lg font-mono text-yellow-500 font-bold">{stats.WAIT}</span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-yellow-500">hourglass_empty</span>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between relative overflow-hidden group">
                <div className="z-10 relative">
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">Market Sentiment</p>
                    <h3 className={`text-xl font-black uppercase mt-1 flex items-center gap-2 ${sentiment.color}`}>
                        {sentiment.label}
                        <span className="material-symbols-outlined text-lg">{sentiment.icon}</span>
                    </h3>
                </div>
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 blur-xl transition-colors ${sentiment.label === 'Bullish' ? 'bg-green-500' : sentiment.label === 'Bearish' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></div>
            </div>
        </div>
    );
};

export default SignalStats;
