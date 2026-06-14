import React, { useMemo, useState } from 'react';
import { C } from './constants';
import { useIronGateDay } from './useIronGateDay';
import { useETClock } from './useETClock';
import { useScanWindow } from './useScanWindow';
import { HeaderCard } from './HeaderCard';
import { SignalCountCards } from './SignalCountCards';
import { TabSwitcher } from './TabSwitcher';
import { OpenPositionsTable } from './OpenPositionsTable';
import { HistoryTable } from './HistoryTable';
import type { ActiveTab, SignalFilter, Toast } from './types';

/* ─── Keyframe styles ─────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800;900&display=swap');

  @keyframes igd-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(1.3); }
  }
  @keyframes igd-flash-in {
    0%   { opacity: 0; transform: translateY(-8px); box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    30%  { opacity: 1; transform: translateY(0);    box-shadow: 0 0 24px 4px rgba(34,197,94,0.3); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  @keyframes igd-pulse-row {
    0%   { opacity: 1; }
    50%  { opacity: 0.65; }
    100% { opacity: 1; }
  }
  @keyframes igd-skeleton {
    0%   { opacity: 0.7; }
    50%  { opacity: 0.4; }
    100% { opacity: 0.7; }
  }
  @keyframes igd-toast-in {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes igd-toast-out {
    from { opacity: 1; }
    to   { opacity: 0; transform: translateX(24px); }
  }
`;

/* ─── Toast notification ─────────────────────────────────── */
const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const colors = {
    win:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.5)',  text: C.accentGreen },
    loss: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)',  text: C.accentRed },
    new:  { bg: 'rgba(255,215,0,0.1)',  border: 'rgba(255,215,0,0.45)', text: C.accentYellow },
    info: { bg: C.cardBg,               border: C.cardBorder,            text: C.textSecondary },
  };
  const c = colors[toast.type];
  const icons = { win: '✅', loss: '🛑', new: '⚡', info: 'ℹ️' };

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      maxWidth: 320,
      animation: 'igd-toast-in 0.3s ease',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[toast.type]}</span>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: c.text, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
};

/* ─── Error Banner ───────────────────────────────────────── */
const ErrorBanner: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div style={{
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 12,
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accentRed, marginBottom: 2 }}>Connection Error</div>
        <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)' }}>{error}</div>
      </div>
    </div>
    <button
      onClick={onRetry}
      style={{
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: 8,
        padding: '6px 14px',
        cursor: 'pointer',
        color: C.accentRed,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      Retry
    </button>
  </div>
);

/* ─── Main Component ─────────────────────────────────────── */
interface Props {
  // Passed from App.tsx for optional trade execution — wired through PositionCard if needed
  onExecute?: (signal: any) => void;
}

const IRON_GATE_DAY_WEBHOOK = 'https://prabhupadala01.app.n8n.cloud/webhook/Irorn_gate_day_trade';

const IronGateDayDashboard: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('positions');
  const [activeFilter, setActiveFilter] = useState<SignalFilter>('ALL');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'ok' | 'err'>('idle');

  const handleManualScan = async () => {
    if (scanStatus === 'scanning') return;
    setScanStatus('scanning');
    try {
      await fetch(IRON_GATE_DAY_WEBHOOK, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ triggered_by: 'manual' }),
      });
      setScanStatus('ok');
    } catch {
      setScanStatus('err');
    } finally {
      setTimeout(() => setScanStatus('idle'), 4000);
    }
  };

  const {
    openPositions, todayHistory, allHistory,
    loading, connected, error,
    toasts, flashIds, updatedIds,
    historyPulse, refetch, dismissToast,
  } = useIronGateDay();

  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyPreset, setHistoryPreset] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const setPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    setHistoryPreset(preset);
    if (preset === 'today') {
      setHistoryDateFrom(''); setHistoryDateTo('');
    } else if (preset === 'week') {
      const from = new Date(now); from.setDate(now.getDate() - 6);
      setHistoryDateFrom(from.toISOString().slice(0, 10)); setHistoryDateTo(now.toISOString().slice(0, 10));
    } else if (preset === 'month') {
      const from = new Date(now); from.setDate(now.getDate() - 29);
      setHistoryDateFrom(from.toISOString().slice(0, 10)); setHistoryDateTo(now.toISOString().slice(0, 10));
    } else {
      setHistoryDateFrom(''); setHistoryDateTo('');
    }
  };

  const filteredHistory = useMemo(() => {
    if (historyPreset === 'today') return todayHistory;
    if (!historyDateFrom && !historyDateTo) return allHistory;
    return allHistory.filter(h => {
      const d = h.closed_at ? h.closed_at.slice(0, 10) : '';
      if (historyDateFrom && d < historyDateFrom) return false;
      if (historyDateTo   && d > historyDateTo)   return false;
      return true;
    });
  }, [historyPreset, historyDateFrom, historyDateTo, todayHistory, allHistory]);

  const clock = useETClock();
  const scan = useScanWindow();

  // Counts for signal cards (always from full openPositions list)
  const counts = useMemo(() => ({
    strongBuy:  openPositions.filter(p => p.action === 'BUY'  && p.tier === 'A+').length,
    buy:        openPositions.filter(p => p.action === 'BUY'  && p.tier !== 'A+').length,
    strongSell: openPositions.filter(p => p.action === 'SELL' && p.tier === 'A+').length,
    sell:       openPositions.filter(p => p.action === 'SELL' && p.tier !== 'A+').length,
  }), [openPositions]);

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, color: C.textPrimary, fontFamily: 'Inter, sans-serif' }}>
      <style>{STYLES}</style>

      {/* Toast container */}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <HeaderCard clock={clock} connectionStatus={connected} onScan={handleManualScan} scanStatus={scanStatus} />

        {/* Signal count cards */}
        <SignalCountCards
          positions={openPositions}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Error */}
        {error && <ErrorBanner error={error} onRetry={refetch} />}

        {/* Performance stats + Tab switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <TabSwitcher
            activeTab={activeTab}
            openCount={openPositions.length}
            historyCount={todayHistory.length}
            historyPulse={historyPulse}
            onTabChange={setActiveTab}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Active filter indicator */}
            {activeFilter !== 'ALL' && activeTab === 'positions' && (
              <span style={{
                padding: '5px 12px',
                borderRadius: 20,
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.35)',
                fontSize: 11,
                fontWeight: 700,
                color: C.blue,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                Filter: {activeFilter.replace('_', ' ')}
                <button
                  onClick={() => setActiveFilter('ALL')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 0, fontSize: 14, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            )}
            {/* Counts summary */}
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {Object.values(counts).some(v => (v as number) > 0) ? (
                <span>
                  {counts.strongBuy > 0 && <span style={{ color: C.strongBuyColor, fontWeight: 700 }}>{counts.strongBuy} SB </span>}
                  {counts.buy > 0       && <span style={{ color: C.buyColor, fontWeight: 700 }}>{counts.buy} B </span>}
                  {counts.strongSell > 0 && <span style={{ color: C.strongSellColor, fontWeight: 700 }}>{counts.strongSell} SS </span>}
                  {counts.sell > 0      && <span style={{ color: C.sellColor, fontWeight: 700 }}>{counts.sell} S</span>}
                </span>
              ) : (
                <span style={{ color: C.textMuted }}>No active positions</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'positions' ? (
          <OpenPositionsTable
            positions={openPositions}
            activeFilter={activeFilter}
            flashIds={flashIds}
            updatedIds={updatedIds}
            loading={loading}
            isMarketOpen={clock.isMarketOpen}
            isWeekend={clock.isWeekend}
            scan={scan}
          />
        ) : (
          <>
            {/* History date filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filter:</span>
              {(['today', 'week', 'month', 'all'] as const).map(p => {
                const labels: Record<string, string> = { today: 'Today', week: 'This Week', month: '30 Days', all: 'All' };
                const counts: Record<string, number> = {
                  today: todayHistory.length,
                  week: 0, month: 0,
                  all: allHistory.length,
                };
                const isActive = historyPreset === p && (p !== 'week' && p !== 'month');
                const isCustomActive = (p === 'week' || p === 'month') && historyPreset === p;
                return (
                  <button key={p} onClick={() => setPreset(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    border: `1px solid ${(isActive || isCustomActive) ? 'rgba(59,130,246,0.6)' : C.cardBorder}`,
                    background: (isActive || isCustomActive) ? 'rgba(59,130,246,0.12)' : C.innerRowBg,
                    color: (isActive || isCustomActive) ? '#60A5FA' : C.textMuted,
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labels[p]}</span>
                    {counts[p] > 0 && <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 10 }}>{counts[p]}</span>}
                  </button>
                );
              })}
              <span style={{ color: C.cardBorder, fontSize: 10 }}>|</span>
              <input
                type="date"
                value={historyDateFrom}
                onChange={e => { setHistoryDateFrom(e.target.value); setHistoryPreset('all'); }}
                style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.innerRowBg, color: C.textPrimary, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
              />
              <span style={{ color: C.textMuted, fontSize: 10 }}>–</span>
              <input
                type="date"
                value={historyDateTo}
                onChange={e => { setHistoryDateTo(e.target.value); setHistoryPreset('all'); }}
                style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.innerRowBg, color: C.textPrimary, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
              />
              {(historyDateFrom || historyDateTo) && historyPreset === 'all' && (
                <button onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>clear</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 9, color: C.textMuted, fontWeight: 700 }}>{filteredHistory.length} of {allHistory.length} shown</span>
            </div>
            <HistoryTable
              history={filteredHistory}
              loading={loading}
            />
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${C.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Iron Gate Day Trade &bull; 5-Gate v5.8 &bull; Realtime via Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export default IronGateDayDashboard;
