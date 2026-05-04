import React from 'react';
import { C } from './constants';
import { ConnectionIndicator } from './ConnectionIndicator';
import type { ETClockResult } from './useETClock';
import type { ConnectionStatus } from './types';

interface Props {
  clock: ETClockResult;
  connectionStatus: ConnectionStatus;
}

export const HeaderCard: React.FC<Props> = ({ clock, connectionStatus }) => {
  const marketPillBg = clock.isMarketOpen ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const marketPillBorder = clock.isMarketOpen ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
  const marketPillText = clock.isMarketOpen ? C.accentGreen : C.accentRed;
  const marketLabel = clock.isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131C1C 0%, #0F1A1A 100%)',
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 16,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>

        {/* Left: icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: C.innerRowBg,
            border: `1px solid rgba(255,215,0,0.25)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            boxShadow: '0 0 16px rgba(255,215,0,0.12)',
            flexShrink: 0,
          }}>
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                fontFamily: 'Inter, sans-serif',
                color: C.textPrimary,
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
              }}>
                Iron Gate Day Trade
              </h1>
              {/* Market status pill */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: marketPillBg,
                border: `1px solid ${marketPillBorder}`,
                fontSize: 10,
                fontWeight: 700,
                color: marketPillText,
                letterSpacing: '0.06em',
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: marketPillText,
                  display: 'inline-block',
                  animation: clock.isMarketOpen ? 'igd-pulse 2s infinite' : 'none',
                }} />
                {marketLabel}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.textSecondary, fontFamily: 'Inter, sans-serif' }}>
              Intraday scalp tracking &bull; 5-Gate v5.8
            </p>
          </div>
        </div>

        {/* Right: clock + connection */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
            color: C.textPrimary,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            tabularNums: 'true',
          } as React.CSSProperties}>
            {clock.formatted}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2, marginBottom: 6 }}>
            ET Market Time
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConnectionIndicator status={connectionStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};
