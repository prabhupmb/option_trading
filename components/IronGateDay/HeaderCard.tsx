import React from 'react';
import { C } from './constants';
import { ConnectionIndicator } from './ConnectionIndicator';
import type { ETClockResult } from './useETClock';
import type { ConnectionStatus } from './types';

interface Props {
  clock: ETClockResult;
  connectionStatus: ConnectionStatus;
  onScan?: () => void;
  scanStatus?: 'idle' | 'scanning' | 'ok' | 'err';
}

export const HeaderCard: React.FC<Props> = ({ clock, connectionStatus, onScan, scanStatus = 'idle' }) => {
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

        {/* Right: scan button + clock + connection */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Manual Scan Button */}
            {onScan && (
              <button
                onClick={onScan}
                disabled={scanStatus === 'scanning'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 10,
                  border: scanStatus === 'ok'
                    ? '1px solid rgba(34,197,94,0.5)'
                    : scanStatus === 'err'
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid rgba(255,215,0,0.35)',
                  background: scanStatus === 'ok'
                    ? 'rgba(34,197,94,0.12)'
                    : scanStatus === 'err'
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(255,215,0,0.08)',
                  color: scanStatus === 'ok'
                    ? C.accentGreen
                    : scanStatus === 'err'
                      ? C.accentRed
                      : C.accentYellow,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: scanStatus === 'scanning' ? 'not-allowed' : 'pointer',
                  opacity: scanStatus === 'scanning' ? 0.6 : 1,
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span style={{
                  fontSize: 14,
                  display: 'inline-block',
                  animation: scanStatus === 'scanning' ? 'igd-pulse 1s infinite' : 'none',
                }}>
                  {scanStatus === 'ok' ? '✓' : scanStatus === 'err' ? '✕' : '⚡'}
                </span>
                {scanStatus === 'scanning' ? 'Scanning...' : scanStatus === 'ok' ? 'Triggered!' : scanStatus === 'err' ? 'Failed' : 'Scan Now'}
              </button>
            )}
            <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: C.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {clock.formatted}
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            ET Market Time
          </div>
          <ConnectionIndicator status={connectionStatus} />
        </div>
      </div>
    </div>
  );
};
