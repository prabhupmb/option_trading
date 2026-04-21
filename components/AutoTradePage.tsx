import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { isAfter10AMCST } from '../utils/tradeUtils';

/* ─── DESIGN TOKENS ─────────────────────────────────────── */
const C = {
    bg: '#0b0e13', surface: '#171c27', cardAlt: '#1a2030',
    border: '#252d3a', borderLight: '#2f3a4d',
    text: '#e2e8f0', textSec: '#94a3b8', textMuted: '#5e6b80', textFaint: '#3a4555',
    green: '#22c55e', greenBg: 'rgba(34,197,94,0.10)', greenBdr: 'rgba(34,197,94,0.25)',
    red: '#ef4444', redBg: 'rgba(239,68,68,0.10)', redBdr: 'rgba(239,68,68,0.25)',
    amber: '#f59e0b', amberBg: 'rgba(245,158,11,0.12)', amberBdr: 'rgba(245,158,11,0.30)',
    blue: '#3b82f6', cyan: '#06b6d4', purple: '#a78bfa',
};
const MONO = "'JetBrains Mono','SF Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
const CARD: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 22px', marginBottom: 14 };

/* ─── SHARED PRIMITIVES ─────────────────────────────────── */

const Row: React.FC<{ label: string; hint?: string; last?: boolean; children: React.ReactNode }> =
    ({ label, hint, last, children }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${C.border}26` }}>
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
            padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${active ? color : C.border}`,
            background: active ? `${color}2E` : 'transparent',
            color: active ? color : C.textMuted,
            fontSize: 11, fontWeight: 700, fontFamily: MONO,
            letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.15s',
        }}>{label}</button>
    );

const NumInput: React.FC<{ value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; accent?: string; width?: number }> =
    ({ value, onChange, prefix, suffix, accent = C.green, width = 64 }) => {
        const [focused, setFocused] = useState(false);
        return (
            <div style={{ position: 'relative', width: width + (prefix || suffix ? 24 : 0) }}>
                {prefix && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 12, fontFamily: MONO, pointerEvents: 'none' }}>{prefix}</span>}
                <input type="text" inputMode="decimal" value={value}
                    onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    style={{
                        width: '100%', boxSizing: 'border-box', background: C.bg, borderRadius: 6, outline: 'none',
                        border: `1px solid ${focused ? accent : C.border}`,
                        boxShadow: focused ? `0 0 0 2px ${accent}33` : 'none',
                        padding: prefix ? '6px 8px 6px 20px' : suffix ? '6px 22px 6px 8px' : '6px 8px',
                        color: C.text, fontSize: 13, fontWeight: 600, fontFamily: MONO, textAlign: 'right', transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                />
                {suffix && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 12, fontFamily: MONO, pointerEvents: 'none' }}>{suffix}</span>}
            </div>
        );
    };

const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
    <button onClick={onToggle} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? C.green : C.border,
        boxShadow: on ? `0 0 8px ${C.green}55` : 'none',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s, box-shadow 0.2s',
    }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }} />
    </button>
);

const SectionTitle: React.FC<{ icon: string; label: string; badge?: string; badgeColor?: string; color?: string }> =
    ({ icon, label, badge, badgeColor = C.amber, color = C.textMuted }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color, fontFamily: MONO, textTransform: 'uppercase' }}>{label}</span>
            {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${badgeColor}20`, border: `1px solid ${badgeColor}50`, color: badgeColor, fontFamily: MONO }}>{badge}</span>}
        </div>
    );

const StatusBar: React.FC<{ enabled: boolean; message: string }> = ({ enabled, message }) => (
    <div style={{ padding: '9px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, background: enabled ? C.greenBg : C.cardAlt, border: `1px solid ${enabled ? C.greenBdr : C.border}` }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: enabled ? C.green : C.textFaint, boxShadow: enabled ? `0 0 6px ${C.green}` : 'none' }} />
        <span style={{ fontSize: 12, fontFamily: MONO, color: enabled ? C.green : C.textMuted }}>{message}</span>
    </div>
);

const Toast: React.FC<{ msg: string; type: 'success' | 'error' }> = ({ msg, type }) => (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, zIndex: 9999, background: type === 'success' ? C.green : C.red, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: MONO, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>{msg}</div>
);

const SaveButton: React.FC<{ saving: boolean; label: string; onClick: () => void; color?: string }> =
    ({ saving, label, onClick, color = C.green }) => (
        <button disabled={saving} onClick={onClick} style={{
            width: '100%', padding: '14px 0', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: saving ? C.border : color, color: saving ? C.textMuted : '#fff',
            fontSize: 12, fontWeight: 800, fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20, transition: 'filter 0.15s',
        }}>{saving ? 'Saving...' : label}</button>
    );

const ErrorList: React.FC<{ errors: string[] }> = ({ errors }) =>
    errors.length === 0 ? null : (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBdr}`, marginBottom: 14 }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: C.red, fontFamily: SANS, marginBottom: i < errors.length - 1 ? 4 : 0 }}>{e}</div>)}
        </div>
    );

/* ─── BROKER STATUS BANNER ──────────────────────────────── */

const BrokerStatus: React.FC<{ connected: boolean; brokerName: string; loading: boolean }> = ({ connected, brokerName, loading }) => {
    if (loading) return <div style={{ ...CARD, padding: '12px 18px', marginBottom: 14, opacity: 0.6 }}><span style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO }}>Checking broker connection...</span></div>;
    const label = brokerName.toUpperCase();
    return (
        <div style={{
            ...CARD, padding: '12px 18px', marginBottom: 14,
            borderLeft: `3px solid ${connected ? C.green : C.red}`,
            background: connected ? C.greenBg : C.redBg,
            border: `1px solid ${connected ? C.greenBdr : C.redBdr}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? C.green : C.red, boxShadow: connected ? `0 0 6px ${C.green}` : `0 0 6px ${C.red}` }} />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: connected ? C.green : C.red }}>{label} {connected ? 'Connected' : 'Not Connected'}</span>
            </div>
            {!connected && <div style={{ fontSize: 11, color: C.textSec, fontFamily: SANS, marginTop: 6, marginLeft: 18 }}>Connect your {label} account in Settings → Brokers before enabling auto-trade</div>}
        </div>
    );
};

/* ─── CONFIRM MODAL ─────────────────────────────────────── */

const ConfirmModal: React.FC<{
    title: string; summary: { label: string; value: string }[];
    onConfirm: () => void; onCancel: () => void;
}> = ({ title, summary, onConfirm, onCancel }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 400, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.amber, fontFamily: MONO, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>⚠ {title}</div>
            <p style={{ fontSize: 12, color: C.textSec, fontFamily: SANS, lineHeight: 1.7, margin: '0 0 16px' }}>This will automatically place real orders with your broker. Ensure your account is funded and you understand the risks.</p>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                {summary.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < summary.length - 1 ? `1px solid ${C.border}30` : 'none' }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO }}>{s.label}</span>
                        <span style={{ fontSize: 11, color: C.text, fontWeight: 600, fontFamily: MONO }}>{s.value}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', background: C.cardAlt, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 12, fontWeight: 700, fontFamily: MONO }}>Cancel</button>
                <button onClick={onConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', background: C.green, border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: MONO }}>Enable Auto-Trade</button>
            </div>
        </div>
    </div>
);

/* ─── HELPERS ───────────────────────────────────────────── */
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const todayISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

async function validateBrokerCreds(userId: string, brokerName: string): Promise<boolean> {
    const { data } = await supabase
        .from('broker_credentials')
        .select('id, account_id, api_key')
        .eq('user_id', userId)
        .eq('broker_name', brokerName)
        .eq('is_active', true)
        .maybeSingle();
    if (!data) return false;
    if (brokerName === 'schwab' && !data.account_id) return false;
    if (brokerName === 'alpaca' && !data.api_key) return false;
    return true;
}

/* ─── OPTIONS PANEL ─────────────────────────────────────── */

const OPT_DEF = { enabled: false, broker: 'schwab', budget: 250, max_daily: 2, min_tier: 'A+', option_types: ['CALL', 'PUT'], dte_min: 3, dte_max: 7, tp_pct: 0.30, sl_pct: 0.15, bid_discount: 0.15, entry_type: 'limit' as 'limit' | 'market' };

interface OptionTrade { id: string; symbol: string; signal_tier: string; option_type: string; contract_symbol: string; limit_price: number; quantity: number; total_cost: number; order_status: string; error_message: string | null; created_at: string; }

const OptionsPanel: React.FC<{ userId: string }> = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [brokerConnected, setBrokerConnected] = useState(false);
    const [brokerLoading, setBrokerLoading] = useState(true);
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
    const [entryType, setEntryType] = useState<'limit' | 'market'>(isAfter10AMCST() ? 'limit' : OPT_DEF.entry_type);
    const [trades, setTrades] = useState<OptionTrade[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const checkBroker = useCallback(async (b: string) => {
        setBrokerLoading(true);
        const ok = await validateBrokerCreds(userId, b);
        setBrokerConnected(ok);
        setBrokerLoading(false);
    }, [userId]);

    useEffect(() => { checkBroker(broker); }, [broker, checkBroker]);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await supabase.from('auto_trade_settings').select('*').eq('user_id', userId).maybeSingle();
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
            setEntryType(isAfter10AMCST() ? 'limit' : (data.entry_type ?? OPT_DEF.entry_type));
        } catch { /* silent */ } finally { setLoading(false); }
    }, [userId]);

    const fetchTrades = useCallback(async () => {
        const { data } = await supabase.from('auto_trades').select('*').eq('user_id', userId).gte('created_at', todayISO()).order('created_at', { ascending: false }).limit(20);
        setTrades(data || []);
    }, [userId]);

    useEffect(() => { fetchSettings(); fetchTrades(); }, [fetchSettings, fetchTrades]);

    const toggleOptType = (t: string) => setOptionTypes(prev => prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]);

    const payload = (overrides = {}) => ({
        user_id: userId, enabled, broker,
        budget: parseFloat(budget) || OPT_DEF.budget,
        max_daily: parseInt(maxDaily) || OPT_DEF.max_daily,
        min_tier: minTier, option_types: optionTypes,
        dte_min: parseInt(dteMin) || OPT_DEF.dte_min, dte_max: parseInt(dteMax) || OPT_DEF.dte_max,
        tp_pct: (parseFloat(tpPct) || 30) / 100, sl_pct: (parseFloat(slPct) || 15) / 100,
        bid_discount: entryType === 'limit' ? (parseFloat(bidDiscount) || 15) / 100 : 0,
        entry_type: entryType,
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
        if (errs.length) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('auto_trade_settings').upsert(payload(), { onConflict: 'user_id' });
            if (error) throw error;
            showToast('Option auto-trade settings saved', 'success');
        } catch { showToast('Failed to save settings', 'error'); } finally { setSaving(false); }
    };

    const handleToggle = async () => {
        if (!enabled) {
            const ok = await validateBrokerCreds(userId, broker);
            if (!ok) { showToast(`Please connect your ${broker.toUpperCase()} account in Settings → Brokers first.`, 'error'); return; }
            setShowConfirm(true);
            return;
        }
        setEnabled(false);
        supabase.from('auto_trade_settings').upsert({ ...payload(), enabled: false }, { onConflict: 'user_id' }).then(() => { });
    };

    const confirmSummary = [
        { label: 'Broker', value: broker.toUpperCase() },
        { label: 'Budget', value: `$${budget}` },
        { label: 'Max/Day', value: maxDaily },
        { label: 'Tier', value: `${minTier}+` },
        { label: 'Types', value: optionTypes.join(', ') },
        { label: 'Entry', value: entryType.toUpperCase() },
        { label: 'TP / SL', value: `${tpPct}% / ${slPct}%` },
    ];

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 12 }}>Loading settings...</span></div>;

    return (
        <div>
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {showConfirm && <ConfirmModal title="ENABLE OPTION AUTO-TRADE" summary={confirmSummary}
                onConfirm={() => { setEnabled(true); setShowConfirm(false); supabase.from('auto_trade_settings').upsert({ ...payload(), enabled: true }, { onConflict: 'user_id' }).then(() => { }); }}
                onCancel={() => setShowConfirm(false)} />}

            <BrokerStatus connected={brokerConnected} brokerName={broker} loading={brokerLoading} />

            <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: SANS }}>Option Auto-Trade</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>Iron Gate signals via Schwab / Alpaca</div>
                </div>
                <Toggle on={enabled} onToggle={handleToggle} />
            </div>

            <StatusBar enabled={enabled} message={enabled ? `Active — monitoring Iron Gate signals` : 'Disabled — no option orders will be placed'} />

            <div style={CARD}>
                <SectionTitle icon="⚙" label="Trade Parameters" />
                <Row label="Broker" hint="Which broker to route options orders to">
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="SCHWAB" active={broker === 'schwab'} onClick={() => setBroker('schwab')} color={C.blue} />
                        <Pill label="ALPACA" active={broker === 'alpaca'} onClick={() => setBroker('alpaca')} color={C.cyan} />
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

            <div style={{ ...CARD, border: `1px solid ${C.blue}40` }}>
                <SectionTitle icon="🎯" label="Entry Order Type" color={C.blue} />
                <Row label="Order Type" hint="How the entry order is placed with your broker" last>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="LIMIT" active={entryType === 'limit'} onClick={() => setEntryType('limit')} color={C.blue} />
                        <Pill label="MARKET" active={entryType === 'market'} onClick={() => !isAfter10AMCST() && setEntryType('market')} color={isAfter10AMCST() ? C.textMuted : C.green} />
                    </div>
                </Row>
                {isAfter10AMCST() && (
                    <div style={{ padding: '9px 14px', borderRadius: 8, background: C.amberBg, border: `1px solid ${C.amberBdr}`, marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.amber }}>info</span>
                        <span style={{ fontSize: 11, fontFamily: MONO, color: C.amber }}>Market orders are restricted after 10:00 AM CST to mitigate risk. Please use limit orders.</span>
                    </div>
                )}
                <div style={{ padding: '8px 12px', borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: C.textSec, fontFamily: SANS, lineHeight: 1.6 }}>
                        {entryType === 'limit'
                            ? 'Enters below bid price for better fills — may not fill if price moves'
                            : 'Enters at current ask for instant fill — pays full spread'}
                    </span>
                </div>
            </div>

            <div style={{ ...CARD, border: `1px solid ${C.amberBdr}` }}>
                <SectionTitle icon="🛡" label="Bracket Order (Exit Strategy)" color={C.amber} />
                <Row label="Take Profit" hint="Sell when premium rises by this percentage">
                    <NumInput value={tpPct} onChange={setTpPct} suffix="%" accent={C.green} width={64} />
                </Row>
                <Row label="Stop Loss" hint="Cut loss when premium drops by this percentage">
                    <NumInput value={slPct} onChange={setSlPct} suffix="%" accent={C.red} width={64} />
                </Row>
                {entryType === 'limit' && (
                    <Row label="Bid Discount" hint="Set limit price this % below current bid" last>
                        <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" accent={C.blue} width={64} />
                    </Row>
                )}
            </div>

            <ErrorList errors={errors} />
            <SaveButton saving={saving} label="Save Option Auto-Trade Settings" onClick={handleSave} color={C.purple} />

            <div style={CARD}>
                <SectionTitle icon="📋" label="Recent Trades" />
                {trades.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textFaint, fontSize: 12, fontFamily: MONO }}>No option auto-trades today</div>
                    : <div style={{ maxHeight: 300, overflowY: 'auto' }}>{trades.map(t => {
                        const ok = ['FILLED', 'SUBMITTED', 'ACCEPTED'].includes(t.order_status);
                        const err = ['ERROR', 'FAILED', 'REJECTED'].includes(t.order_status);
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 8, marginBottom: 6, background: ok ? C.greenBg : err ? C.redBg : C.cardAlt, border: `1px solid ${ok ? C.greenBdr : err ? C.redBdr : C.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: MONO, background: t.option_type === 'CALL' ? C.greenBg : C.redBg, color: t.option_type === 'CALL' ? C.green : C.red }}>{t.option_type}</span>
                                    <div>
                                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: MONO }}>{t.symbol}</span>
                                        <span style={{ color: C.amber, fontSize: 10, fontFamily: MONO, marginLeft: 6 }}>{t.signal_tier}</span>
                                        {t.error_message
                                            ? <div style={{ color: C.red, fontSize: 10, fontFamily: SANS }}>{t.error_message}</div>
                                            : <div style={{ color: C.textMuted, fontSize: 10, fontFamily: MONO }}>{t.contract_symbol} · ${t.limit_price?.toFixed(2)} × {t.quantity}</div>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {t.total_cost && <span style={{ color: C.text, fontFamily: MONO, fontSize: 12 }}>${t.total_cost.toFixed(0)}</span>}
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: MONO, background: ok ? C.greenBg : err ? C.redBg : `${C.textFaint}20`, color: ok ? C.green : err ? C.red : C.textMuted }}>{t.order_status}</span>
                                    <span style={{ color: C.textFaint, fontSize: 10, fontFamily: MONO }}>{fmtTime(t.created_at)}</span>
                                </div>
                            </div>
                        );
                    })}</div>}
            </div>
        </div>
    );
};

/* ─── STOCK PANEL ───────────────────────────────────────── */

const STK_DEF = { enabled: false, budget: 500, max_daily: 2, min_tier: 'A+', trade_side: ['LONG'], entry_type: 'limit' as 'limit' | 'market', bid_discount: 0.005 };

interface StockTrade { id: string; symbol: string; signal_tier: string; trade_side: string; current_price: number; entry_price: number; quantity: number; total_cost: number; broker: string; order_id: string | null; order_status: string; error_message: string | null; created_at: string; }

const StockPanel: React.FC<{ userId: string }> = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [brokerConnected, setBrokerConnected] = useState(false);
    const [brokerLoading, setBrokerLoading] = useState(true);
    const [enabled, setEnabled] = useState(STK_DEF.enabled);
    const [budget, setBudget] = useState(String(STK_DEF.budget));
    const [maxDaily, setMaxDaily] = useState(String(STK_DEF.max_daily));
    const [minTier, setMinTier] = useState(STK_DEF.min_tier);
    const [tradeSide, setTradeSide] = useState<string[]>(STK_DEF.trade_side);
    const [entryType, setEntryType] = useState<'limit' | 'market'>(isAfter10AMCST() ? 'limit' : STK_DEF.entry_type);
    const [bidDiscount, setBidDiscount] = useState(String(+(STK_DEF.bid_discount * 100).toFixed(1)));
    const [trades, setTrades] = useState<StockTrade[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    useEffect(() => {
        (async () => {
            setBrokerLoading(true);
            const ok = await validateBrokerCreds(userId, 'alpaca');
            setBrokerConnected(ok);
            setBrokerLoading(false);
        })();
    }, [userId]);

    const parseTradeSide = (raw: any): string[] => {
        try {
            if (Array.isArray(raw)) return raw.filter(Boolean);
            if (typeof raw === 'string') return raw.replace(/[{}\\'"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
        } catch { /* fall through */ }
        return STK_DEF.trade_side;
    };

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await supabase.from('stock_auto_trade_settings').select('*').eq('user_id', userId).maybeSingle();
            if (!data) return;
            setEnabled(data.enabled ?? STK_DEF.enabled);
            setBudget(String(data.budget ?? STK_DEF.budget));
            setMaxDaily(String(data.max_daily ?? STK_DEF.max_daily));
            setMinTier(data.min_tier ?? STK_DEF.min_tier);
            setTradeSide(parseTradeSide(data.trade_side));
            setEntryType(isAfter10AMCST() ? 'limit' : (data.entry_type ?? (data.use_limit === false ? 'market' : STK_DEF.entry_type)));
            setBidDiscount(String(+((data.bid_discount ?? STK_DEF.bid_discount) * 100).toFixed(1)));
        } catch { /* silent */ } finally { setLoading(false); }
    }, [userId]);

    const fetchTrades = useCallback(async () => {
        const { data } = await supabase.from('stock_auto_trades').select('*').eq('user_id', userId).gte('created_at', todayISO()).order('created_at', { ascending: false }).limit(20);
        setTrades(data || []);
    }, [userId]);

    useEffect(() => { fetchSettings(); fetchTrades(); }, [fetchSettings, fetchTrades]);

    const toggleSide = (s: string) => setTradeSide(prev => prev.includes(s) ? (prev.length > 1 ? prev.filter(x => x !== s) : prev) : [...prev, s]);

    const payload = (overrides = {}) => ({
        user_id: userId, enabled, broker: 'alpaca',
        budget: parseFloat(budget) || STK_DEF.budget,
        max_daily: parseInt(maxDaily) || STK_DEF.max_daily,
        min_tier: minTier, trade_side: tradeSide,
        entry_type: entryType, use_limit: entryType === 'limit',
        bid_discount: entryType === 'limit' ? (parseFloat(bidDiscount) || 0.5) / 100 : 0,
        updated_at: new Date().toISOString(), ...overrides,
    });

    const validate = () => {
        const e: string[] = [];
        const b = parseFloat(budget) || 0;
        if (b < 50 || b > 25000) e.push('Budget must be $50–$25,000');
        const md = parseInt(maxDaily) || 0;
        if (md < 1 || md > 10) e.push('Max trades/day: 1–10');
        if (tradeSide.length === 0) e.push('Select at least one trade side');
        return e;
    };

    const handleSave = async () => {
        const errs = validate(); setErrors(errs);
        if (errs.length) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('stock_auto_trade_settings').upsert(payload(), { onConflict: 'user_id' });
            if (error) throw error;
            showToast('Stock auto-trade settings saved', 'success');
        } catch { showToast('Failed to save settings', 'error'); } finally { setSaving(false); }
    };

    const handleToggle = async () => {
        if (!enabled) {
            const ok = await validateBrokerCreds(userId, 'alpaca');
            if (!ok) { showToast('Please connect your ALPACA account in Settings → Brokers first.', 'error'); return; }
            setShowConfirm(true); return;
        }
        setEnabled(false);
        supabase.from('stock_auto_trade_settings').upsert({ ...payload(), enabled: false }, { onConflict: 'user_id' }).then(() => { });
    };

    const confirmSummary = [
        { label: 'Broker', value: 'ALPACA' },
        { label: 'Entry', value: entryType.toUpperCase() },
        { label: 'Budget', value: `$${budget}` },
        { label: 'Max/Day', value: maxDaily },
        { label: 'Tier', value: `${minTier}+` },
        { label: 'Side', value: tradeSide.join(', ') },
        { label: 'TP/SL', value: 'Signal Fibonacci' },
    ];

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 12 }}>Loading settings...</span></div>;

    return (
        <div>
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {showConfirm && <ConfirmModal title="ENABLE STOCK AUTO-TRADE" summary={confirmSummary}
                onConfirm={() => { setEnabled(true); setShowConfirm(false); supabase.from('stock_auto_trade_settings').upsert({ ...payload(), enabled: true }, { onConflict: 'user_id' }).then(() => { }); }}
                onCancel={() => setShowConfirm(false)} />}

            <BrokerStatus connected={brokerConnected} brokerName="alpaca" loading={brokerLoading} />

            <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: SANS }}>Stock Auto-Trade</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>Stock Gate signals via Alpaca · Fibonacci TP/SL</div>
                </div>
                <Toggle on={enabled} onToggle={handleToggle} />
            </div>

            <StatusBar enabled={enabled} message={enabled ? 'Active — monitoring Stock Gate signals' : 'Disabled — no stock orders will be placed'} />

            <div style={CARD}>
                <SectionTitle icon="⚙" label="Trade Parameters" />
                <Row label="Broker" hint="Stock auto-trade routes exclusively via Alpaca">
                    <Pill label="ALPACA" active={true} onClick={() => { }} color={C.cyan} />
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
                <Row label="Budget per Trade" hint="Dollar amount per stock trade ($50–$25,000)">
                    <NumInput value={budget} onChange={setBudget} prefix="$" width={80} />
                </Row>
                <Row label="Max Trades per Day" hint="Limit daily order count (1–10)" last>
                    <NumInput value={maxDaily} onChange={setMaxDaily} width={56} />
                </Row>
            </div>

            <div style={{ ...CARD, border: `1px solid ${C.cyan}40` }}>
                <SectionTitle icon="🎯" label="Entry Order Type" color={C.cyan} />
                <Row label="Order Type" hint="How the entry order is placed with Alpaca" last>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Pill label="LIMIT" active={entryType === 'limit'} onClick={() => setEntryType('limit')} color={C.cyan} />
                        <Pill label="MARKET" active={entryType === 'market'} onClick={() => !isAfter10AMCST() && setEntryType('market')} color={isAfter10AMCST() ? C.textMuted : C.green} />
                    </div>
                </Row>
                {isAfter10AMCST() && (
                    <div style={{ padding: '9px 14px', borderRadius: 8, background: C.amberBg, border: `1px solid ${C.amberBdr}`, marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.amber }}>info</span>
                        <span style={{ fontSize: 11, fontFamily: MONO, color: C.amber }}>Market orders are restricted after 10:00 AM CST to mitigate risk. Please use limit orders.</span>
                    </div>
                )}
                <div style={{ padding: '8px 12px', borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: C.textSec, fontFamily: SANS, lineHeight: 1.6 }}>
                        {entryType === 'limit'
                            ? 'Enters below bid price for better fills — may not fill if price moves'
                            : 'Enters at current ask for instant fill — pays full spread'}
                    </span>
                </div>
                {entryType === 'limit' && (
                    <Row label="Bid Discount" hint="Set limit price this % below current bid" last>
                        <NumInput value={bidDiscount} onChange={setBidDiscount} suffix="%" accent={C.cyan} width={64} />
                    </Row>
                )}
            </div>

            <div style={{ ...CARD, border: `1px solid rgba(6,182,212,0.30)` }}>
                <SectionTitle icon="🛡" label="Signal-Level Exit (Fibonacci TP/SL)" badge="FIBONACCI EXIT" badgeColor={C.cyan} color={C.cyan} />
                <div style={{ padding: '12px 16px', borderRadius: 7, background: C.bg, border: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 12, color: C.textSec, fontFamily: SANS, lineHeight: 1.7, margin: 0 }}>
                        Stock trades use signal-level Fibonacci TP/SL from each signal's gate analysis — not flat percentages. The <span style={{ color: C.cyan, fontFamily: MONO, fontWeight: 600 }}>target_price</span> and <span style={{ color: C.cyan, fontFamily: MONO, fontWeight: 600 }}>stop_loss</span> come directly from the Stock Gate scanner.
                    </p>
                </div>
            </div>

            <ErrorList errors={errors} />
            <SaveButton saving={saving} label="Save Stock Auto-Trade Settings" onClick={handleSave} color={C.cyan} />

            <div style={CARD}>
                <SectionTitle icon="📋" label="Recent Trades" />
                {trades.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textFaint, fontSize: 12, fontFamily: MONO }}>No stock auto-trades today</div>
                    : <div style={{ maxHeight: 300, overflowY: 'auto' }}>{trades.map(t => {
                        const ok = ['FILLED', 'SUBMITTED', 'ACCEPTED'].includes(t.order_status);
                        const isErr = ['ERROR', 'FAILED', 'REJECTED'].includes(t.order_status);
                        const isLong = t.trade_side === 'LONG';
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 8, marginBottom: 6, background: ok ? C.greenBg : isErr ? C.redBg : C.cardAlt, border: `1px solid ${ok ? C.greenBdr : isErr ? C.redBdr : C.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: MONO, background: isLong ? C.greenBg : C.redBg, color: isLong ? C.green : C.red }}>{t.trade_side}</span>
                                    <div>
                                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: MONO }}>{t.symbol}</span>
                                        <span style={{ color: C.amber, fontSize: 10, fontFamily: MONO, marginLeft: 6 }}>{t.signal_tier}</span>
                                        {t.error_message
                                            ? <div style={{ color: C.red, fontSize: 10, fontFamily: SANS }}>{t.error_message}</div>
                                            : <div style={{ color: C.textMuted, fontSize: 10, fontFamily: MONO }}>{t.quantity} sh · ${Number(t.total_cost).toFixed(0)}</div>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: MONO, background: ok ? C.greenBg : isErr ? C.redBg : `${C.textFaint}20`, color: ok ? C.green : isErr ? C.red : C.textMuted }}>{t.order_status}</span>
                                    <span style={{ color: C.textFaint, fontSize: 10, fontFamily: MONO }}>{fmtTime(t.created_at)}</span>
                                </div>
                            </div>
                        );
                    })}</div>}
            </div>
        </div>
    );
};

/* ─── ADMIN PANEL ───────────────────────────────────────── */

interface AdminUser {
    id: string; email: string; display_name: string; is_active: boolean;
    brokerCreds: { broker_name: string; is_active: boolean; account_id?: string; api_key?: string }[];
    optSettings: { enabled: boolean; broker: string; budget: number; max_daily: number; min_tier: string; option_types: string[]; dte_min: number; dte_max: number; tp_pct: number; sl_pct: number; entry_type?: string } | null;
    stkSettings: { enabled: boolean; budget: number; max_daily: number; min_tier: string; trade_side: string[]; entry_type?: string } | null;
}

const AdminPanel: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ userId: string; type: 'disableAll' | 'deleteAll'; name: string } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: allUsers }, { data: allCreds }, { data: allOpt }, { data: allStk }] = await Promise.all([
                supabase.from('users').select('id, email, display_name, is_active').order('display_name'),
                supabase.from('broker_credentials').select('user_id, broker_name, is_active, account_id, api_key'),
                supabase.from('auto_trade_settings').select('user_id, enabled, broker, budget, max_daily, min_tier, option_types, dte_min, dte_max, tp_pct, sl_pct, entry_type'),
                supabase.from('stock_auto_trade_settings').select('user_id, enabled, budget, max_daily, min_tier, trade_side, entry_type'),
            ]);
            const mapped: AdminUser[] = (allUsers || []).map((u: any) => ({
                id: u.id, email: u.email || '', display_name: u.display_name || u.email?.split('@')[0] || 'Unknown', is_active: u.is_active,
                brokerCreds: (allCreds || []).filter((c: any) => c.user_id === u.id),
                optSettings: (allOpt || []).find((o: any) => o.user_id === u.id) || null,
                stkSettings: (allStk || []).find((s: any) => s.user_id === u.id) || null,
            }));
            setUsers(mapped);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleDisableAll = async (uid: string) => {
        try {
            await Promise.all([
                supabase.from('auto_trade_settings').update({ enabled: false }).eq('user_id', uid),
                supabase.from('stock_auto_trade_settings').update({ enabled: false }).eq('user_id', uid),
            ]);
            showToast('All auto-trade disabled for user', 'success');
            fetchAll();
        } catch { showToast('Failed to disable', 'error'); }
        setConfirmAction(null);
    };

    const handleDeleteAll = async (uid: string) => {
        try {
            await Promise.all([
                supabase.from('auto_trade_settings').delete().eq('user_id', uid),
                supabase.from('stock_auto_trade_settings').delete().eq('user_id', uid),
            ]);
            showToast('Settings deleted for user', 'success');
            fetchAll();
        } catch { showToast('Failed to delete', 'error'); }
        setConfirmAction(null);
    };

    const optActive = users.filter(u => u.optSettings?.enabled).length;
    const stkActive = users.filter(u => u.stkSettings?.enabled).length;

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 12 }}>Loading users...</span></div>;

    const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: MONO, color, background: bg, letterSpacing: '0.04em' }}>{label}</span>
    );

    return (
        <div>
            {toast && <Toast msg={toast.msg} type={toast.type} />}
            {confirmAction && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmAction(null)}>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 360, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: confirmAction.type === 'deleteAll' ? C.red : C.amber, fontFamily: MONO, marginBottom: 10 }}>
                            {confirmAction.type === 'deleteAll' ? '⚠ DELETE SETTINGS' : '⚠ DISABLE ALL'}
                        </div>
                        <p style={{ fontSize: 12, color: C.textSec, fontFamily: SANS, lineHeight: 1.7, margin: '0 0 20px' }}>
                            {confirmAction.type === 'deleteAll'
                                ? `Delete all auto-trade settings for ${confirmAction.name}? This cannot be undone.`
                                : `Disable all auto-trade systems for ${confirmAction.name}?`}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', background: C.cardAlt, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 12, fontWeight: 700, fontFamily: MONO }}>Cancel</button>
                            <button onClick={() => confirmAction.type === 'deleteAll' ? handleDeleteAll(confirmAction.userId) : handleDisableAll(confirmAction.userId)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', background: confirmAction.type === 'deleteAll' ? C.red : C.amber, border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: MONO }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary stats */}
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: C.text }}>{users.length} <span style={{ color: C.textMuted, fontWeight: 500 }}>users total</span></span>
                <span style={{ width: 1, height: 14, background: C.border }} />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: optActive > 0 ? C.green : C.textMuted }}>{optActive} <span style={{ color: C.textMuted, fontWeight: 500 }}>options active</span></span>
                <span style={{ width: 1, height: 14, background: C.border }} />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: stkActive > 0 ? C.green : C.textMuted }}>{stkActive} <span style={{ color: C.textMuted, fontWeight: 500 }}>stocks active</span></span>
            </div>

            {/* User list */}
            {users.map(u => {
                const isExp = expanded === u.id;
                const hasBroker = u.brokerCreds.length > 0;
                const hasSchwab = u.brokerCreds.some(c => c.broker_name === 'schwab' && c.is_active);
                const hasAlpaca = u.brokerCreds.some(c => c.broker_name === 'alpaca' && c.is_active);
                return (
                    <div key={u.id} style={{ ...CARD, padding: 0, overflow: 'hidden', marginBottom: 10 }}>
                        <button onClick={() => setExpanded(isExp ? null : u.id)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px', border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, fontFamily: MONO, color: C.textSec }}>
                                    {(u.display_name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: SANS }}>{u.display_name}</div>
                                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: MONO }}>{u.email}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {hasSchwab && <Badge label="SCHWAB" color={C.blue} bg={`${C.blue}20`} />}
                                {hasAlpaca && <Badge label="ALPACA" color={C.cyan} bg={`${C.cyan}20`} />}
                                {!hasBroker && <Badge label="NO BROKER" color={C.red} bg={C.redBg} />}
                                <Badge label={u.optSettings?.enabled ? 'OPT ON' : 'OPT OFF'} color={u.optSettings?.enabled ? C.green : C.textFaint} bg={u.optSettings?.enabled ? C.greenBg : `${C.textFaint}15`} />
                                <Badge label={u.stkSettings?.enabled ? 'STK ON' : 'STK OFF'} color={u.stkSettings?.enabled ? C.green : C.textFaint} bg={u.stkSettings?.enabled ? C.greenBg : `${C.textFaint}15`} />
                                <span style={{ color: C.textFaint, fontSize: 14, fontFamily: MONO, marginLeft: 4, transition: 'transform 0.2s', transform: isExp ? 'rotate(180deg)' : 'none' }}>▾</span>
                            </div>
                        </button>

                        {isExp && (
                            <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.border}30` }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                                    {/* Options column */}
                                    <div style={{ background: C.bg, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, fontFamily: MONO, letterSpacing: '0.1em', marginBottom: 10 }}>OPTIONS</div>
                                        {u.optSettings ? (<>
                                            <div style={{ fontSize: 11, color: u.optSettings.enabled ? C.green : C.red, fontWeight: 700, fontFamily: MONO, marginBottom: 8 }}>{u.optSettings.enabled ? 'ACTIVE' : 'DISABLED'}</div>
                                            {[
                                                ['Broker', u.optSettings.broker?.toUpperCase()],
                                                ['Entry', (u.optSettings.entry_type || 'limit').toUpperCase()],
                                                ['Budget', `$${u.optSettings.budget}`],
                                                ['Max/Day', String(u.optSettings.max_daily)],
                                                ['Tier', `${u.optSettings.min_tier}+`],
                                                ['Types', (u.optSettings.option_types || []).join(', ')],
                                                ['DTE', `${u.optSettings.dte_min}–${u.optSettings.dte_max}`],
                                                ['TP/SL', `${Math.round((u.optSettings.tp_pct || 0) * 100)}% / ${Math.round((u.optSettings.sl_pct || 0) * 100)}%`],
                                            ].map(([k, v]) => (
                                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10, fontFamily: MONO }}>
                                                    <span style={{ color: C.textMuted }}>{k}</span>
                                                    <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                                                </div>
                                            ))}
                                        </>) : <div style={{ fontSize: 10, color: C.textFaint, fontFamily: MONO }}>No settings</div>}
                                    </div>
                                    {/* Stock column */}
                                    <div style={{ background: C.bg, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: C.cyan, fontFamily: MONO, letterSpacing: '0.1em', marginBottom: 10 }}>STOCKS</div>
                                        {u.stkSettings ? (<>
                                            <div style={{ fontSize: 11, color: u.stkSettings.enabled ? C.green : C.red, fontWeight: 700, fontFamily: MONO, marginBottom: 8 }}>{u.stkSettings.enabled ? 'ACTIVE' : 'DISABLED'}</div>
                                            {[
                                                ['Broker', 'ALPACA'],
                                                ['Entry', (u.stkSettings.entry_type || 'limit').toUpperCase()],
                                                ['Budget', `$${u.stkSettings.budget}`],
                                                ['Max/Day', String(u.stkSettings.max_daily)],
                                                ['Tier', `${u.stkSettings.min_tier}+`],
                                                ['Side', Array.isArray(u.stkSettings.trade_side) ? u.stkSettings.trade_side.join(', ') : String(u.stkSettings.trade_side)],
                                            ].map(([k, v]) => (
                                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10, fontFamily: MONO }}>
                                                    <span style={{ color: C.textMuted }}>{k}</span>
                                                    <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                                                </div>
                                            ))}
                                        </>) : <div style={{ fontSize: 10, color: C.textFaint, fontFamily: MONO }}>No settings</div>}
                                    </div>
                                </div>
                                {/* Admin actions */}
                                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                                    <button onClick={() => setConfirmAction({ userId: u.id, type: 'disableAll', name: u.display_name })} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.amberBdr}`, background: 'transparent', color: C.amber, fontSize: 10, fontWeight: 700, fontFamily: MONO, cursor: 'pointer' }}>Disable All</button>
                                    <button onClick={() => setConfirmAction({ userId: u.id, type: 'deleteAll', name: u.display_name })} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.redBdr}`, background: 'transparent', color: C.red, fontSize: 10, fontWeight: 700, fontFamily: MONO, cursor: 'pointer' }}>Delete Settings</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/* ─── COMBINED PAGE ─────────────────────────────────────── */

type Tab = 'options' | 'stock' | 'admin';

interface AutoTradePageProps { userId: string; isAdmin?: boolean; }

const AutoTradePage: React.FC<AutoTradePageProps> = ({ userId, isAdmin = false }) => {
    const [activeTab, setActiveTab] = useState<Tab>('options');

    const tabs: { id: Tab; label: string; sub: string; color: string; adminOnly?: boolean }[] = [
        { id: 'options', label: 'OPTIONS AUTO-TRADE', sub: 'Iron Gate · Schwab/Alpaca · % TP/SL', color: C.purple },
        { id: 'stock', label: 'STOCK AUTO-TRADE', sub: 'Stock Gate · Alpaca · Signal TP/SL', color: C.cyan },
        ...(isAdmin ? [{ id: 'admin' as Tab, label: 'ADMIN PANEL', sub: 'Manage all users', color: C.amber, adminOnly: true }] : []),
    ];

    return (
        <div style={{ flex: 1, overflowY: 'auto', background: C.bg, minHeight: '100vh' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Auto-Trade</h1>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: C.textMuted, fontFamily: MONO, marginTop: 4 }}>OPTIONS + STOCKS · INDEPENDENT SYSTEMS</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: tabs.map(() => '1fr').join(' '), border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: '#12161e', marginBottom: 24 }}>
                    {tabs.map((tab, i) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                padding: '16px 20px', border: 'none', cursor: 'pointer',
                                background: isActive ? `${tab.color}1E` : 'transparent',
                                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                                textAlign: 'left', transition: 'all 0.2s',
                                borderRight: i < tabs.length - 1 ? `1px solid ${C.border}` : 'none',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: isActive ? tab.color : C.textMuted, letterSpacing: '0.05em', marginBottom: 4 }}>{tab.label}</div>
                                <div style={{ fontSize: 9, fontFamily: MONO, color: isActive ? `${tab.color}99` : C.textFaint, letterSpacing: '0.04em' }}>{tab.sub}</div>
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'options' && <OptionsPanel userId={userId} />}
                {activeTab === 'stock' && <StockPanel userId={userId} />}
                {activeTab === 'admin' && isAdmin && <AdminPanel />}
            </div>
        </div>
    );
};

export default AutoTradePage;
