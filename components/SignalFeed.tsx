import React, { useState, useMemo } from 'react';

// --- TYPES & ENUMS ---
enum FeedSignalType {
    BUY_STRONG = 'Buy - Strong',
    BUY = 'Buy',
    WAIT = 'Wait - Moderate',
    SELL = 'Sell',
    SELL_HOLD = 'Sell / Hold',
    HOLD = 'Hold'
}

enum FeedTrend {
    BREAKOUT = 'BREAKOUT',
    CONSOLIDATION = 'CONSOLIDATION',
    FALLING = 'FALLING',
    RALLY = 'RALLY'
}

interface Metric {
    label: string;
    value: string;
    color?: string;
}

interface FeedSignal {
    id: string;
    symbol: string;
    name: string;
    type: FeedSignalType;
    price: string;
    trend: FeedTrend;
    metrics: Metric[];
    description: string;
    tags: string[];
    actionBox: {
        label: string;
        icon: string;
        description: string;
        color: string;
    };
    risk: string;
    fullWidth?: boolean;
}

// --- CONSTANTS ---
const INITIAL_SIGNALS: FeedSignal[] = [
    {
        id: '1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: FeedSignalType.BUY_STRONG,
        price: '$185.42',
        trend: FeedTrend.BREAKOUT,
        metrics: [
            { label: 'Entry', value: '$184.00' },
            { label: 'Target', value: '$195.00', color: 'text-rh-green' },
            { label: 'Stop Loss', value: '$179.00', color: 'text-red-500' },
            { label: 'R/R Ratio', value: '1:2.2' },
        ],
        description: 'Apple breaking above SMA50 with strong volume. RSI at 62 with room to run. ADX at 28 confirms trend strength.',
        tags: ['RSI 62', 'ADX 28', 'VOL 1.3x', 'VWAP UP'],
        actionBox: {
            label: 'When to Buy',
            icon: 'bolt',
            description: 'On pullback to $184 (VWAP level)',
            color: 'primary'
        },
        risk: 'Earnings in 2 weeks, market volatility'
    },
    {
        id: '2',
        symbol: 'TSLA',
        name: 'Tesla, Inc.',
        type: FeedSignalType.WAIT,
        price: '$248.30',
        trend: FeedTrend.CONSOLIDATION,
        metrics: [
            { label: 'Current Range', value: '$245.00 - $252.00' },
            { label: 'Avg Volume', value: '112.4M' },
        ],
        description: 'Tesla in tight range between $245-$252. Waiting for volume breakout above resistance level. RSI neutral at 48.',
        tags: [],
        actionBox: {
            label: 'When to Buy',
            icon: 'notifications_active',
            description: 'Break above $252 with 1.5x volume',
            color: 'wait'
        },
        risk: 'Could break down to $238 support'
    },
    {
        id: '3',
        symbol: 'META',
        name: 'Meta Platforms',
        type: FeedSignalType.SELL_HOLD,
        price: '$510.20',
        trend: FeedTrend.FALLING,
        fullWidth: true,
        metrics: [
            { label: 'SMA 20', value: '$522.40', color: 'text-red-500' },
            { label: 'SMA 50', value: '$518.15', color: 'text-red-500' },
            { label: 'RSI', value: '35', color: 'text-yellow-500' },
            { label: 'Support', value: '$495.00', color: 'text-rh-green' },
        ],
        description: 'Meta below SMA20 and SMA50. RSI at 35 nearing oversold territory. Technical outlook is bearish, wait for clear reversal confirmation before entry.',
        tags: ['Bearish Alignment', 'Negative Volume Delta'],
        actionBox: {
            label: 'Reversal Watch',
            icon: 'rebase_edit',
            description: 'RSI below 30 + bullish divergence on 1H chart',
            color: 'primary'
        },
        risk: 'Sector rotation out of tech into defensives'
    }
];

const SignalCardRef: React.FC<{ signal: FeedSignal; onDismiss: (id: string) => void }> = ({ signal, onDismiss }) => {
    const getTrendIcon = (trend: FeedTrend) => {
        switch (trend) {
            case FeedTrend.BREAKOUT: return 'arrow_drop_up';
            case FeedTrend.CONSOLIDATION: return 'sync_alt';
            case FeedTrend.FALLING: return 'south_east';
            case FeedTrend.RALLY: return 'trending_up';
            default: return 'trending_flat';
        }
    };

    const getStatusColor = (type: FeedSignalType) => {
        if (type.includes('Buy')) return 'bg-rh-green text-black';
        if (type.includes('Wait')) return 'bg-yellow-500 text-black';
        if (type.includes('Sell')) return 'bg-red-500 text-white';
        return 'bg-slate-700 text-white';
    };

    const getTypeIcon = (type: FeedSignalType) => {
        if (type.includes('Buy')) return 'trending_up';
        if (type.includes('Wait')) return 'hourglass_empty';
        if (type.includes('Sell')) return 'trending_down';
        return 'info';
    };

    const getStatusIconColor = (type: FeedSignalType) => {
        if (type.includes('Buy')) return 'text-rh-green bg-rh-green/10 border-rh-green/20';
        if (type.includes('Wait')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        if (type.includes('Sell')) return 'text-red-500 bg-red-500/10 border-red-500/20';
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    };

    const getActionBoxStyles = (color: string) => {
        switch (color) {
            case 'primary': return 'border-rh-green/40 bg-slate-900/50 text-rh-green';
            case 'wait': return 'border-yellow-500/40 bg-slate-900/50 text-yellow-500';
            case 'sell': return 'border-red-500/40 bg-slate-900/50 text-red-500';
            default: return 'border-slate-500/40 bg-slate-900/50 text-slate-500';
        }
    };

    return (
        <div className={`signal-card bg-[#1e2124] border border-white/10 rounded-xl overflow-hidden flex flex-col ${signal.fullWidth ? 'xl:col-span-2' : ''}`}>
            <div className={`p-5 flex flex-col ${signal.fullWidth ? 'md:flex-row gap-8' : 'gap-4'}`}>
                <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg border ${getStatusIconColor(signal.type)}`}>
                                <span className="material-symbols-outlined text-3xl leading-none">{getTypeIcon(signal.type)}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-2xl font-black tracking-tight text-white">{signal.symbol}</h3>
                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${getStatusColor(signal.type)}`}>
                                        {signal.type}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm font-medium">{signal.name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-mono font-bold text-white leading-none">{signal.price}</div>
                            <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-1 uppercase ${signal.trend === FeedTrend.BREAKOUT || signal.trend === FeedTrend.RALLY ? 'text-rh-green' :
                                    signal.trend === FeedTrend.CONSOLIDATION ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                <span className="material-symbols-outlined text-sm">{getTrendIcon(signal.trend)}</span>
                                {signal.trend}
                            </div>
                        </div>
                    </div>

                    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-white/10`}>
                        {signal.metrics.map((m, idx) => (
                            <div key={idx} className={`flex flex-col ${idx === signal.metrics.length - 1 ? 'items-end' : ''}`}>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{m.label}</span>
                                <span className={`text-sm font-mono font-bold ${m.color || 'text-slate-200'}`}>{m.value}</span>
                            </div>
                        ))}
                    </div>

                    {!signal.fullWidth && (
                        <div className="space-y-3">
                            <p className="text-slate-300 text-sm leading-relaxed">{signal.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {signal.tags.map(tag => (
                                    <span key={tag} className={`px-2 py-1 rounded text-[10px] font-mono border ${tag.includes('VWAP') ? 'bg-rh-green/10 text-rh-green border-rh-green/20' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={`${signal.fullWidth ? 'flex-1' : ''} flex flex-col justify-between space-y-4`}>
                    {signal.fullWidth && (
                        <div>
                            <p className="text-slate-300 text-sm leading-relaxed mb-4">{signal.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {signal.tags.map(tag => (
                                    <span key={tag} className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-mono border border-slate-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={`rounded-lg p-3 border-l-4 mt-2 ${getActionBoxStyles(signal.actionBox.color)}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined text-sm`}>{signal.actionBox.icon}</span>
                            <span className="text-[11px] font-black uppercase text-white tracking-widest">{signal.actionBox.label}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            {signal.actionBox.description.split(/(\$\d+(?:\.\d+)?)/).map((part, i) =>
                                part.startsWith('$') ? <span key={i} className="text-white font-bold">{part}</span> : part
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`material-symbols-outlined text-sm ${signal.risk.toLowerCase().includes('sector') ? 'text-red-500' : 'text-yellow-500'}`}>warning</span>
                        <span>Risk: {signal.risk}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto flex border-t border-white/10">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border-r border-white/10 text-xs font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">show_chart</span>
                    {signal.fullWidth ? 'View Analysis' : 'Chart'}
                </button>
                {!signal.fullWidth && (
                    <button className={`flex-[1.5] flex items-center justify-center gap-2 py-3 transition-all text-xs font-black uppercase tracking-widest ${signal.type.includes('Wait') ? 'bg-yellow-500 text-black hover:bg-yellow-500/90' : 'bg-rh-green text-black hover:bg-rh-green/90'
                        }`}>
                        <span className="material-symbols-outlined text-sm">{signal.type.includes('Wait') ? 'alarm_add' : 'shopping_cart'}</span>
                        {signal.type.includes('Wait') ? 'Set Alert' : 'Trade Now'}
                    </button>
                )}
                <button
                    onClick={() => onDismiss(signal.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all text-xs font-bold uppercase tracking-wider"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                    Dismiss {signal.fullWidth ? 'Signal' : ''}
                </button>
            </div>
        </div>
    );
};

const SignalFeed: React.FC = () => {
    const [signals, setSignals] = useState<FeedSignal[]>(INITIAL_SIGNALS);
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('Confidence');

    const filteredSignals = useMemo(() => {
        let result = [...signals];
        if (activeFilter !== 'ALL') {
            result = result.filter(s => s.type.toUpperCase().includes(activeFilter));
        }
        return result;
    }, [signals, activeFilter]);

    const handleDismiss = (id: string) => {
        setSignals(prev => prev.filter(s => s.id !== id));
    };

    const filterButtons = [
        { label: 'All', value: 'ALL', color: 'bg-rh-green text-black' },
        { label: 'Buy', value: 'BUY', color: 'bg-[#1e2124] text-rh-green hover:bg-rh-green/10 border-rh-green/20' },
        { label: 'Sell', value: 'SELL', color: 'bg-[#1e2124] text-red-500 hover:bg-red-500/10 border-red-500/20' },
        { label: 'Hold', value: 'HOLD', color: 'bg-[#1e2124] text-yellow-500 hover:bg-yellow-500/10 border-yellow-500/20' },
        { label: 'Wait', value: 'WAIT', color: 'bg-[#1e2124] text-slate-400 hover:bg-slate-800' },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-[#0a0712] p-8">
            {/* Header handled by Navigation/Header in App.tsx usually, but this is a stand-alone view, so we keep inner content */}
            <main className="max-w-[1400px] mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-[#1e2124]/50 p-2 rounded-xl border border-white/10">
                    <div className="flex flex-wrap gap-2">
                        {filterButtons.map(btn => (
                            <button
                                key={btn.value}
                                onClick={() => setActiveFilter(btn.value)}
                                className={`px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border ${activeFilter === btn.value ? (btn.value === 'ALL' ? 'bg-rh-green text-black border-rh-green' : btn.color) : 'bg-transparent text-slate-400 hover:text-white border-transparent'
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium border-t md:border-t-0 border-white/10 pt-2 md:pt-0 px-2">
                        <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Sort By:</span>
                        <nav className="flex gap-6">
                            {['Confidence', 'Symbol', 'Signal'].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setSortBy(option)}
                                    className={`pb-1 transition-all ${sortBy === option ? 'text-rh-green border-b-2 border-rh-green' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {filteredSignals.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {filteredSignals.map(signal => (
                            <SignalCardRef key={signal.id} signal={signal} onDismiss={handleDismiss} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-white/10 rounded-xl bg-[#1e2124]/20">
                        <span className="material-symbols-outlined text-5xl mb-4">playlist_remove</span>
                        <p className="text-lg font-semibold">No active signals match your criteria</p>
                        <button onClick={() => setActiveFilter('ALL')} className="mt-4 text-rh-green hover:underline text-sm font-bold uppercase tracking-widest">Clear Filters</button>
                    </div>
                )}

                <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 pb-12 border-t border-white/10 pt-8">
                    <div className="text-slate-500 text-xs">
                        Showing <span className="text-white font-bold">{filteredSignals.length}</span> active signals from your watchlist of 42 symbols
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="text-xs font-bold text-white px-3">Page 1 of 4</span>
                        <button className="p-2 rounded border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default SignalFeed;
