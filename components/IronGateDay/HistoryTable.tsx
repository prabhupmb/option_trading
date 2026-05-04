import React from 'react';
import { HistoryCard } from './HistoryCard';
import { PerformanceStats } from './PerformanceStats';
import { C } from './constants';
import type { IronGateDayHistory } from './types';

interface Props {
  history: IronGateDayHistory[];
  loading: boolean;
}

const SkeletonCard: React.FC = () => (
  <div style={{
    background: C.cardBg,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 12,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    animation: 'igd-skeleton 1.5s infinite',
  }}>
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: C.innerRowBg }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 20, width: '40%', borderRadius: 6, background: C.innerRowBg }} />
        <div style={{ height: 16, width: '70%', borderRadius: 6, background: C.innerRowBg }} />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 56, borderRadius: 8, background: C.innerRowBg }} />)}
    </div>
  </div>
);

export const HistoryTable: React.FC<Props> = ({ history, loading }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        padding: '64px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: C.textPrimary, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
          No Trades Today
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.textSecondary }}>
          Closed positions will appear here as the day progresses.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PerformanceStats history={history} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
        {history.map(entry => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
};
