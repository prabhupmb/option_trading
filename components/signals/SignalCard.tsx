import React, { useState } from 'react';
import { SmartSignal } from '../../hooks/useSignals';
import { AccessLevel } from '../../types';

interface SignalCardProps {
    signal: SmartSignal;
    accessLevel: AccessLevel;
    onExecute?: (signal: SmartSignal) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, accessLevel, onExecute }) => {
    const [expanded, setExpanded] = useState(false);

    const getSignalColor = (type: string, confidence: string) => {
        switch (type) {
            case 'BUY':
                return confidence === 'strong' ? 'bg-green-600 text-white' : 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30';
            case 'SELL':
                return 'bg-red-600 text-white';
            case 'HOLD':
                return 'bg-blue-600 text-white';
            case 'WAIT':
                return 'bg-yellow-500/80 text-black';
            default:
                return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        }
    };

    const getTrendIcon = (status: string) => {
        const s = status.toLowerCase();
        if (s.includes('breakout') || s.includes('uptrend')) return 'trending_up';
        if (s.includes('falling') || s.includes('downtrend')) return 'trending_down';
        if (s.includes('reversal')) return 'currency_exchange';
        return 'trending_flat';
    };

    const getTrendColor = (status: string) => {
        const s = status.toLowerCase();
        if (s.includes('breakout') || s.includes('uptrend')) return 'text-green-500';
        if (s.includes('falling') || s.includes('downtrend')) return 'text-red-500';
        if (s.includes('reversal')) return 'text-orange-500';
        return 'text-yellow-500';
    };

    const formatCurrency = (val?: number) => val ? `$${val.toFixed(2)}` : '-';

    return (
        <div
            className={`bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-gray-400 dark:hover:border-gray-600 ${expanded ? 'ring-1 ring-blue-500/50' : ''}`}
        >
            {/* Header */}
            <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-black text-gray-500 dark:text-gray-400">{signal.symbol[0]}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{signal.symbol}</h3>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getSignalColor(signal.signal_type, signal.confidence)}`}>
                                    {signal.signal_type}
                                </span>
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-bold uppercase ${getTrendColor(signal.market_status)}`}>
                                <span className="material-symbols-outlined text-sm">{getTrendIcon(signal.market_status)}</span>
                                {signal.market_status}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(signal.current_price)}</div>
                        <div className="text-xs text-gray-500 font-medium">Current Price</div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-gray-200/50 dark:border-gray-800/50">
                    {signal.signal_type === 'BUY' && (
                        <>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Entry</span>
                                <p className="text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(signal.entry_price)}</p>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Target</span>
                                <p className="text-sm font-mono text-green-600 dark:text-green-400">{formatCurrency(signal.target_price)}</p>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Stop Loss</span>
                                <p className="text-sm font-mono text-red-500 dark:text-red-400">{formatCurrency(signal.stop_loss)}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">R/R</span>
                                <p className="text-sm font-mono text-blue-500 dark:text-blue-400">{signal.risk_reward_ratio || '-'}</p>
                            </div>
                        </>
                    )}

                    {(signal.signal_type === 'SELL' || signal.signal_type === 'HOLD' || signal.signal_type === 'WAIT') && (
                        <>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">SMA 20</span>
                                <p className="text-sm font-mono text-yellow-500">{formatCurrency(signal.indicators?.sma20)}</p>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">RSI</span>
                                <p className={`text-sm font-mono ${(signal.indicators?.rsi || 50) > 70 ? 'text-red-400' : (signal.indicators?.rsi || 50) < 30 ? 'text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                    {signal.indicators?.rsi?.toFixed(0) || '-'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-bold">ADX</span>
                                <p className="text-sm font-mono text-slate-900 dark:text-white">{signal.indicators?.adx?.toFixed(0) || '-'}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Support</span>
                                <p className="text-sm font-mono text-blue-500 dark:text-blue-400">{formatCurrency(signal.entry_price)}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* AI Summary */}
                <div className="mt-4">
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed border-l-2 border-blue-500 pl-3">
                        {signal.ai_summary}
                    </p>
                </div>

                {/* Indicators Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                    {signal.indicators?.rsi && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-700">RSI {signal.indicators.rsi.toFixed(0)}</span>
                    )}
                    {signal.indicators?.adx && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-700">ADX {signal.indicators.adx.toFixed(0)}</span>
                    )}
                    {signal.indicators?.vwap && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-700">VWAP {signal.indicators.vwap}</span>
                    )}
                    {signal.confidence === 'strong' && (
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-500 dark:text-purple-400 text-[10px] font-mono rounded border border-purple-500/20">HIGH CONVICTION</span>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="bg-gray-50 dark:bg-[#151925] border-t border-gray-200 dark:border-gray-800 p-5 animate-in slide-in-from-top-2">

                    {/* When to Buy */}
                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-lg">
                        <h4 className="text-blue-500 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">lightbulb</span>
                            Action Plan
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">{signal.when_to_buy}</p>
                    </div>

                    {/* In-depth reasoning */}
                    <h4 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">AI Reasoning</h4>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-line mb-4">
                        {signal.ai_reasoning}
                    </p>

                    {/* Risk Factors */}
                    <div className="flex items-start gap-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/5 p-2 rounded">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        <span>Risk: {signal.risk_factors}</span>
                    </div>

                </div>
            )}

            {/* Actions Footer */}
            <div className="flex border-t border-gray-200 dark:border-gray-800 divide-x divide-gray-200 dark:divide-gray-800">
                <button className="flex-1 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-sm">show_chart</span>
                    Chart
                </button>

                {accessLevel === 'trade' && (
                    <button
                        onClick={() => onExecute?.(signal)}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        Trade Now
                    </button>
                )}

                {accessLevel === 'paper' && (
                    <button
                        onClick={() => onExecute?.(signal)}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">description</span>
                        Paper Trade
                    </button>
                )}

                {accessLevel === 'signal' && (
                    <button className="flex-1 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-blue-500 dark:text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                        <span className="material-symbols-outlined text-sm">notifications</span>
                        Set Alert
                    </button>
                )}

                <button className="flex-[0.5] py-3 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
        </div>
    );
};

export default SignalCard;
