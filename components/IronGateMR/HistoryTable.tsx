import React, { useMemo, useState } from 'react';
import { C, MONO } from './constants';
import type { MRHistoryPosition } from './types';

type SortKey = 'symbol' | 'side' | 'signal_date' | 'pnl_pct' | 'close_reason' | 'sessions_held' | 'closed_at';
type SortDir = 'asc' | 'desc';

interface Props {
  history: MRHistoryPosition[];
  loading: boolean;
}

const CLOSE_REASON_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  SMA5_EXIT:  { bg: 'rgba(34,213,238,0.12)', border: 'rgba(34,213,238,0.4)', color: '#22D3EE' },
  TIME_EXIT:  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)', color: '#C084FC' },
  STOP_LOSS:  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  color: '#EF4444' },
  MANUAL:     { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#FBBF24' },
};

const RESULT_COLORS: Record<string, string> = {
  WIN: '#22C55E',
  LOSS: '#EF4444',
  MANUAL_CLOSE: '#FBBF24',
};

export const HistoryTable: React.FC<Props> = ({ history, loading }) => {
  const [sortKey, setSortKey] = useState<SortKey>('closed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [filterSide, setFilterSide] = useState<string>('ALL');
  const [filterReason, setFilterReason] = useState<string>('ALL');

  const filtered = useMemo(() => {
    let items = history;
    if (filterResult !== 'ALL') items = items.filter(h => h.status === filterResult);
    if (filterSide !== 'ALL') items = items.filter(h => h.side === filterSide);
    if (filterReason !== 'ALL') items = items.filter(h => h.close_reason === filterReason);
    return items;
  }, [history, filterResult, filterSide, filterReason]);

  const sorted = useMemo(() => {
    const cmp = (a: MRHistoryPosition, b: MRHistoryPosition) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = ['Symbol', 'Side', 'Signal Date', 'Entry', 'Exit', 'P&L %', 'Close Reason', 'Days Held', 'Closed At'];
    const rows = sorted.map(h => [
      h.symbol, h.side, h.signal_date ?? '', h.entry_price?.toFixed(2) ?? '', h.exit_price?.toFixed(2) ?? '',
      h.pnl_pct?.toFixed(2) ?? '', h.close_reason ?? '', h.sessions_held ?? '', h.closed_at ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `iron_mr_history_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading history...</div>;

  const SortHeader: React.FC<{ label: string; k: SortKey }> = ({ label, k }) => (
    <th onClick={() => toggleSort(k)} style={{
      padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: sortKey === k ? C.blue : C.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
    }}>
      {label} {sortKey === k ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </th>
  );

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Filter:</span>
        {['ALL', 'WIN', 'LOSS', 'MANUAL_CLOSE'].map(r => (
          <button key={r} onClick={() => setFilterResult(r)} style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${filterResult === r ? 'rgba(59,130,246,0.6)' : C.cardBorder}`,
            background: filterResult === r ? 'rgba(59,130,246,0.12)' : C.innerRowBg,
            color: filterResult === r ? '#60A5FA' : C.textMuted,
          }}>{r === 'MANUAL_CLOSE' ? 'MANUAL' : r}</button>
        ))}
        <span style={{ color: C.cardBorder }}>|</span>
        {['ALL', 'LONG', 'SHORT'].map(s => (
          <button key={s} onClick={() => setFilterSide(s)} style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${filterSide === s ? 'rgba(59,130,246,0.6)' : C.cardBorder}`,
            background: filterSide === s ? 'rgba(59,130,246,0.12)' : C.innerRowBg,
            color: filterSide === s ? '#60A5FA' : C.textMuted,
          }}>{s}</button>
        ))}
        <span style={{ color: C.cardBorder }}>|</span>
        {['ALL', 'SMA5_EXIT', 'TIME_EXIT', 'STOP_LOSS', 'MANUAL'].map(r => (
          <button key={r} onClick={() => setFilterReason(r)} style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${filterReason === r ? 'rgba(59,130,246,0.6)' : C.cardBorder}`,
            background: filterReason === r ? 'rgba(59,130,246,0.12)' : C.innerRowBg,
            color: filterReason === r ? '#60A5FA' : C.textMuted,
          }}>{r}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: C.textMuted }}>{sorted.length} of {history.length}</span>
        <button onClick={exportCSV} style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase',
          background: C.innerRowBg, border: `1px solid ${C.cardBorder}`, color: C.textSecondary,
        }}>CSV</button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#128202;</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No history matching filters</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                <SortHeader label="Symbol" k="symbol" />
                <SortHeader label="Side" k="side" />
                <SortHeader label="Signal" k="signal_date" />
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' }}>Entry &rarr; Exit</th>
                <SortHeader label="P&L %" k="pnl_pct" />
                <SortHeader label="Reason" k="close_reason" />
                <SortHeader label="Days" k="sessions_held" />
                <SortHeader label="Closed" k="closed_at" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const pnl = h.pnl_pct ?? 0;
                const rStyle = CLOSE_REASON_COLORS[h.close_reason ?? ''] || { bg: C.innerRowBg, border: C.cardBorder, color: C.textMuted };
                return (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: C.textPrimary }}>{h.symbol}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                        background: h.side === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: h.side === 'LONG' ? C.longColor : C.shortColor,
                      }}>{h.side}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textMuted, fontSize: 10 }}>{h.signal_date ?? '-'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 10 }}>
                      <span style={{ color: C.accentYellow }}>${h.entry_price?.toFixed(2)}</span>
                      <span style={{ color: C.textMuted }}> &rarr; </span>
                      <span style={{ color: pnl >= 0 ? C.accentGreen : C.accentRed }}>${h.exit_price?.toFixed(2) ?? '-'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, fontWeight: 800, color: RESULT_COLORS[h.status] || C.textMuted }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: rStyle.bg, border: `1px solid ${rStyle.border}`, color: rStyle.color,
                      }}>{h.close_reason ?? '-'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textSecondary, textAlign: 'center' }}>{h.sessions_held ?? '-'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textMuted, fontSize: 10 }}>
                      {h.closed_at ? new Date(h.closed_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }) : '-'}
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
