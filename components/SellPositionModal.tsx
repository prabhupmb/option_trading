import React, { useState, useEffect } from 'react';

// ─── TYPES ────────────────────────────────────────────────────

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
}

interface SellPositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    position: Position | null;
    brokerInfo: {
        broker_id: string;
        broker_name: string;
        broker_mode: string;
    } | null;
    userId?: string;
    onSuccess?: () => void;
}

type ModalStep = 'configure' | 'confirm' | 'result';

// ─── WEBHOOK ──────────────────────────────────────────────────

const SELL_WEBHOOK_URL = 'https://prabhupadala01.app.n8n.cloud/webhook/sell-option';

// ─── HELPERS ──────────────────────────────────────────────────

const formatCurrency = (val: number | null | undefined): string => {
    if (val == null || isNaN(val)) return '$0.00';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatExpiry = (d: string | null | undefined): string => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const getDTE = (d: string | null | undefined): number => {
    if (!d) return 0;
    return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
};

// ─── COMPONENT ───────────────────────────────────────────────

const SellPositionModal: React.FC<SellPositionModalProps> = ({
    isOpen, onClose, position, brokerInfo, userId, onSuccess,
}) => {
    const [step, setStep] = useState<ModalStep>('configure');
    const [sellQty, setSellQty] = useState(1);
    const [confirmText, setConfirmText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; orderId?: string } | null>(null);

    const isPaper = brokerInfo?.broker_mode !== 'live';
    const isLive = !isPaper;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen && position) {
            setStep('configure');
            setSellQty(position.quantity);
            setConfirmText('');
            setSubmitting(false);
            setResult(null);
        }
    }, [isOpen, position]);

    if (!isOpen || !position) return null;

    const totalPL = position.dayPL;
    const plPerContract = position.quantity > 0 ? totalPL / position.quantity : 0;
    const estimatedPL = plPerContract * sellQty;
    const isProfitable = estimatedPL >= 0;

    const handleSubmit = async () => {
        if (isLive && confirmText.toUpperCase() !== 'CONFIRM') return;

        setSubmitting(true);
        try {
            const payload = {
                symbol: position.underlying || position.symbol,
                contract_symbol: position.symbol,
                instruction: 'SELL_TO_CLOSE',
                option_type: position.putCall || 'CALL',
                strike: position.strikePrice,
                expiry: position.expirationDate,
                quantity: sellQty,
                order_type: 'market',
                asset_type: position.assetType,
                is_option: position.isOption,
                avg_price: position.avgPrice,
                market_value: position.marketValue,
                broker_id: brokerInfo?.broker_id,
                broker_name: brokerInfo?.broker_name,
                broker_mode: brokerInfo?.broker_mode,
                user_id: userId,
            };

            console.log('Sell Payload:', payload);

            const response = await fetch(SELL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    message: `Successfully closed ${sellQty} contract${sellQty > 1 ? 's' : ''} of ${position.underlying}`,
                    orderId: data.order?.orderId || data.order_id || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                });
                setStep('result');

                // Auto-refresh portfolio after 2s
                setTimeout(() => {
                    onSuccess?.();
                }, 2000);
            } else {
                setResult({
                    success: false,
                    message: data.message || data.error || 'Order failed. Please try again.',
                });
                setStep('result');
            }
        } catch (err: any) {
            setResult({
                success: false,
                message: err.message || 'Network error. Please try again.',
            });
            setStep('result');
        } finally {
            setSubmitting(false);
        }
    };

    const dte = getDTE(position.expirationDate);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== 'result' ? onClose : undefined} />

            {/* Modal */}
            <div className="relative bg-[#0d1117] border border-gray-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-400 text-lg">sell</span>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base">Close Position</h2>
                            <span className="text-gray-500 text-xs">Sell to Close</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-gray-400 text-lg">close</span>
                    </button>
                </div>

                {/* ─── CONFIGURE STEP ─── */}
                {step === 'configure' && (
                    <div className="px-6 py-5 space-y-5">

                        {/* Position Summary Card */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-950 to-green-900/20 text-green-400 flex items-center justify-center text-sm font-bold border border-green-900">
                                        {position.underlying?.charAt(0) || '?'}
                                    </span>
                                    <div>
                                        <span className="text-white font-bold text-sm block">{position.underlying}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {position.isOption && (
                                                <>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${position.putCall === 'CALL'
                                                        ? 'bg-green-950 text-green-400 border-green-900'
                                                        : 'bg-red-950 text-red-400 border-red-900'
                                                        }`}>
                                                        {position.putCall}
                                                    </span>
                                                    <span className="text-gray-400 text-[11px]">${position.strikePrice}</span>
                                                </>
                                            )}
                                            {!position.isOption && (
                                                <span className="text-gray-500 text-[11px]">EQUITY</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {position.isOption && (
                                    <div className="text-right">
                                        <span className="text-gray-400 text-[10px] font-bold tracking-widest block">EXPIRY</span>
                                        <span className="text-white text-xs font-medium">{formatExpiry(position.expirationDate)}</span>
                                        <span className={`text-[10px] block font-bold ${dte <= 3 ? 'text-red-400' : dte <= 7 ? 'text-amber-400' : 'text-gray-500'}`}>
                                            {dte}d remaining
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold tracking-widest block">QTY HELD</span>
                                    <span className="text-white font-bold text-sm">{position.quantity}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold tracking-widest block">AVG COST</span>
                                    <span className="text-white font-bold text-sm">{formatCurrency(position.avgPrice)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold tracking-widest block">MKT VALUE</span>
                                    <span className="text-white font-bold text-sm">{formatCurrency(position.marketValue)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quantity Selector */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-2">
                                Sell Quantity
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden flex-1">
                                    <button
                                        onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                                        disabled={sellQty <= 1}
                                        className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-30"
                                    >
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={position.quantity}
                                        value={sellQty}
                                        onChange={e => setSellQty(Math.min(position.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                                        className="flex-1 bg-transparent text-center text-white font-bold text-lg py-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setSellQty(Math.min(position.quantity, sellQty + 1))}
                                        disabled={sellQty >= position.quantity}
                                        className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-30"
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => setSellQty(position.quantity)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${sellQty === position.quantity
                                        ? 'bg-red-950/40 text-red-400 border-red-900'
                                        : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
                                        }`}
                                >
                                    SELL ALL
                                </button>
                            </div>
                        </div>

                        {/* P&L Preview */}
                        <div className={`rounded-xl p-4 border ${isProfitable ? 'bg-green-950/20 border-green-900/40' : 'bg-red-950/20 border-red-900/40'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">ESTIMATED P&L</span>
                                <span className={`text-lg font-bold font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                                    {isProfitable ? '+' : ''}{formatCurrency(estimatedPL)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-gray-500 text-[11px]">
                                    {sellQty} of {position.quantity} contract{position.quantity > 1 ? 's' : ''} • Market Order
                                </span>
                                <span className={`text-[11px] font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                                    {position.dayPLPct >= 0 ? '+' : ''}{position.dayPLPct?.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        {/* Broker Info */}
                        <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaper ? 'bg-blue-400' : 'bg-amber-400'}`}></span>
                            <span>{brokerInfo?.broker_name?.toUpperCase()} • {isPaper ? 'PAPER' : 'LIVE'}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => isPaper ? handleSubmit() : setStep('confirm')}
                                className="flex-[2] py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <span className="material-symbols-outlined text-base">sell</span>
                                {isPaper ? 'Sell to Close' : 'Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── CONFIRM STEP (Live only) ─── */}
                {step === 'confirm' && (
                    <div className="px-6 py-5 space-y-5">
                        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-400 text-xl mt-0.5">warning</span>
                            <div>
                                <p className="text-amber-300 font-bold text-sm">Live Trade Confirmation</p>
                                <p className="text-amber-400/70 text-xs mt-1">
                                    You are about to close <strong>{sellQty} contract{sellQty > 1 ? 's' : ''}</strong> of{' '}
                                    <strong>{position.underlying}</strong> on your <strong>LIVE</strong> account.
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Symbol</span>
                                <span className="text-white font-bold">{position.underlying} {position.putCall} ${position.strikePrice}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Quantity</span>
                                <span className="text-white font-bold">{sellQty}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Order Type</span>
                                <span className="text-white font-bold">Market (Sell to Close)</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-gray-800">
                                <span className="text-gray-400">Estimated P&L</span>
                                <span className={`font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                                    {isProfitable ? '+' : ''}{formatCurrency(estimatedPL)}
                                </span>
                            </div>
                        </div>

                        {/* CONFIRM Input */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-2">
                                Type CONFIRM to proceed
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder="CONFIRM"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-center font-bold tracking-widest text-lg outline-none focus:border-red-500 transition-colors"
                                autoFocus
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('configure')}
                                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:bg-gray-800 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={confirmText.toUpperCase() !== 'CONFIRM' || submitting}
                                className="flex-[2] py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Selling...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-base">sell</span>
                                        Sell to Close
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── RESULT STEP ─── */}
                {step === 'result' && result && (
                    <div className="px-6 py-8 flex flex-col items-center text-center space-y-4">
                        {result.success ? (
                            <>
                                <div className="w-16 h-16 rounded-full bg-green-950/40 border border-green-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Order Placed</h3>
                                    <p className="text-gray-400 text-sm mt-1">{result.message}</p>
                                </div>
                                {result.orderId && (
                                    <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2">
                                        <span className="text-gray-500 text-[10px] font-bold tracking-widest">ORDER ID</span>
                                        <p className="text-white font-mono text-xs mt-0.5">{result.orderId}</p>
                                    </div>
                                )}
                                <button
                                    onClick={onClose}
                                    className="mt-2 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors"
                                >
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-red-400 text-3xl">error</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Order Failed</h3>
                                    <p className="text-red-400/80 text-sm mt-1">{result.message}</p>
                                </div>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:bg-gray-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => { setStep('configure'); setResult(null); }}
                                        className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SellPositionModal;
