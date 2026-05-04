import React from 'react';
import { C } from './constants';

interface Props {
  action: 'BUY' | 'SELL';
  tier?: 'A+' | 'A' | 'B';
}

export const ActionBadge: React.FC<Props> = ({ action, tier }) => {
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
  const glow = isStrong
    ? (isBuy ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)')
    : 'none';

  const label = isStrong ? (isBuy ? 'STRONG BUY' : 'STRONG SELL') : action;

  return (
    <span style={{
      padding: '3px 9px',
      borderRadius: 6,
      border: `1px solid ${border}`,
      background: bg,
      color: text,
      fontSize: 10,
      fontWeight: 900,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.06em',
      boxShadow: glow !== 'none' ? `0 0 10px ${glow}` : 'none',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
};
