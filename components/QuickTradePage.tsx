import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import QuickTradeForm from './quicktrade/QuickTradeForm';

interface DayTradeStock {
    id: string;
    symbol: string;
    current_price: number;
    tier: string;
    trading_recommendation: string;
    analyzed_at: string;
}

interface RecentTrade {
    id: string;
    symbol: string;
    option_type: string;
    strike_price: number;
    expiry_date: string;
    total_cost: number;
    status: string;
    pnl: number;
    created_at: string;
}

const QuickTradePage: React.FC = () => {
    const [stocks, setStocks] = useState<DayTradeStock[]>([]);
    const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
    const [selectedStock, setSelectedStock] = useState<DayTradeStock | null>(null);
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [loadingTrades, setLoadingTrades] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchStocks = async () => {
        try {
            setLoadingStocks(true);
            const { data, error } = await supabase
                .from('day_trade')
                .select('id, symbol, current_price, tier, trading_recommendation, analyzed_at')
                .eq('is_latest', true)
                .order('analyzed_at', { ascending: false });

            if (error) throw error;
            setStocks(data || []);
        } catch (err) {
            console.error('Error fetching stocks:', err);
        } finally {
            setLoadingStocks(false);
        }
    };

    const fetchRecentTrades = async () => {
        try {
            setLoadingTrades(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('option_trades')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setRecentTrades(data || []);
        } catch (err) {
            console.error('Error fetching recent trades:', err);
        } finally {
            setLoadingTrades(false);
        }
    };

    useEffect(() => {
        fetchStocks();
        fetchRecentTrades();
    }, []);

    const filteredStocks = useMemo(() => {
        if (!searchQuery.trim()) return stocks;
        const q = searchQuery.trim().toUpperCase();
        return stocks.filter(s => s.symbol.toUpperCase().includes(q));
    }, [stocks, searchQuery]);

    const getDirectionIcon = (rec: string) => {
        const r = (rec || '').toUpperCase();
        if (r.includes('BUY')) return { icon: 'trending_up', color: 'text-green-500' };
        if (r.includes('SELL')) return { icon: 'trending_down', color: 'text-red-500' };
        return { icon: 'trending_flat', color: 'text-gray-500' };
    };

    const getTierColor = (tier: string) => {
        if (tier === 'A+') return 'bg-green-500/10 text-green-400 border-green-500/20';
        if (tier === 'A') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (tier === 'B+') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    return (
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-[#0a0712] flex flex-col">
            {/* Top Section: Stock List + Trade Form */}
            <div className="flex-1 flex min-h-0">

                {/* Left Panel: Stock List */}
                <div className="w-80 border-r border-gray-100 dark:border-white/5 flex flex-col bg-white dark:bg-[#0f1219]">
                    {/* Search */}
                    <div className="p-4 border-b border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2">
                            <span className="material-symbols-outlined text-gray-400 text-sm">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search ticker..."
                                className="bg-transparent text-sm text-slate-900 dark:text-white placeholder-gray-400 outline-none flex-1"
                            />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 font-medium">
                            {filteredStocks.length} stocks from Day Trade signals
                        </p>
                    </div>

                    {/* Stock List */}
                    <div className="flex-1 overflow-y-auto">
                        {loadingStocks ? (
                            <div className="p-6 text-center">
                                <span className="material-symbols-outlined text-2xl text-gray-600 animate-spin">sync</span>
                                <p className="text-gray-500 text-xs mt-2">Loading stocks...</p>
                            </div>
                        ) : filteredStocks.length === 0 ? (
                            <div className="p-6 text-center">
                                <span className="material-symbols-outlined text-3xl text-gray-700">search_off</span>
                                <p className="text-gray-500 text-xs mt-2">No stocks found</p>
                            </div>
                        ) : (
                            filteredStocks.map((stock) => {
                                const dir = getDirectionIcon(stock.trading_recommendation);
                                const isSelected = selectedStock?.symbol === stock.symbol;
                                return (
                                    <button
                                        key={stock.id}
                                        onClick={() => setSelectedStock(stock)}
                                        className={`w-full px-4 py-3 flex items-center justify-between border-b border-gray-50 dark:border-white/5 transition-all text-left ${isSelected
                                                ? 'bg-purple-500/5 border-l-2 border-l-purple-500'
                                                : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined text-lg ${dir.color}`}>{dir.icon}</span>
                                            <div>
                                                <span className={`font-black text-sm ${isSelected ? 'text-purple-400' : 'text-slate-900 dark:text-white'}`}>{stock.symbol}</span>
                                                <p className="text-gray-500 text-[10px] font-mono">${stock.current_price?.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${getTierColor(stock.tier)}`}>
                                            {stock.tier}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Refresh */}
                    <div className="p-3 border-t border-gray-100 dark:border-white/5">
                        <button
                            onClick={fetchStocks}
                            disabled={loadingStocks}
                            className="w-full py-2 text-xs font-bold text-gray-500 hover:text-purple-400 uppercase tracking-wider flex items-center justify-center gap-2 rounded-lg hover:bg-purple-500/5 transition-colors disabled:opacity-50"
                        >
                            <span className={`material-symbols-outlined text-sm ${loadingStocks ? 'animate-spin' : ''}`}>refresh</span>
                            Refresh List
                        </button>
                    </div>
                </div>

                {/* Right Panel: Trade Form */}
                <div className="flex-1 overflow-y-auto p-8">
                    {selectedStock ? (
                        <div className="max-w-lg mx-auto">
                            <QuickTradeForm
                                symbol={selectedStock.symbol}
                                currentPrice={selectedStock.current_price}
                                defaultDirection={
                                    (selectedStock.trading_recommendation || '').toUpperCase().includes('SELL')
                                        ? 'PUT'
                                        : 'CALL'
                                }
                                signalTier={selectedStock.tier}
                                onSuccess={() => {
                                    fetchRecentTrades();
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-20 h-20 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-4xl text-purple-500/30">touch_app</span>
                                </div>
                                <h3 className="text-slate-900 dark:text-white font-black text-lg uppercase tracking-tight mb-1">Select a Stock</h3>
                                <p className="text-gray-500 text-sm">Choose from the list to start a quick trade</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: Recent Trades */}
            <div className="border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0f1219]">
                <div className="px-6 py-3 flex items-center justify-between border-b border-gray-50 dark:border-white/5">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">history</span>
                        Recent Quick Trades
                    </h3>
                    <button onClick={fetchRecentTrades} className="text-gray-500 hover:text-purple-400 transition-colors">
                        <span className={`material-symbols-outlined text-sm ${loadingTrades ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>

                <div className="max-h-48 overflow-y-auto">
                    {recentTrades.length === 0 ? (
                        <div className="py-6 text-center">
                            <p className="text-gray-600 text-xs">No recent trades</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 uppercase tracking-widest border-b border-gray-50 dark:border-white/5">
                                    <th className="px-4 py-2 text-left font-bold">Symbol</th>
                                    <th className="px-4 py-2 text-left font-bold">Type</th>
                                    <th className="px-4 py-2 text-right font-bold">Strike</th>
                                    <th className="px-4 py-2 text-left font-bold">Expiry</th>
                                    <th className="px-4 py-2 text-right font-bold">Cost</th>
                                    <th className="px-4 py-2 text-center font-bold">Status</th>
                                    <th className="px-4 py-2 text-right font-bold">PnL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTrades.map((trade) => (
                                    <tr key={trade.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-2.5 font-black text-slate-900 dark:text-white">{trade.symbol}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.option_type === 'CALL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {trade.option_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-gray-300">${trade.strike_price?.toFixed(0)}</td>
                                        <td className="px-4 py-2.5 text-gray-500 font-mono">{trade.expiry_date}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-gray-300">${trade.total_cost?.toFixed(0)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.status === 'filled' ? 'bg-green-500/10 text-green-500' :
                                                    trade.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                        'bg-gray-500/10 text-gray-500'
                                                }`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {(trade.pnl || 0) >= 0 ? '+' : ''}{trade.pnl !== null && trade.pnl !== undefined ? `$${trade.pnl.toFixed(0)}` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickTradePage;
