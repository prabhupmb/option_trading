import React from 'react';
import { C } from './constants';
import type { ScanWindowResult } from './useScanWindow';

interface Props {
  isMarketOpen: boolean;
  isWeekend: boolean;
  scan: ScanWindowResult;
}

export const EmptyState: React.FC<Props> = ({ isMarketOpen, isWeekend, scan }) => {
  const nextMsg = isWeekend
    ? 'Market reopens 9:30 AM ET Monday'
    : !isMarketOpen
    ? 'Market reopens 9:30 AM ET'
    : scan.nextScan
    ? `Next scan at ${scan.nextScan} ET — in ${scan.countdown}`
    : 'All scans complete for today';

  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 16,
      padding: '64px 32px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Lightning icon */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 16,
        background: 'rgba(255,215,0,0.1)',
        border: '1px solid rgba(255,215,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 38,
        boxShadow: '0 0 24px rgba(255,215,0,0.1)',
      }}>
        ⚡
      </div>

      <div>
        <h3 style={{
          margin: '0 0 8px',
          fontSize: 20,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          color: C.textPrimary,
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
        }}>
          Iron Gate Day Is Scanning
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: C.textSecondary, fontFamily: 'Inter, sans-serif' }}>
          Watching for A+, A, and B scalp signals.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontFamily: 'Inter, sans-serif' }}>
          {nextMsg}
        </p>
      </div>

      {/* Scan window pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 600 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
          Scan window:
        </span>
        {scan.scanTimes.map((t) => {
          const status = scan.statusOf(t);
          const styles: Record<string, React.CSSProperties> = {
            past: {
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.35)',
              color: C.accentGreen,
            },
            next: {
              background: 'rgba(255,215,0,0.12)',
              border: `1px solid ${C.accentYellow}`,
              color: C.accentYellow,
              boxShadow: '0 0 8px rgba(255,215,0,0.2)',
            },
            future: {
              background: 'transparent',
              border: `1px solid ${C.cardBorder}`,
              color: C.textMuted,
            },
          };
          return (
            <span key={t} style={{
              ...styles[status],
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {t}
            </span>
          );
        })}
      </div>

      {/* Auto-polling footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMuted }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: C.blue,
          display: 'inline-block',
          animation: 'igd-pulse 2s infinite',
        }} />
        Auto-polling every 15 seconds
      </div>
    </div>
  );
};
