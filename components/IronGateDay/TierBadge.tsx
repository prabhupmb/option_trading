import React from 'react';
import { C } from './constants';

interface Props {
  tier: 'A+' | 'A' | 'B';
  size?: 'sm' | 'lg';
}

const tierColors: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  'A+': { bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.5)', text: C.tierAPlus, glow: 'rgba(255,215,0,0.2)' },
  'A':  { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.4)',  text: C.tierA },
  'B':  { bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.3)',text: C.tierB },
};

export const TierBadge: React.FC<Props> = ({ tier, size = 'sm' }) => {
  const colors = tierColors[tier] || tierColors['B'];
  const pad = size === 'lg' ? '6px 12px' : '3px 8px';
  const fs = size === 'lg' ? 13 : 10;
  return (
    <span style={{
      padding: pad,
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.text,
      fontSize: fs,
      fontWeight: 900,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.05em',
      boxShadow: colors.glow ? `0 0 8px ${colors.glow}` : 'none',
    }}>
      {tier}
    </span>
  );
};

// 48x48 badge for left side of position card
export const TierSquare: React.FC<{ tier: 'A+' | 'A' | 'B'; symbol: string }> = ({ tier, symbol }) => {
  const colors = tierColors[tier] || tierColors['B'];
  const abbr = symbol.slice(0, 3);
  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 10,
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: colors.glow ? `0 0 12px ${colors.glow}` : 'none',
    }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: colors.text, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{abbr}</span>
      <span style={{ fontSize: 8, fontWeight: 700, color: colors.text, opacity: 0.7, letterSpacing: '0.05em' }}>{tier}</span>
    </div>
  );
};
