import React from 'react';
import { C, MONO } from './constants';
import type { MRSkip } from './types';

interface Props {
  skips: MRSkip[];
  loading: boolean;
}

const REASON_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  CAP_TOTAL:           { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  color: '#EF4444' },
  CAP_GROUP:           { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#FBBF24' },
  ALREADY_OPEN:        { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.4)',  color: '#60A5FA' },
  NO_DATA:             { bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.4)', color: '#9CA3AF' },
  FILL_WINDOW_MISSED:  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)', color: '#C084FC' },
};

export const SkipsTable: React.FC<Props> = ({ skips, loading }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading skips...</div>;
  if (skips.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>&#9989;</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>No skipped signals</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
            {['Time', 'Workflow', 'Symbol', 'Side', 'Reason', 'Detail'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skips.map((s, i) => {
            const rStyle = REASON_COLORS[s.reason] || { bg: C.innerRowBg, border: C.cardBorder, color: C.textMuted };
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textMuted, fontSize: 10 }}>
                  {new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </td>
                <td style={{ padding: '8px 10px', color: C.textMuted, fontSize: 10 }}>{s.workflow ?? '-'}</td>
                <td style={{ padding: '8px 10px', fontWeight: 800, color: C.textPrimary }}>{s.symbol}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                    background: s.side === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: s.side === 'LONG' ? C.longColor : C.shortColor,
                  }}>{s.side}</span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: rStyle.bg, border: `1px solid ${rStyle.border}`, color: rStyle.color,
                  }}>{s.reason}</span>
                </td>
                <td style={{ padding: '8px 10px', color: C.textMuted, fontSize: 10, maxWidth: 300 }}>{s.detail ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
