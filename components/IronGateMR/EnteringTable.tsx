import React from 'react';
import { C, MONO } from './constants';
import type { MRSignal } from './types';

interface Props {
  signals: MRSignal[];
  loading: boolean;
}

export const EnteringTable: React.FC<Props> = ({ signals, loading }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading signals...</div>;
  if (signals.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>&#128301;</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>No pending entries</div>
      <div style={{ fontSize: 11, marginTop: 4, color: C.textMuted }}>New signals appear after the 4 PM ET scan.</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ marginBottom: 10, fontSize: 10, color: C.amber, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>&#9201;</span>
        Fills at the next open (09:32 ET)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
            {['#', 'Symbol', 'Side', 'RSI2', 'Close', 'Stop', 'ATR%', 'Group', 'Signal Date'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map(s => (
            <tr key={s.id} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textSecondary }}>{s.rank ?? '-'}</td>
              <td style={{ padding: '8px 10px', fontWeight: 800, color: C.textPrimary }}>{s.symbol}</td>
              <td style={{ padding: '8px 10px' }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                  background: s.side === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${s.side === 'LONG' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                  color: s.side === 'LONG' ? C.longColor : C.shortColor,
                }}>{s.side}</span>
              </td>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: (s.rsi2 ?? 50) < 10 ? C.accentGreen : (s.rsi2 ?? 50) > 90 ? C.accentRed : C.textSecondary }}>
                {s.rsi2?.toFixed(1) ?? '-'}
              </td>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textPrimary }}>${s.close_price?.toFixed(2) ?? '-'}</td>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.accentRed }}>${s.planned_stop?.toFixed(2) ?? '-'}</td>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textSecondary }}>{s.atr_pct?.toFixed(1) ?? '-'}%</td>
              <td style={{ padding: '8px 10px', color: C.textMuted }}>{s.corr_group ?? '-'}</td>
              <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textMuted, fontSize: 10 }}>{s.signal_date ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
