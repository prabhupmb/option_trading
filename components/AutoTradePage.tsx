import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

/* ─── DESIGN TOKENS ─────────────────────────────────────── */
const C = {
    bg: '#0b0e13',
    surface: '#171c27',
    cardAlt: '#1a2030',
    border: '#252d3a',
    text: '#e2e8f0',
    textSec: '#94a3b8',
    textMuted: '#5e6b80',
    textFaint: '#3a4555',
    green: '#22c55e',
    greenBg: 'rgba(34,197,94,0.10)',
    greenBdr: 'rgba(34,197,94,0.25)',
    red: '#ef4444',
    redBg: 'rgba(239,68,68,0.10)',
    redBdr: 'rgba(239,68,68,0.25)',
    amber: '#f59e0b',
    amberBg: 'rgba(245,158,11,0.12)',
    amberBdr: 'rgba(245,158,11,0.30)',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    purple: '#a78bfa',
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

/* ─── SHARED UI PRIMITIVES ──────────────────────────────── */

const Row: React.FC<{ label: string; hint?: string; last?: boolean; children: React.ReactNode }> =
    ({ label, hint, last, children }) => (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: last ? 'none' : `1px solid ${C.border}26`,
        }}>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: SANS }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS, marginTop: 2 }}>{hint}</div>}
            </div>
            <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
        </div>
    );

const Pill: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> =
    ({ label, active, onClick, color = C.blue }) => (
        <button onClick={onClick} style={{
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${active ? color : C.border}`,
            background: active ? `${color}2E` : 'transparent',
            color: active ? color : C.textMuted,
            fontSize: 11, fontWeight: 700, fontFamily: MONO,
            letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.15s',
        }}>{label}</button>
    );

const NumInput: React.FC<{
    value: string; onChange: (v: string) => void;
    prefix?: string; suffix?: string; accent?: string; width?: number;
}> = ({ value, onChange, prefix, suffix, accent = C.green, width = 64 }) => {
    const [focused, setFocused] = useState(false);
    const totalWidth = width + (prefix || suffix ? 24 : 0);
    return (
        <div style={{ position: 'relative', width: totalWidth }}>
            {prefix && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 12, fontFamily: MONO, pointerEvents: 'none' }}>{prefix}</span>}
            <input
                type="text" inputMode="decimal" value={value}
                onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                style={{
                    width: '100%', boxSizing: 'border-box',
                    background: C.bg, borderRadius: 6, outline: 'none',
                    border: `1px solid ${focused ? accent : C.border}`,
                    boxShadow: focused ? `0 0 0 2px ${accent}33` : 'none',
                    padding: prefix ? '6px 8px 6px 20px' : suffix ? '6px 22px 6px 8px' : '6px 8px',
                    color: C.text, fontSize: 13, fontWeight: 600, fontFamily: MONO,
                    textAlign: 'right', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
            />
            {suffix && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 12, fontFamily: MONO, pointerEvents: 'none' }}>{suffix}</span>}
        </div>
    );
};

const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
    <button onClick={onToggle} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? C.green : C.border,
        boxShadow: on ? `0 0 8px ${C.green}55` : 'none',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s, box-shadow 0.2s',
    }}>
        <div style={{
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s',
        }} />
    </button>
);

const SectionTitle: React.FC<{ icon: string; label: string; badge?: string; badgeColor?: string }> =
    ({ icon, label, badge, badgeColor = C.amber }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: C.textMuted, fontFamily: MONO, textTransform: 'uppercase' }}>{label}</span>
            {badge && (
                <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: `${badgeColor}20`, border: `1px solid ${badgeColor}50`,
                    color: badgeColor, fontFamily: MONO, letterSpacing: '0.05em',
                }}>{badge}</span>
            )}
        </div>
    );

const StatusBar: React.FC<{ enabled: boolean; message: string }> = ({ enabled, message }) => (
    <div style={{
        padding: '9px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
        background: enabled ? C.greenBg : C.cardAlt,
        border: `1px solid ${enabled ? C.greenBdr : C.border}`,
    }}>
        <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: enabled ? C.green : C.textFaint,
            boxShadow: enabled ? `0 0 6px ${C.green}` : 'none',
        }} />
        <span style={{ fontSize: 12, fontFamily: MONO, color: enabled ? C.green : C.textMuted }}>{message}</span>
    </div>
);

const Toast: React.FC<{ msg: string; type: 'success' | 'error' }> = ({ msg, type }) => (
    <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        padding: '12px 24px', borderRadius: 8, zIndex: 9999,
        background: type === 'success' ? C.green : C.red,
        color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: MONO,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap',
    }}>{msg}</div>
);

const ConfirmModal: React.FC<{
    title: string; body: string;
    onConfirm: () => void; onCancel: () => void;
}> = ({ title, body, onConfirm, onCancel }) => (
    <div style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }} onClick={onCancel}>
        <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, width: 380, padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.amber, fontFamily: MONO, marginBottom: 10 }}>{title}</div>
            <p style={{ fontSize: 12, color: C.textSec, fontFamily: SANS, lineHeight: 1.7, margin: '0 0 20px' }}>{body}</p>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    background: C.cardAlt, border: `1px solid ${C.border}`,
                    color: C.textSec, fontSize: 12, fontWeight: 700, fontFamily: MONO,
                }}>Cancel</button>
                <button onClick={onConfirm} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    background: C.green, border: 'none',
                    color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: MONO,
                }}>Enable</button>
            </div>
        </div>
    </div>
);

const SaveButton: React.FC<{ saving: boolean; label: string; onClick: () => void; color?: string }> =
    ({ saving, label, onClick, color = C.green }) => (
        <button disabled={saving} onClick={onClick} style={{
            width: '100%', padding: '14px 0', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: saving ? C.border : color,
            color: saving ? C.textMuted : '#fff',
            fontSize: 12, fontWeight: 800, fontFamily: MONO,
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20,
            transition: 'filter 0.15s',
        }}>{saving ? 'Saving...' : label}</button>
    );

const CARD: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '18px 22px', marginBottom: 14,
};

const ErrorList: React.FC<{ errors: string[] }> = ({ errors }) =>
    errors.length === 0 ? null : (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBdr}`, marginBottom: 14 }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: C.red, fontFamily: SANS, marginBottom: i < errors.length - 1 ? 4 : 0 }}>{e}</div>)}
        </div>
    );

/* ─── HELPERS ───────────────────────────────────────────── */
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const todayISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

/* ─── OPTIONS PANEL ─────────────────────────────────────── */

const OPT_DEF = { enabled: false, broker: 'schwab', budget: 250, max_daily: 1, min_tier: 'A+', option_types: ['CALL', 'PUT'], dte_min: 15, dte_max: 20, tp_pct: 0.30, sl_pct: 0.15, bid_discount: 0.15 };

interface OptionTrade { id: string; symbol: string; signal_tier: string; option_type: string; contract_symbol: string; limit_price: number; quantity: number; total_cost: number; order_status: string; error_message: string | null; created_at: string; }

const OptionsPanel: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [enabled, setEnabled] = useState(OPT_DEF.enabled);
    const [broker, setBroker] = useState(OPT_DEF.broker);
    const [budget, setBudget] = useState(String(OPT_DEF.budget));
    const [maxDaily, setMaxDaily] = useState(String(OPT_DEF.max_daily));
    const [minTier, setMinTier] = useState(OPT_DEF.min_tier);
    const [optionTypes, setOptionTypes] = useState<string[]>(OPT_DEF.option_types);
    const [dteMin, setDteMin] = useState(String(OPT_DEF.dte_min));
    const [dteMax, setDteMax] = useState(String(OPT_DEF.dte_max));
    const [tpPct, setTpPct] = useState(String(Math.round(OPT_DEF.tp_pct * 100)));
    const [slPct, setSlPct] = useState(String(Math.round(OPT_DEF.sl_pct * 100)));
    const [bidDiscount, setBidDiscount] = useState(String(Math.round(OPT_DEF.bid_discount * 100)));
    const [trades, setTrades] = useState<OptionTrade[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data } = await supabase.from('auto_trade_settings').select('*').eq('user_id', user.id).maybeSingle();
            if (!data) return;
            setEnabled(data.enabled ?? OPT_DEF.enabled);
            setBroker(data.broker ?? OPT_DEF.broker);
            setBudget(String(data.budget ?? OPT_DEF.budget));
            setMaxDaily(String(data.max_daily ?? OPT_DEF.max_daily));
            setMinTier(data.min_tier ?? OPT_DEF.min_tier);
            setOptionTypes(data.option_types ?? OPT_DEF.option_types);
            setDteMin(String(data.dte_min ?? OPT_DEF.dte_min));
            setDteMax(String(data.dte_max ?? OPT_DEF.dte_max));
            setTpPct(String(Math.round((data.tp_pct ?? OPT_DEF.tp_pct) * 100)));
            setSlPct(String(Math.round((data.sl_pct ?? OPT_DEF.sl_pct) * 100)));
            setBidDiscount(String(Math.round((data.bid_discount ?? OPT_DEF.bid_discount) * 100)));
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    const fetchTrades = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('auto_trades').select('*').eq('user_id', user.id).gte('created_at', todayISO()).order('created_at', { ascending: false }).limit(10);
        setTrades(data || []);
    }, []);

    useEffect(() => { fetchSettings(); fetchTrades(); }, [fetchSettings, fetchTrades]);

    const toggleOptType = (t: string) => setOptionTypes(prev => prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]);

    const payload = (overrides = {}) => ({
        user_id: userId, enabled, broker,
        budget: parseFloat(budget) || OPT_DEF.budget,
        max_daily: parseInt(maxDaily) || OPT_DEF.max_daily,
        min_tier: minTier, option_types: optionTypes,
        dte_min: parseInt(dteMin) || OPT_DEF.dte_min,
        dte_max: parseInt(dteMax) || OPT_DEF.dte_max,
        tp_pct: (parseFloat(tpPct) || 30) / 100,
        sl_pct: (parseFloat(slPct) || 15) / 100,
        bid_discount: (parseFloat(bidDiscount) || 15) / 100,
        updated_at: new Date().toISOString(), ...overrides,
    });

    const validate = () => {
        const e: string[] = [];
        const b = parseFloat(budget) || 0;
        if (b < 50 || b > 5000) e.push('Budget must be $50–$5,000');
        const md = parseInt(maxDaily) || 0;
        if (md < 1 || md > 10) e.push('Max trades/day: 1–10');
        if (optionTypes.length === 0) e.push('Select at least one option type');
        if ((parseInt(dteMin) || 0) >= (parseInt(dteMax) || 0)) e.push('DTE min must be less than DTE max');
        if ((parseFloat(tpPct) || 0) <= 0) e.push('Take profit must be > 0%');
        if ((parseFloat(slPct) || 0) <= 0) e.push('Stop loss must be > 0%');
        return e;
    };

    const handleSave = async () => {
        const errs = validate(); setErrors(errs);
        if (errs.length || !userId) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('auto_trade_settings').upsert(payload(), { onConflict: 'user_id' });
            if (error) throw error;
            showToast('Option auto-trade settings saved', 'success');
        } catch { showToast('Failed to save settings', 'error'); } finally { setSaving(false); }
    };

    const handleToggle = () => {
        if (!enabled) { setShowConfirm(true); return; }
        setEnabled(false);
        if (userId) supabase.from('auto_trade_settings').upsert({ ...payload(), enabled: false }, { onConflict: 'user_id' }).then(() => { });
    };

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 12 }}>Loading settings...</span></div>;

    return (
        <div>
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {showConfirm && <ConfirmModal
                title="Enable Option Auto-Trading?"
                body={`Real options orders will be placed via ${broker.toUpperCase()}. Budget $${budget}/trade, max ${maxDaily}/day. Ensure your broker is connected and funded.`}
                onConfirm={() => { setEnabled(true); setShowConfirm(false); if (userId) supabase.from('auto_trade_settings').upsert({ ...payload(), enabled: true }, { onConflict: 'user_id' }).then(() => { }); }}
                onCancel={() => setShowConfirm(false)}
            />}

            {/* Master toggle header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: SANS }}>Option Auto-Trade</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>Iron Gate signals via Schwab / Alpaca</div>
                </div>
                <ToggleSwitch on={enabled} onToggle={handleToggle} />
            </div>

            <StatusBar enabled={enabled} message={enabled ? `Active — polling iron_gate_positions for ${minTier}+ signals` : 'Disabled — no option orders will be placed'} />

            {/* Trade Parameters */}
            <div style={CARD}>
                <SectionTitle icon="⚙" label="Trade Parameters" />
                <Row label="Broker" hint="Which broker to route options orders to">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="SCHWAB" active={broker === 'schwab'} onClick={() => setBroker('schwab')} color={C.blue} />
                        <Pill label="ALPACA" active={broker === 'alpaca'} onClick={() => setBroker('alpaca')} color={C.blue} />
                    </div>
                </Row>
                <Row label="Minimum Signal Tier" hint="Only trade signals of this quality or better">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="A+" active={minTier === 'A+'} onClick={() => setMinTier('A+')} color={C.amber} />
                        <Pill label="A" active={minTier === 'A'} onClick={() => setMinTier('A')} color={C.green} />
                    </div>
                </Row>
                <Row label="Option Types" hint="Which directions to trade (multi-select)">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="CALL" active={optionTypes.includes('CALL')} onClick={() => toggleOptType('CALL')} color={C.green} />
                        <Pill label="PUT" active={optionTypes.includes('PUT')} onClick={() => toggleOptType('PUT')} color={C.red} />
                    </div>
                </Row>
                <Row label="Budget per Trade" hint="Dollar amount per option trade ($50–$5,000)">
                    <NumInput value={budget} onChange={setBudget} prefix="$" width={80} />
                </Row>
                <Row label="Max Trades per Day" hint="Limit daily order count (1–10)">
                    <NumInput value={maxDaily} onChange={setMaxDaily} width={56} />
                </Row>
                <Row label="DTE Range" hint="Days to expiration window" last>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <NumInput value={dteMin} onChange={setDteMin} width={52} />
                        <span style={{ color: C.textFaint, fontSize: 11, fontFamily: MONO }}>to</span>
                        <NumInput value={dteMax} onChange={setDteMax} width={52} />
                        <span style={{ color: C.textFaint, fontSize: 11, fontFamily: MONO }}>days</span>
                    </div>
                </Row>
            </div>

            {/* Bracket Order */}
            <div style={CARD}>
                <SectionTitle icon="🛡" label="Bracket Order (Exit Strategy)" />
                <Row label="Take Profit" hint="Sell when premium rises by this percentage">
                    <NumInput value={tpPct} onChange={setTpPct} suffix="%" accent={C.green} width={64} />
                </Row>
                <Row label="Stop Loss" hint="Cut loss when premium drops by this percentage">
                    <NumInput value={slPct} onChange={setSlPct} suffix="%" accent={C.red} width={64} />
                </Row>
                <Row label="Bid Discount" hint="Set limit price this % below current bid" last>
                    <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" accent={C.blue} width={64} />
                </Row>
            </div>

            <ErrorList errors={errors} />
            <SaveButton saving={saving} label="Save Option Auto-Trade Settings" onClick={handleSave} color={C.purple} />

            {/* Recent trades */}
            <div style={CARD}>
                <SectionTitle icon="📋" label="Today's Option Trades" />
                {trades.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textFaint, fontSize: 12, fontFamily: MONO }}>No option auto-trades today</div>
                    : trades.map(t => {
                        const ok = ['FILLED', 'SUBMITTED', 'ACCEPTED'].includes(t.order_status);
                        const err = ['ERROR', 'FAILED', 'REJECTED'].includes(t.order_status);
                        return (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '9px 11px', borderRadius: 8, marginBottom: 6,
                                background: ok ? C.greenBg : err ? C.redBg : C.cardAlt,
                                border: `1px solid ${ok ? C.greenBdr : err ? C.redBdr : C.border}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: MONO, background: t.option_type === 'CALL' ? C.greenBg : C.redBg, color: t.option_type === 'CALL' ? C.green : C.red }}>{t.option_type}</span>
                                    <div>
                                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: MONO }}>{t.symbol}</span>
                                        <span style={{ color: C.amber, fontSize: 10, fontFamily: MONO, marginLeft: 6 }}>{t.signal_tier}</span>
                                        {t.error_message
                                            ? <div style={{ color: C.red, fontSize: 10, fontFamily: SANS }}>{t.error_message}</div>
                                            : <div style={{ color: C.textMuted, fontSize: 10, fontFamily: MONO }}>{t.contract_symbol} · ${t.limit_price?.toFixed(2)} × {t.quantity}</div>
                                        }
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {t.total_cost && <span style={{ color: C.text, fontFamily: MONO, fontSize: 12 }}>${t.total_cost.toFixed(0)}</span>}
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: MONO, background: ok ? C.greenBg : err ? C.redBg : `${C.textFaint}20`, color: ok ? C.green : err ? C.red : C.textMuted }}>{t.order_status}</span>
                                    <span style={{ color: C.textFaint, fontSize: 10, fontFamily: MONO }}>{fmtTime(t.created_at)}</span>
                                </div>
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
};

/* ─── STOCK PANEL ───────────────────────────────────────── */

const STK_DEF = { enabled: false, budget: 500, max_daily: 2, min_tier: 'A+', trade_side: ['LONG'], use_limit: true, bid_discount: 0.005, min_rr_ratio: 1.5, max_sl_pct: 5.0, min_adx: 25 };

interface StockTrade { id: string; symbol: string; signal_tier: string; trade_side: string; quantity: number; total_cost: number; bracket_tp: number; bracket_sl: number; risk_reward: number; order_status: string; error_message: string | null; created_at: string; }

const StockPanel: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [enabled, setEnabled] = useState(STK_DEF.enabled);
    const [budget, setBudget] = useState(String(STK_DEF.budget));
    const [maxDaily, setMaxDaily] = useState(String(STK_DEF.max_daily));
    const [minTier, setMinTier] = useState(STK_DEF.min_tier);
    const [tradeSide, setTradeSide] = useState<string[]>(STK_DEF.trade_side);
    const [useLimit, setUseLimit] = useState(STK_DEF.use_limit);
    const [bidDiscount, setBidDiscount] = useState(String(+(STK_DEF.bid_discount * 100).toFixed(1)));
    const [minRR, setMinRR] = useState(String(STK_DEF.min_rr_ratio));
    const [maxSlPct, setMaxSlPct] = useState(String(STK_DEF.max_sl_pct));
    const [minAdx, setMinAdx] = useState(String(STK_DEF.min_adx));
    const [trades, setTrades] = useState<StockTrade[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data } = await supabase.from('stock_auto_trade_settings').select('*').eq('user_id', user.id).maybeSingle();
            if (!data) return;
            setEnabled(data.enabled ?? STK_DEF.enabled);
            setBudget(String(data.budget ?? STK_DEF.budget));
            setMaxDaily(String(data.max_daily ?? STK_DEF.max_daily));
            setMinTier(data.min_tier ?? STK_DEF.min_tier);
            const sides = Array.isArray(data.trade_side) ? data.trade_side : typeof data.trade_side === 'string' ? data.trade_side.replace(/[{}]/g, '').split(',').filter(Boolean) : STK_DEF.trade_side;
            setTradeSide(sides);
            setUseLimit(data.use_limit ?? STK_DEF.use_limit);
            setBidDiscount(String(+((data.bid_discount ?? STK_DEF.bid_discount) * 100).toFixed(1)));
            setMinRR(String(data.min_rr_ratio ?? STK_DEF.min_rr_ratio));
            setMaxSlPct(String(data.max_sl_pct ?? STK_DEF.max_sl_pct));
            setMinAdx(String(data.min_adx ?? STK_DEF.min_adx));
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    const fetchTrades = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('stock_auto_trades').select('*').eq('user_id', user.id).gte('created_at', todayISO()).order('created_at', { ascending: false }).limit(10);
        setTrades(data || []);
    }, []);

    useEffect(() => { fetchSettings(); fetchTrades(); }, [fetchSettings, fetchTrades]);

    const toggleSide = (s: string) => setTradeSide(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s]);

    const payload = (overrides = {}) => ({
        user_id: userId, enabled, broker: 'alpaca',
        budget: parseFloat(budget) || STK_DEF.budget,
        max_daily: parseInt(maxDaily) || STK_DEF.max_daily,
        min_tier: minTier, trade_side: tradeSide,
        use_limit: useLimit,
        bid_discount: (parseFloat(bidDiscount) || 0.5) / 100,
        min_rr_ratio: parseFloat(minRR) || STK_DEF.min_rr_ratio,
        max_sl_pct: parseFloat(maxSlPct) || STK_DEF.max_sl_pct,
        min_adx: parseInt(minAdx) || STK_DEF.min_adx,
        updated_at: new Date().toISOString(), ...overrides,
    });

    const validate = () => {
        const e: string[] = [];
        const b = parseFloat(budget) || 0;
        if (b < 50 || b > 10000) e.push('Budget must be $50–$10,000');
        const md = parseInt(maxDaily) || 0;
        if (md < 1 || md > 10) e.push('Max trades/day: 1–10');
        if (tradeSide.length === 0) e.push('Select at least one trade side');
        const rr = parseFloat(minRR) || 0;
        if (rr < 0.5 || rr > 10) e.push('Min R:R must be 0.5–10');
        const sl = parseFloat(maxSlPct) || 0;
        if (sl < 0.5 || sl > 20) e.push('Max SL distance must be 0.5–20%');
        const adx = parseInt(minAdx) || 0;
        if (adx < 10 || adx > 60) e.push('Min ADX must be 10–60');
        return e;
    };

    const handleSave = async () => {
        const errs = validate(); setErrors(errs);
        if (errs.length || !userId) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('stock_auto_trade_settings').upsert(payload(), { onConflict: 'user_id' });
            if (error) throw error;
            showToast('Stock auto-trade settings saved', 'success');
        } catch { showToast('Failed to save settings', 'error'); } finally { setSaving(false); }
    };

    const handleToggle = () => {
        if (!enabled) { setShowConfirm(true); return; }
        setEnabled(false);
        if (userId) supabase.from('stock_auto_trade_settings').upsert({ ...payload(), enabled: false }, { onConflict: 'user_id' }).then(() => { });
    };

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 12 }}>Loading settings...</span></div>;

    return (
        <div>
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {showConfirm && <ConfirmModal
                title="Enable Stock Auto-Trading?"
                body={`Real stock orders will be placed via Alpaca. Budget $${budget}/trade, max ${maxDaily}/day. TP/SL will come from each signal's Fibonacci analysis.`}
                onConfirm={() => { setEnabled(true); setShowConfirm(false); if (userId) supabase.from('stock_auto_trade_settings').upsert({ ...payload(), enabled: true }, { onConflict: 'user_id' }).then(() => { }); }}
                onCancel={() => setShowConfirm(false)}
            />}

            {/* Master toggle header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: SANS }}>Stock Auto-Trade</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>Stock Gate signals via Alpaca · Fibonacci TP/SL</div>
                </div>
                <ToggleSwitch on={enabled} onToggle={handleToggle} />
            </div>

            <StatusBar enabled={enabled} message={enabled ? `Active — polling stock_gate_positions for ${minTier}+ signals → bracket with signal TP/SL` : 'Disabled — no stock orders will be placed'} />

            {/* Trade Parameters */}
            <div style={CARD}>
                <SectionTitle icon="⚙" label="Trade Parameters" />
                <Row label="Broker" hint="Stock auto-trade routes exclusively via Alpaca">
                    <Pill label="ALPACA" active={true} onClick={() => { }} color={C.blue} />
                </Row>
                <Row label="Minimum Signal Tier" hint="Only trade signals of this quality or better">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="A+" active={minTier === 'A+'} onClick={() => setMinTier('A+')} color={C.amber} />
                        <Pill label="A" active={minTier === 'A'} onClick={() => setMinTier('A')} color={C.green} />
                    </div>
                </Row>
                <Row label="Trade Side" hint="Which direction(s) to trade (multi-select)">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="LONG" active={tradeSide.includes('LONG')} onClick={() => toggleSide('LONG')} color={C.green} />
                        <Pill label="SHORT" active={tradeSide.includes('SHORT')} onClick={() => toggleSide('SHORT')} color={C.red} />
                    </div>
                </Row>
                <Row label="Budget per Trade" hint="Dollar amount per stock trade ($50–$10,000)">
                    <NumInput value={budget} onChange={setBudget} prefix="$" width={80} />
                </Row>
                <Row label="Max Trades per Day" hint="Limit daily order count (1–10)">
                    <NumInput value={maxDaily} onChange={setMaxDaily} width={56} />
                </Row>
                <Row label="Limit Orders" hint="Buy at a discount below current ask price">
                    <ToggleSwitch on={useLimit} onToggle={() => setUseLimit(!useLimit)} />
                </Row>
                {useLimit && (
                    <Row label="Bid Discount" hint="How far below ask price to set limit (0.1–5%)" last>
                        <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" accent={C.blue} width={64} />
                    </Row>
                )}
            </div>

            {/* Signal Risk Filters — amber border */}
            <div style={{ ...CARD, border: `1px solid ${C.amberBdr}` }}>
                <SectionTitle icon="🎯" label="Signal Risk Filters" badge="FIBONACCI EXIT" badgeColor={C.cyan} />
                <div style={{ padding: '10px 14px', borderRadius: 7, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: C.textSec, fontFamily: SANS, lineHeight: 1.6, margin: 0 }}>
                        TP/SL prices come directly from each signal's Fibonacci analysis — not flat percentages. These filters control which signals qualify for auto-trading.
                    </p>
                </div>
                <Row label="Min Risk/Reward Ratio" hint="Skip signals with R:R below this value">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.textMuted, fontSize: 12, fontFamily: MONO }}>1 :</span>
                        <NumInput value={minRR} onChange={setMinRR} accent={C.cyan} width={64} />
                    </div>
                </Row>
                <Row label="Max Stop Loss Distance" hint="Reject signals where SL is too far from entry">
                    <NumInput value={maxSlPct} onChange={setMaxSlPct} suffix="%" accent={C.amber} width={64} />
                </Row>
                <Row label="Min ADX Strength" hint="Only trade when trend momentum meets minimum" last>
                    <NumInput value={minAdx} onChange={setMinAdx} accent={C.purple} width={64} />
                </Row>
            </div>

            {/* How It Works */}
            <div style={{ padding: '16px 20px', borderRadius: 10, marginBottom: 14, border: `1px dashed ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: C.textMuted, fontFamily: MONO, textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
                <div style={{ fontSize: 12, fontFamily: SANS, lineHeight: 2.2, color: C.textSec }}>
                    <span style={{ color: C.cyan }}>Stock Gate</span> detects <span style={{ color: C.amber }}>{minTier}+</span> <span style={{ color: tradeSide.includes('LONG') ? C.green : C.red }}>{tradeSide.join('/')}</span> signal
                    {' → '} passes R:R ≥ <span style={{ color: C.cyan }}>{minRR}</span>, SL ≤ <span style={{ color: C.amber }}>{maxSlPct}%</span>, ADX ≥ <span style={{ color: C.purple }}>{minAdx}</span>
                    {' → '} buy <span style={{ color: C.green }}>${budget}</span> via <span style={{ color: C.blue }}>Alpaca</span>
                    {useLimit && <>{' at '}<span style={{ color: C.blue }}>-{bidDiscount}% limit</span></>}
                    {' → '} TP = <span style={{ color: C.cyan }}>signal Fibonacci target</span> · SL = <span style={{ color: C.cyan }}>signal stop</span>
                    {' → '} max <span style={{ color: C.green }}>{maxDaily}</span>/day
                </div>
            </div>

            <ErrorList errors={errors} />
            <SaveButton saving={saving} label="Save Stock Auto-Trade Settings" onClick={handleSave} color={C.cyan} />

            {/* Recent stock trades */}
            <div style={CARD}>
                <SectionTitle icon="📋" label="Today's Stock Trades" />
                {trades.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textFaint, fontSize: 12, fontFamily: MONO }}>No stock auto-trades today</div>
                    : trades.map(t => {
                        const ok = ['FILLED', 'SUBMITTED', 'ACCEPTED'].includes(t.order_status);
                        const isErr = ['ERROR', 'FAILED', 'REJECTED'].includes(t.order_status);
                        const isLong = t.trade_side === 'LONG';
                        return (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '9px 11px', borderRadius: 8, marginBottom: 6,
                                background: ok ? C.greenBg : isErr ? C.redBg : C.cardAlt,
                                border: `1px solid ${ok ? C.greenBdr : isErr ? C.redBdr : C.border}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: MONO, background: isLong ? C.greenBg : C.redBg, color: isLong ? C.green : C.red }}>{t.trade_side}</span>
                                    <div>
                                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: MONO }}>{t.symbol}</span>
                                        <span style={{ color: C.amber, fontSize: 10, fontFamily: MONO, marginLeft: 6 }}>{t.signal_tier}</span>
                                        {t.error_message
                                            ? <div style={{ color: C.red, fontSize: 10, fontFamily: SANS }}>{t.error_message}</div>
                                            : <div style={{ color: C.textMuted, fontSize: 10, fontFamily: MONO }}>
                                                {t.quantity} sh
                                                {t.bracket_tp && <> · TP <span style={{ color: C.green }}>${t.bracket_tp?.toFixed(2)}</span></>}
                                                {t.bracket_sl && <> · SL <span style={{ color: C.red }}>${t.bracket_sl?.toFixed(2)}</span></>}
                                                {t.risk_reward && <> · R:R <span style={{ color: C.cyan }}>{t.risk_reward?.toFixed(1)}</span></>}
                                            </div>
                                        }
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {t.total_cost && <span style={{ color: C.text, fontFamily: MONO, fontSize: 12 }}>${t.total_cost.toFixed(0)}</span>}
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: MONO, background: ok ? C.greenBg : isErr ? C.redBg : `${C.textFaint}20`, color: ok ? C.green : isErr ? C.red : C.textMuted }}>{t.order_status}</span>
                                    <span style={{ color: C.textFaint, fontSize: 10, fontFamily: MONO }}>{fmtTime(t.created_at)}</span>
                                </div>
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
};

/* ─── COMBINED PAGE ─────────────────────────────────────── */

type Tab = 'options' | 'stock';

const AutoTradePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('options');

    const tabs: { id: Tab; label: string; sub: string; color: string }[] = [
        { id: 'options', label: 'OPTIONS AUTO-TRADE', sub: 'Iron Gate · Schwab/Alpaca · % TP/SL', color: C.purple },
        { id: 'stock', label: 'STOCK AUTO-TRADE', sub: 'Stock Gate · Alpaca · Signal TP/SL', color: C.cyan },
    ];

    return (
        <div style={{ flex: 1, overflowY: 'auto', background: C.bg, minHeight: '100vh' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

                {/* Page Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Auto-Trade</h1>
                    <p style={{ fontSize: 12, color: C.textMuted, fontFamily: MONO, marginTop: 4 }}>OPTIONS + STOCKS · INDEPENDENT SYSTEMS</p>
                </div>

                {/* Tab Switcher */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    overflow: 'hidden', background: '#12161e', marginBottom: 24,
                }}>
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                padding: '16px 20px', border: 'none', cursor: 'pointer',
                                background: isActive ? `${tab.color}1E` : 'transparent',
                                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                                textAlign: 'left', transition: 'all 0.2s',
                                borderRight: tab.id === 'options' ? `1px solid ${C.border}` : 'none',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: isActive ? tab.color : C.textMuted, letterSpacing: '0.05em', marginBottom: 4 }}>
                                    {tab.label}
                                </div>
                                <div style={{ fontSize: 9, fontFamily: MONO, color: isActive ? `${tab.color}99` : C.textFaint, letterSpacing: '0.04em' }}>
                                    {tab.sub}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Active Panel */}
                {activeTab === 'options' ? <OptionsPanel /> : <StockPanel />}
            </div>
        </div>
    );
};

export default AutoTradePage;
