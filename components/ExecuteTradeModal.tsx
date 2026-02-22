import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../services/useAuth';
import { useBrokerContext } from '../context/BrokerContext';
import { OptionSignal } from '../types';
import { formatCurrency } from '../utils/tradeUtils';

// ─── TYPES ────────────────────────────────────────────────────

interface ExecuteTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    signal: OptionSignal | null;
    onSuccess?: () => void;
    onNavigate?: (view: string) => void;
}

interface DuplicatePositionInfo {
    optionType: string;
    symbol: string;
    contractSymbol: string;
    strike: number;
    expiry: string;
    dte: number;
}

type BlockingErrorType = 'market_closed' | 'session_expired' | 'reconnect_required' | 'options_not_enabled' | 'broker_not_configured';

// ─── HELPERS ─────────────────────────────────────────────────

function getNextMarketOpen(): string {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const day = et.getDay();
    const hour = et.getHours();
    const min = et.getMinutes();

    const next = new Date(et);

    if (day === 6) {
        next.setDate(next.getDate() + 2);
    } else if (day === 0) {
        next.setDate(next.getDate() + 1);
    } else if (hour > 16 || (hour === 16 && min > 0)) {
        next.setDate(next.getDate() + (day === 5 ? 3 : 1));
    } else if (hour < 9 || (hour === 9 && min < 30)) {
        // Today before open — stays same day
    } else {
        // During market hours — shouldn't happen, but next day
        next.setDate(next.getDate() + (day === 5 ? 3 : 1));
    }

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
    if (msg.includes('9:30') || msg.includes('market hours') || msg.includes('4:00 pm') || msg.includes('market closed') || msg.includes('outside of')) {
        return 'market_closed';
    }
    if (msg.includes('refresh token') || msg.includes('7-day') || msg.includes('invalid_grant') || msg.includes('reconnect schwab')) {
        return 'reconnect_required';
    }
    if (msg.includes('session expired') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('token expired') || msg.includes('token')) {
        return 'session_expired';
    }
    if (msg.includes('forbidden') || msg.includes('403') || msg.includes('not enabled') || msg.includes('options trading')) {
        return 'options_not_enabled';
    }
    if (msg.includes('credentials') || msg.includes('broker not found') || msg.includes('inactive') || msg.includes('failed to fetch')) {
        return 'broker_not_configured';
    }
    return null;
}

// ─── BLOCKING ERROR COMPONENT ────────────────────────────────

const BLOCKING_ERROR_CONFIG: Record<BlockingErrorType, {
    icon: string;
    title: string;
    color: string;
    message: string;
}> = {
    market_closed: {
        icon: '🕐',
        title: 'MARKET CLOSED',
        color: '#f59e0b',
        message: 'Options trading is available during market hours only.',
    },
    session_expired: {
        icon: '🔒',
        title: 'SESSION EXPIRED',
        color: '#ef4444',
        message: 'Your broker session has expired. Please reconnect to continue trading.',
    },
    reconnect_required: {
        icon: '🔑',
        title: 'RECONNECT REQUIRED',
        color: '#ef4444',
        message: 'Your broker authorization has expired (7-day limit). You need to log in again.',
    },
    options_not_enabled: {
        icon: '🔐',
        title: 'OPTIONS NOT ENABLED',
        color: '#ef4444',
        message: 'Options trading is not enabled on this broker account.',
    },
    broker_not_configured: {
        icon: '⚙️',
        title: 'BROKER NOT CONFIGURED',
        color: '#f59e0b',
        message: 'Could not connect to your broker. Please check your broker settings.',
    },
};

interface BlockingErrorProps {
    type: BlockingErrorType;
    brokerName?: string;
    onClose: () => void;
    onNavigate?: (view: string) => void;
}

const BlockingError: React.FC<BlockingErrorProps> = ({ type, brokerName, onClose, onNavigate }) => {
    const config = BLOCKING_ERROR_CONFIG[type];
    const currentET = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 32px', minHeight: '400px' }}>
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ background: `${config.color}12` }}>
                <span style={{ fontSize: '48px' }}>{config.icon}</span>
            </div>

            {/* Title */}
            <h3 style={{ color: config.color, fontSize: '16px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                {config.title}
            </h3>

            {/* Message */}
            <p style={{ color: '#9ca3af', fontSize: '13px', maxWidth: '360px', lineHeight: 1.5, marginBottom: '24px' }}>
                {config.message}
            </p>

            {/* Info Card — varies by type */}
            <div style={{ background: '#0d1117', border: '1px solid #1e2a36', borderRadius: '10px', padding: '16px 20px', width: '100%', maxWidth: '400px', textAlign: 'left', marginBottom: '24px' }}>
                {type === 'market_closed' && (
                    <>
                        <InfoRow icon="🔔" label="Market Hours" value="Mon–Fri: 9:30 AM — 4:00 PM ET" />
                        <InfoRow icon="⏰" label="Current Time" value={`${currentET} ET`} border />
                        <InfoRow icon="📅" label="Next Open" value={getNextMarketOpen()} />
                    </>
                )}

                {type === 'session_expired' && (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span>ℹ️</span>
                            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                                {brokerName === 'schwab' ? 'Schwab' : 'Broker'} access tokens expire every 30 minutes and auto-refresh. If auto-refresh fails, you need to reconnect manually.
                            </p>
                        </div>
                    </div>
                )}

                {type === 'reconnect_required' && (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span>ℹ️</span>
                            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                                {brokerName === 'schwab' ? 'Schwab' : 'Your broker'} requires re-authentication every 7 days for security. This is a broker requirement and cannot be extended.
                            </p>
                        </div>
                    </div>
                )}

                {type === 'options_not_enabled' && (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span>📋</span>
                            <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.8 }}>
                                <p style={{ fontWeight: 600, color: '#d1d5db', marginBottom: '4px' }}>To enable options trading:</p>
                                <p>1. Log in to your broker's website</p>
                                <p>2. Go to Account Settings</p>
                                <p>3. Apply for Options Trading</p>
                                <p>4. Wait for approval (1-2 business days)</p>
                            </div>
                        </div>
                    </div>
                )}

                {type === 'broker_not_configured' && (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span>ℹ️</span>
                            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                                Your broker credentials may be missing, expired, or the broker account may be inactive. Go to Settings to reconnect.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 justify-center">
                <button
                    onClick={onClose}
                    style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #1f2937', background: '#0d1117', color: '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                    Close
                </button>

                {(type === 'session_expired' || type === 'reconnect_required') && (
                    <button
                        onClick={() => { onClose(); onNavigate?.('settings'); }}
                        style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Reconnect {brokerName === 'schwab' ? 'Schwab' : 'Broker'} →
                    </button>
                )}

                {type === 'options_not_enabled' && (
                    <button
                        onClick={() => window.open('https://www.schwab.com', '_blank')}
                        style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Go to Schwab →
                    </button>
                )}

                {type === 'broker_not_configured' && (
                    <button
                        onClick={() => { onClose(); onNavigate?.('settings'); }}
                        style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Go to Settings →
                    </button>
                )}
            </div>
        </div>
    );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string; border?: boolean }> = ({ icon, label, value, border }) => (
    <div className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: border !== false ? '1px solid #1e2a36' : 'none' }}>
        <span style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{icon}</span> {label}
        </span>
        <span style={{ color: '#d1d5db', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
            {value}
        </span>
    </div>
);

interface ContractRecommendation {
    symbol: string;
    contract_symbol: string;
    strike: number;
    expiry: string;
    option_type: 'CALL' | 'PUT';
    premium: number;
    quantity: number;
    total_cost: number;
    dte: number;
    implied_volatility?: number;
    delta?: number;
    description?: string;
    bid?: number;
    ask?: number;
    max_contracts?: number;
    cost_per_contract?: number;
    moneyness?: string;  // ATM, OTM, ITM
    volume?: number;
    open_interest?: number;
    recommended?: boolean;
}

interface FindOptionResponse {
    contracts: ContractRecommendation[];
    no_affordable?: boolean;
    min_budget_needed?: number;
    cheapest_contract?: ContractRecommendation;
    message?: string;
    over_budget_options?: ContractRecommendation[];
}

type FlowStep = 1 | 2 | 3;
type DteRange = 'short' | 'swing' | 'monthly';
type TPSLMode = 'percent' | 'dollar' | 'off';
type OrderMode = 'bracket' | 'regular';

const SL_PRESETS = [10, 20, 30, 50];
const TP_PRESETS = [25, 50, 100, 200];

// ─── STEP INDICATOR ───────────────────────────────────────────

const StepIndicator: React.FC<{ current: FlowStep; onStepClick: (s: FlowStep) => void }> = ({ current, onStepClick }) => {
    const steps = [
        { num: 1 as FlowStep, label: 'Configure' },
        { num: 2 as FlowStep, label: 'Select Contract' },
        { num: 3 as FlowStep, label: 'TP / SL' },
    ];

    return (
        <div className="px-4 py-2 border-b border-gray-800/60 flex items-center justify-center gap-0">
            {steps.map((s, idx) => {
                const isComplete = s.num < current;
                const isCurrent = s.num === current;
                const isFuture = s.num > current;
                return (
                    <React.Fragment key={s.num}>
                        {idx > 0 && (
                            <div className={`w-8 h-px mx-1 ${isComplete ? 'bg-green-600' : 'bg-gray-800'}`}></div>
                        )}
                        <button
                            onClick={() => isComplete && onStepClick(s.num)}
                            disabled={!isComplete}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${isCurrent ? 'text-white' :
                                isComplete ? 'text-green-400 hover:text-green-300 cursor-pointer' :
                                    'text-gray-600 cursor-default'
                                }`}
                        >
                            {isComplete ? (
                                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                            ) : (
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border ${isCurrent ? 'bg-green-600 border-green-500 text-white' :
                                    'border-gray-700 text-gray-600'
                                    }`}>{s.num}</span>
                            )}
                            <span className="hidden sm:inline">{s.label}</span>
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ─── MODE TOGGLE (% / $ / Off) ────────────────────────────────

const ModeToggle: React.FC<{ value: TPSLMode; onChange: (m: TPSLMode) => void; color: string }> = ({ value, onChange, color }) => {
    const opts: { id: TPSLMode; label: string }[] = [
        { id: 'percent', label: '%' },
        { id: 'dollar', label: '$' },
        { id: 'off', label: 'Off' },
    ];
    return (
        <div className="flex bg-[#0d1117] rounded border border-gray-700 p-0.5 gap-0.5">
            {opts.map(o => (
                <button
                    key={o.id}
                    onClick={() => onChange(o.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${value === o.id
                        ? (o.id === 'off' ? 'bg-gray-800 text-gray-300' : `bg-${color}-900/40 text-${color}-400 border border-${color}-800`)
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                >{o.label}</button>
            ))}
        </div>
    );
};


// ─── MAIN COMPONENT ───────────────────────────────────────────

const ExecuteTradeModal: React.FC<ExecuteTradeModalProps> = ({ isOpen, onClose, signal, onSuccess, onNavigate }) => {
    const { user, accessLevel } = useAuth();
    const { selectedBroker } = useBrokerContext();

    // Flow
    const [step, setStep] = useState<FlowStep>(1);
    const [warningAcknowledged, setWarningAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [txId, setTxId] = useState('');
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [duplicateError, setDuplicateError] = useState<DuplicatePositionInfo | null>(null);
    const [blockingError, setBlockingError] = useState<BlockingErrorType | null>(null);

    // Step 1: Config
    const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
    const [dteRange, setDteRange] = useState<DteRange>('swing');
    const [budget, setBudget] = useState(300);

    // Step 2: Contract Selection
    const [searching, setSearching] = useState(false);
    const [contracts, setContracts] = useState<ContractRecommendation[]>([]);
    const [selectedContract, setSelectedContract] = useState<ContractRecommendation | null>(null);

    // Step 3: TP/SL
    const [orderMode, setOrderMode] = useState<OrderMode>('bracket');
    const [slMode, setSlMode] = useState<TPSLMode>('percent');
    const [slPercent, setSlPercent] = useState(20);
    const [slDollar, setSlDollar] = useState<string>('');
    const [tpMode, setTpMode] = useState<TPSLMode>('percent');
    const [tpPercent, setTpPercent] = useState(50);
    const [tpDollar, setTpDollar] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [confirmText, setConfirmText] = useState('');

    // Budget error
    const [budgetError, setBudgetError] = useState<{ message: string; minBudget: number; cheapestContract?: ContractRecommendation } | null>(null);

    // ─── Derived ──────────────────────────────────────────────

    const isPaper = accessLevel === 'paper' || selectedBroker?.broker_mode === 'paper';
    const isSchwab = selectedBroker?.broker_name === 'schwab';
    const isCall = optionType === 'CALL';
    const themeColor = isPaper ? 'blue' : isCall ? 'green' : 'red';
    const premium = selectedContract?.premium || 0;

    const computedSL = useMemo(() => {
        if (slMode === 'off') return null;
        if (slMode === 'percent') return +(premium * (1 - slPercent / 100)).toFixed(2);
        return parseFloat(slDollar) || null;
    }, [slMode, slPercent, slDollar, premium]);

    const computedTP = useMemo(() => {
        if (tpMode === 'off') return null;
        if (tpMode === 'percent') return +(premium * (1 + tpPercent / 100)).toFixed(2);
        return parseFloat(tpDollar) || null;
    }, [tpMode, tpPercent, tpDollar, premium]);

    const maxLoss = computedSL != null ? (premium - computedSL) * 100 * quantity : null;
    const maxGain = computedTP != null ? (computedTP - premium) * 100 * quantity : null;
    const riskReward = (computedSL != null && computedTP != null && premium - computedSL > 0)
        ? ((computedTP - premium) / (premium - computedSL)).toFixed(1)
        : '—';

    const dteOptions = [
        { id: 'short' as DteRange, label: 'Short-term', days: '5-10 DTE' },
        { id: 'swing' as DteRange, label: 'Swing', days: '10-15 DTE' },
        { id: 'monthly' as DteRange, label: 'Monthly', days: '30+ DTE' },
    ];

    // ─── Trade Quality Warnings ────────────────────────────────

    const tradeWarnings = useMemo(() => {
        if (!signal) return [];
        const warnings: { icon: string; title: string; detail: string; severity: 'high' | 'medium' }[] = [];

        const rec = signal.trading_recommendation?.toUpperCase() || '';
        const isStrong = rec.includes('STRONG');
        if (!isStrong) {
            const label = rec || 'UNKNOWN';
            warnings.push({
                icon: '⚡',
                title: 'Not a Strong Signal',
                detail: `Signal is "${label}" — only Strong Buy / Strong Sell signals indicate high-conviction setups. Weaker signals have higher failure rates.`,
                severity: 'high',
            });
        }

        const [passed, total] = (signal.gates_passed || '0/6').split('/').map(Number);
        const missed = total - passed;
        if (missed > 0) {
            warnings.push({
                icon: '🚦',
                title: `${missed} Confirmation Gate${missed > 1 ? 's' : ''} Failed`,
                detail: `Only ${passed} of ${total} gates passed. Each failed gate represents a missing confirmation (momentum, trend, volume, etc.). ${missed >= 3 ? 'High risk — most filters rejected this trade.' : 'Proceed with caution.'}`,
                severity: missed >= 2 ? 'high' : 'medium',
            });
        }

        if (signal.tier === 'B+') {
            warnings.push({
                icon: '📊',
                title: 'Tier B+ Setup',
                detail: 'A+ and A tier trades have the strongest historical win rate. B+ setups are valid but carry more uncertainty.',
                severity: 'medium',
            });
        }

        return warnings;
    }, [signal]);

    const needsWarning = tradeWarnings.length > 0 && !warningAcknowledged;

    // ─── Init ─────────────────────────────────────────────────

    useEffect(() => {
        if (signal && isOpen) {
            setStep(1);
            setSubmitting(false);
            setSubmitted(false);
            setErrorMsg('');
            setTxId('');
            setExecutionResult(null);
            setContracts([]);
            setSelectedContract(null);
            setBudgetError(null);
            setDuplicateError(null);
            setBlockingError(null);
            setConfirmText('');
            setWarningAcknowledged(false);

            setOptionType(signal.option_type as 'CALL' | 'PUT');
            setBudget(user?.user_metadata?.default_budget || 300);

            // Step 3 defaults — bracket only for Schwab
            setOrderMode(selectedBroker?.broker_name === 'schwab' ? 'bracket' : 'regular');
            setSlMode('percent');
            setSlPercent(20);
            setSlDollar('');
            setTpMode('percent');
            setTpPercent(50);
            setTpDollar('');
            setQuantity(1);
        }
    }, [signal, isOpen, user]);

    if (!isOpen || !signal) return null;

    // ─── API: Find Contracts ──────────────────────────────────

    const handleFindContracts = async () => {
        setSearching(true);
        setErrorMsg('');
        setBudgetError(null);

        try {
            const fetchContracts = async (min: number, max: number) => {
                const payload = {
                    symbol: signal.symbol,
                    current_price: signal.current_price,
                    option_type: optionType,
                    dte_min: min,
                    dte_max: max,
                    budget: budget,
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

            let dte_min = 5, dte_max = 10;
            if (dteRange === 'swing') { dte_min = 10; dte_max = 15; }
            if (dteRange === 'monthly') { dte_min = 30; dte_max = 60; }

            let result: FindOptionResponse & { success?: boolean; error?: string; message?: string } = await fetchContracts(dte_min, dte_max);

            // Check for blocking errors from the chain API
            if (result.success === false && (result.error || result.message)) {
                const errStr = result.error || result.message || '';
                const blocking = detectBlockingError(errStr);
                if (blocking) {
                    setBlockingError(blocking);
                    setSearching(false);
                    return;
                }
            }

            // Auto-retry with wider range if nothing found (unless budget is the issue)
            if ((!result.contracts || result.contracts.length === 0) && !result.no_affordable) {
                console.log('No contracts found. Retrying with wider DTE range (3-45 days)...');
                result = await fetchContracts(3, 45);
            }

            if (result.no_affordable) {
                setBudgetError({
                    message: result.message || 'No options available within your budget.',
                    minBudget: result.min_budget_needed || (result.cheapest_contract ? result.cheapest_contract.premium * 100 : 0),
                    cheapestContract: result.cheapest_contract
                });
                setSearching(false);
                return;
            }

            if (result.contracts && result.contracts.length > 0) {
                setContracts(result.contracts);
                setStep(2);
            } else {
                throw new Error('No contracts found matching criteria. Try a wider expiry range or higher budget.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to find contracts.');
        } finally {
            setSearching(false);
        }
    };

    const handleRetryHigherBudget = () => {
        if (budgetError?.minBudget) {
            const newBudget = Math.ceil((budgetError.minBudget + 50) / 50) * 50;
            setBudget(newBudget);
            setBudgetError(null);
        }
    };

    // ─── API: Submit Order ────────────────────────────────────

    const handleSubmit = async () => {
        if (!isPaper && confirmText.toUpperCase() !== 'CONFIRM') {
            setErrorMsg('Please type CONFIRM to place a live order.');
            return;
        }
        if (!selectedContract) return;

        setSubmitting(true);
        setErrorMsg('');
        setExecutionResult(null);

        try {
            const isBracketActive = orderMode === 'bracket';

            const payload = {
                symbol: signal.symbol,
                contract_symbol: selectedContract.contract_symbol,
                option_type: optionType,
                strike: selectedContract.strike,
                expiry: selectedContract.expiry,
                premium: selectedContract.premium,
                quantity: quantity,
                total_cost: quantity * premium * 100,
                budget: budget,
                order_type: 'market',
                current_price: signal.current_price,

                // Bracket fields — premium-based TP/SL
                // Schwab: bracket by default; bracketOrder=true when Bracket selected
                bracketOrder: (selectedBroker?.broker_name === 'schwab' && isBracketActive) ? true : isBracketActive,
                stop_loss: isBracketActive ? computedSL : null,
                take_profit: isBracketActive ? computedTP : null,
                order_mode: isBracketActive ? 'bracket' : 'regular',

                // Broker
                broker_id: selectedBroker?.id,
                broker_name: selectedBroker?.broker_name,
                broker_mode: selectedBroker?.broker_mode,

                // Signal reference
                signal_id: signal.id || null,
                tier: signal.tier,
                gates_passed: signal.gates_passed,
                user_id: user?.id
            };

            console.log('Execute Payload:', payload);

            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/execute-option-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            setExecutionResult(result);

            if (result.success) {
                setTxId(result.order?.orderId || result.order_id || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase());
                setSubmitted(true);
            } else {
                // Safely coerce error to string (API may return object or string)
                const errorStr = typeof result.error === 'string' ? result.error
                    : (result.error?.message || result.message || JSON.stringify(result.error) || '');

                const blocking = detectBlockingError(errorStr);
                if (blocking) {
                    setBlockingError(blocking);
                } else if (errorStr.includes('Already holding')) {
                    // Parse duplicate position error
                    const match = errorStr.match(/Already holding (\w+) on (\w+): (.+)/);
                    if (match) {
                        const raw = match[3].trim().replace(/\s+/g, '');
                        const strikeVal = parseInt(raw.slice(-8)) / 1000;
                        const dateStr = raw.slice(raw.length - 15, raw.length - 9);
                        const expiryDate = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
                        const dte = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
                        setDuplicateError({
                            optionType: match[1],
                            symbol: match[2],
                            contractSymbol: match[3].trim(),
                            strike: strikeVal,
                            expiry: expiryDate,
                            dte: Math.max(0, dte),
                        });
                    } else {
                        setErrorMsg(errorStr);
                    }
                } else {
                    setErrorMsg(result.message || result.error || 'Order failed. Please try again.');
                }
            }
        } catch (err: any) {
            console.error('Execution Error:', err);
            setErrorMsg(err.message || 'Network error.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Navigation ───────────────────────────────────────────

    const goBack = () => {
        if (step === 3) setStep(2);
        else if (step === 2) { setStep(1); setContracts([]); }
    };

    const selectContract = (c: ContractRecommendation) => {
        setSelectedContract(c);
        setQuantity(1);
        // Init dollar inputs from defaults
        setSlDollar((c.premium * (1 - 20 / 100)).toFixed(2));
        setTpDollar((c.premium * (1 + 50 / 100)).toFixed(2));
        setStep(3);
    };

    const handleCloseOrBack = () => {
        if (blockingError || duplicateError) { onClose(); return; }
        if (step === 1 || submitted) { onClose(); if (submitted && onSuccess) onSuccess(); }
        else goBack();
    };

    // ─── Moneyness helper ─────────────────────────────────────

    const getMoneyness = (c: ContractRecommendation) => {
        if (c.moneyness) return c.moneyness;
        const diff = c.strike - signal.current_price;
        if (Math.abs(diff) / signal.current_price < 0.01) return 'ATM';
        if (optionType === 'CALL') return diff > 0 ? 'OTM' : 'ITM';
        return diff < 0 ? 'OTM' : 'ITM';
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-[#0f1219] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
                style={{ animation: 'slideUp 0.25s ease' }}>

                {/* ─── Header ───────────────────────────────── */}
                <div className={`p-4 border-b border-${themeColor}-500/20 bg-${themeColor}-900/10 flex justify-between items-center`}>
                    <div>
                        <h2 className={`text-lg font-black uppercase tracking-tight text-${themeColor}-400 flex items-center gap-2`}>
                            <span className="text-amber-400">⚡</span>
                            Execute {optionType} Option
                        </h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mt-1">
                            <span className="text-white">{signal.symbol}</span>
                            <span className="text-gray-600">•</span>
                            <span>{formatCurrency(signal.current_price)}</span>
                            <span className="text-gray-600">•</span>
                            <span className={`text-${themeColor}-400 bg-${themeColor}-900/20 px-1.5 py-0.5 rounded text-[10px]`}>Tier {signal.tier}</span>
                            <span className="text-gray-600">•</span>
                            <span>{signal.gates_passed} Gates</span>
                        </div>
                    </div>
                    <button onClick={handleCloseOrBack} className="text-gray-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-xl">{step === 1 || submitted || blockingError || duplicateError ? 'close' : 'arrow_back'}</span>
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

                {/* ─── Step Indicator ───────────────────────── */}
                {!submitted && !submitting && !duplicateError && !blockingError && !needsWarning && (
                    <StepIndicator current={step} onStepClick={(s) => { if (s < step) setStep(s); }} />
                )}

                {/* ─── Body ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* ═══ TRADE WARNING SCREEN ═══ */}
                    {needsWarning && !duplicateError && !blockingError && (
                        <div className="space-y-4">
                            <div className="text-center pt-2">
                                <div className="text-5xl mb-3">⚠️</div>
                                <h3 className="text-base font-black text-amber-400 uppercase tracking-widest">Confirm Trade Risk</h3>
                                <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
                                    This signal has <span className="text-amber-400 font-bold">{tradeWarnings.length} quality concern{tradeWarnings.length > 1 ? 's' : ''}</span>. Review before proceeding.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {tradeWarnings.map((w, i) => (
                                    <div
                                        key={i}
                                        className={`rounded-xl p-4 border ${w.severity === 'high'
                                            ? 'bg-red-900/10 border-red-500/30'
                                            : 'bg-amber-900/10 border-amber-500/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-lg">{w.icon}</span>
                                            <span className={`text-xs font-black uppercase tracking-wide ${w.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                                                {w.title}
                                            </span>
                                        </div>
                                        <p className="text-gray-400 text-xs leading-relaxed pl-7">{w.detail}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800 flex items-start gap-3">
                                <span className="text-blue-400 text-lg">💡</span>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Best setups are <span className="text-white font-bold">Strong Buy / Strong Sell</span> with all <span className="text-white font-bold">6/6 gates passed</span> and <span className="text-white font-bold">Tier A+</span>. Deviating increases the chance of a losing trade.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 border border-gray-700 text-gray-400 font-bold rounded-xl hover:bg-gray-800 transition-colors text-xs uppercase tracking-wide"
                                >
                                    Cancel Trade
                                </button>
                                <button
                                    onClick={() => setWarningAcknowledged(true)}
                                    className="flex-[2] py-3 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">warning</span>
                                    Proceed Anyway
                                </button>
                            </div>
                        </div>
                    )}

                    {!needsWarning && !duplicateError && !blockingError && (<>
                        {/* ═══ STEP 1: Configure ═══ */}
                        {step === 1 && !searching && !budgetError && (
                            <>
                                {/* Option Type */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Option Type</label>
                                    <div className="flex bg-[#0d1117] rounded-lg border border-gray-700/60 p-1">
                                        <button onClick={() => setOptionType('CALL')} className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${optionType === 'CALL' ? 'bg-green-900/40 text-green-400 shadow' : 'text-gray-500 hover:text-white'}`}>
                                            <span className={`w-2 h-2 rounded-full ${optionType === 'CALL' ? 'bg-green-400' : 'bg-gray-700'}`}></span>
                                            CALL
                                        </button>
                                        <button onClick={() => setOptionType('PUT')} className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${optionType === 'PUT' ? 'bg-red-900/40 text-red-400 shadow' : 'text-gray-500 hover:text-white'}`}>
                                            <span className={`w-2 h-2 rounded-full ${optionType === 'PUT' ? 'bg-red-400' : 'bg-gray-700'}`}></span>
                                            PUT
                                        </button>
                                    </div>
                                </div>

                                {/* Expiry Range */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Expiry Range</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {dteOptions.map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setDteRange(opt.id)}
                                                className={`py-3 rounded-lg border text-center transition-all ${dteRange === opt.id ? 'bg-green-950/30 border-green-800 text-white' : 'bg-[#0d1117] border-gray-700/60 text-gray-400 hover:border-gray-500'}`}
                                            >
                                                <span className={`block text-[10px] font-bold ${dteRange === opt.id ? 'text-green-400' : 'text-gray-500'}`}>{opt.days}</span>
                                                <span className="block text-xs font-semibold mt-1">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Budget */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Budget</label>
                                    <div className="flex items-center bg-[#0d1117] border border-gray-700/60 rounded-lg overflow-hidden">
                                        <span className="px-3 text-gray-500 font-bold border-r border-gray-700/60">$</span>
                                        <input
                                            type="number"
                                            value={budget}
                                            onChange={e => setBudget(parseInt(e.target.value) || 0)}
                                            className="flex-1 px-3 py-3 bg-transparent text-white font-mono font-bold text-lg outline-none"
                                            placeholder="300"
                                        />
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs font-medium">
                                        {errorMsg}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Searching spinner */}
                        {step === 1 && searching && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-green-500 animate-spin mx-auto mb-6"></div>
                                <h3 className="text-lg font-black text-white animate-pulse">Finding best {optionType} option...</h3>
                                <p className="text-gray-500 text-sm mt-2">Searching {dteOptions.find(d => d.id === dteRange)?.days} contracts within ${budget} budget...</p>
                            </div>
                        )}

                        {/* Budget Too Low */}
                        {step === 1 && budgetError && (
                            <div className="space-y-4">
                                <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-xl overflow-hidden">
                                    <div className="bg-yellow-500/10 p-3 border-b border-yellow-500/20 flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-yellow-500 text-lg">savings</span>
                                        <span className="text-yellow-400 font-black uppercase text-sm tracking-wide">Budget Too Low</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <p className="text-gray-300 text-sm">{budgetError.message}</p>
                                        {budgetError.cheapestContract && (
                                            <div className="bg-[#0f1219] p-3 rounded-lg border border-gray-800">
                                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Cheapest Available</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white font-bold">{budgetError.cheapestContract.symbol} ${budgetError.cheapestContract.strike}</span>
                                                    <span className="text-yellow-400 font-mono font-bold">{formatCurrency(budgetError.cheapestContract.cost_per_contract || budgetError.cheapestContract.premium * 100)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setBudgetError(null)} className="flex-1 py-3 border border-gray-700 text-gray-400 font-bold rounded-xl hover:bg-gray-800 transition-colors uppercase text-xs">← Edit Budget</button>
                                    <button onClick={handleRetryHigherBudget} className="flex-[2] py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-black rounded-xl transition-all uppercase text-xs flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                        Retry with {formatCurrency(Math.ceil(((budgetError.minBudget || 0) + 50) / 50) * 50)}
                                    </button>
                                </div>
                            </div>
                        )}


                        {/* ═══ STEP 2: Select Contract ═══ */}
                        {step === 2 && (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Available Contracts</h3>
                                {contracts.map((c, i) => {
                                    const money = getMoneyness(c);
                                    const moneyColor = money === 'ITM' ? 'text-green-400 bg-green-950 border-green-900'
                                        : money === 'ATM' ? 'text-yellow-400 bg-yellow-950 border-yellow-900'
                                            : 'text-gray-400 bg-gray-800 border-gray-700';
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => selectContract(c)}
                                            className="p-4 rounded-xl border border-gray-700/60 bg-[#0d1117] cursor-pointer transition-all hover:border-green-700/60 hover:bg-green-950/5 group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-white text-lg">{signal.symbol} ${c.strike} {c.option_type}</span>
                                                        {(c.recommended || i === 0) && (
                                                            <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-green-800">★ BEST</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 font-mono mt-0.5 block">{c.expiry} ({c.dte}d)</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-black text-green-400 text-lg font-mono">{formatCurrency(c.premium)}</span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {formatCurrency(c.cost_per_contract || c.premium * 100)}/ct
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Tags */}
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-800/60">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${moneyColor}`}>{money}</span>
                                                {c.delta != null && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-400 bg-gray-800 border border-gray-700">Δ {c.delta.toFixed(2)}</span>}
                                                {c.implied_volatility != null && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-400 bg-gray-800 border border-gray-700">IV {(c.implied_volatility * 100).toFixed(0)}%</span>}
                                                {c.volume != null && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-400 bg-gray-800 border border-gray-700">Vol {c.volume.toLocaleString()}</span>}
                                                {c.open_interest != null && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-400 bg-gray-800 border border-gray-700">OI {c.open_interest.toLocaleString()}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}


                        {/* ═══ STEP 3: TP/SL + Submit ═══ */}
                        {step === 3 && selectedContract && !submitting && !submitted && (
                            <div className="space-y-5">

                                {/* Selected Contract Summary */}
                                <div className="bg-[#0d1117] rounded-xl p-4 border border-gray-700/60 flex justify-between items-center">
                                    <div>
                                        <span className="font-black text-white text-base">{signal.symbol} ${selectedContract.strike} {selectedContract.option_type}</span>
                                        <span className="block text-[11px] text-gray-400 font-mono mt-0.5">
                                            {selectedContract.expiry} • {selectedContract.dte}d • {getMoneyness(selectedContract)}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-green-400 text-xl font-mono">{formatCurrency(premium)}</span>
                                        <span className="block text-[10px] text-gray-500">per contract</span>
                                    </div>
                                </div>

                                {/* Order Mode Toggle — Schwab only */}
                                {isSchwab && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Order Mode</label>
                                        <div className="flex bg-[#0d1117] rounded-lg border border-gray-700/60 p-1 gap-1">
                                            <button
                                                onClick={() => setOrderMode('bracket')}
                                                className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${orderMode === 'bracket' ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-800' : 'text-gray-500 hover:text-white border border-transparent'}`}
                                            >
                                                <span className="material-symbols-outlined text-sm">link</span>
                                                Bracket
                                            </button>
                                            <button
                                                onClick={() => setOrderMode('regular')}
                                                className={`flex-1 py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${orderMode === 'regular' ? 'bg-green-900/30 text-green-400 border border-green-800' : 'text-gray-500 hover:text-white border border-transparent'}`}
                                            >
                                                <span className="material-symbols-outlined text-sm">description</span>
                                                Regular
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {orderMode === 'bracket' ? (
                                    <>
                                        {/* ─── Stop Loss ─────────────── */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-red-400 uppercase flex items-center gap-1">▼ Stop Loss</label>
                                                <ModeToggle value={slMode} onChange={setSlMode} color="red" />
                                            </div>

                                            {slMode === 'percent' && (
                                                <div>
                                                    <div className="flex gap-1.5 mb-2">
                                                        {SL_PRESETS.map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={() => setSlPercent(p)}
                                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${slPercent === p ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-[#0d1117] text-gray-400 border-gray-700/60 hover:border-gray-500'}`}
                                                            >
                                                                -{p}%
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[11px] text-gray-400">
                                                        Exit if premium drops to <span className="text-red-400 font-mono font-bold">{formatCurrency(computedSL || 0)}</span> <span className="text-gray-600">(-{slPercent}%)</span>
                                                    </p>
                                                </div>
                                            )}

                                            {slMode === 'dollar' && (
                                                <div className="flex items-center bg-[#0d1117] border border-gray-700/60 rounded-lg overflow-hidden">
                                                    <span className="px-3 text-gray-500 font-bold border-r border-gray-700/60">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={slDollar}
                                                        onChange={e => setSlDollar(e.target.value)}
                                                        placeholder={`e.g. ${(premium * 0.8).toFixed(2)}`}
                                                        className="flex-1 px-3 py-3 bg-transparent text-white font-mono font-bold outline-none"
                                                    />
                                                </div>
                                            )}

                                            {slMode === 'off' && (
                                                <p className="text-gray-500 text-xs py-2 px-3 bg-[#0d1117] rounded-lg border border-gray-700/60">No stop loss — manual exit only</p>
                                            )}
                                        </div>

                                        {/* ─── Take Profit ─────────────── */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-green-400 uppercase flex items-center gap-1">▲ Take Profit</label>
                                                <ModeToggle value={tpMode} onChange={setTpMode} color="green" />
                                            </div>

                                            {tpMode === 'percent' && (
                                                <div>
                                                    <div className="flex gap-1.5 mb-2">
                                                        {TP_PRESETS.map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={() => setTpPercent(p)}
                                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${tpPercent === p ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-[#0d1117] text-gray-400 border-gray-700/60 hover:border-gray-500'}`}
                                                            >
                                                                +{p}%
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[11px] text-gray-400">
                                                        Exit if premium rises to <span className="text-green-400 font-mono font-bold">{formatCurrency(computedTP || 0)}</span> <span className="text-gray-600">(+{tpPercent}%)</span>
                                                    </p>
                                                </div>
                                            )}

                                            {tpMode === 'dollar' && (
                                                <div className="flex items-center bg-[#0d1117] border border-gray-700/60 rounded-lg overflow-hidden">
                                                    <span className="px-3 text-gray-500 font-bold border-r border-gray-700/60">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={tpDollar}
                                                        onChange={e => setTpDollar(e.target.value)}
                                                        placeholder={`e.g. ${(premium * 1.5).toFixed(2)}`}
                                                        className="flex-1 px-3 py-3 bg-transparent text-white font-mono font-bold outline-none"
                                                    />
                                                </div>
                                            )}

                                            {tpMode === 'off' && (
                                                <p className="text-gray-500 text-xs py-2 px-3 bg-[#0d1117] rounded-lg border border-gray-700/60">No take profit — manual exit only</p>
                                            )}
                                        </div>

                                        {/* ─── Bracket Summary ─────────── */}
                                        {(computedSL != null || computedTP != null) && (
                                            <div className="bg-[#080c11] rounded-xl p-4 border border-gray-800 space-y-1.5">
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-gray-500 text-xs">Entry Premium</span>
                                                    <span className="text-white text-xs font-semibold font-mono">{formatCurrency(premium)}</span>
                                                </div>
                                                {computedSL != null && (
                                                    <div className="flex justify-between items-center py-1">
                                                        <span className="text-red-400 text-xs">▼ Stop Loss</span>
                                                        <span className="text-red-400 text-xs font-semibold font-mono">
                                                            {formatCurrency(computedSL)} <span className="text-gray-600">(-{formatCurrency(premium - computedSL)}/ct)</span>
                                                        </span>
                                                    </div>
                                                )}
                                                {computedTP != null && (
                                                    <div className="flex justify-between items-center py-1">
                                                        <span className="text-green-400 text-xs">▲ Take Profit</span>
                                                        <span className="text-green-400 text-xs font-semibold font-mono">
                                                            {formatCurrency(computedTP)} <span className="text-gray-600">(+{formatCurrency(computedTP - premium)}/ct)</span>
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="border-t border-gray-800 pt-2 mt-1 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500 text-[11px]">Max Loss / Max Gain</span>
                                                        <span className="text-xs font-mono">
                                                            {maxLoss != null ? <span className="text-red-400 font-bold">-{formatCurrency(maxLoss)}</span> : <span className="text-gray-600">—</span>}
                                                            <span className="text-gray-600 mx-1">/</span>
                                                            {maxGain != null ? <span className="text-green-400 font-bold">+{formatCurrency(maxGain)}</span> : <span className="text-gray-600">—</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500 text-[11px]">Risk / Reward</span>
                                                        <span className="text-yellow-400 text-xs font-bold font-mono">1:{riskReward}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-700/60 flex items-center gap-3">
                                        <span className="material-symbols-outlined text-gray-500">description</span>
                                        <span className="text-gray-400 text-xs">Regular order — no automatic TP/SL. You'll manage exits manually.</span>
                                    </div>
                                )}

                                {/* Quantity */}
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Quantity</label>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} className={`w-8 h-8 flex items-center justify-center rounded-lg bg-[#0d1117] border border-gray-700 ${quantity <= 1 ? 'text-gray-600' : 'text-white hover:bg-gray-800'} transition-colors`}>
                                            <span className="material-symbols-outlined text-sm">remove</span>
                                        </button>
                                        <span className="font-mono font-black text-xl w-8 text-center text-white">{quantity}</span>
                                        <button onClick={() => setQuantity(Math.min(selectedContract.max_contracts || 10, quantity + 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0d1117] border border-gray-700 text-white hover:bg-gray-800 transition-colors">
                                            <span className="material-symbols-outlined text-sm">add</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Est. Total Cost</span>
                                    <span className="font-mono font-black text-xl text-white">{formatCurrency(quantity * premium * 100)}</span>
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
                            </div>
                        )}

                        {/* Submitting */}
                        {submitting && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-green-500 animate-spin mx-auto mb-6"></div>
                                <h3 className="text-lg font-black text-white animate-pulse">Submitting Order...</h3>
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
                                            <span className="font-mono text-white text-xs" title={txId}>{txId.substring(0, 12)}...</span>
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
                                            <span className="text-gray-500 text-xs font-bold uppercase">Contract</span>
                                            <span className="text-white text-sm font-bold">{signal.symbol} ${selectedContract?.strike} {selectedContract?.option_type}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Type</span>
                                            <span className="text-white text-sm font-bold uppercase">{orderMode === 'bracket' ? 'Bracket (OTO)' : 'Market'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Quantity</span>
                                            <span className="font-mono text-white text-sm">{quantity} contract{quantity > 1 ? 's' : ''}</span>
                                        </div>
                                        {orderMode === 'bracket' && computedSL != null && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 text-xs font-bold uppercase">Stop Loss</span>
                                                <span className="font-mono text-red-400 text-sm">{formatCurrency(computedSL)}</span>
                                            </div>
                                        )}
                                        {orderMode === 'bracket' && computedTP != null && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 text-xs font-bold uppercase">Take Profit</span>
                                                <span className="font-mono text-green-400 text-sm">{formatCurrency(computedTP)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Broker</span>
                                            <span className="text-white text-sm font-bold">{selectedBroker?.display_name} ({selectedBroker?.broker_mode?.toUpperCase()})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error on submit */}
                        {!submitting && !submitted && step === 3 && executionResult && !executionResult.success && (
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
                    </>)}

                    {/* Blocking Error */}
                    {blockingError && (
                        <BlockingError
                            type={blockingError}
                            brokerName={selectedBroker?.broker_name}
                            onClose={onClose}
                            onNavigate={onNavigate}
                        />
                    )}

                    {/* Duplicate Position Error */}
                    {duplicateError && (
                        <div className="space-y-5" style={{ borderTop: '2px solid #f59e0b' }}>
                            <div className="text-center pt-6">
                                <div className="text-4xl mb-3">⚠️</div>
                                <h3 style={{ color: '#f59e0b', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    Duplicate Position
                                </h3>
                            </div>
                            <div className="text-center" style={{ color: '#9ca3af', fontSize: '13px' }}>
                                <p>You already have an open {duplicateError.optionType} on {duplicateError.symbol}.</p>
                                <p>Close or sell it before opening a new one.</p>
                            </div>
                            <div style={{ background: '#0d1117', border: '1px solid #1e2a36', borderRadius: '10px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Existing Position</div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f3f4f6' }}>
                                            {duplicateError.symbol} ${duplicateError.strike} {duplicateError.optionType}
                                        </div>
                                        <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#6b7280', marginTop: '2px' }}>
                                            {duplicateError.contractSymbol}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db' }}>
                                            {new Date(duplicateError.expiry + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                            {duplicateError.dte} DTE
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center gap-2.5">
                                <button
                                    onClick={() => { setDuplicateError(null); setStep(1); setSubmitting(false); setSubmitted(false); setErrorMsg(''); }}
                                    style={{ background: '#0d1117', border: '1px solid #1f2937', color: '#9ca3af', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Dismiss
                                </button>
                                <button
                                    onClick={() => { onClose(); if (onNavigate) onNavigate('portfolio'); }}
                                    style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    View Position →
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Footer ───────────────────────────────── */}
                {!duplicateError && !blockingError && !needsWarning && <div className="p-4 border-t border-gray-800 bg-[#0f1219]/90 backdrop-blur flex justify-end gap-3">
                    {/* Cancel — always visible */}
                    <button
                        onClick={onClose}
                        className="px-5 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors text-xs"
                    >
                        Cancel
                    </button>

                    {/* Step-specific actions */}
                    {step === 1 && !searching && !budgetError && (
                        <button
                            onClick={handleFindContracts}
                            className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.97] flex items-center gap-2 text-xs"
                        >
                            <span className="material-symbols-outlined text-sm">search</span>
                            Find Best Contract
                        </button>
                    )}

                    {step === 2 && (
                        <button onClick={goBack} className="px-5 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors text-xs">
                            ← Back
                        </button>
                    )}

                    {step === 3 && !submitting && !submitted && (
                        <>
                            <button onClick={goBack} className="px-5 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors text-xs">
                                ← Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!isPaper && confirmText.toUpperCase() !== 'CONFIRM'}
                                className={`px-6 py-3 rounded-lg font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.97] flex items-center gap-2 text-xs ${(!isPaper && confirmText.toUpperCase() !== 'CONFIRM')
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                    }`}
                            >
                                🚀 {orderMode === 'bracket' ? 'Place Bracket Order' : 'Place Order'}
                            </button>
                        </>
                    )}

                    {submitted && (
                        <button onClick={() => { onClose(); if (onSuccess) onSuccess(); }} className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-black uppercase rounded-xl transition-all flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-green-500 text-sm">check</span>
                            Done
                        </button>
                    )}
                </div>}
            </div>

            <style>{`
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
};

export default ExecuteTradeModal;
