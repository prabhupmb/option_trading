import React from 'react';

interface Props {
  swingLow: number | null;
  swingHigh: number | null;
  dipStop: number | null;
  entry: number | null;
  livePrice: number | null;
  t1: number | null;
  t2: number | null;
  isClosed?: boolean;
  isStale?: boolean;
}

const fmt = (n: number | null) => (n != null ? `$${n.toFixed(2)}` : '');

export const StructureRail: React.FC<Props> = ({
  swingLow, swingHigh, dipStop, entry, livePrice, t1, t2, isClosed, isStale,
}) => {
  if (swingLow == null || swingHigh == null || swingHigh <= swingLow) return null;
  const range = swingHigh - swingLow;
  const pct = (v: number | null) =>
    v != null ? Math.min(100, Math.max(0, ((v - swingLow) / range) * 100)) : null;

  const pStop = pct(dipStop);
  const pEntry = pct(entry);
  const pLive = pct(livePrice);
  const pT1 = pct(t1);
  const pT2 = pct(t2);

  // Fill segment between stop and live price
  const fillLeft = pStop ?? 0;
  const fillRight = pLive ?? pEntry ?? fillLeft;
  const fillWidth = Math.max(0, fillRight - fillLeft);
  // Color gradient: red near stop, green near T1
  const progressRatio = pT1 != null && pT1 > fillLeft
    ? Math.min(1, Math.max(0, (fillRight - fillLeft) / (pT1 - fillLeft)))
    : 0;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        <span>Swing Low {fmt(swingLow)}</span>
        <span>Swing High {fmt(swingHigh)}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-zinc-800 overflow-visible">
        {/* Progress fill: stop → live */}
        {fillWidth > 0 && (
          <div
            className="absolute h-full rounded-full"
            style={{
              left: `${fillLeft}%`,
              width: `${fillWidth}%`,
              background: `linear-gradient(to right, rgba(239,68,68,0.4), rgba(16,185,129,${0.2 + progressRatio * 0.4}))`,
            }}
          />
        )}

        {/* Stop marker */}
        {pStop != null && (
          <div className="absolute -top-1 h-4 w-0.5 bg-rose-500" style={{ left: `${pStop}%` }} title={`STOP ${fmt(dipStop)}`} />
        )}

        {/* Entry dot */}
        {pEntry != null && (
          <div
            className="absolute -top-0.5 h-3.5 w-3.5 -ml-[7px] rounded-full bg-zinc-400 border-2 border-zinc-950"
            style={{ left: `${pEntry}%` }}
            title={`ENTRY ${fmt(entry)}`}
          />
        )}

        {/* T1 tick */}
        {pT1 != null && (
          <div className="absolute -top-1 h-4 w-0.5 bg-emerald-500" style={{ left: `${pT1}%` }} title={`T1 ${fmt(t1)}`} />
        )}

        {/* T2 tick */}
        {pT2 != null && (
          <div className="absolute -top-1 h-4 w-0.5 bg-emerald-300/60" style={{ left: `${pT2}%` }} title={`T2 ${fmt(t2)}`} />
        )}

        {/* Live price dot (pulsing) or closed exit marker */}
        {pLive != null && (
          <div
            className={`absolute -top-1.5 h-5 w-5 -ml-2.5 rounded-full border-2 border-zinc-950 shadow ${
              isClosed ? '' : isStale ? 'opacity-50' : 'animate-pulse'
            }`}
            style={{
              left: `${pLive}%`,
              background: isClosed ? '#71717a' : '#10b981',
            }}
            title={`${isClosed ? 'EXIT' : 'LIVE'} ${fmt(livePrice)}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
        <span className="text-rose-400">STOP {fmt(dipStop)}</span>
        <span className="text-zinc-500">ENTRY {fmt(entry)}</span>
        <span className="text-emerald-400">T1 {fmt(t1)}{t2 != null ? ` · T2 ${fmt(t2)}` : ''}</span>
      </div>
    </div>
  );
};
