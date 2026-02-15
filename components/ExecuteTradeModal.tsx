import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/useAuth';
import { useBrokerContext } from '../context/BrokerContext';
import { OptionSignal } from '../types';
import { formatCurrency, getExpiryOptions, getStrikeSuggestions } from '../utils/tradeUtils';

interface ExecuteTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    signal: OptionSignal | null;
    onSuccess?: () => void;
}

type OrderStep = 'config' | 'confirm' | 'submitting' | 'success' | 'error';
type OrderType = 'market' | 'limit';

const ExecuteTradeModal: React.FC<ExecuteTradeModalProps> = ({ isOpen, onClose, signal, onSuccess }) => {
    const { user, accessLevel } = useAuth();
    const { selectedBroker } = useBrokerContext();

    // Modal State
    const [step, setStep] = useState<OrderStep>('config');
    const [errorMsg, setErrorMsg] = useState('');
    const [txId, setTxId] = useState('');

    // Order Configuration
    const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
    const [expiry, setExpiry] = useState('');
    const [strike, setStrike] = useState('');
    const [contracts, setContracts] = useState(1);
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [limitPrice, setLimitPrice] = useState('');
    const [budget, setBudget] = useState(300); // Default to $300 or user setting
    const [stopLossEnabled, setStopLossEnabled] = useState(true);
    const [takeProfitTarget, setTakeProfitTarget] = useState<number | null>(null);
    const [confirmText, setConfirmText] = useState('');

    // Computed Values
    const [strikes, setStrikes] = useState({ itm: [] as number[], atm: [] as number[], otm: [] as number[] });
    const [expiryOptions, setExpiryOptions] = useState<{ label: string; value: string }[]>([]);

    // Initialize defaults when signal opens
    useEffect(() => {
        if (signal && isOpen) {
            setStep('config');
            setErrorMsg('');
            setTxId('');
            setConfirmText('');

            setOptionType(signal.option_type as 'CALL' | 'PUT');

            // Strikes
            const suggestion = getStrikeSuggestions(signal.current_price, signal.option_type as 'CALL' | 'PUT');
            setStrikes(suggestion);
            setStrike(suggestion.atm[0].toString()); // Default ATM

            // Expiry
            const opts = getExpiryOptions();
            setExpiryOptions(opts);
            setExpiry(opts[0].value); // This Friday

            // Budget (mock from user metadata or generic default)
            setBudget(user?.user_metadata?.default_budget || 300);

            // Targets
            setTakeProfitTarget(signal.fib_target1);

            // Reset others
            setContracts(1);
            setOrderType('market');
            setLimitPrice('');
        }
    }, [signal, isOpen, user]);

    if (!isOpen || !signal) return null;

    const isCall = optionType === 'CALL';
    const isPaper = accessLevel === 'paper' || selectedBroker?.broker_mode === 'paper';
    const themeColor = isPaper ? 'blue' : isCall ? 'green' : 'red';

    // Calculations
    const estimatedPricePer = 2.50; // Mock premium price (would fetch quote in real app)
    const estimatedTotal = contracts * estimatedPricePer * 100; // 100 shares per contract
    const maxRisk = estimatedTotal; // Long options risk premium

    const handleConfirm = () => {
        // Validate
        if (!strike || !expiry) {
            setErrorMsg('Please complete all configuration fields.');
            return;
        }
        setStep('confirm');
    };

    const handleSubmitOrder = async () => {
        // If live, require confirmation text
        if (!isPaper && confirmText.toUpperCase() !== 'CONFIRM') {
            setErrorMsg('Please type CONFIRM to place a live order.');
            return;
        }

        setStep('submitting');
        setErrorMsg('');

        try {
            const payload = {
                symbol: signal.symbol,
                option_type: optionType,
                strike: parseFloat(strike),
                expiry: expiry,
                quantity: contracts,
                order_type: orderType,
                limit_price: limitPrice ? parseFloat(limitPrice) : null,
                budget: budget,
                stop_loss: stopLossEnabled ? signal.fib_stop_loss : null,
                take_profit: takeProfitTarget,
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: isPaper ? 'paper' : 'live', // Force paper if access level is paper
                user_id: user?.id,
                signal_id: signal.id,
            };

            // Webhook Call
            const response = await fetch('https://terragigsolutions.app.n8n.cloud/webhook/execute-option-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && (result.success || result.status === 'submitted')) {
                setTxId(result.order_id || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase());
                setStep('success');
                if (onSuccess) onSuccess();
            } else {
                throw new Error(result.error || 'Trigger failed');
            }
        } catch (err: any) {
            console.error('Order Error:', err);
            setErrorMsg(err.message || 'Failed to submit order. Please try again.');
            setStep('error');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <div className={`relative w-full max-w-2xl bg-[#0f1219] border border-${themeColor}-500/30 rounded-2xl shadow-2xl shadow-${themeColor}-900/20 overflow-hidden flex flex-col max-h-[90vh]`}>

                {/* Header */}
                <div className={`p-4 border-b border-${themeColor}-500/20 bg-${themeColor}-900/10 flex justify-between items-center`}>
                    <div>
                        <h2 className={`text-xl font-black uppercase tracking-tight text-${themeColor}-400 flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-2xl">bolt</span>
                            Execute {optionType} Option
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mt-1">
                            <span className="text-white">{signal.symbol}</span>
                            <span>•</span>
                            <span>{formatCurrency(signal.current_price)}</span>
                            <span>•</span>
                            <span className={`text-${themeColor}-400 bg-${themeColor}-900/20 px-1.5 py-0.5 rounded`}>Tier {signal.tier}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Selected Broker Banner */}
                <div className={`px-4 py-2 border-b border-gray-800 flex justify-between items-center ${isPaper ? 'bg-blue-900/10' : 'bg-red-900/10'}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Selected Broker</span>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${selectedBroker?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            <span className="text-sm font-bold text-white">{selectedBroker?.display_name || 'No Broker Selected'}</span>
                            <span className={`text-[10px] uppercase font-black px-1.5 rounded border ${isPaper ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                                {isPaper ? 'Paper' : 'LIVE'}
                            </span>
                        </div>
                    </div>
                    {!isPaper && (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-900/20 px-2 py-1 rounded animate-pulse">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            LIVE TRADING ENABLED
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Step: Configuration */}
                    {step === 'config' && (
                        <>
                            {/* Signal Summary */}
                            <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800/50">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                    <div>
                                        <span className="block text-gray-500 uppercase font-black text-[10px] mb-1">Recommendation</span>
                                        <span className={`font-black ${signal.trading_recommendation.includes('BUY') ? 'text-green-400' : 'text-red-400'}`}>{signal.trading_recommendation}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 uppercase font-black text-[10px] mb-1">Gates Passed</span>
                                        <div className="flex items-center gap-1">
                                            <div className="flex gap-0.5">
                                                {[...Array(6)].map((_, i) => (
                                                    <div key={i} className={`w-1 h-3 rounded-full ${i < parseInt(signal.gates_passed) ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                                                ))}
                                            </div>
                                            <span className="font-bold text-white ml-1">{signal.gates_passed}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 uppercase font-black text-[10px] mb-1">ADX Trend</span>
                                        <span className="font-bold text-blue-400">{signal.adx_value?.toFixed(1)} {signal.adx_trend?.replace('_', ' ')}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 uppercase font-black text-[10px] mb-1">Target 1</span>
                                        <span className="font-mono font-bold text-green-400">{formatCurrency(signal.fib_target1)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expiry Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Expiry Date</label>
                                <select
                                    value={expiry}
                                    onChange={e => setExpiry(e.target.value)}
                                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-blue-500 outline-none appearance-none"
                                >
                                    {expiryOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Strike Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Strike Price (Current: {formatCurrency(signal.current_price)})</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {/* ITM Column */}
                                    <div className="space-y-1">
                                        <span className="block text-[10px] text-center text-gray-600 font-bold uppercase">ITM</span>
                                        {strikes.itm.map(p => (
                                            <button key={p} onClick={() => setStrike(p.toString())} className={`w-full py-1.5 rounded text-xs font-mono border ${strike === p.toString() ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1a1f2e] border-gray-700 text-gray-400 hover:border-blue-500/50'}`}>${p}</button>
                                        ))}
                                    </div>
                                    {/* ATM Column */}
                                    <div className="space-y-1">
                                        <span className="block text-[10px] text-center text-blue-500 font-bold uppercase">ATM (Rec)</span>
                                        {strikes.atm.map(p => (
                                            <button key={p} onClick={() => setStrike(p.toString())} className={`w-full py-1.5 rounded text-xs font-mono border ${strike === p.toString() ? 'bg-blue-600 border-blue-500 text-white ring-2 ring-blue-500/30' : 'bg-[#1a1f2e] border-gray-700 text-gray-400 hover:border-blue-500/50'}`}>${p}</button>
                                        ))}
                                    </div>
                                    {/* OTM Column */}
                                    <div className="space-y-1">
                                        <span className="block text-[10px] text-center text-gray-600 font-bold uppercase">OTM</span>
                                        {strikes.otm.map(p => (
                                            <button key={p} onClick={() => setStrike(p.toString())} className={`w-full py-1.5 rounded text-xs font-mono border ${strike === p.toString() ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1a1f2e] border-gray-700 text-gray-400 hover:border-blue-500/50'}`}>${p}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-[#1a1f2e] p-2 rounded-lg border border-gray-700">
                                    <span className="text-xs font-bold text-gray-400">Custom Strike:</span>
                                    <input type="number" value={strike} onChange={e => setStrike(e.target.value)} className="bg-transparent text-white font-mono text-sm outline-none flex-1" placeholder="Enter strike..." />
                                </div>
                            </div>

                            {/* Quantity & Order Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Quantity</label>
                                    <div className="flex items-center bg-[#1a1f2e] rounded-lg border border-gray-700 overflow-hidden">
                                        <button onClick={() => setContracts(Math.max(1, contracts - 1))} className="px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white">-</button>
                                        <input type="number" value={contracts} onChange={e => setContracts(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-transparent text-center text-white font-bold outline-none" />
                                        <button onClick={() => setContracts(contracts + 1)} className="px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Order Type</label>
                                    <div className="flex bg-[#1a1f2e] rounded-lg border border-gray-700 p-1">
                                        <button onClick={() => setOrderType('market')} className={`flex-1 py-1 rounded text-xs font-bold uppercase transition-all ${orderType === 'market' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Market</button>
                                        <button onClick={() => setOrderType('limit')} className={`flex-1 py-1 rounded text-xs font-bold uppercase transition-all ${orderType === 'limit' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Limit</button>
                                    </div>
                                </div>
                            </div>

                            {/* Limit Price Input */}
                            {orderType === 'limit' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Limit Price (Per Contract)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white font-mono text-sm focus:border-blue-500 outline-none" placeholder="0.00" />
                                    </div>
                                </div>
                            )}

                            {/* Risk Management */}
                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={stopLossEnabled} onChange={e => setStopLossEnabled(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-offset-0 focus:ring-0" />
                                    <span className="text-xs text-gray-300 group-hover:text-white">Auto Stop Loss at <span className="font-mono font-bold text-red-400">{formatCurrency(signal.fib_stop_loss)}</span></span>
                                </label>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Take Profit Target</span>
                                    <div className="flex gap-2">
                                        {[signal.fib_target1, signal.fib_target2].map((t, i) => t && (
                                            <button key={i} onClick={() => setTakeProfitTarget(t)} className={`px-2 py-1 rounded text-[10px] font-bold border ${takeProfitTarget === t ? 'bg-green-600 border-green-500 text-white' : 'bg-[#1a1f2e] border-gray-700 text-gray-400'}`}>
                                                T{i + 1}: {formatCurrency(t)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Preview Box */}
                            <div className="bg-[#1a1f2e] border border-dashed border-gray-700 rounded-xl p-4 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Estimated Total Cost</span>
                                    <span className="text-lg font-mono font-black text-white">$ {(estimatedTotal).toFixed(2)}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 text-center">
                                    *Premium estimated based on last quote. Actual fill price may vary.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Step: Confirm */}
                    {step === 'confirm' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                <span className="material-symbols-outlined text-3xl text-blue-500">receipt_long</span>
                            </div>
                            <h3 className="text-xl font-black text-white mb-6">Confirm Order Details</h3>

                            <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 p-6 text-left space-y-4 mb-6">
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Contract</span>
                                    <span className="text-white font-bold">{contracts}x {signal.symbol} ${strike} {optionType}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Expiry</span>
                                    <span className="text-white font-mono text-sm">{expiry}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Est. Cost</span>
                                    <span className="text-white font-mono font-bold">$ {(estimatedTotal).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Broker</span>
                                    <span className={`font-black uppercase text-xs ${isPaper ? 'text-blue-400' : 'text-red-400'}`}>
                                        {selectedBroker?.display_name} ({isPaper ? 'Paper' : 'LIVE'})
                                    </span>
                                </div>
                            </div>

                            {!isPaper && (
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-red-500 uppercase mb-2 animate-pulse">⚠️ Live Order Confirmation</label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder="Type 'CONFIRM'"
                                        className="w-full bg-red-900/10 border border-red-500/30 rounded-lg px-4 py-3 text-center text-white font-bold uppercase placeholder-red-500/30 focus:border-red-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step: Submitting */}
                    {step === 'submitting' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 rounded-full border-4 border-gray-800 border-t-blue-500 animate-spin mx-auto mb-6"></div>
                            <h3 className="text-xl font-black text-white animate-pulse">Submitting Order...</h3>
                            <p className="text-gray-500 text-sm mt-2">Connecting to broker via N8N Gateway</p>
                        </div>
                    )}

                    {/* Step: Success */}
                    {step === 'success' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Order Submitted!</h3>
                            <p className="text-gray-400 text-sm mb-6">Your order has been queued for execution.</p>

                            <div className="bg-[#1a1f2e] rounded-xl p-4 mb-6 inline-block w-full max-w-sm border border-gray-800">
                                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Transaction ID</span>
                                <span className="font-mono text-blue-400 text-sm break-all">{txId}</span>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors">Close</button>
                                <button onClick={() => window.location.href = '#portfolio'} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">View Portfolio</button>
                            </div>
                        </div>
                    )}

                    {/* Step: Error */}
                    {step === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                                <span className="material-symbols-outlined text-5xl text-red-500">error</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Order Failed</h3>
                            <p className="text-red-400 text-sm font-bold mb-6 max-w-xs mx-auto">{errorMsg}</p>

                            {errorMsg.toLowerCase().includes('insufficient') && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded mb-6 text-xs text-yellow-200">
                                    Tip: Try reducing contract quantity or selecting a cheaper strike price.
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors">Cancel</button>
                                <button onClick={() => setStep('config')} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">Try Again</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Config & Confirm Step Only) */}
                {(step === 'config' || step === 'confirm') && (
                    <div className="p-4 border-t border-gray-800 bg-[#0f1219]/90 backdrop-blur flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        {step === 'config' ? (
                            <button onClick={handleConfirm} className={`px-6 py-3 rounded-lg text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.95] flex items-center gap-2 ${themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : themeColor === 'green' ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}`}>
                                Next Step <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        ) : (
                            <button onClick={handleSubmitOrder} className={`px-6 py-3 rounded-lg text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.95] flex items-center gap-2 ${themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : themeColor === 'green' ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}`}>
                                <span className="material-symbols-outlined text-sm">bolt</span>
                                Submit {isPaper ? 'Paper Trade' : 'Order'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExecuteTradeModal;
