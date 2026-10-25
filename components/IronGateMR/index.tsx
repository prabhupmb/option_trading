import React, { useMemo, useState } from 'react';
import { C, MONO } from './constants';
import { useIronGateMR } from './useIronGateMR';
import { useMdBars, type Timeframe } from '../../hooks/useMdBars';
import { OpenPositionCard } from './OpenPositionCard';
import { EnteringTable } from './EnteringTable';
import { HistoryTable } from './HistoryTable';
import { ShadowTable } from './ShadowTable';
import { ScorecardTab } from './ScorecardTab';
import { SkipsTable } from './SkipsTable';
import type { MRSubTab, Toast, MRScorecard, MRPromotion } from './types';

/* ── Keyframe styles ── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800;900&display=swap');
  @keyframes mr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
  @keyframes mr-toast-in { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
`;

const N8N_BASE = (import.meta.env.VITE_N8N_BASE_URL as string) || 'https://prabhupadala01.app.n8n.cloud';
const TK_SECRET = (import.meta.env.VITE_TK_WEBHOOK_SECRET as string) ?? '';

/* ── Toast item ── */
const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    win:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.5)',  text: C.accentGreen },
    loss: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.5)',  text: C.accentRed },
    new:  { bg: 'rgba(255,215,0,0.1)',   border: 'rgba(255,215,0,0.45)', text: C.accentYellow },
    info: { bg: C.cardBg,                border: C.cardBorder,            text: C.textSecondary },
  };
  const c = colors[toast.type] || colors.info;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 320,
      animation: 'mr-toast-in 0.3s ease', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: c.text, lineHeight: 1.4 }}>{toast.message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: 0 }}>&times;</button>
    </div>
  );
};

/* ── KPI chip ── */
const KPIChip: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = C.textPrimary }) => (
  <div style={{ padding: '6px 12px', background: C.innerRowBg, borderRadius: 8, border: `1px solid ${C.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
    <span style={{ fontSize: 14, fontWeight: 900, fontFamily: MONO, color }}>{value}</span>
    <span style={{ fontSize: 8, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
  </div>
);

/* ── Promotion meter ── */
const PromotionMeter: React.FC<{ promo: MRPromotion | undefined }> = ({ promo }) => {
  if (!promo) return null;
  const trades = promo.trades ?? 0;
  const tradesPct = Math.min(100, (trades / 40) * 100);
  const winPct = promo.win_pct ?? 0;
  const pf = promo.profit_factor ?? 0;

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Trades progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted }}>Trades</span>
        <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${tradesPct}%`, background: tradesPct >= 100 ? C.accentGreen : C.blue, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 9, fontFamily: MONO, color: C.textSecondary }}>{trades}/40</span>
      </div>
      {/* Win% */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted }}>Win%</span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: winPct >= 60 ? C.accentGreen : C.accentRed }}>{winPct.toFixed(1)}%</span>
        <span style={{ fontSize: 8, color: C.textMuted }}>/60%</span>
      </div>
      {/* Profit factor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted }}>PF</span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: pf >= 1.2 ? C.accentGreen : C.accentRed }}>{pf.toFixed(2)}</span>
        <span style={{ fontSize: 8, color: C.textMuted }}>/1.2</span>
      </div>
      {/* Ready badge */}
      {promo.meets_promotion_bar && (
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', color: C.accentGreen,
        }}>READY TO PROMOTE</span>
      )}
    </div>
  );
};

/* ── Main Component ── */
const IronGateMRDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MRSubTab>('open');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'ok' | 'err'>('idle');
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [chartTf, setChartTf] = useState<Timeframe>('1D');
  const [closeResult, setCloseResult] = useState<{ msg: string; ok: boolean } | null>(null);

  const {
    open, pendingSignals, history, scorecard, promotion, weekly,
    lastScan, shadow, skips, loading, connected, error, toasts,
    refetch, dismissToast,
  } = useIronGateMR();

  const barSymbols = useMemo(() => open.map(p => p.symbol), [open]);
  const { barsBySymbol } = useMdBars(barSymbols, chartTf);

  const liveSC = scorecard.find(s => s.engine === 'MR_LIVE');
  const livePromo = promotion.find(p => p.engine === 'MR_LIVE');

  /* ── Scan handler ── */
  const handleScan = async () => {
    if (scanStatus === 'scanning') return;
    setScanStatus('scanning');
    setScanPreview(null);
    try {
      const res = await fetch(`${N8N_BASE}/webhook/iron-mr-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TK-Secret': TK_SECRET },
        body: JSON.stringify({ triggered_by: 'manual' }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        setScanStatus('ok');
        if (body?.candidates?.length) {
          setScanPreview(`Preview: ${body.candidates.map((c: any) => c.symbol || c).join(', ')}`);
          setTimeout(() => setScanPreview(null), 8000);
        }
        refetch();
      } else {
        setScanStatus('err');
      }
    } catch {
      setScanStatus('err');
    } finally {
      setTimeout(() => setScanStatus('idle'), 4000);
    }
  };

  /* ── Close position handler ── */
  const handleClose = async (positionId: string) => {
    setCloseResult(null);
    try {
      const res = await fetch(`${N8N_BASE}/webhook/iron-mr-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: positionId }),
      });
      const body = await res.json().catch(() => null);
      if (body?.ok) {
        setCloseResult({ msg: `Closed at $${body.exit_price?.toFixed(2)} (${body.pnl_pct?.toFixed(2)}%)`, ok: true });
        refetch();
      } else {
        setCloseResult({ msg: body?.error || 'Close failed', ok: false });
      }
    } catch {
      setCloseResult({ msg: 'Network error', ok: false });
    }
    setTimeout(() => setCloseResult(null), 6000);
  };

  /* ── Last scan info ── */
  const scanInfo = lastScan ? {
    date: lastScan.bar_date ?? '-',
    time: lastScan.ran_at ? new Date(lastScan.ran_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) : '-',
    newSignals: lastScan.new_signals ?? 0,
    exits: lastScan.exits_flagged ?? 0,
    hasErrors: (lastScan.notes?.errors?.length ?? 0) > 0,
    isPreview: lastScan.notes?.mode === 'PREVIEW',
  } : null;

  /* ── Tab definitions ── */
  const tabs: { id: MRSubTab; label: string; count: number }[] = [
    { id: 'open',      label: 'Open',       count: open.length },
    { id: 'entering',  label: 'Entering',   count: pendingSignals.length },
    { id: 'history',   label: 'History',     count: history.length },
    { id: 'shadow',    label: 'Shadow 1H',   count: shadow.length },
    { id: 'scorecard', label: 'Scorecard',   count: 0 },
    { id: 'skips',     label: 'Skips',       count: skips.length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.textPrimary, fontFamily: 'Inter, sans-serif' }}>
      <style>{STYLES}</style>

      {/* Toast container */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>

      {/* Scan preview toast */}
      {scanPreview && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1001, padding: '10px 20px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: C.amber }}>
          {scanPreview}
        </div>
      )}

      {/* Close result toast */}
      {closeResult && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1001, padding: '10px 20px', background: closeResult.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${closeResult.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: closeResult.ok ? C.accentGreen : C.accentRed }}>
          {closeResult.msg}
        </div>
      )}

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ Header Card ═══ */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '18px 22px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary, letterSpacing: '-0.02em' }}>
              IRON GATE MR &mdash; Mean Reversion in Trend
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', color: C.accentGreen,
              animation: 'mr-pulse 2s infinite',
            }}>ACTIVE</span>
            {/* Connection */}
            <span style={{
              marginLeft: 'auto', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
              color: connected === 'connected' ? C.accentGreen : connected === 'idle' ? C.amber : C.accentRed,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              {connected}
            </span>
          </div>

          {/* Rule */}
          <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 12px 0', lineHeight: 1.5 }}>
            Buy sharp dips (RSI2&lt;10) above the 200-day; short spikes (RSI2&gt;90) below it. Exit when price crosses the 5-day average. Stop 3x ATR. Max 10 days.
          </p>

          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <KPIChip label="Trades" value={String(liveSC?.trades ?? '-')} />
            <KPIChip label="Win %" value={liveSC?.win_pct != null ? `${liveSC.win_pct.toFixed(1)}%` : '-'} color={(liveSC?.win_pct ?? 0) >= 60 ? C.accentGreen : C.accentRed} />
            <KPIChip label="Avg P&L" value={liveSC?.avg_pnl_pct != null ? `${liveSC.avg_pnl_pct >= 0 ? '+' : ''}${liveSC.avg_pnl_pct.toFixed(2)}%` : '-'} color={(liveSC?.avg_pnl_pct ?? 0) >= 0 ? C.accentGreen : C.accentRed} />
            <KPIChip label="Profit Factor" value={liveSC?.profit_factor != null ? liveSC.profit_factor.toFixed(2) : '-'} color={(liveSC?.profit_factor ?? 0) >= 1.2 ? C.accentGreen : C.accentRed} />
            <KPIChip label="Total P&L" value={liveSC?.total_pnl_pct != null ? `${liveSC.total_pnl_pct >= 0 ? '+' : ''}${liveSC.total_pnl_pct.toFixed(2)}%` : '-'} color={(liveSC?.total_pnl_pct ?? 0) >= 0 ? C.accentGreen : C.accentRed} />
          </div>

          {/* Promotion meter */}
          <PromotionMeter promo={livePromo} />

          {/* Last scan + Scan Now */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.cardBorder}` }}>
            {scanInfo && (
              <div style={{ fontSize: 10, color: C.textMuted, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Last scan: <span style={{ color: C.textSecondary, fontFamily: MONO }}>{scanInfo.date}</span></span>
                <span style={{ color: C.textSecondary, fontFamily: MONO }}>{scanInfo.time} CT</span>
                <span>Signals: <span style={{ color: C.accentGreen, fontFamily: MONO }}>{scanInfo.newSignals}</span></span>
                <span>Exits: <span style={{ color: C.amber, fontFamily: MONO }}>{scanInfo.exits}</span></span>
                {scanInfo.hasErrors && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: C.accentRed }}>ERRORS</span>}
                {scanInfo.isPreview && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: C.amber }}>PREVIEW</span>}
              </div>
            )}
            <button onClick={handleScan} disabled={scanStatus === 'scanning'} style={{
              marginLeft: 'auto', padding: '6px 16px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: scanStatus === 'scanning' ? 'wait' : 'pointer', transition: 'all 0.15s',
              background: scanStatus === 'ok' ? 'rgba(34,197,94,0.15)' : scanStatus === 'err' ? 'rgba(239,68,68,0.15)' : 'rgba(255,215,0,0.12)',
              border: `1px solid ${scanStatus === 'ok' ? 'rgba(34,197,94,0.5)' : scanStatus === 'err' ? 'rgba(239,68,68,0.5)' : 'rgba(255,215,0,0.45)'}`,
              color: scanStatus === 'ok' ? C.accentGreen : scanStatus === 'err' ? C.accentRed : C.accentYellow,
            }}>
              {scanStatus === 'scanning' ? 'Scanning...' : scanStatus === 'ok' ? 'Done' : scanStatus === 'err' ? 'Failed' : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* ═══ Error ═══ */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>&#9888;&#65039;</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accentRed, marginBottom: 2 }}>Connection Error</div>
                <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)' }}>{error}</div>
              </div>
            </div>
            <button onClick={refetch} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.accentRed, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Retry</button>
          </div>
        )}

        {/* ═══ Sub-tabs ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20,
              border: `1px solid ${activeTab === tab.id ? 'rgba(59,130,246,0.6)' : C.cardBorder}`,
              background: activeTab === tab.id ? 'rgba(59,130,246,0.12)' : C.innerRowBg,
              color: activeTab === tab.id ? '#60A5FA' : C.textMuted,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 10,
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.2)',
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ═══ Tab content ═══ */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '18px' }}>
          {activeTab === 'open' && (
            open.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>&#127793;</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No open MR positions</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Next scan after the 4 PM ET close.</div>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading positions...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
                {open.map(pos => (
                  <OpenPositionCard
                    key={pos.id}
                    pos={pos}
                    bars={barsBySymbol[pos.symbol]}
                    tf={chartTf}
                    onTfChange={setChartTf}
                    onClose={handleClose}
                  />
                ))}
              </div>
            )
          )}

          {activeTab === 'entering' && (
            <EnteringTable signals={pendingSignals} loading={loading} />
          )}

          {activeTab === 'history' && (
            <HistoryTable history={history} loading={loading} />
          )}

          {activeTab === 'shadow' && (
            <ShadowTable shadow={shadow} loading={loading} />
          )}

          {activeTab === 'scorecard' && (
            <ScorecardTab scorecard={scorecard} weekly={weekly} loading={loading} />
          )}

          {activeTab === 'skips' && (
            <SkipsTable skips={skips} loading={loading} />
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${C.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Iron Gate MR &bull; Mean Reversion in Trend &bull; Realtime via Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export default IronGateMRDashboard;
