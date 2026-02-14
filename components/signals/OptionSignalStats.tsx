import React, { useMemo } from 'react';
import { OptionSignal } from '../../hooks/useOptionSignals';

const OptionSignalStats: React.FC<{ signals: OptionSignal[] }> = ({ signals }) => {
    const stats = useMemo(() => {
        return {
            APlus: signals.filter(s => s.tier === 'A+').length,
            Calls: signals.filter(s => s.option_type === 'CALL' && s.tier !== 'NO_TRADE').length,
            Puts: signals.filter(s => s.option_type === 'PUT' && s.tier !== 'NO_TRADE').length,
            NoTrade: signals.filter(s => s.tier === 'NO_TRADE').length,
            Strength: {
                VeryStrong: signals.filter(s => s.adx_trend === 'VERY_STRONG').length
            }
        };
    }, [signals]);

    return (
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3 text-white">
            <div className="bg-[#1a1f2e] border border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-black/20">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">A+ SIGNALS</h4>
                    <span className="text-3xl font-black">{stats.APlus}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                    <span className="material-symbols-outlined text-yellow-500">star</span>
                </div>
            </div>

            <div className="bg-[#1a1f2e] border border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-black/20">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1">CALL</h4>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-black">{stats.Calls}</span>
                        {stats.Strength.VeryStrong > 0 && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">
                                {Math.round((stats.Strength.VeryStrong / signals.length) * 100)}% STRONG
                            </span>
                        )}
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <span className="material-symbols-outlined text-green-500">trending_up</span>
                </div>
            </div>

            <div className="bg-[#1a1f2e] border border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-black/20">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">PUT</h4>
                    <span className="text-3xl font-black">{stats.Puts}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <span className="material-symbols-outlined text-red-500">trending_down</span>
                </div>
            </div>

            <div className="bg-[#1a1f2e] border border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-black/20 opacity-60">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">NO TRADE</h4>
                    <span className="text-3xl font-black text-gray-400">{stats.NoTrade}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                    <span className="material-symbols-outlined text-gray-500">block</span>
                </div>
            </div>
        </div>
    );
};

export default OptionSignalStats;
