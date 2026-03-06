import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

/* ─── Helper Sub-Components ─── */

const Row: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({ label, sub, children }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/40 last:border-b-0">
        <div>
            <span className="text-sm font-bold text-white">{label}</span>
            {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const Pill: React.FC<{
    label: string; active: boolean; onClick: () => void;
    activeClass?: string; inactiveClass?: string;
}> = ({ label, active, onClick, activeClass = 'bg-blue-600 text-white border-blue-500', inactiveClass = 'bg-[#0d1117] text-gray-500 border-gray-700 hover:border-gray-600' }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${active ? activeClass : inactiveClass}`}
    >
        {label}
    </button>
);

const NumInput: React.FC<{
    value: string; onChange: (v: string) => void;
    prefix?: string; suffix?: string; className?: string; width?: string;
}> = ({ value, onChange, prefix, suffix, className = '', width = 'w-24' }) => (
    <div className={`relative ${width}`}>
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">{prefix}</span>}
        <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
            className={`w-full bg-[#0d1117] border border-gray-700 focus:border-blue-500 rounded-lg py-2 text-white font-mono font-bold text-sm outline-none transition-colors text-right ${prefix ? 'pl-6 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'} ${className}`}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">{suffix}</span>}
    </div>
);

const Toggle: React.FC<{ on: boolean; onToggle: () => void; size?: 'sm' | 'lg' }> = ({ on, onToggle, size = 'sm' }) => {
    const isSm = size === 'sm';
    return (
        <button
            onClick={onToggle}
            className={`${isSm ? 'w-10 h-5' : 'w-14 h-7'} rounded-full relative transition-colors ${on ? 'bg-emerald-600' : 'bg-gray-700'}`}
        >
            <div
                className={`${isSm ? 'w-4 h-4' : 'w-5.5 h-5.5'} rounded-full bg-white absolute top-0.5 transition-all`}
                style={{
                    width: isSm ? '16px' : '22px',
                    height: isSm ? '16px' : '22px',
                    top: isSm ? '2px' : '3px',
                    left: on ? (isSm ? '22px' : '30px') : '2px'
                }}
            />
        </button>
    );
};

/* ─── Defaults ─── */
const DEFAULTS = {
    enabled: false,
    broker: 'schwab',
    budget: 250,
    max_daily: 2,
    min_tier: 'A+',
    option_types: ['CALL', 'PUT'],
    dte_min: 3,
    dte_max: 7,
    tp_pct: 0.30,
    sl_pct: 0.15,
    bid_discount: 0.15,
};

interface AutoTradeSettingsType {
    enabled: boolean;
    broker: string;
    budget: number;
    max_daily: number;
    min_tier: string;
    option_types: string[];
    dte_min: number;
    dte_max: number;
    tp_pct: number;
    sl_pct: number;
    bid_discount: number;
}

interface AutoTrade {
    id: string;
    symbol: string;
    signal_tier: string;
    option_type: string;
    contract_symbol: string;
    strike: number;
    expiry: string;
    limit_price: number;
    quantity: number;
    total_cost: number;
    take_profit: number;
    stop_loss: number;
    broker: string;
    order_status: string;
    order_type: string;
    error_message: string | null;
    created_at: string;
}

/* ─── Main Component ─── */

const AutoTradeSettings: React.FC = () => {
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [userId, setUserId] = useState<string | null>(null);

    // Settings state
    const [enabled, setEnabled] = useState(DEFAULTS.enabled);
    const [broker, setBroker] = useState(DEFAULTS.broker);
    const [budget, setBudget] = useState(String(DEFAULTS.budget));
    const [maxDaily, setMaxDaily] = useState(String(DEFAULTS.max_daily));
    const [minTier, setMinTier] = useState(DEFAULTS.min_tier);
    const [optionTypes, setOptionTypes] = useState<string[]>(DEFAULTS.option_types);
    const [dteMin, setDteMin] = useState(String(DEFAULTS.dte_min));
    const [dteMax, setDteMax] = useState(String(DEFAULTS.dte_max));
    const [tpPct, setTpPct] = useState(String(Math.round(DEFAULTS.tp_pct * 100)));
    const [slPct, setSlPct] = useState(String(Math.round(DEFAULTS.sl_pct * 100)));
    const [bidDiscount, setBidDiscount] = useState(String(Math.round(DEFAULTS.bid_discount * 100)));

    // Confirmation modal
    const [showConfirm, setShowConfirm] = useState(false);

    // Recent trades
    const [trades, setTrades] = useState<AutoTrade[]>([]);
    const [loadingTrades, setLoadingTrades] = useState(true);

    // Validation errors
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // ── Fetch settings ──
    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);

            const { data, error } = await supabase
                .from('auto_trade_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                // New user — no row yet, will upsert on first save
                return;
            }

            setEnabled(data.enabled ?? DEFAULTS.enabled);
            setBroker(data.broker ?? DEFAULTS.broker);
            setBudget(String(data.budget ?? DEFAULTS.budget));
            setMaxDaily(String(data.max_daily ?? DEFAULTS.max_daily));
            setMinTier(data.min_tier ?? DEFAULTS.min_tier);
            setOptionTypes(data.option_types ?? DEFAULTS.option_types);
            setDteMin(String(data.dte_min ?? DEFAULTS.dte_min));
            setDteMax(String(data.dte_max ?? DEFAULTS.dte_max));
            setTpPct(String(Math.round((data.tp_pct ?? DEFAULTS.tp_pct) * 100)));
            setSlPct(String(Math.round((data.sl_pct ?? DEFAULTS.sl_pct) * 100)));
            setBidDiscount(String(Math.round((data.bid_discount ?? DEFAULTS.bid_discount) * 100)));
        } catch (err) {
            console.error('Failed to fetch auto-trade settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    const fetchTrades = useCallback(async () => {
        try {
            setLoadingTrades(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('auto_trades')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setTrades(data || []);
        } catch (err) {
            console.error('Failed to fetch auto-trades:', err);
        } finally {
            setLoadingTrades(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchTrades();
    }, [fetchSettings, fetchTrades]);

    // ── Validation ──
    const validate = (): string[] => {
        const errs: string[] = [];
        if ((parseFloat(budget) || 0) <= 0) errs.push('Budget must be greater than $0');
        const md = parseInt(maxDaily) || 0;
        if (md < 1 || md > 10) errs.push('Max trades per day must be 1-10');
        if ((parseInt(dteMin) || 0) >= (parseInt(dteMax) || 0)) errs.push('DTE min must be less than DTE max');
        if (optionTypes.length === 0) errs.push('At least one option type must be selected');
        if ((parseFloat(tpPct) || 0) <= 0) errs.push('Take profit must be greater than 0%');
        if ((parseFloat(slPct) || 0) <= 0) errs.push('Stop loss must be greater than 0%');
        return errs;
    };

    // ── Build payload (shared by save + toggle) ──
    const buildPayload = (overrides: Record<string, any> = {}) => {
        return {
            user_id: userId,
            enabled,
            broker,
            budget: parseFloat(budget) || DEFAULTS.budget,
            max_daily: parseInt(maxDaily) || DEFAULTS.max_daily,
            min_tier: minTier,
            option_types: optionTypes,
            dte_min: parseInt(dteMin) || DEFAULTS.dte_min,
            dte_max: parseInt(dteMax) || DEFAULTS.dte_max,
            tp_pct: (parseFloat(tpPct) || 30) / 100,
            sl_pct: (parseFloat(slPct) || 15) / 100,
            bid_discount: (parseFloat(bidDiscount) || 15) / 100,
            updated_at: new Date().toISOString(),
            ...overrides,
        };
    };

    // ── Save ──
    const handleSave = async () => {
        const errs = validate();
        if (errs.length > 0) {
            setValidationErrors(errs);
            return;
        }
        setValidationErrors([]);

        if (!userId) return;
        setSaving(true);
        setSaveStatus('idle');

        try {
            const { error } = await supabase
                .from('auto_trade_settings')
                .upsert(buildPayload(), { onConflict: 'user_id' });
            if (error) throw error;
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    // ── Enable toggle (auto-saves to DB) ──
    const handleToggleEnable = () => {
        if (!enabled) {
            setShowConfirm(true);
        } else {
            // Disable immediately and save
            setEnabled(false);
            if (userId) {
                supabase
                    .from('auto_trade_settings')
                    .upsert({ ...buildPayload(), enabled: false }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                        if (error) console.error('Failed to disable auto-trade:', error);
                    });
            }
        }
    };

    const confirmEnable = () => {
        setEnabled(true);
        setShowConfirm(false);
        // Save enabled=true to DB immediately
        if (userId) {
            supabase
                .from('auto_trade_settings')
                .upsert({ ...buildPayload(), enabled: true }, { onConflict: 'user_id' })
                .then(({ error }) => {
                    if (error) console.error('Failed to enable auto-trade:', error);
                });
        }
    };

    // ── Option type toggle ──
    const toggleOptionType = (type: string) => {
        if (optionTypes.includes(type)) {
            if (optionTypes.length > 1) {
                setOptionTypes(optionTypes.filter(t => t !== type));
            }
        } else {
            setOptionTypes([...optionTypes, type]);
        }
    };

    // ── Live example calc ──
    const exampleBid = 2.00;
    const calcLimit = useMemo(() => exampleBid * (1 - (parseFloat(bidDiscount) || 0) / 100), [bidDiscount]);
    const calcTp = useMemo(() => calcLimit * (1 + (parseFloat(tpPct) || 0) / 100), [calcLimit, tpPct]);
    const calcSl = useMemo(() => calcLimit * (1 - (parseFloat(slPct) || 0) / 100), [calcLimit, slPct]);

    // ── Loading state ──
    if (loadingSettings) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <span className="material-symbols-outlined text-3xl text-gray-600 animate-spin">sync</span>
                    <p className="text-gray-500 text-sm">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#0a0712]">
            <div className="max-w-2xl mx-auto p-8 space-y-6">

                {/* ── Section 1: Header + Master Toggle ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400 text-lg">bolt</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase tracking-tight">Auto-Trade</h1>
                                <p className="text-gray-500 text-xs">Automatically buy options when strong swing signals are detected</p>
                            </div>
                        </div>
                        <Toggle on={enabled} onToggle={handleToggleEnable} size="lg" />
                    </div>

                    {enabled && (
                        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">fiber_manual_record</span>
                            <p className="text-emerald-300/90 text-xs font-medium">
                                Active — polling <strong className="text-emerald-200">swing_trade</strong> for <strong className="text-emerald-200">{minTier}+</strong> signals
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Section 2: Trade Parameters ── */}
                <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-gray-600">tune</span>
                        Trade Parameters
                    </h2>

                    <Row label="Broker" sub="Which broker to route orders to">
                        <div className="flex gap-2">
                            <Pill label="Schwab" active={broker === 'schwab'} onClick={() => setBroker('schwab')}
                                activeClass="bg-blue-600/20 text-blue-400 border-blue-500 shadow-lg shadow-blue-500/10" />
                            <Pill label="Alpaca" active={broker === 'alpaca'} onClick={() => setBroker('alpaca')}
                                activeClass="bg-orange-600/20 text-orange-400 border-orange-500 shadow-lg shadow-orange-500/10" />
                        </div>
                    </Row>

                    <Row label="Minimum Signal Tier" sub="Only trade signals of this quality or better">
                        <div className="flex gap-2">
                            <Pill label="A+" active={minTier === 'A+'} onClick={() => setMinTier('A+')}
                                activeClass="bg-amber-600/20 text-amber-400 border-amber-500 shadow-lg shadow-amber-500/10" />
                            <Pill label="A" active={minTier === 'A'} onClick={() => setMinTier('A')}
                                activeClass="bg-amber-600/20 text-amber-400 border-amber-500 shadow-lg shadow-amber-500/10" />
                        </div>
                    </Row>

                    <Row label="Option Types" sub="Which directions to trade">
                        <div className="flex gap-2">
                            <Pill label="CALL" active={optionTypes.includes('CALL')} onClick={() => toggleOptionType('CALL')}
                                activeClass="bg-green-600/20 text-green-400 border-green-500 shadow-lg shadow-green-500/10" />
                            <Pill label="PUT" active={optionTypes.includes('PUT')} onClick={() => toggleOptionType('PUT')}
                                activeClass="bg-red-600/20 text-red-400 border-red-500 shadow-lg shadow-red-500/10" />
                        </div>
                    </Row>

                    <Row label="Budget per Trade" sub="Dollar amount per trade">
                        <NumInput value={budget} onChange={setBudget} prefix="$" />
                    </Row>

                    <Row label="Max Trades per Day" sub="Limit daily order count (1-10)">
                        <NumInput value={maxDaily} onChange={setMaxDaily} width="w-20" />
                    </Row>

                    <Row label="DTE Range" sub="Days to expiration window">
                        <div className="flex items-center gap-2">
                            <NumInput value={dteMin} onChange={setDteMin} width="w-16" />
                            <span className="text-gray-600 text-xs font-bold">to</span>
                            <NumInput value={dteMax} onChange={setDteMax} width="w-16" />
                            <span className="text-gray-600 text-[10px]">days</span>
                        </div>
                    </Row>
                </div>

                {/* ── Section 3: Bracket Order / Exit Strategy ── */}
                <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-gray-600">shield</span>
                        Bracket Order (Exit Strategy)
                    </h2>

                    <Row label="Take Profit" sub="Sell when premium rises by">
                        <NumInput value={tpPct} onChange={setTpPct} suffix="%" width="w-20"
                            className="!border-green-500/30 focus:!border-green-500 !text-green-400" />
                    </Row>

                    <Row label="Stop Loss" sub="Cut loss when premium drops by">
                        <NumInput value={slPct} onChange={setSlPct} suffix="%" width="w-20"
                            className="!border-red-500/30 focus:!border-red-500 !text-red-400" />
                    </Row>

                    <Row label="Bid Discount" sub="Limit price set below bid">
                        <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" width="w-20"
                            className="!border-blue-500/30 focus:!border-blue-500 !text-blue-400" />
                    </Row>

                    {/* Live Example Calculator */}
                    <div className="mt-4 bg-[#0d1117] rounded-xl border border-gray-800/30 p-4 space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="material-symbols-outlined text-gray-600 text-xs">calculate</span>
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Live Example · $2.00 Bid</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Limit Price</p>
                                <p className="text-blue-400 font-mono font-black text-sm mt-0.5">${calcLimit.toFixed(2)}</p>
                                <p className="text-[9px] text-gray-600">bid - {bidDiscount}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-green-500 uppercase tracking-wider font-bold">Take Profit</p>
                                <p className="text-green-400 font-mono font-black text-sm mt-0.5">${calcTp.toFixed(2)}</p>
                                <p className="text-[9px] text-gray-600">+{tpPct}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-red-500 uppercase tracking-wider font-bold">Stop Loss</p>
                                <p className="text-red-400 font-mono font-black text-sm mt-0.5">${calcSl.toFixed(2)}</p>
                                <p className="text-[9px] text-gray-600">-{slPct}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Validation Errors ── */}
                {validationErrors.length > 0 && (
                    <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 space-y-1">
                        {validationErrors.map((err, i) => (
                            <div key={i} className="flex items-center gap-2 text-red-400 text-xs">
                                <span className="material-symbols-outlined text-xs">error</span>
                                {err}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Section 4: Save Button ── */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                    {saving ? (
                        <>
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                            Saving...
                        </>
                    ) : saveStatus === 'saved' ? (
                        <>
                            <span className="material-symbols-outlined text-sm text-green-400">check_circle</span>
                            <span className="text-green-400">Saved</span>
                        </>
                    ) : saveStatus === 'error' ? (
                        <>
                            <span className="material-symbols-outlined text-sm text-red-400">error</span>
                            <span className="text-red-400">Failed to Save</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-sm">save</span>
                            Save Settings
                        </>
                    )}
                </button>

                {/* ── Section 5: Recent Auto-Trades ── */}
                {trades.length > 0 && (
                    <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-gray-600">history</span>
                            Recent Auto-Trades
                        </h2>

                        <div className="space-y-2">
                            {trades.map((t) => (
                                <div key={t.id} className="flex items-center justify-between py-2.5 px-3 bg-[#0d1117] rounded-xl border border-gray-800/30 hover:border-gray-700/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.option_type === 'CALL' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {t.option_type}
                                        </span>
                                        <div>
                                            <span className="text-white font-black text-sm">{t.symbol}</span>
                                            <span className="text-gray-600 text-[10px] ml-1.5 font-bold">Tier {t.signal_tier}</span>
                                        </div>
                                        <span className="text-gray-600 text-[10px] font-mono uppercase">{t.broker}</span>
                                        {t.order_type === 'bracket' && <span title="Bracket order">🛡️</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-white font-mono text-xs font-bold">${t.total_cost?.toFixed(0)}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${t.order_status === 'FILLED' || t.order_status === 'SUBMITTED' ? 'bg-green-500/10 text-green-400' :
                                            t.order_status === 'ERROR' ? 'bg-red-500/10 text-red-400' :
                                                'bg-gray-500/10 text-gray-400'
                                            }`}>
                                            {t.order_status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!loadingTrades && trades.length === 0 && (
                            <p className="text-gray-600 text-xs text-center py-4">No auto-trades yet</p>
                        )}
                    </div>
                )}

            </div>

            {/* ── Confirmation Modal ── */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowConfirm(false)}>
                    <div className="bg-[#0f1219] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-gray-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-yellow-400 text-lg">warning</span>
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-sm uppercase tracking-tight">Enable Auto-Trading?</h2>
                                    <p className="text-yellow-400/80 text-[11px] mt-0.5">This will place real orders with your broker</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-3">
                            <p className="text-gray-400 text-xs leading-relaxed">
                                When enabled, the system will automatically place options orders when strong signals are detected. Please review your settings:
                            </p>
                            <div className="bg-[#0d1117] rounded-xl border border-gray-800/30 p-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Broker</span>
                                    <span className="text-white font-bold uppercase">{broker}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Budget per Trade</span>
                                    <span className="text-white font-mono font-bold">${budget}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Max Daily Trades</span>
                                    <span className="text-white font-mono font-bold">{maxDaily}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Min Tier</span>
                                    <span className="text-amber-400 font-bold">{minTier}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Bracket Protection</span>
                                    <span className="text-white font-mono">TP {tpPct}% / SL {slPct}%</span>
                                </div>
                            </div>

                            <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-lg p-3">
                                <p className="text-yellow-300/80 text-[11px] leading-relaxed">
                                    ⚠️ Real money will be used. Ensure your broker is connected and funded. You can disable auto-trading at any time.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-800 flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2.5 bg-[#1a1f2e] hover:bg-[#252b3d] text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmEnable}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">check</span>
                                Enable Auto-Trade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoTradeSettings;
