import React, { useState, useMemo } from 'react';
import { useQuickTrade, QuickTradeParams } from '../../hooks/useQuickTrade';

interface QuickTradeFormProps {
    symbol: string;
    currentPrice?: number;
    defaultDirection?: 'CALL' | 'PUT';
    signalTier?: string;
    onClose?: () => void;
    onSuccess?: () => void;
    onNavigate?: (view: string) => void;
}

function isMarketOpen() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hours = et.getHours();
    const mins = et.getMinutes();
    const day = et.getDay();
    if (day === 0 || day === 6) return false;
    const timeInMins = hours * 60 + mins;
    return timeInMins >= 570 && timeInMins <= 960;
}

const STRIKE_CONFIG = {
    atm: { label: 'ATM', sub: 'Near price', detail: 'Max 2 contracts', color: 'blue' },
    otm: { label: 'OTM', sub: '3-10% away', detail: 'Max 3 contracts', color: 'emerald' },
    deep_otm: { label: 'Deep OTM', sub: '8-20% away', detail: 'Max 5 contracts', color: 'purple' },
} as const;

const QuickTradeForm: React.FC<QuickTradeFormProps> = ({
    symbol,
    currentPrice,
    defaultDirection = 'CALL',
    signalTier,
    onClose,
    onSuccess,
    onNavigate,
}) => {
    const { execute, loading, result, error, reset } = useQuickTrade();

    // Form state
    const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
    const [strikePreference, setStrikePreference] = useState<'atm' | 'otm' | 'deep_otm'>('otm');
    const [optionType, setOptionType] = useState<'CALL' | 'PUT'>(defaultDirection);
    const [expiryType, setExpiryType] = useState<'0dte' | 'weekly' | 'monthly'>('weekly');
    const [budget, setBudget] = useState('300');
    const [limitDiscount, setLimitDiscount] = useState('15');
    const [bracketOrder, setBracketOrder] = useState(true);
    const [tpPercent, setTpPercent] = useState('30');
    const [slPercent, setSlPercent] = useState('15');

    const marketOpen = isMarketOpen();

    const expiryDates = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const zeroDte = new Date(today);
        if (zeroDte.getDay() === 0) zeroDte.setDate(zeroDte.getDate() + 1);
        if (zeroDte.getDay() === 6) zeroDte.setDate(zeroDte.getDate() + 2);

        const weekly = new Date(today);
        const daysToFriday = (5 - weekly.getDay() + 7) % 7 || 7;
        weekly.setDate(weekly.getDate() + daysToFriday);

        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const firstDay = nextMonth.getDay();
        const thirdFridayOffset = ((5 - firstDay + 7) % 7) + 14;
        const monthly = new Date(nextMonth);
        monthly.setDate(1 + thirdFridayOffset);

        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { '0dte': fmt(zeroDte), weekly: fmt(weekly), monthly: fmt(monthly) };
    }, []);

    const handleSubmit = async () => {
        const params: QuickTradeParams = {
            symbol,
            optionType,
            expiryType,
            budget: parseFloat(budget) || 300,
            orderMode,
            strikePreference,
            bracketOrder,
            tpPercent: parseFloat(tpPercent) || 30,
            slPercent: parseFloat(slPercent) || 15,
            limitDiscount: orderMode === 'limit' ? (parseFloat(limitDiscount) || 15) : 0,
        };
        await execute(params);
    };

    const isCall = optionType === 'CALL';

    // ─── SUCCESS STATE ───
    if (result?.success && result.order) {
        const o = result.order;
        const isMarket = o.orderMode === 'market';
        const dist = o.distFromPrice;
        return (
            <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-green-500/10 border-2 border-green-500/30">
                    <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
                </div>
                <div>
                    <h3 className="text-white font-black text-lg uppercase tracking-tight">Order Submitted!</h3>
                    <p className="text-gray-400 text-sm mt-1">{result.message}</p>
                </div>

                <div className="bg-[#0d1117] rounded-xl p-4 border border-gray-700/40 space-y-2 text-left">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Mode</span>
                        <span className={`font-bold uppercase ${isMarket ? 'text-amber-400' : 'text-blue-400'}`}>
                            {isMarket ? 'MARKET' : 'LIMIT'} {o.optionType}
                            {o.isBracket ? ' + BRACKET' : ''}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Contract</span>
                        <span className="text-white font-mono font-bold">{o.contract}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Strike</span>
                        <span className="text-white font-mono">
                            ${o.strike}
                            {dist !== undefined && dist !== null && (
                                <span className={`ml-1.5 text-[10px] font-bold ${(dist || 0) > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    ({(dist || 0) > 0 ? '+' : ''}{dist}% {(dist || 0) > 0 ? 'OTM' : 'ITM'})
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Entry</span>
                        <span className="text-white font-mono">
                            {isMarket
                                ? `Ask $${o.ask?.toFixed(2)}`
                                : `Limit $${(o.entryPrice || o.limitPrice)?.toFixed(2)}`
                            } × {o.quantity}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-gray-800 pt-2 mt-2">
                        <span className="text-gray-400 font-bold">Total Cost</span>
                        <span className="text-white font-mono font-black">${o.totalCost?.toFixed(2)}</span>
                    </div>
                    {o.isBracket && (
                        <>
                            <div className="flex justify-between text-xs">
                                <span className="text-green-500">Take Profit</span>
                                <span className="text-green-400 font-mono">${o.takeProfit?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-red-500">Stop Loss</span>
                                <span className="text-red-400 font-mono">${o.stopLoss?.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Alternative Contracts */}
                {result.topContracts && result.topContracts.length > 1 && (
                    <div className="text-left">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Alternative Contracts</h4>
                        <div className="space-y-1">
                            {result.topContracts.slice(1, 4).map((c: any, i: number) => (
                                <div key={i} className="bg-[#0d1117]/60 rounded-lg p-2.5 flex justify-between text-[11px] border border-gray-800/40">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-mono font-bold">${c.strike}</span>
                                        <span className="text-gray-600">{c.expiry}</span>
                                        {c.distFromPrice !== undefined && (
                                            <span className={`text-[10px] font-bold ${c.distFromPrice > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {c.distFromPrice > 0 ? '+' : ''}{c.distFromPrice}%
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-gray-400 font-mono">${c.entryPrice} × {c.max_contracts}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    {onNavigate && (
                        <button
                            onClick={() => { onSuccess?.(); onClose?.(); onNavigate('portfolio'); }}
                            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            View in Portfolio
                        </button>
                    )}
                    <button
                        onClick={() => { reset(); onSuccess?.(); onClose?.(); }}
                        className="flex-1 px-4 py-3 bg-[#1a1f2e] hover:bg-[#252b3d] text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ─── FORM STATE ───
    return (
        <div className="space-y-5">
            {/* Stock Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <span className="text-purple-400 font-black text-sm">{symbol.charAt(0)}</span>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-lg tracking-tight">{symbol}</h3>
                        {currentPrice && (
                            <span className="text-gray-400 text-xs font-mono">${currentPrice.toFixed(2)}</span>
                        )}
                    </div>
                </div>
                {signalTier && (
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${signalTier === 'A+' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            signalTier === 'A' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                        Tier {signalTier}
                    </span>
                )}
            </div>

            {/* Order Type */}
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setOrderMode('market')}
                        className={`p-2.5 rounded-xl text-center transition-all ${orderMode === 'market'
                                ? 'bg-amber-500/10 border-2 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10'
                                : 'bg-[#0d1117] border-2 border-gray-700 text-gray-500 hover:border-amber-500/30 hover:text-amber-400'
                            }`}
                    >
                        <div className="text-xs font-black uppercase">MARKET</div>
                        <div className="text-[10px] opacity-70 mt-0.5">Instant fill @ ask</div>
                    </button>
                    <button
                        onClick={() => setOrderMode('limit')}
                        className={`p-2.5 rounded-xl text-center transition-all ${orderMode === 'limit'
                                ? 'bg-blue-500/10 border-2 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                                : 'bg-[#0d1117] border-2 border-gray-700 text-gray-500 hover:border-blue-500/30 hover:text-blue-400'
                            }`}
                    >
                        <div className="text-xs font-black uppercase">LIMIT</div>
                        <div className="text-[10px] opacity-70 mt-0.5">Bid - discount %</div>
                    </button>
                </div>
            </div>

            {/* Market Hours Warning */}
            {orderMode === 'market' && !marketOpen && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5 shrink-0">warning</span>
                    <p className="text-amber-300/80 text-[11px] leading-relaxed">
                        Market is closed. Market orders execute at next open (9:30 AM ET). Consider using <button onClick={() => setOrderMode('limit')} className="underline font-bold text-blue-400 hover:text-blue-300">LIMIT</button> instead.
                    </p>
                </div>
            )}

            {/* Strike Preference */}
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Strike Target</label>
                <div className="grid grid-cols-3 gap-2">
                    {(['atm', 'otm', 'deep_otm'] as const).map((pref) => {
                        const cfg = STRIKE_CONFIG[pref];
                        const isActive = strikePreference === pref;
                        const colorMap = {
                            blue: isActive ? 'bg-blue-500/10 border-2 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-[#0d1117] border-2 border-gray-700 text-gray-500 hover:border-blue-500/30 hover:text-blue-400',
                            emerald: isActive ? 'bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-[#0d1117] border-2 border-gray-700 text-gray-500 hover:border-emerald-500/30 hover:text-emerald-400',
                            purple: isActive ? 'bg-purple-500/10 border-2 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10' : 'bg-[#0d1117] border-2 border-gray-700 text-gray-500 hover:border-purple-500/30 hover:text-purple-400',
                        };
                        return (
                            <button
                                key={pref}
                                onClick={() => setStrikePreference(pref)}
                                className={`p-2 rounded-xl text-center transition-all ${colorMap[cfg.color]}`}
                            >
                                <div className="text-xs font-black uppercase">{cfg.label}</div>
                                <div className="text-[10px] opacity-70 mt-0.5">{cfg.sub}</div>
                                <div className="text-[9px] opacity-40 mt-0.5">{cfg.detail}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Direction */}
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setOptionType('CALL')}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${optionType === 'CALL'
                                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 border border-green-500'
                                : 'bg-[#0d1117] text-gray-500 border border-gray-700 hover:border-green-500/30 hover:text-green-400'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">trending_up</span>
                        CALL
                    </button>
                    <button
                        onClick={() => setOptionType('PUT')}
                        className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${optionType === 'PUT'
                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 border border-red-500'
                                : 'bg-[#0d1117] text-gray-500 border border-gray-700 hover:border-red-500/30 hover:text-red-400'
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">trending_down</span>
                        PUT
                    </button>
                </div>
            </div>

            {/* Expiry */}
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Expiry</label>
                <div className="grid grid-cols-3 gap-2">
                    {(['0dte', 'weekly', 'monthly'] as const).map((exp) => (
                        <button
                            key={exp}
                            onClick={() => setExpiryType(exp)}
                            className={`py-2 rounded-xl text-center transition-all ${expiryType === exp
                                    ? 'bg-purple-600 text-white border border-purple-500 shadow-lg shadow-purple-600/20'
                                    : 'bg-[#0d1117] text-gray-500 border border-gray-700 hover:border-purple-500/30 hover:text-purple-400'
                                }`}
                        >
                            <div className="text-xs font-black uppercase">{exp === '0dte' ? '0DTE' : exp}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{expiryDates[exp]}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Budget + Limit Discount (conditional) */}
            <div className={`grid gap-3 ${orderMode === 'limit' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Budget</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="w-full bg-[#0d1117] border border-gray-700 focus:border-purple-500 rounded-xl pl-7 pr-3 py-2.5 text-white font-mono font-bold text-sm outline-none transition-colors"
                        />
                    </div>
                </div>
                {orderMode === 'limit' && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Limit Discount</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={limitDiscount}
                                onChange={(e) => setLimitDiscount(e.target.value.replace(/[^0-9.]/g, ''))}
                                className="w-full bg-[#0d1117] border border-gray-700 focus:border-blue-500 rounded-xl pl-3 pr-7 py-2.5 text-white font-mono font-bold text-sm outline-none transition-colors text-right"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">%</span>
                        </div>
                        <p className="text-gray-600 text-[10px] mt-1">0% = bid price, 15% = 15% below bid</p>
                    </div>
                )}
            </div>

            {/* Bracket Order */}
            <div className="bg-[#0d1117] rounded-xl border border-gray-700/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400 text-sm">link</span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Bracket Order</span>
                    </div>
                    <button
                        onClick={() => setBracketOrder(!bracketOrder)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${bracketOrder ? 'bg-purple-600' : 'bg-gray-700'}`}
                    >
                        <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                            style={{ left: bracketOrder ? '22px' : '2px' }}
                        />
                    </button>
                </div>

                {bracketOrder && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 block">
                                <span className="material-symbols-outlined text-[10px]">arrow_upward</span>
                                Take Profit
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={tpPercent}
                                    onChange={(e) => setTpPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                                    className="w-full bg-green-900/10 border border-green-500/20 focus:border-green-500 rounded-lg pl-3 pr-7 py-2 text-green-400 font-mono font-bold text-sm outline-none transition-colors text-right"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-mono text-xs">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-1 block">
                                <span className="material-symbols-outlined text-[10px]">arrow_downward</span>
                                Stop Loss
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={slPercent}
                                    onChange={(e) => setSlPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                                    className="w-full bg-red-900/10 border border-red-500/20 focus:border-red-500 rounded-lg pl-3 pr-7 py-2 text-red-400 font-mono font-bold text-sm outline-none transition-colors text-right"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600 font-mono text-xs">%</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview */}
            <div className="bg-[#0d1117]/60 rounded-xl border border-gray-800/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-gray-600 text-xs">preview</span>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Preview</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${orderMode === 'market' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                        {orderMode.toUpperCase()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${strikePreference === 'atm' ? 'bg-blue-500/10 text-blue-400' :
                            strikePreference === 'otm' ? 'bg-emerald-500/10 text-emerald-400' :
                                'bg-purple-500/10 text-purple-400'
                        }`}>
                        {strikePreference === 'deep_otm' ? 'DEEP OTM' : strikePreference.toUpperCase()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isCall ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                        {optionType}
                    </span>
                </div>
                <p className="text-gray-500 text-[10px] leading-relaxed">
                    {strikePreference === 'atm' && 'Strikes near current price • Higher premium, lower qty'}
                    {strikePreference === 'otm' && `Strikes 3-10% ${isCall ? 'above' : 'below'} price • Balanced risk/reward`}
                    {strikePreference === 'deep_otm' && `Strikes 8-20% ${isCall ? 'above' : 'below'} price • Cheapest, max leverage`}
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-red-400 text-sm mt-0.5 shrink-0">error</span>
                    <div className="flex-1">
                        <p className="text-red-300 text-xs font-medium">{error}</p>
                        <button onClick={reset} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase mt-1 underline">Try Again</button>
                    </div>
                </div>
            )}

            {/* Execute Button */}
            <button
                onClick={handleSubmit}
                disabled={loading || !symbol}
                className={`w-full py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'bg-gray-600 cursor-wait' :
                        orderMode === 'market'
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                            : isCall
                                ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20'
                                : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    }`}
            >
                {loading ? (
                    <>
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        Submitting to Schwab...
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        {orderMode === 'market' ? `Market ${optionType}` : `Limit ${optionType}`}
                    </>
                )}
            </button>

            {/* Info */}
            <div className="flex items-start gap-2 opacity-60">
                <span className="material-symbols-outlined text-gray-500 text-xs mt-0.5">info</span>
                <p className="text-gray-500 text-[10px] leading-relaxed">
                    {orderMode === 'market' ? 'Fill at ask price' : `Limit at ${limitDiscount}% below bid`} • {STRIKE_CONFIG[strikePreference].detail} • Budget ${budget}
                </p>
            </div>
        </div>
    );
};

export default QuickTradeForm;
