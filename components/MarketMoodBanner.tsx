import React from 'react';
import { useMarketMood } from '../hooks/useMarketMood';

const MarketMoodBanner: React.FC = () => {
  const { indices, loading, isMarketOpen } = useMarketMood();

  if (loading && indices.length === 0) return null;
  if (indices.length === 0) return null;

  // Overall mood based on SPY
  const spy = indices.find(i => i.symbol === 'SPY');
  const overallPct = spy?.changePct ?? 0;
  const mood = overallPct > 0.5 ? 'BULLISH' : overallPct < -0.5 ? 'BEARISH' : 'NEUTRAL';
  const moodColor = mood === 'BULLISH' ? '#22c55e' : mood === 'BEARISH' ? '#ef4444' : '#fbbf24';
  const moodBg = mood === 'BULLISH' ? 'rgba(34,197,94,0.08)' : mood === 'BEARISH' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)';
  const moodBorder = mood === 'BULLISH' ? 'rgba(34,197,94,0.2)' : mood === 'BEARISH' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 16px',
      background: moodBg,
      borderBottom: `1px solid ${moodBorder}`,
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
      flexWrap: 'wrap',
      minHeight: 32,
    }}>
      {/* Market status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isMarketOpen ? '#22c55e' : '#ef4444',
          boxShadow: isMarketOpen ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
        }} />
        <span style={{ fontSize: 9, fontWeight: 800, color: isMarketOpen ? '#22c55e' : '#ef4444', letterSpacing: '0.06em' }}>
          {isMarketOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />

      {/* Mood label */}
      <span style={{
        fontSize: 9, fontWeight: 800, color: moodColor, letterSpacing: '0.08em',
        padding: '2px 8px', borderRadius: 4,
        background: mood === 'BULLISH' ? 'rgba(34,197,94,0.12)' : mood === 'BEARISH' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
        border: `1px solid ${moodBorder}`,
      }}>
        {mood}
      </span>

      <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />

      {/* Index quotes */}
      {indices.map(idx => {
        const isUp = idx.changePct >= 0;
        const color = isUp ? '#22c55e' : '#ef4444';
        const arrow = isUp ? '\u25B2' : '\u25BC';
        return (
          <div key={idx.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>{idx.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{idx.price.toFixed(2)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color }}>
              {arrow} {isUp ? '+' : ''}{idx.changePct.toFixed(2)}%
            </span>
            {idx !== indices[indices.length - 1] && (
              <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)', marginLeft: 6 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MarketMoodBanner;
