import React from 'react';
import { PositionCard } from './PositionCard';
import { EmptyState } from './EmptyState';
import { C } from './constants';
import type { IronGateDayPosition, SignalFilter } from './types';
import type { ScanWindowResult } from './useScanWindow';

interface Props {
  positions: IronGateDayPosition[];
  activeFilter: SignalFilter;
  flashIds: Set<string>;
  updatedIds: Set<string>;
  loading: boolean;
  isMarketOpen: boolean;
  isWeekend: boolean;
  scan: ScanWindowResult;
}

function applyFilter(positions: IronGateDayPosition[], filter: SignalFilter): IronGateDayPosition[] {
  switch (filter) {
    case 'STRONG_BUY':  return positions.filter(p => p.action === 'BUY'  && p.tier === 'A+');
    case 'BUY':         return positions.filter(p => p.action === 'BUY'  && p.tier !== 'A+');
    case 'STRONG_SELL': return positions.filter(p => p.action === 'SELL' && p.tier === 'A+');
    case 'SELL':        return positions.filter(p => p.action === 'SELL' && p.tier !== 'A+');
    default:            return positions;
  }
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
        <div style={{ height: 16, width: '60%', borderRadius: 6, background: C.innerRowBg }} />
      </div>
    </div>
    <div style={{ height: 28, borderRadius: 8, background: C.innerRowBg }} />
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, height: 56, borderRadius: 8, background: C.innerRowBg }} />
      ))}
    </div>
  </div>
);

export const OpenPositionsTable: React.FC<Props> = ({
  positions, activeFilter, flashIds, updatedIds, loading, isMarketOpen, isWeekend, scan,
}) => {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const filtered = applyFilter(positions, activeFilter);

  if (positions.length === 0) {
    return <EmptyState isMarketOpen={isMarketOpen} isWeekend={isWeekend} scan={scan} />;
  }

  if (filtered.length === 0) {
    return (
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          No positions match the <strong style={{ color: C.textPrimary }}>{activeFilter.replace('_', ' ')}</strong> filter.
        </p>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
          {positions.length} open position{positions.length !== 1 ? 's' : ''} in other categories.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 }}>
      {filtered.map(pos => (
        <PositionCard
          key={pos.id}
          pos={pos}
          isFlashing={flashIds.has(pos.id)}
          isUpdated={updatedIds.has(pos.id)}
        />
      ))}
    </div>
  );
};
