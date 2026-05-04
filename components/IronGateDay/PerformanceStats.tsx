import React from 'react';
import { C } from './constants';
import type { IronGateDayHistory } from './types';

interface Props {
  history: IronGateDayHistory[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export const PerformanceStats: React.FC<Props> = ({ history }) => {
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
      background: C.cardBg,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
        Today:
      </span>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <span style={{ color: C.cardBorderHover, fontSize: 12 }}>•</span>}
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            {item.label}{' '}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              color: item.color || C.textPrimary,
            }}>
              {item.value}
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};
