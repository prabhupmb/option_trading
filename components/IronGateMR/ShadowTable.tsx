import React from 'react';
import { C, MONO } from './constants';
import type { MRShadow } from './types';

interface Props {
  shadow: MRShadow[];
  loading: boolean;
}

export const ShadowTable: React.FC<Props> = ({ shadow, loading }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading shadow data...</div>;

  const open = shadow.filter(s => !s.closed_at);
  const closed = shadow.filter(s => !!s.closed_at);

  return (
    <div>
      <div style={{ marginBottom: 14, padding: '10px 14px', background: C.innerRowBg, borderRadius: 8, border: `1px solid ${C.cardBorder}` }}>
        <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>
          Tracked, never traded &mdash; enters only after the 1H SuperTrend flips back.
        </span>
      </div>

      {shadow.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#128065;</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No shadow positions</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                {['Variant', 'Symbol', 'Side', 'Entry', 'Stop', 'Current', 'P&L %', 'MFE', 'MAE', 'Status', 'Reason', 'Exit', 'Closed'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...open, ...closed].map((s, i) => {
                const pnl = s.pnl_pct ?? 0;
                const isOpen = !s.closed_at;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, opacity: isOpen ? 1 : 0.7 }}>
                    <td style={{ padding: '8px 10px', color: C.textMuted, fontSize: 10 }}>{s.variant ?? '-'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: C.textPrimary }}>{s.symbol}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                        background: s.side === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: s.side === 'LONG' ? C.longColor : C.shortColor,
                      }}>{s.side}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.accentYellow }}>${s.entry_price.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.accentRed }}>${s.stop_loss.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textPrimary }}>{s.current_price ? `$${s.current_price.toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, fontWeight: 800, color: pnl >= 0 ? C.accentGreen : C.accentRed }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.accentGreen, fontSize: 10 }}>{s.mfe_pct?.toFixed(1) ?? '-'}%</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.accentRed, fontSize: 10 }}>{s.mae_pct?.toFixed(1) ?? '-'}%</td>
                    <td style={{ padding: '8px 10px', fontSize: 10, color: C.textSecondary }}>{s.status ?? '-'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 10, color: C.textMuted }}>{s.close_reason ?? '-'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textSecondary }}>{s.exit_price ? `$${s.exit_price.toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textMuted, fontSize: 10 }}>
                      {s.closed_at ? new Date(s.closed_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
