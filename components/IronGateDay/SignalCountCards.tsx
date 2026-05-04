import React from 'react';
import { C } from './constants';
import type { IronGateDayPosition, SignalFilter } from './types';

interface Props {
  positions: IronGateDayPosition[];
  activeFilter: SignalFilter;
  onFilterChange: (f: SignalFilter) => void;
}

interface CardDef {
  id: SignalFilter;
  label: string;
  color: string;
  bgActive: string;
  borderActive: string;
  glow: string;
  filter: (p: IronGateDayPosition) => boolean;
}

const CARDS: CardDef[] = [
  {
    id: 'STRONG_BUY',
    label: 'Strong Buy',
    color: C.strongBuyColor,
    bgActive: 'rgba(22,163,74,0.12)',
    borderActive: 'rgba(22,163,74,0.6)',
    glow: 'rgba(22,163,74,0.2)',
    filter: (p) => p.action === 'BUY' && p.tier === 'A+',
  },
  {
    id: 'BUY',
    label: 'Buy',
    color: C.buyColor,
    bgActive: 'rgba(34,197,94,0.1)',
    borderActive: 'rgba(34,197,94,0.5)',
    glow: 'none',
    filter: (p) => p.action === 'BUY' && p.tier !== 'A+',
  },
  {
    id: 'STRONG_SELL',
    label: 'Strong Sell',
    color: C.strongSellColor,
    bgActive: 'rgba(220,38,38,0.12)',
    borderActive: 'rgba(220,38,38,0.6)',
    glow: 'rgba(220,38,38,0.2)',
    filter: (p) => p.action === 'SELL' && p.tier === 'A+',
  },
  {
    id: 'SELL',
    label: 'Sell',
    color: C.sellColor,
    bgActive: 'rgba(239,68,68,0.1)',
    borderActive: 'rgba(239,68,68,0.5)',
    glow: 'none',
    filter: (p) => p.action === 'SELL' && p.tier !== 'A+',
  },
];

export const SignalCountCards: React.FC<Props> = ({ positions, activeFilter, onFilterChange }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {CARDS.map((card) => {
        const count = positions.filter(card.filter).length;
        const isActive = activeFilter === card.id;

        return (
          <button
            key={card.id}
            onClick={() => onFilterChange(isActive ? 'ALL' : card.id)}
            style={{
              background: isActive ? card.bgActive : C.cardBg,
              border: `1px solid ${isActive ? card.borderActive : C.cardBorder}`,
              borderRadius: 12,
              padding: '20px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isActive && card.glow !== 'none' ? `0 0 20px ${card.glow}` : 'none',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = C.cardBorderHover;
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = C.cardBorder;
            }}
          >
            <div style={{
              fontSize: 48,
              fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              color: card.color,
              lineHeight: 1,
              marginBottom: 8,
              animation: count > 0 ? undefined : undefined,
            }}>
              {count}
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              color: isActive ? card.color : C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {card.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};
