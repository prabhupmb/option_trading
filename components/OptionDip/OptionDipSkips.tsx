import React, { useMemo } from 'react';
import type { OptionDipSkip } from './types';

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

const REASON_PREFIXES = [
  'signal_too_old',
  'confluence_',
  'rr_',
  'no_contract_passed_gates',
  'data_stale',
  'iv_',
  'spread_',
  'dte_',
  'delta_',
  'oi_',
];

function reasonPrefix(reason: string): string {
  for (const p of REASON_PREFIXES) {
    if (reason.startsWith(p)) return p.replace(/_$/, '');
  }
  return 'other';
}

interface Props {
  skips: OptionDipSkip[];
}

export const OptionDipSkips: React.FC<Props> = ({ skips }) => {
  // Last 7 days for distribution chart
  const sevenDaySkips = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return skips.filter(s => new Date(s.created_at).getTime() > cutoff);
  }, [skips]);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sevenDaySkips) {
      const p = reasonPrefix(s.reason);
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [sevenDaySkips]);

  const maxCount = distribution.length > 0 ? distribution[0][1] : 1;

  // Last 24h for the table
  const recent = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return skips.filter(s => new Date(s.created_at).getTime() > cutoff);
  }, [skips]);

  if (skips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
        <p className="text-zinc-400 text-sm">No skips recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Distribution bar chart — 7d */}
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-4">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
          Skip reasons — last 7 days ({sevenDaySkips.length} total)
        </h3>
        <div className="space-y-1.5">
          {distribution.map(([prefix, count]) => (
            <div key={prefix} className="flex items-center gap-2">
              <span className="w-40 md:w-52 text-xs text-zinc-300 truncate font-mono shrink-0">{prefix}</span>
              <div className="flex-1 h-3 bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/40 rounded-full"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold font-mono text-amber-400 w-8 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent skips table — 24h */}
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-800/60">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Last 24h — {recent.length} skip{recent.length !== 1 ? 's' : ''}
          </span>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">No skips in the last 24 hours.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/40">
                <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Time</th>
                <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Symbol</th>
                <th className="px-4 py-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Reason</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id} className="border-b border-zinc-800/20 hover:bg-zinc-800/20">
                  <td className="px-4 py-2 text-xs font-mono text-zinc-500">{ago(s.created_at)}</td>
                  <td className="px-4 py-2 text-sm font-bold text-zinc-200">{s.symbol}</td>
                  <td className="px-4 py-2 text-xs font-mono text-zinc-400">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
