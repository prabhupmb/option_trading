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
            // Map range to numbers
            let dte_min = 5, dte_max = 10;
            if (dteRange === 'swing') { dte_min = 10; dte_max = 20; }
            if (dteRange === 'monthly') { dte_min = 30; dte_max = 60; }

            const payload = {
                symbol: signal.symbol,
                current_price: signal.current_price,
                option_type: optionType,
                dte_min,
                dte_max,
                budget,
                stop_loss: stopLossEnabled ? signal.fib_stop_loss : null,
                take_profit: takeProfitTarget,
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: isPaper ? 'paper' : 'live'
            };

            console.log('Find Option Payload:', payload);

            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/find-option', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.contracts && result.contracts.length > 0) {
                setRecommendations(result.contracts);
                // Auto-select best (first)
                setSelectedContract(result.contracts[0]);
                setStep('selection');
            } else {
                throw new Error('No contracts found matching criteria.');
            }

        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to find contracts.');
            setStep('error');
        }
    };

    const handleConfirmOrder = async () => {
        // If live, require confirmation text
        if (!isPaper && confirmText.toUpperCase() !== 'CONFIRM') {
            setErrorMsg('Please type CONFIRM to place a live order.');
            return;
        }

        setStep('submitting');
        setErrorMsg('');

        try {
            if (!selectedContract) throw new Error('No contract selected');

            const payload = {
                symbol: signal.symbol,
                option_type: optionType,
                strike: selectedContract.strike,
                expiry: selectedContract.expiry,
                quantity: selectedContract.quantity,
                order_type: 'market', // Default market for simplified flow
                budget: budget,
                stop_loss: stopLossEnabled ? signal.fib_stop_loss : null,
                take_profit: takeProfitTarget,
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: isPaper ? 'paper' : 'live',
                signal_id: signal.id,
                user_id: user?.id
            };

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
                throw new Error(result.error || 'Execution failed');
            }

        } catch (err: any) {
            console.error('Execution Error:', err);
            setErrorMsg(err.message || 'Failed to submit order.');
            setStep('error');
        }
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
                                        onClick={() => setSelectedContract(contract)}
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
                        <div className="text-center py-4">
                            <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 p-6 text-left space-y-4 mb-6 relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-1 h-full ${isPaper ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Contract</span>
                                    <span className="text-white font-bold">{selectedContract.quantity}x {selectedContract.symbol} ${selectedContract.strike} {selectedContract.option_type}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Expiry</span>
                                    <span className="text-white font-mono text-sm">{selectedContract.expiry}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Total Cost</span>
                                    <span className="text-white font-mono font-bold">$ {(selectedContract.total_cost).toFixed(2)}</span>
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

                    {/* Steps: Submitting/Success/Error (Shared) */}
                    {step === 'submitting' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-blue-500 animate-spin mx-auto mb-6"></div>
                            <h3 className="text-lg font-black text-white animate-pulse">Submitting Order...</h3>
                        </div>
                    )}
                    {step === 'success' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Order Submitted!</h3>
                            <p className="text-gray-400 text-xs mb-6 font-mono">{txId}</p>
                            <div className="flex gap-2">
                                <button onClick={onClose} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors">Close</button>
                                <button onClick={() => { onClose(); window.location.href = '#portfolio'; }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">Portfolio</button>
                            </div>
                        </div>
                    )}
                    {step === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                                <span className="material-symbols-outlined text-5xl text-red-500">error</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Something went wrong</h3>
                            <p className="text-red-400 text-sm font-bold mb-6 max-w-xs mx-auto">{errorMsg}</p>
                            <button onClick={() => setStep('config')} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg">Try Again</button>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                {(step === 'config' || step === 'selection' || step === 'confirm') && (
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

                        {step === 'confirm' && (
                            <button onClick={handleConfirmOrder} className={`px-6 py-3 rounded-lg text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.95] flex items-center gap-2 ${themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                <span className="material-symbols-outlined text-sm">bolt</span>
                                {isPaper ? 'Execute Paper Trade' : 'Execute LIVE Order'}
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default ExecuteTradeModal;
