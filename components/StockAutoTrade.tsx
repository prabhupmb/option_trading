import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

/* ─── Sub-Components (matching AutoTradeSettings pattern) ─── */

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
    activeClass?: string;
}> = ({ label, active, onClick, activeClass = 'bg-blue-600/20 text-blue-400 border-blue-500' }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${active ? activeClass : 'bg-[#0d1117] text-gray-500 border-gray-700 hover:border-gray-600'}`}
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
            className={`w-full bg-[#0d1117] border border-gray-700 focus:border-emerald-500 rounded-lg py-2 text-white font-mono font-bold text-sm outline-none transition-colors text-right ${prefix ? 'pl-6 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'} ${className}`}
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
                className="rounded-full bg-white absolute transition-all"
                style={{
                    width: isSm ? '16px' : '22px',
                    height: isSm ? '16px' : '22px',
                    top: isSm ? '2px' : '3px',
                    left: on ? (isSm ? '22px' : '30px') : '2px',
                }}
            />
        </button>
    );
};

/* ─── Types ─── */

interface StockAutoTradeSettingsType {
    enabled: boolean;
    broker: string;
    budget: number;
    max_daily: number;
    min_tier: string;
    trade_side: string[];
    tp_pct: number;
    sl_pct: number;
    use_limit: boolean;
    bid_discount: number;
}

interface StockAutoTrade {
    id: string;
    symbol: string;
    signal_tier: string;
    trade_side: string;
    current_price: number;
    entry_price: number;
    quantity: number;
    total_cost: number;
    broker: string;
    order_id: string | null;
    order_status: string;
    order_type: string;
    error_message: string | null;
    submitted_at: string | null;
    created_at: string;
}

/* ─── Defaults ─── */

const DEFAULTS: StockAutoTradeSettingsType = {
    enabled: false,
    broker: 'alpaca',
    budget: 500,
    max_daily: 2,
    min_tier: 'A+',
    trade_side: ['LONG'],
    tp_pct: 0.05,
    sl_pct: 0.03,
    use_limit: true,
    bid_discount: 0.005,
};

/* ─── Helpers ─── */

const fmtTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/* ─── Main Component ─── */

const StockAutoTrade: React.FC = () => {
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [userId, setUserId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Settings
    const [enabled, setEnabled] = useState(DEFAULTS.enabled);
    const [budget, setBudget] = useState(String(DEFAULTS.budget));
    const [maxDaily, setMaxDaily] = useState(String(DEFAULTS.max_daily));
    const [minTier, setMinTier] = useState(DEFAULTS.min_tier);
    const [tradeSide, setTradeSide] = useState<string[]>(DEFAULTS.trade_side);
    const [tpPct, setTpPct] = useState(String(Math.round(DEFAULTS.tp_pct * 100)));
    const [slPct, setSlPct] = useState(String(Math.round(DEFAULTS.sl_pct * 100)));
    const [useLimit, setUseLimit] = useState(DEFAULTS.use_limit);
    const [bidDiscount, setBidDiscount] = useState(String(+(DEFAULTS.bid_discount * 100).toFixed(1)));

    // Recent trades
    const [trades, setTrades] = useState<StockAutoTrade[]>([]);
    const [loadingTrades, setLoadingTrades] = useState(true);

    // Validation
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    /* ── Fetch settings ── */
    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);

            const { data, error } = await supabase
                .from('stock_auto_trade_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;
            if (!data) return;

            setEnabled(data.enabled ?? DEFAULTS.enabled);
            setBudget(String(data.budget ?? DEFAULTS.budget));
            setMaxDaily(String(data.max_daily ?? DEFAULTS.max_daily));
            setMinTier(data.min_tier ?? DEFAULTS.min_tier);
            // trade_side may come from Postgres as {LONG} array or JS array
            const sides = Array.isArray(data.trade_side)
                ? data.trade_side
                : typeof data.trade_side === 'string'
                    ? data.trade_side.replace(/[{}]/g, '').split(',').filter(Boolean)
                    : DEFAULTS.trade_side;
            setTradeSide(sides);
            setTpPct(String(Math.round((data.tp_pct ?? DEFAULTS.tp_pct) * 100)));
            setSlPct(String(Math.round((data.sl_pct ?? DEFAULTS.sl_pct) * 100)));
            setUseLimit(data.use_limit ?? DEFAULTS.use_limit);
            setBidDiscount(String(+((data.bid_discount ?? DEFAULTS.bid_discount) * 100).toFixed(1)));
        } catch (err) {
            console.error('Failed to fetch stock auto-trade settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    const fetchTrades = useCallback(async () => {
        try {
            setLoadingTrades(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('stock_auto_trades')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setTrades(data || []);
        } catch (err) {
            console.error('Failed to fetch stock auto-trades:', err);
        } finally {
            setLoadingTrades(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchTrades();
    }, [fetchSettings, fetchTrades]);

    /* ── Validation ── */
    const validate = (): string[] => {
        const errs: string[] = [];
        const b = parseFloat(budget) || 0;
        if (b < 50 || b > 10000) errs.push('Budget must be between $50 and $10,000');
        const md = parseInt(maxDaily) || 0;
        if (md < 1 || md > 10) errs.push('Max trades per day must be 1–10');
        if (tradeSide.length === 0) errs.push('At least one trade side must be selected');
        const tp = parseFloat(tpPct) || 0;
        if (tp < 1 || tp > 50) errs.push('Take profit must be 1–50%');
        const sl = parseFloat(slPct) || 0;
        if (sl < 1 || sl > 30) errs.push('Stop loss must be 1–30%');
        if (useLimit) {
            const bd = parseFloat(bidDiscount) || 0;
            if (bd < 0.1 || bd > 5) errs.push('Bid discount must be 0.1–5%');
        }
        return errs;
    };

    /* ── Build payload ── */
    const buildPayload = (overrides: Record<string, unknown> = {}) => ({
        user_id: userId,
        enabled,
        broker: 'alpaca',
        budget: parseFloat(budget) || DEFAULTS.budget,
        max_daily: parseInt(maxDaily) || DEFAULTS.max_daily,
        min_tier: minTier,
        trade_side: tradeSide,
        tp_pct: (parseFloat(tpPct) || 5) / 100,
        sl_pct: (parseFloat(slPct) || 3) / 100,
        use_limit: useLimit,
        bid_discount: (parseFloat(bidDiscount) || 0.5) / 100,
        updated_at: new Date().toISOString(),
        ...overrides,
    });

    /* ── Save ── */
    const handleSave = async () => {
        const errs = validate();
        if (errs.length > 0) { setValidationErrors(errs); return; }
        setValidationErrors([]);
        if (!userId) return;
        setSaving(true);
        setSaveStatus('idle');
        try {
            const { error } = await supabase
                .from('stock_auto_trade_settings')
                .upsert(buildPayload(), { onConflict: 'user_id' });
            if (error) throw error;
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    /* ── Enable toggle ── */
    const handleToggleEnable = () => {
        if (!enabled) {
            setShowConfirm(true);
        } else {
            setEnabled(false);
            if (userId) {
                supabase.from('stock_auto_trade_settings')
                    .upsert({ ...buildPayload(), enabled: false }, { onConflict: 'user_id' })
                    .then(({ error }) => { if (error) console.error('Disable failed:', error); });
            }
        }
    };

    const confirmEnable = () => {
        setEnabled(true);
        setShowConfirm(false);
        if (userId) {
            supabase.from('stock_auto_trade_settings')
                .upsert({ ...buildPayload(), enabled: true }, { onConflict: 'user_id' })
                .then(({ error }) => { if (error) console.error('Enable failed:', error); });
        }
    };

    /* ── Trade side toggle (multi-select, min 1) ── */
    const toggleTradeSide = (side: string) => {
        if (tradeSide.includes(side)) {
            if (tradeSide.length > 1) setTradeSide(tradeSide.filter(s => s !== side));
        } else {
            setTradeSide([...tradeSide, side]);
        }
    };

    /* ── Order preview sentence ── */
    const previewText = useMemo(() => {
        const sides = tradeSide.join(' & ');
        const tierLabel = minTier === 'A+' ? 'A+' : 'A+ and A';
        const orderType = useLimit ? `limit order (${bidDiscount}% below ask)` : 'market order';
        return `When a ${tierLabel} tier ${sides} signal appears on stock_gate_positions → buy $${budget} worth of shares via Alpaca using a ${orderType} → bracket TP +${tpPct}% / SL -${slPct}% → max ${maxDaily} trade${parseInt(maxDaily) !== 1 ? 's' : ''}/day`;
    }, [minTier, tradeSide, budget, useLimit, bidDiscount, tpPct, slPct, maxDaily]);

    /* ── Loading ── */
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

                {/* ── Header + Master Toggle ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-emerald-400 text-lg">show_chart</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase tracking-tight">Stock Auto-Trade</h1>
                                <p className="text-gray-500 text-xs">Automatically buy stocks when strong gate signals are detected</p>
                            </div>
                        </div>
                        <Toggle on={enabled} onToggle={handleToggleEnable} size="lg" />
                    </div>

                    {/* Status bar */}
                    <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2.5 border transition-all ${enabled
                            ? 'bg-emerald-950/20 border-emerald-900/30'
                            : 'bg-[#161b22] border-gray-800/50'
                        }`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                        <p className={`text-xs font-medium ${enabled ? 'text-emerald-300/90' : 'text-gray-500'}`}>
                            {enabled
                                ? <>Active — polling <strong className="text-emerald-200">stock_gate_positions</strong> for <strong className="text-emerald-200">{minTier}+</strong> signals</>
                                : 'Disabled — no orders will be placed'
                            }
                        </p>
                    </div>
                </div>

                {/* ── Card 1: Trade Parameters ── */}
                <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-gray-600">tune</span>
                        Trade Parameters
                    </h2>

                    {/* Broker — Alpaca only */}
                    <Row label="Broker" sub="Stock auto-trade routes via Alpaca">
                        <span className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border bg-orange-600/20 text-orange-400 border-orange-500">
                            ALPACA
                        </span>
                    </Row>

                    {/* Min Tier */}
                    <Row label="Minimum Signal Tier" sub="Only trade signals of this quality or better">
                        <div className="flex gap-2">
                            <Pill label="A+" active={minTier === 'A+'} onClick={() => setMinTier('A+')}
                                activeClass="bg-amber-600/20 text-amber-400 border-amber-500 shadow-lg shadow-amber-500/10" />
                            <Pill label="A" active={minTier === 'A'} onClick={() => setMinTier('A')}
                                activeClass="bg-amber-600/20 text-amber-400 border-amber-500 shadow-lg shadow-amber-500/10" />
                        </div>
                    </Row>

                    {/* Trade Side */}
                    <Row label="Trade Side" sub="Which direction(s) to trade (multi-select)">
                        <div className="flex gap-2">
                            <Pill label="LONG" active={tradeSide.includes('LONG')} onClick={() => toggleTradeSide('LONG')}
                                activeClass="bg-green-600/20 text-green-400 border-green-500 shadow-lg shadow-green-500/10" />
                            <Pill label="SHORT" active={tradeSide.includes('SHORT')} onClick={() => toggleTradeSide('SHORT')}
                                activeClass="bg-red-600/20 text-red-400 border-red-500 shadow-lg shadow-red-500/10" />
                        </div>
                    </Row>

                    {/* Budget */}
                    <Row label="Budget per Trade" sub="Dollar amount per stock trade ($50–$10,000)">
                        <NumInput value={budget} onChange={setBudget} prefix="$" />
                    </Row>

                    {/* Max Daily */}
                    <Row label="Max Trades per Day" sub="Limit daily order count (1–10)">
                        <NumInput value={maxDaily} onChange={setMaxDaily} width="w-20" />
                    </Row>

                    {/* Limit Orders toggle */}
                    <Row label="Limit Orders" sub="Buy at a discount below current ask price">
                        <Toggle on={useLimit} onToggle={() => setUseLimit(!useLimit)} size="sm" />
                    </Row>

                    {/* Bid Discount — only when useLimit=true */}
                    {useLimit && (
                        <Row label="Bid Discount" sub="How far below ask price to set limit (0.1–5%)">
                            <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" width="w-20"
                                className="!border-blue-500/30 focus:!border-blue-500 !text-blue-400" />
                        </Row>
                    )}
                </div>

                {/* ── Card 2: Bracket Order / Exit Strategy ── */}
                <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-gray-600">shield</span>
                        Bracket Order (Exit Strategy)
                    </h2>

                    <Row label="Take Profit" sub="Sell when stock price rises by">
                        <NumInput value={tpPct} onChange={setTpPct} suffix="%" width="w-20"
                            className="!border-green-500/30 focus:!border-green-500 !text-green-400" />
                    </Row>

                    <Row label="Stop Loss" sub="Cut loss when stock price drops by">
                        <NumInput value={slPct} onChange={setSlPct} suffix="%" width="w-20"
                            className="!border-red-500/30 focus:!border-red-500 !text-red-400" />
                    </Row>

                    {/* Live price example */}
                    <div className="mt-4 bg-[#0d1117] rounded-xl border border-gray-800/30 p-4 space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="material-symbols-outlined text-gray-600 text-xs">calculate</span>
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Live Example · $150.00 Stock</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            {[
                                {
                                    label: 'Entry',
                                    value: useLimit ? `$${(150 * (1 - (parseFloat(bidDiscount) || 0) / 100)).toFixed(2)}` : '$150.00',
                                    color: 'text-blue-400',
                                    sub: useLimit ? `-${bidDiscount}%` : 'market',
                                },
                                {
                                    label: 'Take Profit',
                                    value: `$${(150 * (1 + (parseFloat(tpPct) || 0) / 100)).toFixed(2)}`,
                                    color: 'text-green-400',
                                    sub: `+${tpPct}%`,
                                },
                                {
                                    label: 'Stop Loss',
                                    value: `$${(150 * (1 - (parseFloat(slPct) || 0) / 100)).toFixed(2)}`,
                                    color: 'text-red-400',
                                    sub: `-${slPct}%`,
                                },
                            ].map(({ label, value, color, sub }) => (
                                <div key={label}>
                                    <p className={`text-[10px] uppercase tracking-wider font-bold ${color}`}>{label}</p>
                                    <p className={`${color} font-mono font-black text-sm mt-0.5`}>{value}</p>
                                    <p className="text-[9px] text-gray-600">{sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Order Preview ── */}
                <div className="rounded-xl border border-dashed border-gray-700 p-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-gray-500 text-base flex-shrink-0 mt-0.5">description</span>
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Order Preview</p>
                        <p className="text-xs text-gray-300 leading-relaxed">{previewText}</p>
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

                {/* ── Save Button ── */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                    style={{
                        background: saveStatus === 'error' ? '#f85149' : saveStatus === 'saved' ? '#2ea043' : saving ? '' : '#2ea043',
                        boxShadow: saveStatus === 'saved' || (!saving && saveStatus === 'idle') ? '0 4px 20px rgba(46,160,67,0.25)' : '',
                    }}
                >
                    {saving ? (
                        <><span className="material-symbols-outlined text-sm animate-spin">sync</span> Saving...</>
                    ) : saveStatus === 'saved' ? (
                        <><span className="material-symbols-outlined text-sm">check_circle</span> Settings Saved</>
                    ) : saveStatus === 'error' ? (
                        <><span className="material-symbols-outlined text-sm">error</span> Failed to Save — Try Again</>
                    ) : (
                        <><span className="material-symbols-outlined text-sm">save</span> Save Stock Auto-Trade Settings</>
                    )}
                </button>

                {/* ── Recent Stock Auto-Trades (Today) ── */}
                <div className="bg-[#0f1219] rounded-2xl border border-gray-800/60 p-5">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-gray-600">history</span>
                        Recent Stock Auto-Trades (Today)
                    </h2>

                    {loadingTrades ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 rounded-xl bg-[#0d1117] animate-pulse border border-gray-800/30" />
                            ))}
                        </div>
                    ) : trades.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-3xl text-gray-700 block mb-2">show_chart</span>
                            <p className="text-gray-600 text-xs">No stock auto-trades today</p>
                            <p className="text-gray-700 text-[10px] mt-1">Enable auto-trade and trades will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {trades.map((t) => {
                                const isOk = t.order_status === 'FILLED' || t.order_status === 'SUBMITTED' || t.order_status === 'ACCEPTED';
                                const isErr = t.order_status === 'ERROR' || t.order_status === 'FAILED';
                                return (
                                    <div
                                        key={t.id}
                                        className={`flex items-center justify-between py-2.5 px-3 rounded-xl border transition-colors ${isOk
                                                ? 'bg-emerald-950/15 border-emerald-900/25 hover:border-emerald-800/40'
                                                : isErr
                                                    ? 'bg-red-950/15 border-red-900/25 hover:border-red-800/40'
                                                    : 'bg-[#0d1117] border-gray-800/30 hover:border-gray-700/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Status icon */}
                                            <span className={`material-symbols-outlined text-sm flex-shrink-0 ${isOk ? 'text-emerald-400' : isErr ? 'text-red-400' : 'text-gray-500'}`}>
                                                {isOk ? 'check_circle' : isErr ? 'cancel' : 'pending'}
                                            </span>

                                            {/* Side badge */}
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${t.trade_side === 'LONG'
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                {t.trade_side}
                                            </span>

                                            {/* Symbol + tier */}
                                            <div className="min-w-0">
                                                <span className="text-white font-black text-sm">{t.symbol}</span>
                                                <span className="text-amber-400/70 text-[10px] ml-1.5 font-bold">{t.signal_tier}</span>
                                                {t.error_message ? (
                                                    <p className="text-red-400/80 text-[10px] truncate max-w-[180px]">{t.error_message}</p>
                                                ) : (
                                                    <p className="text-gray-600 text-[10px]">
                                                        {t.quantity} share{t.quantity !== 1 ? 's' : ''} @ <span className="font-mono">${(t.entry_price || t.current_price)?.toFixed(2)}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                            {t.total_cost && (
                                                <span className="text-white font-mono text-xs font-bold">${t.total_cost.toFixed(0)}</span>
                                            )}
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isOk ? 'bg-green-500/10 text-green-400' : isErr ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'
                                                }`}>
                                                {t.order_status}
                                            </span>
                                            <span className="text-gray-700 text-[10px] font-mono">{fmtTime(t.submitted_at || t.created_at)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* ── Confirmation Modal ── */}
            {showConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={() => setShowConfirm(false)}
                >
                    <div
                        className="bg-[#0f1219] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-yellow-400 text-lg">warning</span>
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-sm uppercase tracking-tight">Enable Stock Auto-Trading?</h2>
                                    <p className="text-yellow-400/80 text-[11px] mt-0.5">This will place real orders via Alpaca</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-3">
                            <p className="text-gray-400 text-xs leading-relaxed">
                                When enabled, the system will automatically buy stocks when strong gate signals are detected. Review your settings:
                            </p>
                            <div className="bg-[#0d1117] rounded-xl border border-gray-800/30 p-4 space-y-2">
                                {[
                                    { label: 'Broker', value: 'ALPACA', mono: false },
                                    { label: 'Budget per Trade', value: `$${budget}`, mono: true },
                                    { label: 'Max Daily Trades', value: maxDaily, mono: true },
                                    { label: 'Min Tier', value: minTier, mono: false, color: 'text-amber-400' },
                                    { label: 'Trade Side', value: tradeSide.join(', '), mono: false },
                                    { label: 'Bracket Protection', value: `TP +${tpPct}% / SL -${slPct}%`, mono: true },
                                ].map(({ label, value, mono, color }) => (
                                    <div key={label} className="flex justify-between text-xs">
                                        <span className="text-gray-500">{label}</span>
                                        <span className={`font-bold uppercase ${color || 'text-white'} ${mono ? 'font-mono' : ''}`}>{value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-lg p-3">
                                <p className="text-yellow-300/80 text-[11px] leading-relaxed">
                                    Real money will be used. Ensure your Alpaca account is connected and funded. You can disable at any time.
                                </p>
                            </div>
                        </div>

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

export default StockAutoTrade;
