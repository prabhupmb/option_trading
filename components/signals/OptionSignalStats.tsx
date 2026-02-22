import React, { useMemo } from 'react';
import { OptionSignal } from '../../types';

interface OptionSignalStatsProps {
    signals: OptionSignal[];
    activeFilter?: string;
    onFilterClick?: (filter: string) => void;
}

const OptionSignalStats: React.FC<OptionSignalStatsProps> = ({ signals, activeFilter, onFilterClick }) => {
    const stats = useMemo(() => {
        const normalize = (s: string) => s?.toUpperCase() || '';
        return {
            StrongBuy: signals.filter(s => normalize(s.trading_recommendation).includes('STRONG') && normalize(s.trading_recommendation).includes('BUY')).length,
            Buy: signals.filter(s => normalize(s.trading_recommendation).includes('BUY') && !normalize(s.trading_recommendation).includes('STRONG') && !normalize(s.trading_recommendation).includes('WEAK')).length,
            StrongSell: signals.filter(s => normalize(s.trading_recommendation).includes('STRONG') && normalize(s.trading_recommendation).includes('SELL')).length,
            Sell: signals.filter(s => normalize(s.trading_recommendation).includes('SELL') && !normalize(s.trading_recommendation).includes('STRONG') && !normalize(s.trading_recommendation).includes('WEAK')).length,
        };
    }, [signals]);

    const handleCardClick = (filter: string) => {
        if (onFilterClick) {
            onFilterClick(activeFilter === filter ? 'ALL' : filter);
        }
    };

    return (
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3 text-slate-900 dark:text-white">
            {/* STRONG BUY */}
            <div
                onClick={() => handleCardClick('STRONG_BUY')}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-lg dark:shadow-black/20 cursor-pointer hover:border-green-500/50 hover:bg-gray-50 dark:hover:bg-[#1a1f2e]/80 transition-all active:scale-[0.98]"
            >
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1">STRONG BUY</h4>
                    <span className="text-3xl font-black">{stats.StrongBuy}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <span className="material-symbols-outlined text-green-500">rocket_launch</span>
                </div>
            </div>

            {/* BUY */}
            <div
                onClick={() => handleCardClick('BUY')}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-lg dark:shadow-black/20 cursor-pointer hover:border-green-400/50 hover:bg-gray-50 dark:hover:bg-[#1a1f2e]/80 transition-all active:scale-[0.98]"
            >
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-1">BUY</h4>
                    <span className="text-3xl font-black">{stats.Buy}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/5 flex items-center justify-center border border-green-500/10">
                    <span className="material-symbols-outlined text-green-400">trending_up</span>
                </div>
            </div>

            {/* STRONG SELL */}
            <div
                onClick={() => handleCardClick('STRONG_SELL')}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-lg dark:shadow-black/20 cursor-pointer hover:border-red-500/50 hover:bg-gray-50 dark:hover:bg-[#1a1f2e]/80 transition-all active:scale-[0.98]"
            >
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">STRONG SELL</h4>
                    <span className="text-3xl font-black">{stats.StrongSell}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <span className="material-symbols-outlined text-red-500">warning</span>
                </div>
            </div>

            {/* SELL */}
            <div
                onClick={() => handleCardClick('SELL')}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-lg dark:shadow-black/20 cursor-pointer hover:border-red-400/50 hover:bg-gray-50 dark:hover:bg-[#1a1f2e]/80 transition-all active:scale-[0.98]"
            >
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">SELL</h4>
                    <span className="text-3xl font-black">{stats.Sell}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/5 flex items-center justify-center border border-red-500/10">
                    <span className="material-symbols-outlined text-red-400">trending_down</span>
                </div>
            </div>
        </div>
    );
};

export default OptionSignalStats;
