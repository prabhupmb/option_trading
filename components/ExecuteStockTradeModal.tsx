import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../services/useAuth';
import { useBrokerContext } from '../context/BrokerContext';
import { SmartSignal } from '../hooks/useSignals';
import { formatCurrency } from '../utils/tradeUtils';

// ─── TYPES ────────────────────────────────────────────────────

interface ExecuteStockTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    signal: SmartSignal | null;
    onSuccess?: () => void;
    onNavigate?: (view: string) => void;
}

type BlockingErrorType = 'market_closed' | 'session_expired' | 'reconnect_required' | 'broker_not_configured';
type OrderType = 'market' | 'limit';
type TradeAction = 'BUY' | 'SELL';

// ─── HELPERS ─────────────────────────────────────────────────

function getNextMarketOpen(): string {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const day = et.getDay();
    const hour = et.getHours();
    const min = et.getMinutes();
    const next = new Date(et);

    if (day === 6) next.setDate(next.getDate() + 2);
    else if (day === 0) next.setDate(next.getDate() + 1);
    else if (hour > 16 || (hour === 16 && min > 0)) next.setDate(next.getDate() + (day === 5 ? 3 : 1));
    else if (hour < 9 || (hour === 9 && min < 30)) { /* same day */ }
    else next.setDate(next.getDate() + (day === 5 ? 3 : 1));

    next.setHours(9, 30, 0, 0);
    const isToday = next.toDateString() === et.toDateString();
    const tomorrow = new Date(et);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = next.toDateString() === tomorrow.toDateString();
    const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : next.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayLabel}, 9:30 AM ET`;
}

function detectBlockingError(errorStr: string): BlockingErrorType | null {
    const msg = errorStr.toLowerCase();
    if (msg.includes('9:30') || msg.includes('market hours') || msg.includes('4:00 pm') || msg.includes('market closed') || msg.includes('outside of')) return 'market_closed';
    if (msg.includes('refresh token') || msg.includes('7-day') || msg.includes('invalid_grant') || msg.includes('reconnect')) return 'reconnect_required';
    if (msg.includes('session expired') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('token expired') || msg.includes('token')) return 'session_expired';
    if (msg.includes('credentials') || msg.includes('broker not found') || msg.includes('inactive') || msg.includes('failed to fetch')) return 'broker_not_configured';
    return null;
}

// ─── BLOCKING ERROR CONFIG ──────────────────────────────────

const BLOCKING_ERROR_CONFIG: Record<BlockingErrorType, { icon: string; title: string; color: string; message: string }> = {
    market_closed: { icon: '🕐', title: 'MARKET CLOSED', color: '#f59e0b', message: 'Stock trading is available during market hours only.' },
    session_expired: { icon: '🔒', title: 'SESSION EXPIRED', color: '#ef4444', message: 'Your broker session has expired. Please reconnect to continue trading.' },
    reconnect_required: { icon: '🔑', title: 'RECONNECT REQUIRED', color: '#ef4444', message: 'Your broker authorization has expired. You need to log in again.' },
    broker_not_configured: { icon: '⚙️', title: 'BROKER NOT CONFIGURED', color: '#f59e0b', message: 'Could not connect to your broker. Please check your broker settings.' },
};

// ─── BLOCKING ERROR COMPONENT ────────────────────────────────

const BlockingError: React.FC<{ type: BlockingErrorType; brokerName?: string; onClose: () => void; onNavigate?: (view: string) => void }> = ({ type, brokerName, onClose, onNavigate }) => {
    const config = BLOCKING_ERROR_CONFIG[type];
    const currentET = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 32px', minHeight: '300px' }}>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ background: `${config.color}12` }}>
                <span style={{ fontSize: '48px' }}>{config.icon}</span>
            </div>
            <h3 style={{ color: config.color, fontSize: '16px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{config.title}</h3>
            <p style={{ color: '#9ca3af', fontSize: '13px', maxWidth: '360px', lineHeight: 1.5, marginBottom: '24px' }}>{config.message}</p>

            <div style={{ background: '#0d1117', border: '1px solid #1e2a36', borderRadius: '10px', padding: '16px 20px', width: '100%', maxWidth: '400px', textAlign: 'left', marginBottom: '24px' }}>
                {type === 'market_closed' && (
                    <>
                        <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #1e2a36' }}>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>🔔 Market Hours</span>
                            <span style={{ color: '#d1d5db', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Mon–Fri: 9:30 AM — 4:00 PM ET</span>
                        </div>
                        <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #1e2a36' }}>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>⏰ Current Time</span>
                            <span style={{ color: '#d1d5db', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{currentET} ET</span>
                        </div>
                        <div className="flex justify-between items-center" style={{ padding: '8px 0' }}>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>📅 Next Open</span>
                            <span style={{ color: '#d1d5db', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{getNextMarketOpen()}</span>
                        </div>
                    </>
                )}
                {(type === 'session_expired' || type === 'reconnect_required') && (
                    <div className="flex items-start gap-2">
                        <span>ℹ️</span>
                        <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                            {brokerName === 'schwab' ? 'Schwab' : 'Your broker'} requires re-authentication. Go to Settings to reconnect.
                        </p>
                    </div>
                )}
                {type === 'broker_not_configured' && (
                    <div className="flex items-start gap-2">
                        <span>ℹ️</span>
                        <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                            Your broker credentials may be missing, expired, or inactive. Go to Settings to reconnect.
                        </p>
                    </div>
                )}
            </div>

            <div className="flex gap-2.5 justify-center">
                <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #1f2937', background: '#0d1117', color: '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                {(type === 'session_expired' || type === 'reconnect_required' || type === 'broker_not_configured') && (
                    <button onClick={() => { onClose(); onNavigate?.('settings'); }} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: type === 'broker_not_configured' ? '#f59e0b' : '#22c55e', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                        Go to Settings →
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────

const ExecuteStockTradeModal: React.FC<ExecuteStockTradeModalProps> = ({ isOpen, onClose, signal, onSuccess, onNavigate }) => {
    const { user, accessLevel } = useAuth();
    const { selectedBroker } = useBrokerContext();

    // State
    const [tradeAction, setTradeAction] = useState<TradeAction>('BUY');
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [quantity, setQuantity] = useState(1);
    const [limitPrice, setLimitPrice] = useState('');
    const [confirmText, setConfirmText] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [txId, setTxId] = useState('');
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [blockingError, setBlockingError] = useState<BlockingErrorType | null>(null);

    // Derived
    const isPaper = accessLevel === 'paper' || selectedBroker?.broker_mode === 'paper';
    const isBuy = tradeAction === 'BUY';
    const themeColor = isPaper ? 'blue' : isBuy ? 'green' : 'red';

    const effectivePrice = useMemo(() => {
        if (orderType === 'limit' && limitPrice) return parseFloat(limitPrice) || 0;
        return signal?.current_price || 0;
    }, [orderType, limitPrice, signal?.current_price]);

    const estimatedCost = useMemo(() => quantity * effectivePrice, [quantity, effectivePrice]);

    // Init on open
    useEffect(() => {
        if (signal && isOpen) {
            const signalType = signal.signal_type?.toUpperCase();
            setTradeAction(signalType === 'SELL' ? 'SELL' : 'BUY');
            setOrderType('market');
            setQuantity(1);
            setLimitPrice(signal.entry_price?.toFixed(2) || signal.current_price?.toFixed(2) || '');
            setConfirmText('');
            setSubmitting(false);
            setSubmitted(false);
            setErrorMsg('');
            setTxId('');
            setExecutionResult(null);
            setBlockingError(null);
        }
    }, [signal, isOpen]);

    if (!isOpen || !signal) return null;

    // ─── Submit Order ─────────────────────────────────────────

    const handleSubmit = async () => {
        if (!isPaper && confirmText.toUpperCase() !== 'CONFIRM') {
            setErrorMsg('Please type CONFIRM to place a live order.');
            return;
        }

        setSubmitting(true);
        setErrorMsg('');
        setExecutionResult(null);

        try {
            const payload = {
                symbol: signal.symbol,
                action: tradeAction,
                order_type: orderType,
                quantity: quantity,
                limit_price: orderType === 'limit' ? effectivePrice : null,
                current_price: signal.current_price,
                estimated_cost: estimatedCost,

                // Signal reference
                signal_id: signal.id || null,
                signal_type: signal.signal_type,
                confidence: signal.confidence,
                entry_price: signal.entry_price,
                target_price: signal.target_price,
                stop_loss: signal.stop_loss,

                // Broker
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: isPaper ? 'paper' : 'live',

                user_id: user?.id,
            };

            console.log('Execute Stock Trade Payload:', payload);

            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/execute-stock-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            setExecutionResult(result);

            if (result.success) {
                setTxId(result.order?.orderId || result.order_id || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase());
                setSubmitted(true);
            } else {
                const errorStr = typeof result.error === 'string' ? result.error : (result.error?.message || result.message || JSON.stringify(result.error) || '');
                const blocking = detectBlockingError(errorStr);
                if (blocking) {
                    setBlockingError(blocking);
                } else {
                    setErrorMsg(result.message || result.error || 'Order failed. Please try again.');
                }
            }
        } catch (err: any) {
            console.error('Stock Trade Error:', err);
            setErrorMsg(err.message || 'Network error.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Confidence badge color ───────────────────────────────
    const getConfidenceColor = (c: string) => {
        if (c === 'strong') return 'text-green-400 bg-green-900/30 border-green-800';
        if (c === 'moderate') return 'text-yellow-400 bg-yellow-900/30 border-yellow-800';
        return 'text-gray-400 bg-gray-800 border-gray-700';
    };

    const getSignalBadge = (type: string) => {
        switch (type) {
            case 'BUY': return 'text-green-400 bg-green-900/30 border-green-800';
            case 'SELL': return 'text-red-400 bg-red-900/30 border-red-800';
            case 'HOLD': return 'text-blue-400 bg-blue-900/30 border-blue-800';
            case 'WAIT': return 'text-yellow-400 bg-yellow-900/30 border-yellow-800';
            default: return 'text-gray-400 bg-gray-800 border-gray-700';
        }
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-[#0f1219] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
                style={{ animation: 'slideUp 0.25s ease' }}>

                {/* ─── Header ───────────────────────────────── */}
                <div className={`p-4 border-b border-${themeColor}-500/20 bg-${themeColor}-900/10 flex justify-between items-center`}>
                    <div>
                        <h2 className={`text-lg font-black uppercase tracking-tight text-${themeColor}-400 flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-xl">
                                {isBuy ? 'trending_up' : 'trending_down'}
                            </span>
                            {tradeAction} Stock
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mt-1">
                            <span className="text-white">{signal.symbol}</span>
                            <span className="text-gray-600">•</span>
                            <span>{formatCurrency(signal.current_price)}</span>
                            <span className="text-gray-600">•</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getSignalBadge(signal.signal_type)}`}>{signal.signal_type}</span>
                            <span className="text-gray-600">•</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getConfidenceColor(signal.confidence)}`}>{signal.confidence}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* ─── Broker Bar ────────────────────────────── */}
                <div className={`px-4 py-2 border-b border-gray-800 flex justify-between items-center ${isPaper ? 'bg-blue-900/10' : 'bg-gradient-to-r from-green-950/20 to-transparent'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Broker</span>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${selectedBroker?.is_active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            <span className="text-xs font-bold text-white">{selectedBroker?.display_name || 'None'}</span>
                        </div>
                    </div>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${isPaper ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-green-400 border-green-700 bg-green-950/40'}`}>
                        {isPaper ? 'Paper' : 'LIVE'}
                    </span>
                </div>

                {/* ─── Body ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {!blockingError && !submitting && !submitted && (
                        <>
                            {/* Signal Info Card */}
                            <div className="bg-[#0d1117] rounded-xl p-4 border border-gray-700/60">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <span className="font-black text-white text-xl">{signal.symbol}</span>
                                        <span className="block text-xs text-gray-400 mt-0.5">{signal.market_status}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-white text-xl font-mono">{formatCurrency(signal.current_price)}</span>
                                        <span className="block text-[10px] text-gray-500">Current Price</span>
                                    </div>
                                </div>
                                {(signal.entry_price || signal.target_price || signal.stop_loss) && (
                                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800/60">
                                        {signal.entry_price && (
                                            <div>
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">Entry</span>
                                                <p className="text-sm font-mono text-white">{formatCurrency(signal.entry_price)}</p>
                                            </div>
                                        )}
                                        {signal.target_price && (
                                            <div>
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">Target</span>
                                                <p className="text-sm font-mono text-green-400">{formatCurrency(signal.target_price)}</p>
                                            </div>
                                        )}
                                        {signal.stop_loss && (
                                            <div>
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">Stop Loss</span>
                                                <p className="text-sm font-mono text-red-400">{formatCurrency(signal.stop_loss)}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Trade Action */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Action</label>
                                <div className="flex bg-[#0d1117] rounded-lg border border-gray-700/60 p-1">
                                    <button
                                        onClick={() => setTradeAction('BUY')}
                                        className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${tradeAction === 'BUY' ? 'bg-green-900/40 text-green-400 shadow' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${tradeAction === 'BUY' ? 'bg-green-400' : 'bg-gray-700'}`}></span>
                                        BUY
                                    </button>
                                    <button
                                        onClick={() => setTradeAction('SELL')}
                                        className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${tradeAction === 'SELL' ? 'bg-red-900/40 text-red-400 shadow' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${tradeAction === 'SELL' ? 'bg-red-400' : 'bg-gray-700'}`}></span>
                                        SELL
                                    </button>
                                </div>
                            </div>

                            {/* Order Type */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Order Type</label>
                                <div className="flex bg-[#0d1117] rounded-lg border border-gray-700/60 p-1 gap-1">
                                    <button
                                        onClick={() => setOrderType('market')}
                                        className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${orderType === 'market' ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-800' : 'text-gray-500 hover:text-white border border-transparent'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">bolt</span>
                                        Market
                                    </button>
                                    <button
                                        onClick={() => setOrderType('limit')}
                                        className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${orderType === 'limit' ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-800' : 'text-gray-500 hover:text-white border border-transparent'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">tune</span>
                                        Limit
                                    </button>
                                </div>
                            </div>

                            {/* Limit Price */}
                            {orderType === 'limit' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Limit Price</label>
                                    <div className="flex items-center bg-[#0d1117] border border-gray-700/60 rounded-lg overflow-hidden">
                                        <span className="px-3 text-gray-500 font-bold border-r border-gray-700/60">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={limitPrice}
                                            onChange={e => setLimitPrice(e.target.value)}
                                            placeholder={signal.current_price?.toFixed(2)}
                                            className="flex-1 px-3 py-3 bg-transparent text-white font-mono font-bold text-lg outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Quantity */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Shares</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        disabled={quantity <= 1}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg bg-[#0d1117] border border-gray-700 ${quantity <= 1 ? 'text-gray-600' : 'text-white hover:bg-gray-800'} transition-colors`}
                                    >
                                        <span className="material-symbols-outlined text-sm">remove</span>
                                    </button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-20 text-center font-mono font-black text-xl bg-[#0d1117] border border-gray-700/60 rounded-lg py-2 text-white outline-none"
                                    />
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#0d1117] border border-gray-700 text-white hover:bg-gray-800 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                    </button>
                                    <div className="flex gap-1.5 ml-2">
                                        {[5, 10, 25, 50].map(q => (
                                            <button
                                                key={q}
                                                onClick={() => setQuantity(q)}
                                                className={`px-2.5 py-1.5 rounded text-[10px] font-bold border transition-all ${quantity === q ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800' : 'bg-[#0d1117] text-gray-500 border-gray-700/60 hover:text-white hover:border-gray-500'}`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div className="bg-[#080c11] rounded-xl p-4 border border-gray-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-xs">Order Type</span>
                                    <span className="text-white text-xs font-semibold uppercase">{orderType}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-xs">Price</span>
                                    <span className="text-white text-xs font-semibold font-mono">
                                        {orderType === 'market' ? `~${formatCurrency(signal.current_price)}` : formatCurrency(effectivePrice)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-xs">Shares</span>
                                    <span className="text-white text-xs font-semibold font-mono">{quantity}</span>
                                </div>
                                <div className="border-t border-gray-800 pt-2 mt-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-xs font-bold uppercase">Est. Total</span>
                                        <span className={`font-mono font-black text-xl ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(estimatedCost)}
                                        </span>
                                    </div>
                                </div>
                                {signal.risk_reward_ratio && (
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-gray-500 text-xs">R/R Ratio</span>
                                        <span className="text-yellow-400 text-xs font-bold font-mono">{signal.risk_reward_ratio}</span>
                                    </div>
                                )}
                            </div>

                            {/* Live confirmation */}
                            {!isPaper && (
                                <div>
                                    <label className="block text-xs font-bold text-red-500 uppercase mb-2 animate-pulse">Type CONFIRM to execute</label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder="CONFIRM"
                                        className="w-full bg-red-900/10 border border-red-500/30 rounded-lg px-4 py-3 text-center text-white font-bold uppercase placeholder-red-500/30 focus:border-red-500 outline-none"
                                    />
                                </div>
                            )}

                            {errorMsg && (
                                <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs font-medium">{errorMsg}</div>
                            )}
                        </>
                    )}

                    {/* Submitting */}
                    {submitting && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-green-500 animate-spin mx-auto mb-6"></div>
                            <h3 className="text-lg font-black text-white animate-pulse">Submitting {tradeAction} Order...</h3>
                            <p className="text-gray-500 text-sm mt-2">{quantity} shares of {signal.symbol} at {orderType === 'market' ? 'market price' : formatCurrency(effectivePrice)}</p>
                        </div>
                    )}

                    {/* Success */}
                    {submitted && (
                        <div className="space-y-4">
                            <div className="bg-green-900/10 border border-green-500/30 rounded-xl overflow-hidden">
                                <div className="bg-green-600 p-4 border-b border-green-500 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-white">check_circle</span>
                                    <span className="text-white font-black uppercase text-sm tracking-wide">Order Submitted Successfully</span>
                                </div>
                                <div className="p-5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Order ID</span>
                                        <span className="font-mono text-white text-xs" title={txId}>{txId.substring(0, 16)}...</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Status</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${executionResult?.order?.status === 'accepted' || executionResult?.order?.status === 'filled' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                                            <span className={`text-xs font-black uppercase ${executionResult?.order?.status === 'accepted' || executionResult?.order?.status === 'filled' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {executionResult?.order?.status || 'SUBMITTED'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-px bg-green-500/20"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Action</span>
                                        <span className={`text-sm font-bold uppercase ${isBuy ? 'text-green-400' : 'text-red-400'}`}>{tradeAction}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Symbol</span>
                                        <span className="text-white text-sm font-bold">{signal.symbol}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Shares</span>
                                        <span className="font-mono text-white text-sm">{quantity}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Order Type</span>
                                        <span className="text-white text-sm font-bold uppercase">{orderType}</span>
                                    </div>
                                    {orderType === 'limit' && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Limit Price</span>
                                            <span className="font-mono text-white text-sm">{formatCurrency(effectivePrice)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Est. Total</span>
                                        <span className="font-mono text-white text-sm font-bold">{formatCurrency(estimatedCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Broker</span>
                                        <span className="text-white text-sm font-bold">{selectedBroker?.display_name} ({selectedBroker?.broker_mode?.toUpperCase()})</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Blocking Error */}
                    {blockingError && (
                        <BlockingError
                            type={blockingError}
                            brokerName={selectedBroker?.broker_name}
                            onClose={onClose}
                            onNavigate={onNavigate}
                        />
                    )}

                    {/* Error on submit */}
                    {!submitting && !submitted && !blockingError && executionResult && !executionResult.success && (
                        <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-red-500 font-black text-base justify-center">
                                <span className="material-symbols-outlined">error</span>
                                ORDER FAILED
                            </div>
                            <p className="text-white font-bold text-sm text-center">{executionResult?.message || errorMsg || 'Unknown error'}</p>
                            {executionResult?.suggestion && (
                                <div className="flex items-start gap-2 bg-red-900/20 p-3 rounded-lg border border-red-500/20 text-left">
                                    <span className="text-lg">💡</span>
                                    <span className="text-red-200 text-xs font-medium">{executionResult.suggestion}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── Footer ───────────────────────────────── */}
                {!blockingError && (
                    <div className="p-4 border-t border-gray-800 bg-[#0f1219]/90 backdrop-blur flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors text-xs"
                        >
                            Cancel
                        </button>

                        {!submitting && !submitted && (
                            <button
                                onClick={handleSubmit}
                                disabled={!isPaper && confirmText.toUpperCase() !== 'CONFIRM'}
                                className={`px-6 py-3 rounded-lg font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.97] flex items-center gap-2 text-xs ${(!isPaper && confirmText.toUpperCase() !== 'CONFIRM')
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : isBuy
                                        ? 'bg-green-600 hover:bg-green-500 text-white'
                                        : 'bg-red-600 hover:bg-red-500 text-white'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm">{isBuy ? 'trending_up' : 'trending_down'}</span>
                                {tradeAction} {quantity} Share{quantity > 1 ? 's' : ''}
                            </button>
                        )}

                        {submitted && (
                            <button
                                onClick={() => { onClose(); if (onSuccess) onSuccess(); }}
                                className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-black uppercase transition-all flex items-center gap-2 text-xs"
                            >
                                <span className="material-symbols-outlined text-green-500 text-sm">check</span>
                                Done
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
};

export default ExecuteStockTradeModal;
