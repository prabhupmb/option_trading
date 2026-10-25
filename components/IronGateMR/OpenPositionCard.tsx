import React, { useState } from 'react';
import { C, MONO } from './constants';
import TradeChart from '../signals/TradeChart';
import type { Bar } from '../../lib/supertrend';
import type { Timeframe } from '../../hooks/useMdBars';
import type { MROpenPosition } from './types';

const N8N_BASE = (import.meta.env.VITE_N8N_BASE_URL as string) || 'https://prabhupadala01.app.n8n.cloud';

function fmt(n: number | null | undefined) {
  if (n == null) return '-';
  return `$${Number(n).toFixed(2)}`;
}

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function pctFmt(n: number | null | undefined) {
  if (n == null) return '-';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

const UI_STATE_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  RUNNING:         { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', color: '#60A5FA', label: 'RUNNING' },
  EXIT_AT_OPEN:    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#FBBF24', label: 'EXIT AT OPEN' },
  NEAR_TIME_LIMIT: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)', color: '#C084FC', label: 'NEAR TIME LIMIT' },
};

interface Props {
  pos: MROpenPosition;
  bars?: Bar[];
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
  onClose: (id: string) => void;
}

export const OpenPositionCard: React.FC<Props> = ({ pos, bars, tf, onTfChange, onClose }) => {
  const [confirmClose, setConfirmClose] = useState(false);
  const isLong = pos.side === 'LONG';
  const pnl = pos.pnl_pct ?? 0;
  const isProfit = pnl >= 0;
  const stateStyle = UI_STATE_STYLES[pos.ui_state] || UI_STATE_STYLES.RUNNING;
  const sma5Target = pos.last_sma5 ?? pos.sma5_at_signal;

  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
      borderLeft: `3px solid ${isLong ? C.longColor : C.shortColor}`,
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Title row: symbol + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: MONO, color: C.textPrimary }}>{pos.symbol}</span>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
            background: isLong ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${isLong ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
            color: isLong ? C.longColor : C.shortColor,
          }}>{pos.side}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA',
          }}>{pos.option_type}</span>
          {pos.corr_group && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, color: C.textSecondary }}>
              {pos.corr_group}
            </span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, color: C.purple }}>
            Day {pos.sessions_held ?? 0}/10
          </span>

          {/* P&L — right aligned */}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: MONO, color: isProfit ? C.accentGreen : C.accentRed }}>
              {pctFmt(pnl)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: isProfit ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)', marginLeft: 6 }}>
              {fmt(pos.pnl_per_share)}/sh
            </span>
          </div>
        </div>

        {/* State pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
            background: stateStyle.bg, border: `1px solid ${stateStyle.border}`, color: stateStyle.color,
          }}>
            {stateStyle.label}
          </span>
          {pos.exit_pending && pos.exit_pending_reason && (
            <span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>
              {pos.exit_pending_reason === 'SMA5_EXIT' ? 'SMA5 crossed' : 'Time limit reached'}
            </span>
          )}
        </div>

        {/* Risk meter — horizontal bar */}
        <div style={{ background: C.innerRowBg, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>
            <span>Entry {fmt(pos.entry_price)}</span>
            <span style={{ color: C.textSecondary }}>{pos.stop_dist_pct != null ? `${pos.stop_dist_pct.toFixed(1)}% to stop` : ''}</span>
            <span>Stop {fmt(pos.stop_loss)}</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.3s',
              width: `${Math.min(100, Math.max(0, pos.stop_used_pct ?? 0))}%`,
              background: (pos.stop_used_pct ?? 0) < 50 ? C.accentGreen : (pos.stop_used_pct ?? 0) < 80 ? C.amber : C.accentRed,
            }} />
            {/* Current price marker */}
            {pos.current_price && (
              <div style={{
                position: 'absolute', top: -2, width: 2, height: 12, background: '#fff', borderRadius: 1,
                left: `${Math.min(100, Math.max(0, pos.stop_used_pct ?? 0))}%`, transform: 'translateX(-1px)',
              }} />
            )}
          </div>
        </div>

        {/* Exit target line */}
        {sma5Target && (
          <div style={{ fontSize: 10, color: C.cyan, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 1, borderTop: `2px dashed ${C.cyan}`, display: 'inline-block' }} />
            Exits when close crosses SMA5 &asymp; {fmt(sma5Target)}
          </div>
        )}

        {/* Mini daily chart */}
        <TradeChart
          bars={bars ?? []}
          entryPrice={pos.entry_price}
          stopLoss={pos.stop_loss}
          target1={sma5Target ?? pos.entry_price}
          currentPrice={pos.current_price ?? pos.entry_price}
          optionType={pos.option_type}
          tf={tf}
          onTfChange={onTfChange}
        />

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 9, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10, flexWrap: 'wrap', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{pos.suggested_qty} sh</span>
            <span>Risk <span style={{ color: C.accentRed, fontFamily: MONO }}>{fmt(pos.risk_dollars)}</span></span>
            {pos.option_hint && <span style={{ color: C.blue }}>{pos.option_hint}</span>}
            <span>MFE <span style={{ color: C.accentGreen, fontFamily: MONO }}>{pctFmt(pos.mfe_pct)}</span></span>
            <span>MAE <span style={{ color: C.accentRed, fontFamily: MONO }}>{pctFmt(pos.mae_pct)}</span></span>
            <span>{timeSince(pos.last_checked_at)}</span>
          </div>

          {/* Close button */}
          {!confirmClose ? (
            <button onClick={() => setConfirmClose(true)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: C.accentRed,
            }}>
              Close
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: C.accentRed, fontWeight: 700 }}>Confirm?</span>
              <button onClick={() => { onClose(pos.id); setConfirmClose(false); }} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                background: C.accentRed, border: 'none', color: '#fff',
              }}>Yes</button>
              <button onClick={() => setConfirmClose(false)} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, color: C.textSecondary,
              }}>No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
