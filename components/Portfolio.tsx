import React, { useState, useEffect, useCallback } from 'react';
import { useBrokerContext } from '../context/BrokerContext';
import { useAuth } from '../services/useAuth';
import SellPositionModal from './SellPositionModal';

// --- TYPES ---
interface PortfolioAccount {
    totalEquity: number;
    cashBalance: number;
    buyingPower: number;
    dayPL: number;
    accountType?: string;
    accountNumber?: string;
}

interface Position {
    symbol: string;
    underlying: string;
    description: string;
    assetType: string;
    putCall: string | null;
    strikePrice?: number;
    expirationDate?: string;
    quantity: number;
    avgPrice: number;
    marketValue: number;
    dayPL: number;
    dayPLPct: number;
    isOption: boolean;
    underlyingPrice?: number;
    underlyingPricePct?: number;
}

interface Order {
    orderId: string;
    symbol: string;
    underlying: string;
    assetType: string;
    putCall: string | null;
    instruction: string;
    quantity: number;
    filledQty: number;
    price: number;
    fillPrice: number | null;
    status: string;
    orderType: string;
    enteredTime: string;
    closedTime: string;
}

interface PortfolioData {
    success: boolean;
    broker: string;
    brokerMode: string;
    displayName: string;
    account: PortfolioAccount;
    positions: {
        all: Position[];
        totalCount: number;
        optionCount: number;
        stockCount: number;
    };
    orders: {
        [key: string]: Order[];
        count: any;
    };
    timestamp: string;
}

// --- HELPERS ---
const WEBHOOK_URL = 'https://prabhupadala01.app.n8n.cloud/webhook/portfolio';

const formatCurrency = (val: number | null | undefined): string => {
    if (val == null || isNaN(val)) return '$0.00';
    const abs = Math.abs(val);
    if (abs >= 1000000) return (val < 0 ? '-' : '') + '$' + (abs / 1000000).toFixed(2) + 'M';
    return (val < 0 ? '-' : '') + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (d: string | null | undefined): string => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatExpiry = (d: string | null | undefined): string => {
    if (!d) return '-';
    const date = new Date(d);
    const now = new Date();
    const dte = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` (${dte}d)`;
};

// --- SUB-COMPONENTS ---
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        FILLED: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
        CANCELED: 'bg-amber-900/20 text-amber-400 border-amber-800',
        REJECTED: 'bg-red-900/20 text-red-400 border-red-800',
        EXPIRED: 'bg-amber-900/20 text-amber-400 border-amber-800',
        WORKING: 'bg-indigo-900/20 text-indigo-400 border-indigo-800',
        QUEUED: 'bg-indigo-900/20 text-indigo-400 border-indigo-800',
        NEW: 'bg-indigo-900/20 text-indigo-400 border-indigo-800',
        ACCEPTED: 'bg-indigo-900/20 text-indigo-400 border-indigo-800',
    };
    const s = styles[status] || 'bg-gray-800 text-gray-400 border-gray-700';
    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border tracking-wide ${s}`}>
            {status}
        </span>
    );
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const isCall = type === 'CALL';
    return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${isCall ? 'bg-green-950 text-green-400 border-green-900' : 'bg-red-950 text-red-400 border-red-900'}`}>
            {type}
        </span>
    );
};

// --- MAIN COMPONENT ---
const Portfolio: React.FC = () => {
    const { selectedBroker } = useBrokerContext();
    const { user } = useAuth();

    const [data, setData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
    const [posFilter, setPosFilter] = useState('all');
    const [orderFilter, setOrderFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [sellPosition, setSellPosition] = useState<Position | null>(null);

    const fetchPortfolio = useCallback(async () => {
        if (!selectedBroker) {
            setLoading(false);
            setError('No broker selected. Please select a broker from the dropdown.');
            return;
        }

        try {
            const resp = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    broker_id: selectedBroker.id,
                    broker_name: selectedBroker.broker_name,
                    broker_mode: selectedBroker.broker_mode,
                    user_email: user?.email,
                }),
            });
            const json = await resp.json();
            if (json.success) {
                setData(json);
                setError(null);
            } else {
                setError(json.error || 'Failed to load portfolio');
            }
        } catch (e: any) {
            setError(e.message || 'Network error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedBroker, user]);

    // Fetch on mount and broker change
    useEffect(() => {
        setLoading(true);
        setError(null);
        setData(null);
        fetchPortfolio();
    }, [selectedBroker?.id]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(fetchPortfolio, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchPortfolio]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchPortfolio();
    };

    // --- LOADING ---
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-8 h-8 border-3 border-gray-700 border-t-green-500 rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm font-medium">Loading portfolio...</p>
            </div>
        );
    }

    // --- NO BROKER ---
    if (!selectedBroker) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-gray-600">link_off</span>
                </div>
                <h3 className="text-lg font-black text-white">No Broker Connected</h3>
                <p className="text-sm text-gray-500 max-w-xs text-center">Connect a broker from the Settings page, then select it from the dropdown.</p>
            </div>
        );
    }

    // --- ERROR ---
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[40vh] gap-3">
                <span className="text-3xl">⚠️</span>
                <p className="text-red-400 text-sm font-medium">{error}</p>
                <button onClick={handleRefresh} className="mt-2 px-5 py-2 bg-green-500 text-black font-semibold rounded-lg text-sm hover:bg-green-400 transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { account, positions, orders } = data;
    const dayPLColor = account.dayPL >= 0 ? 'text-green-400' : 'text-red-400';
    const dayPLBg = account.dayPL >= 0 ? 'bg-green-950 border-green-900' : 'bg-red-950 border-red-900';
    const plPct = account.totalEquity > 0 ? ((account.dayPL / (account.totalEquity - account.dayPL)) * 100).toFixed(2) : '0.00';

    // Get orders array (could be keyed by broker name)
    const allOrders: Order[] = orders[data.broker] || orders.alpaca || orders.schwab || [];
    const orderCount = typeof orders.count === 'number' ? orders.count : allOrders.length;

    // Filters
    const filteredPositions = posFilter === 'all'
        ? positions.all
        : posFilter === 'options'
            ? positions.all.filter(p => p.isOption)
            : positions.all.filter(p => !p.isOption);

    const filteredOrders = orderFilter === 'all'
        ? allOrders
        : allOrders.filter(o => {
            if (orderFilter === 'filled') return o.status === 'FILLED';
            if (orderFilter === 'pending') return ['QUEUED', 'WORKING', 'NEW', 'ACCEPTED', 'PENDING_ACTIVATION'].includes(o.status);
            if (orderFilter === 'cancelled') return ['CANCELED', 'REJECTED', 'EXPIRED'].includes(o.status);
            return true;
        });

    // Check if a position has a pending bracket/GTC sell order
    const hasBracketOrder = (pos: Position): boolean => {
        const pendingStatuses = ['QUEUED', 'WORKING', 'NEW', 'ACCEPTED', 'PENDING_ACTIVATION'];
        return allOrders.some(o =>
            o.symbol === pos.symbol &&
            pendingStatuses.includes(o.status) &&
            (o.instruction?.includes('SELL') || o.instruction === 'SELL_TO_CLOSE')
        );
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Portfolio</h1>
                    <span className="text-xs text-gray-500 font-medium">{data.displayName} • {data.brokerMode?.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3.5 py-1.5 rounded-lg text-xs font-bold text-gray-200 tracking-wider border border-gray-800 flex items-center gap-2 ${data.broker === 'schwab' ? 'bg-green-950/30' : 'bg-blue-950/30'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${data.broker === 'schwab' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                        {data.broker?.toUpperCase()}
                    </span>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="w-9 h-9 rounded-lg border border-gray-800 bg-[#111820] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                        <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>
            </div>

            {/* Account Cards */}
            <div className="grid grid-cols-4 gap-3">
                {/* Equity Card */}
                <div className="col-span-1 bg-gradient-to-br from-[#111820] to-[#0d1117] rounded-xl p-5 border border-[#1e2a36] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">TOTAL EQUITY</span>
                    <span className="text-3xl font-extrabold text-white tracking-tight font-mono">{formatCurrency(account.totalEquity)}</span>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${dayPLBg} ${dayPLColor}`}>
                            {account.dayPL >= 0 ? '▲' : '▼'} {account.dayPL >= 0 ? '+' : ''}{formatCurrency(account.dayPL)} ({plPct}%)
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">TODAY</span>
                    </div>
                </div>

                {/* Cash */}
                <div className="bg-[#111820] rounded-xl p-5 border border-[#1e2a36] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">CASH BALANCE</span>
                    <span className="text-2xl font-extrabold text-white tracking-tight font-mono">{formatCurrency(account.cashBalance)}</span>
                    <span className="text-[11px] text-gray-500 font-medium">Buying Power: {formatCurrency(account.buyingPower)}</span>
                </div>

                {/* Positions count */}
                <div className="bg-[#111820] rounded-xl p-5 border border-[#1e2a36] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">OPEN POSITIONS</span>
                    <span className="text-2xl font-extrabold text-white tracking-tight font-mono">{String(positions.totalCount).padStart(2, '0')}</span>
                    <span className="text-[11px] text-gray-500 font-medium">{positions.optionCount} options • {positions.stockCount} stocks</span>
                </div>

                {/* Orders count */}
                <div className="bg-[#111820] rounded-xl p-5 border border-[#1e2a36] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">ORDERS (7D)</span>
                    <span className="text-2xl font-extrabold text-white tracking-tight font-mono">{String(orderCount).padStart(2, '0')}</span>
                    <span className="text-[11px] text-gray-500 font-medium">
                        {allOrders.filter(o => o.status === 'FILLED').length} filled • {allOrders.filter(o => ['QUEUED', 'WORKING', 'NEW', 'ACCEPTED'].includes(o.status)).length} pending
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[#1e2a36]">
                {(['positions', 'orders'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab
                            ? 'text-white border-green-500'
                            : 'text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                    >
                        {tab === 'positions' ? 'Active Positions' : 'Order History'}
                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${activeTab === tab ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-400'
                            }`}>
                            {tab === 'positions' ? positions.totalCount : orderCount}
                        </span>
                    </button>
                ))}
            </div>

            {/* Positions Tab */}
            {activeTab === 'positions' && (
                <div className="animate-in fade-in duration-200">
                    {/* Filters */}
                    <div className="flex gap-1.5 mb-3">
                        {['all', 'options', 'stocks'].map(f => (
                            <button
                                key={f}
                                onClick={() => setPosFilter(f)}
                                className={`px-3.5 py-1.5 rounded-md border text-xs font-semibold transition-colors capitalize ${posFilter === f
                                    ? 'bg-green-950/40 text-green-400 border-green-900'
                                    : 'bg-[#111820] text-gray-400 border-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {filteredPositions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-60">
                            <span className="text-3xl">📭</span>
                            <p className="text-gray-500 text-sm">No active positions</p>
                        </div>
                    ) : (
                        <div className="bg-[#111820] rounded-xl border border-[#1e2a36] overflow-hidden">
                            {/* Table Header */}
                            <div className="flex px-4 py-2.5 border-b border-[#1e2a36] text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                                <span className="flex-[2]">SYMBOL</span>
                                <span className="flex-1 text-right">QTY</span>
                                <span className="flex-1 text-right">AVG COST</span>
                                <span className="flex-1 text-right">MKT VALUE</span>
                                <span className="flex-1 text-right">P&L</span>
                                <span className="flex-1 text-right">EXPIRY</span>
                                <span className="flex-1 text-right">ACTION</span>
                            </div>
                            {/* Table Rows */}
                            {filteredPositions.map((p, i) => {
                                const plColor = p.dayPL > 0 ? 'text-green-400' : p.dayPL < 0 ? 'text-red-400' : 'text-gray-400';
                                const isBracket = hasBracketOrder(p);
                                return (
                                    <div key={i} className={`flex items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < filteredPositions.length - 1 ? 'border-b border-gray-800/50' : ''}`}>
                                        <span className="flex-[2] flex items-center gap-2.5">
                                            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-950 to-green-900/20 text-green-400 flex items-center justify-center text-xs font-bold border border-green-900 shrink-0">
                                                {p.underlying?.charAt(0) || '?'}
                                            </span>
                                            <span>
                                                <span className="text-white font-semibold text-sm block">{p.underlying}</span>
                                                {p.isOption ? (
                                                    <span className="flex items-center gap-1.5 mt-0.5">
                                                        <TypeBadge type={p.putCall!} />
                                                        <span className="text-gray-400 text-[11px]">${p.strikePrice}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 text-[11px] block">EQUITY</span>
                                                )}
                                                {p.underlyingPrice != null && (
                                                    <span className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-gray-300 text-[11px] font-mono">${p.underlyingPrice.toFixed(2)}</span>
                                                        {p.underlyingPricePct != null && (
                                                            <span className={`text-[10px] font-bold ${p.underlyingPricePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {p.underlyingPricePct >= 0 ? '▲' : '▼'} {Math.abs(p.underlyingPricePct).toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                        <span className="flex-1 text-right text-gray-300 text-sm font-medium">{p.quantity}</span>
                                        <span className="flex-1 text-right text-gray-300 text-sm">{formatCurrency(p.avgPrice)}</span>
                                        <span className="flex-1 text-right text-white text-sm font-semibold">{formatCurrency(p.marketValue)}</span>
                                        <span className="flex-1 text-right">
                                            <span className={`text-sm font-semibold block ${plColor}`}>
                                                {p.dayPL > 0 ? '+' : ''}{formatCurrency(p.dayPL)}
                                            </span>
                                            <span className={`text-[11px] block opacity-80 ${plColor}`}>
                                                {p.dayPLPct > 0 ? '+' : ''}{p.dayPLPct?.toFixed(1)}%
                                            </span>
                                        </span>
                                        <span className="flex-1 text-right">
                                            {p.isOption && p.expirationDate ? (() => {
                                                const expDate = new Date(p.expirationDate);
                                                const dte = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86400000));
                                                const dteColor = dte <= 3 ? 'text-red-400' : dte <= 7 ? 'text-amber-400' : 'text-gray-500';
                                                return (
                                                    <>
                                                        <span className="text-gray-300 text-xs block">
                                                            {expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <span className={`text-[10px] font-bold block ${dteColor}`}>
                                                            {dte === 0 ? 'Expires today' : `${dte}d left`}
                                                        </span>
                                                    </>
                                                );
                                            })() : (
                                                <span className="text-gray-600 text-xs">-</span>
                                            )}
                                        </span>
                                        <span className="flex-1 text-right">
                                            {isBracket ? (
                                                <span
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ml-auto bg-gray-800/50 text-gray-500 border border-gray-700 cursor-not-allowed"
                                                    title="Bracket (GTC) order is active — position will auto-close at TP/SL"
                                                >
                                                    <span className="material-symbols-outlined text-sm">lock</span>
                                                    Bracket
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSellPosition(p); }}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1.5 ml-auto ${p.dayPL >= 0
                                                        ? 'bg-green-950/40 text-green-400 border border-green-900 hover:bg-green-900/40'
                                                        : 'bg-red-950/40 text-red-400 border border-red-900 hover:bg-red-900/40'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-sm">sell</span>
                                                    Close
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="animate-in fade-in duration-200">
                    {/* Filters */}
                    <div className="flex gap-1.5 mb-3">
                        {['all', 'filled', 'pending', 'cancelled'].map(f => (
                            <button
                                key={f}
                                onClick={() => setOrderFilter(f)}
                                className={`px-3.5 py-1.5 rounded-md border text-xs font-semibold transition-colors capitalize ${orderFilter === f
                                    ? 'bg-green-950/40 text-green-400 border-green-900'
                                    : 'bg-[#111820] text-gray-400 border-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-60">
                            <span className="text-3xl">📋</span>
                            <p className="text-gray-500 text-sm">No orders found</p>
                        </div>
                    ) : (
                        <div className="bg-[#111820] rounded-xl border border-[#1e2a36] overflow-hidden">
                            {/* Table Header */}
                            <div className="flex px-4 py-2.5 border-b border-[#1e2a36] text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                                <span className="flex-[2]">ORDER</span>
                                <span className="flex-1">SIDE</span>
                                <span className="flex-1 text-right">QTY</span>
                                <span className="flex-1 text-right">PRICE</span>
                                <span className="flex-1 text-center">STATUS</span>
                                <span className="flex-[1.2] text-right">TIME</span>
                            </div>
                            {/* Table Rows */}
                            {filteredOrders.map((o, i) => (
                                <div key={i} className={`flex items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < filteredOrders.length - 1 ? 'border-b border-gray-800/50' : ''}`}>
                                    <span className="flex-[2] flex items-center gap-2.5">
                                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-950 to-green-900/20 text-green-400 flex items-center justify-center text-xs font-bold border border-green-900 shrink-0">
                                            {(o.underlying || o.symbol)?.charAt(0) || '?'}
                                        </span>
                                        <span>
                                            <span className="text-white font-semibold text-sm block">{o.underlying || o.symbol?.substring(0, 4)}</span>
                                            {o.putCall ? (
                                                <span className="flex items-center gap-1.5 mt-0.5">
                                                    <TypeBadge type={o.putCall} />
                                                    <span className="text-gray-600 text-[10px]">{o.orderType}</span>
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 text-[11px] block">{o.assetType} • {o.orderType}</span>
                                            )}
                                        </span>
                                    </span>
                                    <span className="flex-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${o.instruction?.includes('BUY')
                                            ? 'bg-green-950 text-green-400 border-green-900'
                                            : 'bg-red-950 text-red-400 border-red-900'
                                            }`}>
                                            {o.instruction?.replace('_', ' ')}
                                        </span>
                                    </span>
                                    <span className="flex-1 text-right text-gray-300 text-sm">{o.filledQty || 0}/{o.quantity}</span>
                                    <span className="flex-1 text-right">
                                        <span className="text-white text-sm">{o.fillPrice ? formatCurrency(o.fillPrice) : formatCurrency(o.price)}</span>
                                        {o.fillPrice && o.fillPrice !== o.price && (
                                            <span className="text-gray-600 text-[10px] block line-through">{formatCurrency(o.price)}</span>
                                        )}
                                    </span>
                                    <span className="flex-1 text-center"><StatusBadge status={o.status} /></span>
                                    <span className="flex-[1.2] text-right text-gray-400 text-[11px]">{formatDate(o.enteredTime)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="text-center py-3 border-t border-[#1e2a36]">
                <span className="text-gray-600 text-[11px]">Last synced: {formatDate(data.timestamp)}</span>
            </div>

            {/* Sell Position Modal */}
            <SellPositionModal
                isOpen={!!sellPosition}
                onClose={() => setSellPosition(null)}
                position={sellPosition}
                brokerInfo={selectedBroker ? {
                    broker_id: selectedBroker.id,
                    broker_name: selectedBroker.broker_name,
                    broker_mode: selectedBroker.broker_mode,
                } : null}
                userId={user?.id}
                onSuccess={() => {
                    setSellPosition(null);
                    fetchPortfolio();
                }}
            />
        </div>
    );
};

export default Portfolio;
