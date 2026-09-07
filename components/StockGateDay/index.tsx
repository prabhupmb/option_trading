import React, { useMemo, useState } from 'react';
import { C } from '../IronGateDay/constants';
import { useETClock } from '../IronGateDay/useETClock';
import { useScanWindow } from '../IronGateDay/useScanWindow';
import { useStockGateDay } from './useStockGateDay';
import type { StockGateDayPosition, StockGateDayHistory, ActiveTab, SignalFilter, Toast, ConnectionStatus } from './types';

/* ─── Keyframe styles ─────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800;900&display=swap');

  @keyframes sgd-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(1.3); }
  }
  @keyframes sgd-flash-in {
    0%   { opacity: 0; transform: translateY(-8px); box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    30%  { opacity: 1; transform: translateY(0);    box-shadow: 0 0 24px 4px rgba(34,197,94,0.3); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  @keyframes sgd-pulse-row {
    0%   { opacity: 1; }
    50%  { opacity: 0.65; }
    100% { opacity: 1; }
  }
  @keyframes sgd-skeleton {
    0%   { opacity: 0.7; }
    50%  { opacity: 0.4; }
    100% { opacity: 0.7; }
  }
  @keyframes sgd-toast-in {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`;

/* ─── Helpers ────────────────────────────────────────────── */

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/* ─── Tier / Action badge colors ─────────────────────────── */

const tierColors: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  'A+': { bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.5)', text: C.tierAPlus, glow: 'rgba(255,215,0,0.2)' },
  'A':  { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.4)',  text: C.tierA },
  'B':  { bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.3)',text: C.tierB },
};

/* ─── Inline sub-components ──────────────────────────────── */

const StatCell: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={{
    flex: 1,
    background: C.innerRowBg,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: valueColor || C.textPrimary }}>
      {value}
    </div>
  </div>
);

const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const colors = tierColors[tier] || tierColors['B'];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 6,
      border: `1px solid ${colors.border}`, background: colors.bg,
      color: colors.text, fontSize: 10, fontWeight: 900,
      letterSpacing: '0.05em',
      boxShadow: colors.glow ? `0 0 8px ${colors.glow}` : 'none',
    }}>{tier}</span>
  );
};

const TierSquare: React.FC<{ tier: string; symbol: string }> = ({ tier, symbol }) => {
  const colors = tierColors[tier] || tierColors['B'];
  const abbr = symbol.slice(0, 3);
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 10,
      background: colors.bg, border: `2px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: colors.glow ? `0 0 12px ${colors.glow}` : 'none',
    }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: colors.text, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{abbr}</span>
      <span style={{ fontSize: 8, fontWeight: 700, color: colors.text, opacity: 0.7, letterSpacing: '0.05em' }}>{tier}</span>
    </div>
  );
};

const ActionBadge: React.FC<{ action: 'BUY' | 'SELL'; tier?: string }> = ({ action, tier }) => {
  const isStrong = tier === 'A+';
  const isBuy = action === 'BUY';
  const bg = isBuy
    ? (isStrong ? 'rgba(22,163,74,0.15)' : 'rgba(34,197,94,0.1)')
    : (isStrong ? 'rgba(220,38,38,0.15)' : 'rgba(239,68,68,0.1)');
  const border = isBuy
    ? (isStrong ? 'rgba(22,163,74,0.6)' : 'rgba(34,197,94,0.4)')
    : (isStrong ? 'rgba(220,38,38,0.6)' : 'rgba(239,68,68,0.4)');
  const text = isBuy
    ? (isStrong ? C.strongBuyColor : C.buyColor)
    : (isStrong ? C.strongSellColor : C.sellColor);
  const glow = isStrong ? (isBuy ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)') : 'none';
  const label = isStrong ? (isBuy ? 'STRONG BUY' : 'STRONG SELL') : action;
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 6,
      border: `1px solid ${border}`, background: bg, color: text,
      fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
      boxShadow: glow !== 'none' ? `0 0 10px ${glow}` : 'none',
    }}>{label}</span>
  );
};

const ResultBadge: React.FC<{ result: string }> = ({ result }) => {
  const cfgs: Record<string, { color: string; bg: string; border: string }> = {
    WIN:       { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.5)' },
    LOSS:      { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.5)' },
    BREAKEVEN: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.3)' },
  };
  const cfg = cfgs[result] || cfgs['BREAKEVEN'];
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 20,
      border: `1px solid ${cfg.border}`, background: cfg.bg,
      color: cfg.color, fontSize: 11, fontWeight: 900, letterSpacing: '0.06em',
    }}>{result}</span>
  );
};

const ExitReasonBadge: React.FC<{ reason: string }> = ({ reason }) => {
  const cfgs: Record<string, { color: string; bg: string; border: string }> = {
    TARGET_HIT: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)' },
    STOP_LOSS:  { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)' },
    EOD:        { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.4)' },
    ST_1H_FLIP: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.4)' },
    STALE_8H:   { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  };
  const labels: Record<string, string> = {
    TARGET_HIT: 'Target Hit', STOP_LOSS: 'Stop Loss', EOD: 'EOD Close',
    ST_1H_FLIP: 'ST Flip', STALE_8H: 'Stale 8H',
  };
  const cfg = cfgs[reason] || cfgs['EOD'];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 6,
      border: `1px solid ${cfg.border}`, background: cfg.bg,
      color: cfg.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    }}>{labels[reason] || reason}</span>
  );
};

/* ─── Progress Bar ───────────────────────────────────────── */

function progressColor(pct: number): string {
  if (pct < 25) return '#EF4444';
  if (pct < 50) return '#F59E0B';
  if (pct < 75) return '#FFD700';
  return '#22C55E';
}

function progressEmoji(pct: number): string {
  if (pct >= 100) return '🎯';
  if (pct <= 5) return '🛑';
  if (pct >= 75) return '🟢';
  if (pct >= 40) return '🟡';
  return '🔴';
}

const ProgressBar: React.FC<{ progress: number; isBuy: boolean }> = ({ progress }) => {
  const pct = Math.max(0, Math.min(100, progress || 0));
  const emoji = progressEmoji(pct);
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative', height: 28, borderRadius: 8,
        background: '#0A1414', border: `1px solid ${C.cardBorder}`, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${pct}%`, borderRadius: pct >= 100 ? 8 : '8px 0 0 8px',
          background: 'linear-gradient(90deg, #EF4444 0%, #F59E0B 30%, #FFD700 55%, #22C55E 100%)',
          backgroundSize: '200% 100%', backgroundPosition: `${100 - pct}% 0`,
          transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)', opacity: 0.9,
        }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: 'rgba(255,215,0,0.6)', zIndex: 2 }} />
        <div style={{
          position: 'absolute', top: '50%', left: 'calc(50% - 5px)',
          width: 10, height: 10, borderRadius: '50%', background: '#FFD700',
          border: `2px solid ${C.cardBg}`, zIndex: 3, transform: 'translateY(-50%)',
        }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
          <span style={{
            fontSize: 12, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
            color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}>{emoji} {pct.toFixed(1)}%</span>
        </div>
        {pct > 0 && pct < 100 && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 2,
            background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.8)', zIndex: 3,
            transition: 'left 0.7s cubic-bezier(0.16,1,0.3,1)',
          }} />
        )}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 5,
        fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', padding: '0 2px',
      }}>
        <span style={{ color: '#EF4444' }}>SL</span>
        <span style={{ color: '#FFD700' }}>Entry</span>
        <span style={{ color: '#22C55E' }}>Target</span>
      </div>
    </div>
  );
};

/* ─── Connection Indicator ───────────────────────────────── */

const ConnectionIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const cfg = {
    connected:    { color: '#22C55E', label: 'Live', pulse: true },
    idle:         { color: '#FFD700', label: 'Idle', pulse: false },
    disconnected: { color: '#EF4444', label: 'Offline', pulse: false },
  }[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color,
        display: 'inline-block',
        animation: cfg.pulse ? 'sgd-pulse 2s infinite' : 'none',
        boxShadow: cfg.pulse ? `0 0 6px ${cfg.color}` : 'none',
      }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {cfg.label}
      </span>
    </div>
  );
};

/* ─── Toast ──────────────────────────────────────────────── */

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const colors = {
    win:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.5)',  text: C.accentGreen },
    loss: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)',  text: C.accentRed },
    new:  { bg: 'rgba(255,215,0,0.1)',  border: 'rgba(255,215,0,0.45)', text: C.accentYellow },
    info: { bg: C.cardBg,               border: C.cardBorder,            text: C.textSecondary },
  };
  const c = colors[toast.type];
  const icons = { win: '✅', loss: '🛑', new: '📈', info: 'ℹ️' };
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      maxWidth: 320, animation: 'sgd-toast-in 0.3s ease',
      backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[toast.type]}</span>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: c.text, lineHeight: 1.4 }}>{toast.message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
    </div>
  );
};

/* ─── Error Banner ───────────────────────────────────────── */

const ErrorBanner: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div style={{
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 12, padding: '12px 18px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accentRed, marginBottom: 2 }}>Connection Error</div>
        <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)' }}>{error}</div>
      </div>
    </div>
    <button onClick={onRetry} style={{
      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.accentRed,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>Retry</button>
  </div>
);

/* ─── Skeleton Card ──────────────────────────────────────── */

const SkeletonCard: React.FC = () => (
  <div style={{
    background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
    padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    animation: 'sgd-skeleton 1.5s infinite',
  }}>
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: C.innerRowBg }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 20, width: '40%', borderRadius: 6, background: C.innerRowBg }} />
        <div style={{ height: 16, width: '60%', borderRadius: 6, background: C.innerRowBg }} />
      </div>
    </div>
    <div style={{ height: 28, borderRadius: 8, background: C.innerRowBg }} />
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 56, borderRadius: 8, background: C.innerRowBg }} />)}
    </div>
  </div>
);

/* ─── Position Card ──────────────────────────────────────── */

const PositionCard: React.FC<{
  pos: StockGateDayPosition;
  isFlashing?: boolean;
  isUpdated?: boolean;
}> = ({ pos, isFlashing, isUpdated }) => {
  const [expanded, setExpanded] = useState(false);
  const isBuy = pos.action === 'BUY';
  const current = pos.current_price ?? pos.entry_price;
  const pnlPct = pos.pnl_pct ?? 0;
  const pnlDollars = pos.pnl_dollars ?? 0;
  const isProfit = pnlPct >= 0;

  const vwapColor = pos.vwap_position === 'ABOVE' ? C.accentGreen : pos.vwap_position === 'BELOW' ? C.accentRed : C.textSecondary;
  const adxColor = (pos.adx_value || 0) >= 25 ? C.accentGreen : (pos.adx_value || 0) >= 20 ? '#F59E0B' : C.accentRed;
  const volColor = (pos.volume_ratio || 0) >= 1.5 ? C.accentGreen : C.textSecondary;

  const cardBorder = isFlashing
    ? (isBuy ? 'rgba(22,163,74,0.8)' : 'rgba(220,38,38,0.8)')
    : C.cardBorder;
  const cardGlow = isFlashing
    ? (isBuy ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)')
    : pos.tier === 'A+' && isBuy ? 'rgba(22,163,74,0.06)'
    : pos.tier === 'A+' && !isBuy ? 'rgba(220,38,38,0.06)'
    : 'none';

  // Progress calculation
  let progress = pos.progress_pct || 0;
  if (progress === 0 && pos.entry_price && pos.target_1 && pos.stop_loss) {
    if (isBuy) {
      progress = Math.max(0, Math.min(100, ((current - pos.stop_loss) / (pos.target_1 - pos.stop_loss)) * 100));
    } else {
      progress = Math.max(0, Math.min(100, ((pos.stop_loss - current) / (pos.stop_loss - pos.target_1)) * 100));
    }
  }

  return (
    <div style={{
      background: C.cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12,
      overflow: 'hidden', transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: cardGlow !== 'none' ? `0 0 20px ${cardGlow}` : 'none',
      animation: isFlashing ? 'sgd-flash-in 0.4s ease' : isUpdated ? 'sgd-pulse-row 0.5s ease' : 'none',
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Top Row */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <TierSquare tier={pos.tier} symbol={pos.symbol} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em' }}>
                {pos.symbol}
              </span>
              <ActionBadge action={pos.action} tier={pos.tier} />
              <TierBadge tier={pos.tier} />
              {pos.stage_2 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Stage 2
                </span>
              )}
              {pos.signal_type && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {pos.signal_type}
                </span>
              )}
            </div>
            {/* Current price + P&L */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary }}>
                {fmt(current)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: isProfit ? C.accentGreen : C.accentRed }}>
                {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: isProfit ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' }}>
                ({isProfit ? '+' : ''}{fmt(pnlDollars)})
              </span>
            </div>
          </div>

          {/* Right side: Entry + levels */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>
              Entry <span style={{ color: '#FFD700', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{fmt(pos.entry_price)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              T1 <span style={{ color: C.accentGreen, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{fmt(pos.target_1)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              SL <span style={{ color: C.accentRed, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{fmt(pos.stop_loss)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
              R:R <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>1:{(pos.risk_reward_ratio || 0).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} isBuy={isBuy} />

        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCell label="Gates" value={`${pos.gate_score || 0}/5`} valueColor={pos.gate_score >= 4 ? C.accentGreen : '#F59E0B'} />
          <StatCell label="ADX" value={(pos.adx_value || 0).toFixed(1)} valueColor={adxColor} />
          <StatCell label="VWAP" value={pos.vwap_position || '—'} valueColor={vwapColor} />
          <StatCell label="Volume" value={pos.volume_ratio != null ? `${pos.volume_ratio.toFixed(2)}x` : '—'} valueColor={volColor} />
        </div>

        {/* Stock-specific row: Sector, Gap%, Float */}
        {(pos.sector || pos.gap_pct != null || pos.market_cap) && (
          <div style={{ display: 'flex', gap: 8 }}>
            {pos.sector && <StatCell label="Sector" value={pos.sector} />}
            {pos.gap_pct != null && (
              <StatCell label="Gap" value={`${pos.gap_pct >= 0 ? '+' : ''}${pos.gap_pct.toFixed(1)}%`} valueColor={pos.gap_pct >= 0 ? C.accentGreen : C.accentRed} />
            )}
            {pos.market_cap && <StatCell label="Mkt Cap" value={pos.market_cap} />}
          </div>
        )}

        {/* Expandable details */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            color: C.textMuted, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <span style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
          {expanded ? 'Hide' : 'Show'} Technical Details
        </button>

        {expanded && (
          <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.textMuted }}>ADX: <span style={{ color: adxColor, fontWeight: 700 }}>{(pos.adx_value || 0).toFixed(1)}</span></span>
              <span style={{ color: C.textMuted }}>+DI: <span style={{ color: C.accentGreen, fontWeight: 700 }}>{(pos.plus_di || 0).toFixed(1)}</span></span>
              <span style={{ color: C.textMuted }}>-DI: <span style={{ color: C.accentRed, fontWeight: 700 }}>{(pos.minus_di || 0).toFixed(1)}</span></span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.textMuted }}>VWAP: <span style={{ color: vwapColor, fontWeight: 700 }}>{fmt(pos.vwap_value)} ({pos.vwap_position})</span></span>
              {pos.vwap_crossed && (
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚡ Crossed {pos.vwap_cross_dir}</span>
              )}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.textMuted }}>
              SuperTrend 5M:{' '}
              <span style={{ color: pos.supertrend_5m === 'BULLISH' ? C.accentGreen : C.accentRed, fontWeight: 700 }}>
                {pos.supertrend_5m || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.accentGreen, fontWeight: 700 }}>HWM: {(pos.high_water_mark || 0).toFixed(1)}%</span>
              <span style={{ color: C.accentRed, fontWeight: 700 }}>LWM: {(pos.low_water_mark || 0).toFixed(1)}%</span>
            </div>
            {pos.premarket_volume != null && (
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.textMuted }}>
                Premarket Vol: <span style={{ color: C.textSecondary, fontWeight: 700 }}>{pos.premarket_volume.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 10, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}`,
          paddingTop: 10, flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <span>Opened <span style={{ color: C.textSecondary }}>{timeSince(pos.opened_at)}</span></span>
            <span>Last check <span style={{ color: C.textSecondary }}>{timeSince(pos.last_checked_at)}</span></span>
            <span style={{ color: C.textMuted }}>
              Checks: <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{pos.check_count || 0}</span>
            </span>
            {pos.version && (
              <span style={{ color: C.textMuted }}>
                <span style={{ color: C.accentYellow, fontWeight: 700 }}>#{pos.source || 'SG-DAY'}</span> {pos.version}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── History Card ───────────────────────────────────────── */

const HistoryCard: React.FC<{ entry: StockGateDayHistory }> = ({ entry }) => {
  const isWin = entry.result === 'WIN';
  const isLoss = entry.result === 'LOSS';
  const pnlColor = isWin ? C.accentGreen : isLoss ? C.accentRed : C.textSecondary;
  const pnlSign = (entry.pnl_pct || 0) >= 0 ? '+' : '';
  const borderColor = isWin ? 'rgba(34,197,94,0.25)' : isLoss ? 'rgba(239,68,68,0.2)' : C.cardBorder;
  const bgGlow = isWin ? 'rgba(34,197,94,0.04)' : isLoss ? 'rgba(239,68,68,0.04)' : 'transparent';

  return (
    <div style={{
      background: C.cardBg, border: `1px solid ${borderColor}`, borderRadius: 12,
      overflow: 'hidden', boxShadow: `0 0 20px ${bgGlow}`,
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <TierSquare tier={entry.tier} symbol={entry.symbol} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em' }}>
                {entry.symbol}
              </span>
              <ActionBadge action={entry.action} tier={entry.tier} />
              <TierBadge tier={entry.tier} />
              <ResultBadge result={entry.result} />
              <ExitReasonBadge reason={entry.exit_reason} />
              {entry.stage_2 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textTransform: 'uppercase' }}>
                  Stage 2
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: C.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                Entry <span style={{ color: '#FFD700', fontWeight: 700 }}>{fmt(entry.entry_price)}</span>
              </span>
              <span style={{ color: C.textMuted }}>→</span>
              <span style={{ fontSize: 13, color: C.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                Exit <span style={{ color: pnlColor, fontWeight: 700 }}>{fmt(entry.exit_price)}</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: pnlColor }}>
                {pnlSign}{(entry.pnl_pct || 0).toFixed(2)}%
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: pnlColor, opacity: 0.7 }}>
                ({pnlSign}{fmt(entry.pnl_dollars)})
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <StatCell label="Duration" value={formatDuration(entry.duration_minutes)} />
          <StatCell label="Gates" value={`${entry.gate_score || 0}/5`} valueColor={entry.gate_score >= 4 ? C.accentGreen : '#F59E0B'} />
          <StatCell label="Final %" value={`${(entry.final_progress || 0).toFixed(0)}%`} valueColor={isWin ? C.accentGreen : isLoss ? C.accentRed : C.textSecondary} />
          <StatCell label="Checks" value={entry.check_count || 0} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted,
          borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10, flexWrap: 'wrap', gap: 4,
        }}>
          <span>Opened <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(entry.opened_at)} ET</span></span>
          <span style={{ color: C.textMuted }}>→</span>
          <span>Closed <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(entry.closed_at)} ET</span></span>
          {entry.version && (
            <span>
              <span style={{ color: C.accentYellow, fontWeight: 700 }}>#{entry.source || 'SG-DAY'}</span>
              <span style={{ color: C.textMuted }}> {entry.version}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Performance Stats ──────────────────────────────────── */

const PerformanceStats: React.FC<{ history: StockGateDayHistory[] }> = ({ history }) => {
  if (history.length === 0) return null;
  const wins = history.filter(h => h.result === 'WIN').length;
  const losses = history.filter(h => h.result === 'LOSS').length;
  const winRate = (wins / history.length) * 100;
  const totalPnlDollars = history.reduce((a, h) => a + (h.pnl_dollars || 0), 0);
  const totalPnlPct = history.reduce((a, h) => a + (h.pnl_pct || 0), 0);
  const avgHold = history.reduce((a, h) => a + (h.duration_minutes || 0), 0) / history.length;
  const positive = totalPnlDollars >= 0;
  const pnlColor = positive ? C.accentGreen : C.accentRed;
  const winRateColor = winRate >= 60 ? C.accentGreen : winRate >= 40 ? '#F59E0B' : C.accentRed;

  const items: { label: string; value: string; color?: string }[] = [
    { label: 'Today', value: `${history.length} trade${history.length !== 1 ? 's' : ''}` },
    { label: 'Record', value: `${wins}W / ${losses}L`, color: winRateColor },
    { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, color: winRateColor },
    { label: 'Total P&L', value: `${positive ? '+' : ''}$${totalPnlDollars.toFixed(2)}`, color: pnlColor },
    { label: 'Total %', value: `${positive ? '+' : ''}${totalPnlPct.toFixed(2)}%`, color: pnlColor },
    { label: 'Avg Hold', value: formatDuration(avgHold) },
  ];

  return (
    <div style={{
      background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Today:</span>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <span style={{ color: C.cardBorderHover, fontSize: 12 }}>•</span>}
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            {item.label}{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: item.color || C.textPrimary }}>
              {item.value}
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

/* ─── Signal Count Cards ─────────────────────────────────── */

const SignalCountCards: React.FC<{
  positions: StockGateDayPosition[];
  activeFilter: SignalFilter;
  onFilterChange: (f: SignalFilter) => void;
}> = ({ positions, activeFilter, onFilterChange }) => {
  const cards: { id: SignalFilter; label: string; color: string; bgActive: string; borderActive: string; glow: string; filter: (p: StockGateDayPosition) => boolean }[] = [
    { id: 'STRONG_BUY',  label: 'Strong Buy',  color: C.strongBuyColor,  bgActive: 'rgba(22,163,74,0.12)',  borderActive: 'rgba(22,163,74,0.6)',  glow: 'rgba(22,163,74,0.2)',  filter: p => p.action === 'BUY' && p.tier === 'A+' },
    { id: 'BUY',         label: 'Buy',         color: C.buyColor,        bgActive: 'rgba(34,197,94,0.1)',   borderActive: 'rgba(34,197,94,0.5)',  glow: 'none',                filter: p => p.action === 'BUY' && p.tier !== 'A+' },
    { id: 'STRONG_SELL', label: 'Strong Sell', color: C.strongSellColor, bgActive: 'rgba(220,38,38,0.12)', borderActive: 'rgba(220,38,38,0.6)', glow: 'rgba(220,38,38,0.2)', filter: p => p.action === 'SELL' && p.tier === 'A+' },
    { id: 'SELL',        label: 'Sell',        color: C.sellColor,       bgActive: 'rgba(239,68,68,0.1)',  borderActive: 'rgba(239,68,68,0.5)', glow: 'none',                filter: p => p.action === 'SELL' && p.tier !== 'A+' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(card => {
        const count = positions.filter(card.filter).length;
        const isActive = activeFilter === card.id;
        return (
          <button key={card.id} onClick={() => onFilterChange(isActive ? 'ALL' : card.id)} style={{
            background: isActive ? card.bgActive : C.cardBg,
            border: `1px solid ${isActive ? card.borderActive : C.cardBorder}`,
            borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: isActive && card.glow !== 'none' ? `0 0 20px ${card.glow}` : 'none',
            outline: 'none',
          }}>
            <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: card.color, lineHeight: 1, marginBottom: 8 }}>
              {count}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? card.color : C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};

/* ─── Tab Switcher ───────────────────────────────────────── */

const TabSwitcher: React.FC<{
  activeTab: ActiveTab;
  openCount: number;
  historyCount: number;
  historyPulse: boolean;
  onTabChange: (t: ActiveTab) => void;
}> = ({ activeTab, openCount, historyCount, historyPulse, onTabChange }) => {
  const tabs: { id: ActiveTab; label: string; count: number; hasPulse?: boolean }[] = [
    { id: 'positions', label: 'Open Positions', count: openCount },
    { id: 'history', label: "Today's History", count: historyCount, hasPulse: historyPulse },
  ];
  return (
    <div style={{ display: 'inline-flex', background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, borderRadius: 24, padding: 3, gap: 2 }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
            background: isActive ? C.blue : 'transparent', border: 'none', borderRadius: 20,
            padding: '8px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 700, color: isActive ? '#fff' : C.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s',
            boxShadow: isActive ? '0 2px 12px rgba(59,130,246,0.3)' : 'none',
            outline: 'none', whiteSpace: 'nowrap',
          }}>
            {tab.hasPulse && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accentGreen, display: 'inline-block', animation: 'sgd-pulse 2s infinite', boxShadow: `0 0 6px ${C.accentGreen}` }} />
            )}
            {tab.label}
            <span style={{
              background: isActive ? 'rgba(255,255,255,0.2)' : C.cardBorder,
              color: isActive ? '#fff' : C.textMuted, borderRadius: 10, padding: '1px 7px',
              fontSize: 11, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', minWidth: 20, textAlign: 'center',
            }}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────── */

const StockGateDayDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('positions');
  const [activeFilter, setActiveFilter] = useState<SignalFilter>('ALL');

  const {
    openPositions, todayHistory, allHistory,
    loading, connected, error,
    toasts, flashIds, updatedIds,
    historyPulse, refetch, dismissToast,
  } = useStockGateDay();

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
      if (historyDateTo && d > historyDateTo) return false;
      return true;
    });
  }, [historyPreset, historyDateFrom, historyDateTo, todayHistory, allHistory]);

  const clock = useETClock();
  const scan = useScanWindow();

  const counts = useMemo(() => ({
    strongBuy:  openPositions.filter(p => p.action === 'BUY' && p.tier === 'A+').length,
    buy:        openPositions.filter(p => p.action === 'BUY' && p.tier !== 'A+').length,
    strongSell: openPositions.filter(p => p.action === 'SELL' && p.tier === 'A+').length,
    sell:       openPositions.filter(p => p.action === 'SELL' && p.tier !== 'A+').length,
  }), [openPositions]);

  // Filter positions
  const filteredPositions = useMemo(() => {
    switch (activeFilter) {
      case 'STRONG_BUY':  return openPositions.filter(p => p.action === 'BUY' && p.tier === 'A+');
      case 'BUY':         return openPositions.filter(p => p.action === 'BUY' && p.tier !== 'A+');
      case 'STRONG_SELL': return openPositions.filter(p => p.action === 'SELL' && p.tier === 'A+');
      case 'SELL':        return openPositions.filter(p => p.action === 'SELL' && p.tier !== 'A+');
      default:            return openPositions;
    }
  }, [openPositions, activeFilter]);

  // Market status pill
  const marketPillBg = clock.isMarketOpen ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const marketPillBorder = clock.isMarketOpen ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
  const marketPillText = clock.isMarketOpen ? C.accentGreen : C.accentRed;
  const marketLabel = clock.isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED';

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

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, #131C1C 0%, #0F1A1A 100%)',
          border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, background: C.innerRowBg,
                border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 0 16px rgba(59,130,246,0.12)', flexShrink: 0,
              }}>📈</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h1 style={{
                    margin: 0, fontSize: 22, fontWeight: 900, color: C.textPrimary,
                    letterSpacing: '-0.02em', textTransform: 'uppercase',
                  }}>Stock Gate Day Trade</h1>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    background: marketPillBg, border: `1px solid ${marketPillBorder}`,
                    fontSize: 10, fontWeight: 700, color: marketPillText, letterSpacing: '0.06em',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: marketPillText,
                      display: 'inline-block', animation: clock.isMarketOpen ? 'sgd-pulse 2s infinite' : 'none',
                    }} />
                    {marketLabel}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.textSecondary }}>
                  Intraday stock scalp tracking &bull; 5-Gate
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {clock.formatted}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ET Market Time
              </div>
              <ConnectionIndicator status={connected} />
            </div>
          </div>
        </div>

        {/* Signal count cards */}
        <SignalCountCards positions={openPositions} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        {/* Error */}
        {error && <ErrorBanner error={error} onRetry={refetch} />}

        {/* Tab bar + summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <TabSwitcher activeTab={activeTab} openCount={openPositions.length} historyCount={todayHistory.length} historyPulse={historyPulse} onTabChange={setActiveTab} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {activeFilter !== 'ALL' && activeTab === 'positions' && (
              <span style={{
                padding: '5px 12px', borderRadius: 20,
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                fontSize: 11, fontWeight: 700, color: C.blue, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Filter: {activeFilter.replace('_', ' ')}
                <button onClick={() => setActiveFilter('ALL')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {Object.values(counts).some(v => (v as number) > 0) ? (
                <span>
                  {counts.strongBuy > 0 && <span style={{ color: C.strongBuyColor, fontWeight: 700 }}>{counts.strongBuy} SB </span>}
                  {counts.buy > 0 && <span style={{ color: C.buyColor, fontWeight: 700 }}>{counts.buy} B </span>}
                  {counts.strongSell > 0 && <span style={{ color: C.strongSellColor, fontWeight: 700 }}>{counts.strongSell} SS </span>}
                  {counts.sell > 0 && <span style={{ color: C.sellColor, fontWeight: 700 }}>{counts.sell} S</span>}
                </span>
              ) : (
                <span style={{ color: C.textMuted }}>No active positions</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'positions' ? (
          loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : openPositions.length === 0 ? (
            /* Empty state */
            <div style={{
              background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
              padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 16,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
                boxShadow: '0 0 24px rgba(59,130,246,0.1)',
              }}>📈</div>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: C.textPrimary, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                  Stock Gate Day Is Scanning
                </h3>
                <p style={{ margin: '0 0 4px', fontSize: 14, color: C.textSecondary }}>
                  Watching for A+, A, and B stock day-trade signals.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
                  {clock.isWeekend
                    ? 'Market reopens 9:30 AM ET Monday'
                    : !clock.isMarketOpen
                    ? 'Market reopens 9:30 AM ET'
                    : scan.nextScan
                    ? `Next scan at ${scan.nextScan} ET — in ${scan.countdown}`
                    : 'All scans complete for today'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMuted }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.blue, display: 'inline-block', animation: 'sgd-pulse 2s infinite' }} />
                Auto-polling every 15 seconds
              </div>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
                No positions match the <strong style={{ color: C.textPrimary }}>{activeFilter.replace('_', ' ')}</strong> filter.
              </p>
              <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                {openPositions.length} open position{openPositions.length !== 1 ? 's' : ''} in other categories.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
              {filteredPositions.map(pos => (
                <PositionCard key={pos.id} pos={pos} isFlashing={flashIds.has(pos.id)} isUpdated={updatedIds.has(pos.id)} />
              ))}
            </div>
          )
        ) : (
          <>
            {/* History date filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filter:</span>
              {(['today', 'week', 'month', 'all'] as const).map(p => {
                const labels: Record<string, string> = { today: 'Today', week: 'This Week', month: '30 Days', all: 'All' };
                const counts: Record<string, number> = { today: todayHistory.length, week: 0, month: 0, all: allHistory.length };
                const isActive = historyPreset === p && (p !== 'week' && p !== 'month');
                const isCustomActive = (p === 'week' || p === 'month') && historyPreset === p;
                return (
                  <button key={p} onClick={() => setPreset(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20,
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
              <input type="date" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setHistoryPreset('all'); }}
                style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.innerRowBg, color: C.textPrimary, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
              <span style={{ color: C.textMuted, fontSize: 10 }}>–</span>
              <input type="date" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setHistoryPreset('all'); }}
                style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.innerRowBg, color: C.textPrimary, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
              {(historyDateFrom || historyDateTo) && historyPreset === 'all' && (
                <button onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>clear</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 9, color: C.textMuted, fontWeight: 700 }}>{filteredHistory.length} of {allHistory.length} shown</span>
            </div>

            {/* History content */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
                padding: '64px 32px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: C.textPrimary, textTransform: 'uppercase' }}>
                  No Trades Today
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: C.textSecondary }}>
                  Closed positions will appear here as the day progresses.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PerformanceStats history={filteredHistory} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
                  {filteredHistory.map(entry => <HistoryCard key={entry.id} entry={entry} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 16, borderTop: `1px solid ${C.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Stock Gate Day Trade &bull; 5-Gate &bull; Realtime via Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockGateDayDashboard;
