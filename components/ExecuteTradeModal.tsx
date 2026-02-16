import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/useAuth';
import { useBrokerContext } from '../context/BrokerContext';
import { OptionSignal } from '../types';
import { formatCurrency } from '../utils/tradeUtils';

interface ExecuteTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    signal: OptionSignal | null;
    onSuccess?: () => void;
}

interface ContractRecommendation {
    symbol: string;
    contract_symbol: string;
    strike: number;
    expiry: string;
    option_type: 'CALL' | 'PUT';
    premium: number; // per share
    quantity: number;
    total_cost: number;
    dte: number;
    implied_volatility?: number;
    delta?: number;
    description?: string; // e.g. "Best Value", "Cheaper"
    bid?: number;
    ask?: number;
    max_contracts?: number;
}

type OrderStep = 'config' | 'finding' | 'selection' | 'confirm' | 'submitting' | 'success' | 'error';
type DteRange = 'short' | 'swing' | 'monthly';

const ExecuteTradeModal: React.FC<ExecuteTradeModalProps> = ({ isOpen, onClose, signal, onSuccess }) => {
    const { user, accessLevel } = useAuth();
    const { selectedBroker } = useBrokerContext();

    // Modal State
    const [step, setStep] = useState<OrderStep>('config');
    const [errorMsg, setErrorMsg] = useState('');
    const [txId, setTxId] = useState('');

    // User Configuration
    const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
    const [dteRange, setDteRange] = useState<DteRange>('short');
    const [budget, setBudget] = useState(300);
    const [stopLossEnabled, setStopLossEnabled] = useState(true);
    const [takeProfitTarget, setTakeProfitTarget] = useState<number | null>(null);
    const [confirmText, setConfirmText] = useState('');

    // N8N Data
    const [recommendations, setRecommendations] = useState<ContractRecommendation[]>([]);
    const [selectedContract, setSelectedContract] = useState<ContractRecommendation | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [limitPrice, setLimitPrice] = useState<number | null>(null);

    // Initialize
    useEffect(() => {
        if (signal && isOpen) {
            setStep('config');
            setErrorMsg('');
            setTxId('');
            setConfirmText('');
            setRecommendations([]);
            setSelectedContract(null);

            setOptionType(signal.option_type as 'CALL' | 'PUT');
            setBudget(user?.user_metadata?.default_budget || 300);
            setTakeProfitTarget(signal.fib_target1);
        }
    }, [signal, isOpen, user]);

    if (!isOpen || !signal) return null;

    const isPaper = accessLevel === 'paper' || selectedBroker?.broker_mode === 'paper';
    const themeColor = isPaper ? 'blue' : optionType === 'CALL' ? 'green' : 'red';
    const isCall = optionType === 'CALL';

    const dteOptions = [
        { id: 'short', label: 'Short-term', days: '5-10 DTE' },
        { id: 'swing', label: 'Swing', days: '10-20 DTE' },
        { id: 'monthly', label: 'Monthly', days: '30+ DTE' },
    ];

    const handleFindContracts = async () => {
        setStep('finding');
        setErrorMsg('');

        try {
            // Helper to fetch contracts
            const fetchContracts = async (min: number, max: number) => {
                const payload = {
                    symbol: signal.symbol,
                    current_price: signal.current_price,
                    option_type: optionType,
                    dte_min: min,
                    dte_max: max,
                    budget,
                    stop_loss: stopLossEnabled ? signal.fib_stop_loss : null,
                    take_profit: takeProfitTarget,
                    broker_id: selectedBroker?.id,
                    broker_name: selectedBroker?.broker_name,
                    broker_mode: isPaper ? 'paper' : 'live'
                };

                console.log(`Find Option Payload (${min}-${max} DTE):`, payload);

                const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/find-option', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            };

            // Map range to numbers
            let dte_min = 5, dte_max = 10;
            if (dteRange === 'swing') { dte_min = 10; dte_max = 20; }
            if (dteRange === 'monthly') { dte_min = 30; dte_max = 60; }

            // First attempt
            let result = await fetchContracts(dte_min, dte_max);

            // Auto-retry with wider range if no contracts found
            if (!result.contracts || result.contracts.length === 0) {
                console.log('No contracts found. Retrying with wider DTE range (3-45 days)...');

                // Auto-expand to 3-45 days
                result = await fetchContracts(3, 45);
            }

            if (result.contracts && result.contracts.length > 0) {
                setRecommendations(result.contracts);
                // Auto-select best (first)
                setSelectedContract(result.contracts[0]);
                setQuantity(1);
                setStep('selection');
            } else {
                throw new Error('No contracts found matching criteria (even after expanding search).');
            }

        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to find contracts.');
            setStep('error');
        }
    };

    const handleConfirmOrder = async (isRetry = false, overrideOrderType?: 'market' | 'limit', overrideLimitPrice?: number) => {
        // If live, require confirmation text (unless retrying)
        if (!isPaper && !isRetry && confirmText.toUpperCase() !== 'CONFIRM') {
            setErrorMsg('Please type CONFIRM to place a live order.');
            return;
        }

        setStep('submitting');
        setErrorMsg('');
        setExecutionResult(null);

        try {
            if (!selectedContract) throw new Error('No contract selected');

            const currentOrderType = overrideOrderType || orderType;
            const currentLimitPrice = overrideLimitPrice !== undefined ? overrideLimitPrice : (orderType === 'limit' ? limitPrice : null);
            const priceToUse = currentOrderType === 'limit' && currentLimitPrice ? currentLimitPrice : selectedContract.premium;

            const executePayload = {
                // From the selected contract (find-option response)
                symbol: signal.symbol,
                contract_symbol: selectedContract.contract_symbol,
                option_type: signal.option_type,
                strike: selectedContract.strike,
                expiry: selectedContract.expiry,
                premium: selectedContract.premium,
                total_cost: quantity * priceToUse * 100,

                // From user inputs
                quantity: quantity,
                order_type: currentOrderType,
                limit_price: currentLimitPrice,
                budget: budget,
                current_price: signal.current_price,
                stop_loss: stopLossEnabled ? signal.fib_stop_loss : null,
                take_profit: takeProfitTarget,

                // From broker context
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: selectedBroker?.broker_mode,

                // Optional signal reference
                signal_id: signal.id || null,
                tier: signal.tier,
                gates_passed: signal.gates_passed,
                user_id: user?.id
            };

            console.log('Execute Payload:', executePayload);

            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/execute-option-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(executePayload)
            });

            const result = await response.json();
            setExecutionResult(result);

            if (result.success) {
                setTxId(result.order?.orderId || result.order_id || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase());
                setStep('success');
                // Do not call onSuccess() here; wait for user to click "DONE"
            } else {
                // Determine if we should show the "Retry as Limit" option
                // This is handled in the render logic based on result.suggestion
                setStep('error');
            }

        } catch (err: any) {
            console.error('Execution Error:', err);
            setErrorMsg(err.message || 'Failed to submit order.');
            setStep('error');
        }
    };

    const handleRetryAsLimit = () => {
        if (!selectedContract) return;

        const newPrice = Number((selectedContract.premium * 1.05).toFixed(2)); // 5% buffer

        // Update state for UI consistency
        setOrderType('limit');
        setLimitPrice(newPrice);
        setStep('config');
        setExecutionResult(null); // Clear previous error
    };




    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <div className={`relative w-full max-w-2xl bg-[#0f1219] border border-${themeColor}-500/30 rounded-2xl shadow-2xl shadow-${themeColor}-900/20 overflow-hidden flex flex-col max-h-[95vh]`}>

                {/* Header */}
                <div className={`p-4 border-b border-${themeColor}-500/20 bg-${themeColor}-900/10 flex justify-between items-center`}>
                    <div>
                        <h2 className={`text-lg font-black uppercase tracking-tight text-${themeColor}-400 flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-xl">bolt</span>
                            Execute {optionType} Option
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mt-1">
                            <span className="text-white">{signal.symbol}</span>
                            <span>•</span>
                            <span>{formatCurrency(signal.current_price)}</span>
                            <span>•</span>
                            <span className={`text-${themeColor}-400 bg-${themeColor}-900/20 px-1.5 py-0.5 rounded`}>Tier {signal.tier}</span>
                            <span>•</span>
                            <span>{signal.gates_passed} Gates</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Selected Broker Banner */}
                <div className={`px-4 py-2 border-b border-gray-800 flex justify-between items-center ${isPaper ? 'bg-blue-900/10' : 'bg-red-900/10'}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Broker</span>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${selectedBroker?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            <span className="text-xs font-bold text-white">{selectedBroker?.display_name || 'None'}</span>
                        </div>
                    </div>
                    <span className={`text-[10px] uppercase font-black px-1.5 rounded border ${isPaper ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                        {isPaper ? 'Paper' : 'LIVE'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Step 1: Config */}
                    {step === 'config' && (
                        <>
                            {/* Option Type */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Option Type</label>
                                <div className="flex bg-[#1a1f2e] rounded-lg border border-gray-700 p-1">
                                    <button onClick={() => setOptionType('CALL')} className={`flex-1 py-2 rounded text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${optionType === 'CALL' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                                        <div className={`w-2 h-2 rounded-full ${optionType === 'CALL' ? 'bg-white' : 'border border-gray-500'}`}></div>
                                        CALL
                                    </button>
                                    <button onClick={() => setOptionType('PUT')} className={`flex-1 py-2 rounded text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${optionType === 'PUT' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                                        <div className={`w-2 h-2 rounded-full ${optionType === 'PUT' ? 'bg-white' : 'border border-gray-500'}`}></div>
                                        PUT
                                    </button>
                                </div>
                            </div>

                            {/* Order Type & Limit Price */}
                            <div className="pt-4 border-t border-gray-800">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Order Configuration</label>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <button
                                        onClick={() => setOrderType('market')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase border ${orderType === 'market' ? `bg-${themeColor}-500 text-white border-${themeColor}-500` : 'bg-[#1a1f2e] text-gray-400 border-gray-700'}`}
                                    >
                                        Market
                                    </button>
                                    <button
                                        onClick={() => setOrderType('limit')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase border ${orderType === 'limit' ? `bg-${themeColor}-500 text-white border-${themeColor}-500` : 'bg-[#1a1f2e] text-gray-400 border-gray-700'}`}
                                    >
                                        Limit
                                    </button>
                                </div>

                                {orderType === 'limit' && (
                                    <div className="relative animate-in fade-in slide-in-from-top-2">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={limitPrice || ''}
                                            onChange={e => setLimitPrice(parseFloat(e.target.value) || 0)}
                                            placeholder="Limit Price"
                                            step="0.01"
                                            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-8 pr-3 py-3 text-white font-mono font-bold focus:border-blue-500 outline-none"
                                        />
                                        <span className="text-[10px] text-gray-500 mt-1 block">Max price per contract to pay</span>
                                    </div>
                                )}
                            </div>

                            {/* Expiry Range */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Expiry Range</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {dteOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setDteRange(opt.id as DteRange)}
                                            className={`py-3 rounded-lg border text-center transition-all ${dteRange === opt.id ? `bg-${themeColor}-500/10 border-${themeColor}-500 text-white` : 'bg-[#1a1f2e] border-gray-700 text-gray-400 hover:bg-[#252b3b]'}`}
                                        >
                                            <span className={`block text-[10px] font-black uppercase ${dteRange === opt.id ? `text-${themeColor}-400` : ''}`}>{opt.days}</span>
                                            <span className="block text-xs font-bold mt-1">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Budget */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Budget</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={budget}
                                        onChange={e => setBudget(parseInt(e.target.value) || 0)}
                                        className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-8 pr-3 py-3 text-white font-mono font-bold focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Risk Management */}
                            <div className="space-y-4 pt-4 border-t border-gray-800">
                                <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg border border-gray-800 hover:bg-[#1a1f2e] transition-colors">
                                    <input type="checkbox" checked={stopLossEnabled} onChange={e => setStopLossEnabled(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-offset-0 focus:ring-0" />
                                    <div className="flex-1">
                                        <span className="block text-xs font-bold text-white">Auto Stop Loss</span>
                                        <span className="text-[10px] text-gray-400">Set at Fibonacci Level: <span className="font-mono text-red-400">{formatCurrency(signal.fib_stop_loss)}</span></span>
                                    </div>
                                </label>

                                <div>
                                    <span className="block text-xs font-bold text-gray-500 uppercase mb-2">Take Profit Target</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[signal.fib_target1, signal.fib_target2].map((t, i) => t && (
                                            <button key={i} onClick={() => setTakeProfitTarget(t)} className={`px-2 py-2 rounded text-[10px] font-bold border ${takeProfitTarget === t ? 'bg-green-600 border-green-500 text-white' : 'bg-[#1a1f2e] border-gray-700 text-gray-400'}`}>
                                                T{i + 1}: {formatCurrency(t)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 2: Finding */}
                    {step === 'finding' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-blue-500 animate-spin mx-auto mb-6"></div>
                            <h3 className="text-lg font-black text-white animate-pulse">Finding best {optionType} option...</h3>
                            <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                                Searching {dteOptions.find(d => d.id === dteRange)?.days} contracts within ${budget} budget...
                            </p>
                        </div>
                    )}

                    {/* Step 3: Selection */}
                    {step === 'selection' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase">Available Contracts</h3>
                            <div className="space-y-3">
                                {recommendations.map((contract, i) => (
                                    <div
                                        key={i}
                                        onClick={() => {
                                            setSelectedContract(contract);
                                            setQuantity(1);
                                            if (orderType === 'limit') {
                                                setLimitPrice(Number((contract.premium * 1.05).toFixed(2)));
                                            }
                                        }}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedContract === contract ? `bg-${themeColor}-500/10 border-${themeColor}-500 shadow-lg shadow-${themeColor}-900/10` : 'bg-[#1a1f2e] border-gray-700 hover:border-gray-500'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-white text-lg">{contract.symbol} ${contract.strike} {contract.option_type}</span>
                                                    {i === 0 && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded font-black uppercase">Best Match</span>}
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono">{contract.expiry} ({contract.dte} DTE)</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-black text-white text-lg">{formatCurrency(contract.premium)}</span>
                                                <span className="text-[10px] text-gray-500 uppercase">Per Share</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                                            <div className="text-xs">
                                                <span className="text-gray-500 font-bold">Contracts: </span>
                                                <span className="text-white font-mono">{contract.quantity}</span>
                                            </div>
                                            <div className="text-xs">
                                                <span className="text-gray-500 font-bold">Total Cost: </span>
                                                <span className={`font-mono font-black ${contract.total_cost <= budget ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(contract.total_cost)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirm */}
                    {step === 'confirm' && selectedContract && (
                        <div className="space-y-6">
                            <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
                                <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                                    <span className="font-black text-gray-400 uppercase text-xs tracking-wider">Confirm Order</span>
                                    <button onClick={onClose} className="text-gray-500 hover:text-white"><span className="material-symbols-outlined text-sm">close</span></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Action</span>
                                        <span className={`font-black uppercase ${isCall ? 'text-green-500' : 'text-red-500'}`}>Buy to Open</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Contract</span>
                                        <span className="font-bold text-white">{selectedContract.symbol} ${selectedContract.strike} {selectedContract.option_type}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Expiry</span>
                                        <span className="font-mono text-white text-sm">{selectedContract.expiry} ({selectedContract.dte} DTE)</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Quantity</span>
                                        <span className="font-mono text-white font-bold">{quantity} contract{quantity > 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Order Type</span>
                                        <span className="font-bold text-white uppercase">{orderType} {orderType === 'limit' && `@ ${formatCurrency(limitPrice || 0)}`}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Premium</span>
                                        <span className="font-mono text-gray-400 text-sm">{formatCurrency(selectedContract.premium)} per contract (mid)</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Est. Total Cost</span>
                                        <span className="font-mono font-black text-xl text-white">
                                            {formatCurrency(quantity * (orderType === 'limit' ? limitPrice! : selectedContract.premium) * 100)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Budget</span>
                                        <span className="font-mono text-gray-400 text-sm">{formatCurrency(budget)}</span>
                                    </div>

                                    {/* Risk Section */}
                                    <div className="pt-4 border-t border-gray-800 space-y-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 rounded uppercase font-bold">Risk</span>
                                            <div className="h-px bg-gray-800 flex-1"></div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Stop Loss</span>
                                            <span className="font-mono text-red-400 text-sm">{formatCurrency(signal.fib_stop_loss)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Take Profit</span>
                                            <span className="font-mono text-green-400 text-sm">{takeProfitTarget ? formatCurrency(takeProfitTarget) : 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Broker Section */}
                                    <div className="pt-4 border-t border-gray-800 space-y-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 rounded uppercase font-bold">Broker</span>
                                            <div className="h-px bg-gray-800 flex-1"></div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Account</span>
                                            <span className="text-white text-sm font-bold">{selectedBroker?.display_name} ({selectedBroker?.broker_mode?.toUpperCase()})</span>
                                        </div>
                                        {/* Mock Buying Power for UI completeness as requested */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Buying Power</span>
                                            <span className="font-mono text-white text-sm">$387,012.68</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-4 text-center text-xs font-bold uppercase tracking-wide ${isPaper ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                    {isPaper ? '⚠️ Paper trading - no real money involved' : '⚠️ REAL MONEY - This will execute a real trade'}
                                </div>
                            </div>

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

                            <div className="flex gap-3">
                                <button onClick={() => setStep('selection')} className="flex-1 py-4 border border-gray-700 text-gray-400 font-bold rounded-xl hover:bg-gray-800 transition-colors uppercase text-xs">
                                    ← Back
                                </button>
                                <button
                                    onClick={() => handleConfirmOrder()}
                                    disabled={!isPaper && confirmText.toUpperCase() !== 'CONFIRM'}
                                    className={`flex-[2] py-4 font-black uppercase rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${(!isPaper && confirmText.toUpperCase() !== 'CONFIRM') ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : (isPaper ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20')}`}
                                >
                                    <span className="material-symbols-outlined text-sm">bolt</span>
                                    Confirm & Submit
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Steps: Submitting/Success/Error (Shared) */}
                    {step === 'submitting' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-blue-500 animate-spin mx-auto mb-6"></div>
                            <h3 className="text-lg font-black text-white animate-pulse">Submitting Order...</h3>
                        </div>
                    )}
                    {step === 'success' && (
                        <div className="flex flex-col h-full animate-in zoom-in-50 duration-300">
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-full bg-green-900/10 border border-green-500/30 rounded-xl overflow-hidden mb-6">
                                    <div className="bg-green-600 p-4 border-b border-green-500 flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-white">check_circle</span>
                                        <span className="text-white font-black uppercase text-sm tracking-wide">Order Submitted Successfully</span>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Order ID</span>
                                            <span className="font-mono text-white text-xs" title={txId}>{txId.substring(0, 8)}...</span>
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
                                        <div className="h-px bg-green-500/20 my-2"></div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Contract</span>
                                            <span className="font-bold text-white text-sm">{selectedContract?.symbol} ${selectedContract?.strike} {selectedContract?.option_type}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Order Type</span>
                                            <span className="font-bold text-white text-sm uppercase">{orderType} {orderType === 'limit' && `@ ${formatCurrency(limitPrice || 0)}`}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Quantity</span>
                                            <span className="font-mono text-white text-sm">{quantity} contract{quantity > 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Expiry</span>
                                            <span className="font-mono text-white text-sm">{selectedContract?.expiry}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Broker</span>
                                            <span className="font-bold text-white text-sm">{selectedBroker?.display_name} ({selectedBroker?.broker_mode?.toUpperCase()})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-800 bg-[#0f1219]">
                                <button onClick={() => { onClose(); if (onSuccess) onSuccess(); }} className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-black uppercase rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-green-500">check</span>
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-full bg-red-900/10 border border-red-500/30 rounded-xl p-6 mb-6">
                                    <div className="flex items-center gap-2 text-red-500 font-black text-lg mb-4 justify-center">
                                        <span className="material-symbols-outlined">error</span>
                                        ORDER FAILED
                                    </div>
                                    <p className="text-white font-bold text-sm mb-4 leading-relaxed">
                                        {executionResult?.message || errorMsg || 'Unknown error occurred'}
                                    </p>

                                    {executionResult?.suggestion && (
                                        <div className="flex items-start gap-2 text-left bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                                            <span className="text-lg">💡</span>
                                            <span className="text-red-200 text-xs font-medium leading-relaxed">{executionResult.suggestion}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-gray-500 text-xs font-mono">
                                    {selectedContract?.symbol} ${selectedContract?.strike} {selectedContract?.option_type} • {selectedContract?.expiry} • {quantity} contract(s) via {selectedBroker?.display_name}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-800 bg-[#0f1219] flex gap-3">
                                <button onClick={() => setStep('selection')} className="flex-1 py-3 border border-gray-700 text-gray-400 font-bold rounded-xl hover:bg-gray-800 transition-colors uppercase text-xs">
                                    Back
                                </button>

                                {executionResult?.suggestion?.toUpperCase().includes('LIMIT') && (
                                    <button
                                        onClick={handleRetryAsLimit}
                                        className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all active:scale-[0.98] uppercase text-xs flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                        Retry as LIMIT
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                {(step === 'config' || step === 'selection') && (
                    <div className="p-4 border-t border-gray-800 bg-[#0f1219]/90 backdrop-blur flex justify-end gap-3">
                        <button onClick={() => step === 'config' ? onClose() : setStep(step === 'confirm' ? 'selection' : 'config')} className="px-6 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors">
                            {step === 'config' ? 'Cancel' : 'Back'}
                        </button>

                        {step === 'config' && (
                            <button onClick={handleFindContracts} className={`px-6 py-3 rounded-lg text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.95] flex items-center gap-2 ${themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>
                                <span className="material-symbols-outlined text-sm">search</span>
                                Find Best Contract
                            </button>
                        )}

                        {step === 'selection' && selectedContract && (
                            <button onClick={() => setStep('confirm')} className={`px-6 py-3 rounded-lg text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.95] flex items-center gap-2 ${themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>
                                Next Step <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default ExecuteTradeModal;
