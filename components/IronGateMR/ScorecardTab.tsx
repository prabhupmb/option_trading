import React from 'react';
import { C, MONO } from './constants';
import type { MRScorecard, MRWeekly } from './types';

interface Props {
  scorecard: MRScorecard[];
  weekly: MRWeekly[];
  loading: boolean;
}

const ENGINE_LABELS: Record<string, { label: string; color: string }> = {
  MR_LIVE:        { label: 'MR Live',       color: C.accentGreen },
  MR_SHADOW_1H:   { label: 'MR Shadow 1H',  color: C.purple },
  V2_IRON_GATE:   { label: 'Iron Gate V2',   color: C.accentYellow },
};

function fmtPct(n: number | null) {
  if (n == null) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtNum(n: number | null) {
  if (n == null) return '-';
  return n.toFixed(2);
}

export const ScorecardTab: React.FC<Props> = ({ scorecard, weekly, loading }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading scorecard...</div>;

  const engines = ['MR_LIVE', 'MR_SHADOW_1H', 'V2_IRON_GATE'];
  const cardsByEngine = Object.fromEntries(engines.map(e => [e, scorecard.find(s => s.engine === e)]));

  const rows: { label: string; key: keyof MRScorecard; fmt: (v: any) => string; highlight?: boolean }[] = [
    { label: 'Trades',        key: 'trades',        fmt: (v) => v?.toString() ?? '-' },
    { label: 'Wins',          key: 'wins',          fmt: (v) => v?.toString() ?? '-' },
    { label: 'Win %',         key: 'win_pct',       fmt: fmtPct, highlight: true },
    { label: 'Avg P&L %',     key: 'avg_pnl_pct',   fmt: fmtPct },
    { label: 'Avg Win %',     key: 'avg_win_pct',    fmt: fmtPct },
    { label: 'Avg Loss %',    key: 'avg_loss_pct',   fmt: fmtPct },
    { label: 'Profit Factor', key: 'profit_factor',  fmt: fmtNum, highlight: true },
    { label: 'Total P&L %',   key: 'total_pnl_pct',  fmt: fmtPct, highlight: true },
    { label: 'Last Close',    key: 'last_close',     fmt: (v) => v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }) : '-' },
  ];

  // Weekly chart dimensions
  const maxWeeks = 12;
  const weekData = weekly.slice(0, maxWeeks).reverse();
  const maxPnl = Math.max(1, ...weekData.map(w => Math.abs(w.total_pnl_pct ?? 0)));
  const barH = 160;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Comparison table */}
      <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary }}>Engine Comparison</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' }}>Metric</th>
                {engines.map(e => {
                  const info = ENGINE_LABELS[e] || { label: e, color: C.textSecondary };
                  return (
                    <th key={e} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: info.color }}>
                      {info.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                  <td style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, color: r.highlight ? C.textPrimary : C.textSecondary }}>{r.label}</td>
                  {engines.map(e => {
                    const card = cardsByEngine[e];
                    const val = card ? (card as any)[r.key] : null;
                    const formatted = r.fmt(val);
                    const isPositive = typeof val === 'number' && val > 0;
                    const isNeg = typeof val === 'number' && val < 0;
                    return (
                      <td key={e} style={{
                        padding: '8px 14px', textAlign: 'right', fontFamily: MONO, fontWeight: r.highlight ? 800 : 600,
                        color: r.highlight ? (isPositive ? C.accentGreen : isNeg ? C.accentRed : C.textSecondary) : C.textSecondary,
                      }}>{formatted}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly chart */}
      <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '18px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.textPrimary, marginBottom: 14 }}>Weekly Performance</div>
        {weekData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>No weekly data yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Reference line labels */}
            <div style={{ position: 'relative', height: barH }}>
              {/* 60% win rate reference */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textMuted }}>
                <span>+{maxPnl.toFixed(1)}%</span>
              </div>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: `1px dashed ${C.cardBorder}`, transform: 'translateY(-1px)' }}>
                <span style={{ position: 'absolute', right: 0, top: -10, fontSize: 8, color: C.textMuted }}>0%</span>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textMuted }}>
                <span>-{maxPnl.toFixed(1)}%</span>
              </div>

              {/* Bars */}
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 4, paddingLeft: 40, paddingRight: 40 }}>
                {weekData.map((w, i) => {
                  const pnl = w.total_pnl_pct ?? 0;
                  const pct = (Math.abs(pnl) / maxPnl) * 50;
                  const isPos = pnl >= 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative' }}>
                      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {isPos ? (
                          <>
                            <div style={{ height: `${50 - pct}%` }} />
                            <div style={{ height: `${pct}%`, background: C.accentGreen, borderRadius: '3px 3px 0 0', minHeight: pnl !== 0 ? 2 : 0 }} />
                            <div style={{ height: '50%' }} />
                          </>
                        ) : (
                          <>
                            <div style={{ height: '50%' }} />
                            <div style={{ height: `${pct}%`, background: C.accentRed, borderRadius: '0 0 3px 3px', minHeight: pnl !== 0 ? 2 : 0 }} />
                            <div style={{ height: `${50 - pct}%` }} />
                          </>
                        )}
                      </div>
                      {/* Win % dot */}
                      {w.win_pct != null && (
                        <div style={{
                          position: 'absolute',
                          top: `${100 - w.win_pct}%`,
                          width: 6, height: 6, borderRadius: '50%',
                          background: (w.win_pct ?? 0) >= 60 ? C.accentGreen : C.accentRed,
                          border: '1px solid rgba(255,255,255,0.3)',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Week labels */}
            <div style={{ display: 'flex', gap: 4, paddingLeft: 40, paddingRight: 40 }}>
              {weekData.map((w, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: C.textMuted, fontFamily: MONO }}>
                  {w.week?.slice(5) ?? ''}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 9, color: C.textMuted }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.accentGreen, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />P&L %</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, background: C.accentGreen, borderRadius: '50%', marginRight: 4, verticalAlign: 'middle' }} />Win % (dot)</span>
              <span style={{ color: C.textMuted }}>60% target line</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
