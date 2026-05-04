import React, { useState } from 'react';
import { C } from './constants';
import { TierBadge, TierSquare } from './TierBadge';
import { ActionBadge } from './ActionBadge';
import { ProgressBar } from './ProgressBar';
import type { IronGateDayPosition } from './types';

interface Props {
  pos: IronGateDayPosition;
  isFlashing?: boolean;
  isUpdated?: boolean;
}

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

const StatCell: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({
  label, value, valueColor,
}) => (
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

export const PositionCard: React.FC<Props> = ({ pos, isFlashing, isUpdated }) => {
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
    : pos.tier === 'A+' && isBuy
    ? 'rgba(22,163,74,0.06)'
    : pos.tier === 'A+' && !isBuy
    ? 'rgba(220,38,38,0.06)'
    : 'none';

  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: cardGlow !== 'none' ? `0 0 20px ${cardGlow}` : 'none',
      animation: isFlashing ? 'igd-flash-in 0.4s ease' : isUpdated ? 'igd-pulse 0.5s ease' : 'none',
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ─── Top Row: Badge + Symbol + Price + P&L ─── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <TierSquare tier={pos.tier} symbol={pos.symbol} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Symbol + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em' }}>
                {pos.symbol}
              </span>
              <ActionBadge action={pos.action} tier={pos.tier} />
              <TierBadge tier={pos.tier} />
              {pos.signal_type && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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

          {/* Entry + levels (right side) */}
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

        {/* ─── Progress Bar ─── */}
        <ProgressBar progress={pos.progress_pct} isBuy={isBuy} />

        {/* ─── Stats Grid ─── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCell label="Gates" value={`${pos.gate_score || 0}/5`} valueColor={pos.gate_score >= 4 ? C.accentGreen : '#F59E0B'} />
          <StatCell label="ADX" value={(pos.adx_value || 0).toFixed(1)} valueColor={adxColor} />
          <StatCell label="VWAP" value={pos.vwap_position || '—'} valueColor={vwapColor} />
          <StatCell label="Volume" value={pos.volume_ratio != null ? `${pos.volume_ratio.toFixed(2)}x` : '—'} valueColor={volColor} />
        </div>

        {/* ─── Expandable details ─── */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: C.textMuted,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <span style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
          {expanded ? 'Hide' : 'Show'} Technical Details
        </button>

        {expanded && (
          <div style={{
            borderTop: `1px solid ${C.cardBorder}`,
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* ADX detail */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.textMuted }}>ADX: <span style={{ color: adxColor, fontWeight: 700 }}>{(pos.adx_value || 0).toFixed(1)}</span></span>
              <span style={{ color: C.textMuted }}>+DI: <span style={{ color: C.accentGreen, fontWeight: 700 }}>{(pos.plus_di || 0).toFixed(1)}</span></span>
              <span style={{ color: C.textMuted }}>-DI: <span style={{ color: C.accentRed, fontWeight: 700 }}>{(pos.minus_di || 0).toFixed(1)}</span></span>
            </div>
            {/* VWAP detail */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.textMuted }}>VWAP: <span style={{ color: vwapColor, fontWeight: 700 }}>{fmt(pos.vwap_value)} ({pos.vwap_position})</span></span>
              {pos.vwap_crossed && (
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>⚡ Crossed {pos.vwap_cross_dir}</span>
              )}
            </div>
            {/* SuperTrend */}
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.textMuted }}>
              SuperTrend 5M:{' '}
              <span style={{ color: pos.supertrend_5m === 'BULLISH' ? C.accentGreen : C.accentRed, fontWeight: 700 }}>
                {pos.supertrend_5m || '—'}
              </span>
            </div>
            {/* HWM / LWM */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: C.accentGreen, fontWeight: 700 }}>HWM: {(pos.high_water_mark || 0).toFixed(1)}%</span>
              <span style={{ color: C.accentRed, fontWeight: 700 }}>LWM: {(pos.low_water_mark || 0).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: C.textMuted,
          borderTop: `1px solid ${C.cardBorder}`,
          paddingTop: 10,
          flexWrap: 'wrap',
          gap: 4,
        }}>
          <span>Opened <span style={{ color: C.textSecondary }}>{timeSince(pos.opened_at)}</span></span>
          <span>Last check <span style={{ color: C.textSecondary }}>{timeSince(pos.last_checked_at)}</span></span>
          <span style={{ color: C.textMuted }}>
            Checks: <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{pos.check_count || 0}</span>
          </span>
          {pos.version && (
            <span style={{ color: C.textMuted }}>
              <span style={{ color: C.accentYellow, fontWeight: 700 }}>#{pos.source || 'IG-DAY'}</span> {pos.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
