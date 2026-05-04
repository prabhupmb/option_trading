import React from 'react';
import { C } from './constants';
import { TierBadge, TierSquare } from './TierBadge';
import { ActionBadge } from './ActionBadge';
import { ExitReasonBadge, ResultBadge } from './ExitReasonBadge';
import type { IronGateDayHistory } from './types';

interface Props {
  entry: IronGateDayHistory;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
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

export const HistoryCard: React.FC<Props> = ({ entry }) => {
  const isWin = entry.result === 'WIN';
  const isLoss = entry.result === 'LOSS';
  const pnlColor = isWin ? C.accentGreen : isLoss ? C.accentRed : C.textSecondary;
  const pnlSign = (entry.pnl_pct || 0) >= 0 ? '+' : '';

  const borderColor = isWin ? 'rgba(34,197,94,0.25)' : isLoss ? 'rgba(239,68,68,0.2)' : C.cardBorder;
  const bgGlow = isWin ? 'rgba(34,197,94,0.04)' : isLoss ? 'rgba(239,68,68,0.04)' : 'transparent';

  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: `0 0 20px ${bgGlow}`,
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ─── Top Row ─── */}
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
            </div>

            {/* Entry → Exit price */}
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

        {/* ─── Stats Grid ─── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCell label="Duration" value={formatDuration(entry.duration_minutes)} />
          <StatCell label="Gates" value={`${entry.gate_score || 0}/5`} valueColor={entry.gate_score >= 4 ? C.accentGreen : '#F59E0B'} />
          <StatCell label="Final %" value={`${(entry.final_progress || 0).toFixed(0)}%`} valueColor={isWin ? C.accentGreen : isLoss ? C.accentRed : C.textSecondary} />
          <StatCell label="Checks" value={entry.check_count || 0} />
        </div>

        {/* ─── Footer: timestamps ─── */}
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
          <span>
            Opened <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(entry.opened_at)} ET</span>
          </span>
          <span style={{ color: C.textMuted }}>→</span>
          <span>
            Closed <span style={{ color: C.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(entry.closed_at)} ET</span>
          </span>
          {entry.version && (
            <span>
              <span style={{ color: C.accentYellow, fontWeight: 700 }}>#{entry.source || 'IG-DAY'}</span>
              <span style={{ color: C.textMuted }}> {entry.version}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
