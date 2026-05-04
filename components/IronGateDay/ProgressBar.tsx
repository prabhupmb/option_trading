import React from 'react';
import { C } from './constants';

interface Props {
  progress: number;   // 0–100 (50 = entry, 100 = target, 0 = stop)
  isBuy: boolean;
  animated?: boolean;
}

function progressColor(pct: number): string {
  if (pct <= 0)  return '#EF4444';
  if (pct < 25)  return '#EF4444';
  if (pct < 50)  return '#F59E0B';
  if (pct < 75)  return '#FFD700';
  return '#22C55E';
}

function progressEmoji(pct: number): string {
  if (pct >= 100) return '🎯';
  if (pct <= 5)   return '🛑';
  if (pct >= 75)  return '🟢';
  if (pct >= 40)  return '🟡';
  return '🔴';
}

export const ProgressBar: React.FC<Props> = ({ progress, animated = true }) => {
  const pct = Math.max(0, Math.min(100, progress || 0));
  const color = progressColor(pct);
  const emoji = progressEmoji(pct);

  return (
    <div style={{ width: '100%' }}>
      {/* Bar */}
      <div style={{
        position: 'relative',
        height: 28,
        borderRadius: 8,
        background: '#0A1414',
        border: `1px solid ${C.cardBorder}`,
        overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${pct}%`,
          borderRadius: pct >= 100 ? 8 : '8px 0 0 8px',
          background: `linear-gradient(90deg, #EF4444 0%, #F59E0B 30%, #FFD700 55%, #22C55E 100%)`,
          backgroundSize: '200% 100%',
          backgroundPosition: `${100 - pct}% 0`,
          transition: animated ? 'width 0.7s cubic-bezier(0.16,1,0.3,1)' : 'none',
          opacity: 0.9,
        }} />

        {/* Entry tick at 50% */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: 2,
          background: 'rgba(255,215,0,0.6)',
          zIndex: 2,
        }} />
        <div style={{
          position: 'absolute',
          top: -1,
          left: 'calc(50% - 5px)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#FFD700',
          border: `2px solid ${C.cardBg}`,
          zIndex: 3,
        }} />

        {/* Progress label centered */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}>
            {emoji} {pct.toFixed(1)}%
          </span>
        </div>

        {/* Glowing cursor at progress position */}
        {pct > 0 && pct < 100 && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pct}%`,
            width: 2,
            background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
            zIndex: 3,
            transition: animated ? 'left 0.7s cubic-bezier(0.16,1,0.3,1)' : 'none',
          }} />
        )}
      </div>

      {/* Labels row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 5,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        padding: '0 2px',
      }}>
        <span style={{ color: '#EF4444' }}>SL</span>
        <span style={{ color: '#FFD700' }}>Entry</span>
        <span style={{ color: '#22C55E' }}>Target</span>
      </div>
    </div>
  );
};
