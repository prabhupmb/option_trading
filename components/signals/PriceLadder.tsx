import React from 'react';

interface Props {
  entry: number;
  target: number;
  stopLoss: number;
  current: number;
  optionType: 'CALL' | 'PUT' | 'NO_TRADE';
  riskReward: string;
}

const fmt = (v: number) => `$${v.toFixed(2)}`;

const PriceLadder: React.FC<Props> = ({ entry, target, stopLoss, current, optionType, riskReward }) => {
  if (!entry || !target || !stopLoss || !current) return null;

  const isCall = optionType === 'CALL';

  // For CALL: top=target, bottom=SL.  For PUT: top=SL, bottom=target
  const top = isCall ? target : stopLoss;
  const bottom = isCall ? stopLoss : target;
  const range = top - bottom;
  if (range <= 0) return null;

  // Position as % from bottom (0%) to top (100%)
  const entryPct = ((entry - bottom) / range) * 100;
  const currentPct = Math.max(0, Math.min(100, ((current - bottom) / range) * 100));

  // Progress: SL→Target %
  const rawProgress = isCall
    ? ((current - stopLoss) / (target - stopLoss)) * 100
    : ((stopLoss - current) / (stopLoss - target)) * 100;
  const progress = Math.max(0, Math.min(100, rawProgress));
  const progressColor = progress >= 75 ? '#00c853' : progress >= 50 ? '#69f0ae' : progress >= 25 ? '#ffd740' : '#ff5252';

  // The green zone (entry→target) and red zone (entry→SL)
  // In terms of the ladder (bottom=0%, top=100%):
  const entryPos = entryPct;
  // Green zone: from entry up to target (for CALL) or entry down to target (for PUT)
  const greenTop = isCall ? 100 : entryPos;
  const greenBottom = isCall ? entryPos : 0;
  // Red zone: from entry down to SL (for CALL) or entry up to SL (for PUT)
  const redTop = isCall ? entryPos : 100;
  const redBottom = isCall ? 0 : entryPos;

  const LADDER_H = 180;

  const markerStyle = (pct: number): React.CSSProperties => ({
    position: 'absolute',
    right: 42,
    bottom: `${(pct / 100) * LADDER_H}px`,
    transform: 'translateY(50%)',
  });

  const labelStyle = (pct: number, side: 'left' | 'right' = 'left'): React.CSSProperties => ({
    position: 'absolute',
    [side]: side === 'left' ? 0 : 42,
    bottom: `${(pct / 100) * LADDER_H}px`,
    transform: 'translateY(50%)',
    whiteSpace: 'nowrap',
  });

  return (
    <div className="relative flex items-stretch" style={{ minHeight: LADDER_H + 24 }}>
      {/* Labels on the left */}
      <div className="relative flex-1 min-w-0" style={{ height: LADDER_H, marginTop: 12 }}>
        {/* Target label */}
        <div style={labelStyle(isCall ? 100 : 0)} className="flex items-center gap-1">
          <span className="text-[9px]">🎯</span>
          <span className="text-[10px] font-bold text-green-400 font-mono">{fmt(target)}</span>
        </div>
        {/* Entry label */}
        <div style={labelStyle(entryPct)} className="flex items-center gap-1">
          <span className="text-[9px]">🔒</span>
          <span className="text-[10px] font-bold text-white font-mono">{fmt(entry)}</span>
        </div>
        {/* SL label */}
        <div style={labelStyle(isCall ? 0 : 100)} className="flex items-center gap-1">
          <span className="text-[9px]">⛔</span>
          <span className="text-[10px] font-bold text-red-400 font-mono">{fmt(stopLoss)}</span>
        </div>
        {/* Progress + R:R at bottom */}
        <div className="absolute -bottom-6 left-0 flex items-center gap-2">
          <span className="text-[10px] font-black font-mono" style={{ color: progressColor }}>{progress.toFixed(1)}%</span>
          <span className="text-[9px] text-gray-500 font-mono">R:R {riskReward}</span>
        </div>
      </div>

      {/* The vertical bar */}
      <div className="relative" style={{ width: 28, height: LADDER_H, marginTop: 12 }}>
        {/* Background track */}
        <div className="absolute inset-0 rounded-full bg-gray-800/50 overflow-hidden">
          {/* Green zone */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: `${greenBottom}%`,
              height: `${greenTop - greenBottom}%`,
              background: 'linear-gradient(to top, rgba(0,200,83,0.15), rgba(0,200,83,0.35))',
            }}
          />
          {/* Red zone */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: `${redBottom}%`,
              height: `${redTop - redBottom}%`,
              background: 'linear-gradient(to bottom, rgba(255,82,82,0.15), rgba(255,82,82,0.35))',
            }}
          />
        </div>

        {/* Entry line */}
        <div
          className="absolute left-0 right-0 h-px"
          style={{ bottom: `${entryPct}%`, background: 'rgba(255,255,255,0.5)' }}
        />

        {/* Current price pulsing dot */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ bottom: `${currentPct}%`, transform: 'translate(-50%, 50%)' }}
        >
          <div className="relative">
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-white"
              style={{ background: progressColor, boxShadow: `0 0 8px ${progressColor}` }}
            />
            <div
              className="absolute inset-0 w-3.5 h-3.5 rounded-full animate-ping opacity-40"
              style={{ background: progressColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceLadder;
