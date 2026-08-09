import React, { useState } from 'react';

// ─── TYPES ──────────────────────────────────────────────────

type Section = 'ACTIONABLE' | 'WORTH_CONSIDERING' | 'FILTERED';

export interface IronGateSignal {
  ticker: string;
  currentPrice: number;
  tradeDirection: 'CALL' | 'PUT';
  tier: string;
  gatesPassed: string;
  qualified: boolean;

  route: 'LOCK' | 'LATE' | 'DROP';
  conviction: string;
  lateReason?: string;

  displaySection?: Section;
  displayLabel?: string;

  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: string;

  st5mValue: number;
  st15mValue: number;
  st1hValue: number;

  adxValue: number;
  adxTrend: string;
  plusDI: number;
  minusDI: number;

  vwapValue: number;
  vwapTrend: string;
  vwapPosition: string;
  vwapDistance: number;

  rangePos: number;
  regime: string;
  fibTarget1: number;
  fibTarget2: number;

  timestamp: string;
  version: string;
}

interface IronGateSignalBoardProps {
  signals: IronGateSignal[];
}

// ─── HELPERS ────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;

const timeSince = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 10_000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
};

const tierRank = (tier: string): number => {
  if (tier === 'A+') return 0;
  if (tier === 'A') return 1;
  return 2;
};

const sortSignals = (arr: IronGateSignal[]): IronGateSignal[] =>
  [...arr].sort((a, b) => {
    const t = tierRank(a.tier) - tierRank(b.tier);
    if (t !== 0) return t;
    return (b.adxValue ?? 0) - (a.adxValue ?? 0);
  });

const deriveSection = (s: IronGateSignal): Section => {
  if (s.displaySection) return s.displaySection;
  if (s.route === 'LOCK') return 'ACTIONABLE';
  if (s.route === 'LATE') return 'WORTH_CONSIDERING';
  return 'FILTERED';
};

// Parse "VETO:CODE(…)" or "CODE(…)" into the code string
const parseLateCode = (reason?: string): string | null => {
  if (!reason) return null;
  // VETO:HIGHBOX(0.99>0.4)
  const m = reason.match(/(?:VETO:)?([A-Z_]+)\s*\(/);
  return m ? m[1] : null;
};

const lateLabel = (reason?: string): string => {
  const code = parseLateCode(reason);
  switch (code) {
    case 'HIGHBOX': return 'Extended \u2014 wait for pullback';
    case 'CHOP':    return 'Choppy \u2014 waiting for clean trend';
    case 'CHASE':   return 'Already extended from entry';
    default:        return 'Worth considering';
  }
};

const deriveLabel = (s: IronGateSignal): { text: string; color: string } | null => {
  const section = deriveSection(s);
  if (section === 'FILTERED') return null;
  if (s.displayLabel) {
    return {
      text: s.displayLabel,
      color: section === 'ACTIONABLE'
        ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40'
        : 'text-amber-400 bg-amber-900/20 border-amber-700/40',
    };
  }
  if (section === 'ACTIONABLE') {
    return { text: 'STRONG BUY', color: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40' };
  }
  return { text: lateLabel(s.lateReason), color: 'text-amber-400 bg-amber-900/20 border-amber-700/40' };
};

// ─── PULLBACK TARGET ────────────────────────────────────────

interface PullbackLevel {
  price: number;
  label: string;
}

const computePullback = (s: IronGateSignal): PullbackLevel[] => {
  const candidates: { price: number; label: string }[] = [
    { price: s.st5mValue, label: '5m ST' },
    { price: s.st15mValue, label: '15m ST' },
  ];

  if (s.tradeDirection === 'CALL') {
    // support below current price, pick highest first
    return candidates
      .filter(c => c.price > 0 && c.price < s.currentPrice)
      .sort((a, b) => b.price - a.price);
  }
  // PUT: resistance above current price, pick lowest first
  return candidates
    .filter(c => c.price > 0 && c.price > s.currentPrice)
    .sort((a, b) => a.price - b.price);
};

// ─── ADX TREND COLOR ────────────────────────────────────────

const adxColor = (v: number): string => {
  if (v >= 25) return 'text-emerald-400';
  if (v >= 20) return 'text-yellow-400';
  return 'text-red-400';
};

const dirColor = (d: string): string => {
  const u = d.toUpperCase();
  if (u === 'RISING' || u === 'ABOVE' || u === 'BULLISH') return 'text-emerald-400';
  if (u === 'FALLING' || u === 'BELOW' || u === 'BEARISH') return 'text-red-400';
  return 'text-slate-400';
};

// ─── METRICS STRIP ──────────────────────────────────────────

const MetricsStrip: React.FC<{ s: IronGateSignal }> = ({ s }) => (
  <div className="flex items-center gap-3 flex-wrap text-[10px] font-bold mt-2 pt-2 border-t border-[#1e2430]">
    <span className={adxColor(s.adxValue)}>ADX {s.adxValue?.toFixed(1)} <span className="text-slate-600">({s.adxTrend})</span></span>
    <span className="text-slate-500">+DI <span className="text-emerald-400">{s.plusDI?.toFixed(1)}</span> / -DI <span className="text-red-400">{s.minusDI?.toFixed(1)}</span></span>
    <span className={dirColor(s.vwapPosition)}>VWAP {s.vwapPosition} <span className="text-slate-600">{s.vwapDistance?.toFixed(1)}%</span></span>
    <span className={`${s.regime === 'TREND' ? 'text-emerald-400' : 'text-amber-400'}`}>{s.regime}</span>
  </div>
);

// ─── CARD: ACTIONABLE ───────────────────────────────────────

const ActionableCard: React.FC<{ s: IronGateSignal }> = ({ s }) => {
  const badge = deriveLabel(s);
  return (
    <div className="bg-[#0d1117] border border-emerald-800/30 rounded-xl p-4 hover:border-emerald-700/50 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-black text-white">{s.ticker}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${s.tradeDirection === 'CALL' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40' : 'text-red-400 bg-red-900/20 border-red-700/40'}`}>
          {s.tradeDirection}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${s.tier === 'A+' ? 'text-amber-300 bg-amber-900/30 border-amber-600/40' : 'text-slate-300 bg-slate-800/60 border-slate-600/60'}`}>
          {s.tier}
        </span>
        <span className="text-[9px] font-bold text-emerald-400">{s.gatesPassed}</span>
        <span className="text-sm font-mono font-bold text-white tabular-nums ml-auto">{fmt(s.currentPrice)}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Trade block */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-[10px] font-bold">
        <div>
          <span className="block text-slate-600 uppercase tracking-wider mb-0.5">Entry</span>
          <span className="text-white font-mono tabular-nums">{fmt(s.entryPrice)}</span>
        </div>
        <div>
          <span className="block text-slate-600 uppercase tracking-wider mb-0.5">Target</span>
          <span className="text-emerald-400 font-mono tabular-nums">{fmt(s.targetPrice)}</span>
        </div>
        <div>
          <span className="block text-slate-600 uppercase tracking-wider mb-0.5">Stop</span>
          <span className="text-red-400 font-mono tabular-nums">{fmt(s.stopLoss)}</span>
        </div>
        <div>
          <span className="block text-slate-600 uppercase tracking-wider mb-0.5">R:R</span>
          <span className="text-white font-mono">{s.riskRewardRatio}</span>
        </div>
      </div>

      <MetricsStrip s={s} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-[9px] text-slate-600 font-mono">
        <span>{timeSince(s.timestamp)}</span>
        <span>{s.version}</span>
      </div>
    </div>
  );
};

// ─── CARD: WORTH CONSIDERING ────────────────────────────────

const ConsideringCard: React.FC<{ s: IronGateSignal }> = ({ s }) => {
  const badge = deriveLabel(s);
  const pullback = computePullback(s);

  return (
    <div className="bg-[#0d1117] border-l-2 border-amber-600/50 border border-l-amber-600/50 border-[#1e2430] rounded-xl p-4 opacity-85 hover:opacity-100 transition-opacity">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-black text-slate-200">{s.ticker}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${s.tradeDirection === 'CALL' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40' : 'text-red-400 bg-red-900/20 border-red-700/40'}`}>
          {s.tradeDirection}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${s.tier === 'A+' ? 'text-amber-300 bg-amber-900/30 border-amber-600/40' : 'text-slate-300 bg-slate-800/60 border-slate-600/60'}`}>
          {s.tier}
        </span>
        <span className="text-[9px] font-bold text-slate-500">{s.gatesPassed}</span>
        <span className="text-sm font-mono font-bold text-slate-300 tabular-nums ml-auto">{fmt(s.currentPrice)}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Pullback line */}
      {pullback.length > 0 && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-900/10 border border-amber-800/20 text-[10px] font-bold text-amber-300/80">
          <span className="text-amber-500">Wait for pullback toward</span>{' '}
          {pullback.map((p, i) => (
            <span key={p.label}>
              {i > 0 && <span className="text-slate-600"> {'\u00b7'} then </span>}
              <span className="text-white font-mono tabular-nums">{fmt(p.price)}</span>
              <span className="text-slate-500"> ({p.label})</span>
            </span>
          ))}
        </div>
      )}
      {pullback.length === 0 && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-900/10 border border-amber-800/20 text-[10px] font-bold text-amber-400/60">
          No clear pullback level — wait for price structure to develop
        </div>
      )}

      <MetricsStrip s={s} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-[9px] text-slate-600 font-mono">
        <span>{timeSince(s.timestamp)}</span>
        <span>{s.version}</span>
      </div>
    </div>
  );
};

// ─── CARD: FILTERED ─────────────────────────────────────────

const FilteredCard: React.FC<{ s: IronGateSignal }> = ({ s }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1117] border border-[#1e2430] text-[11px]">
    <span className="font-black text-slate-400">{s.ticker}</span>
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${s.tradeDirection === 'CALL' ? 'text-emerald-400/50 bg-emerald-900/10 border-emerald-800/20' : 'text-red-400/50 bg-red-900/10 border-red-800/20'}`}>
      {s.tradeDirection}
    </span>
    <span className="text-slate-600 font-bold truncate">{s.lateReason || s.conviction || 'Filtered'}</span>
  </div>
);

// ─── MAIN COMPONENT ─────────────────────────────────────────

const IronGateSignalBoard: React.FC<IronGateSignalBoardProps> = ({ signals }) => {
  const [showFiltered, setShowFiltered] = useState(false);

  const actionable = sortSignals(signals.filter(s => deriveSection(s) === 'ACTIONABLE'));
  const considering = sortSignals(signals.filter(s => deriveSection(s) === 'WORTH_CONSIDERING'));
  const filtered = sortSignals(signals.filter(s => deriveSection(s) === 'FILTERED'));

  if (signals.length === 0) {
    return (
      <div className="text-center py-16 bg-[#0d1117] rounded-2xl border border-[#1e2430]">
        <div className="text-3xl mb-3">📡</div>
        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">No signals</h3>
        <p className="text-xs text-slate-500">Scanner hasn't produced any signals yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ACTIONABLE */}
      {actionable.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">local_fire_department</span>
            Actionable
            <span className="text-[9px] font-bold text-emerald-400/60 bg-emerald-900/20 border border-emerald-800/30 px-1.5 py-0.5 rounded-full">{actionable.length}</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {actionable.map(s => <ActionableCard key={`${s.ticker}-${s.tradeDirection}-${s.timestamp}`} s={s} />)}
          </div>
        </div>
      )}

      {/* WORTH CONSIDERING */}
      {considering.length > 0 && (
        <div>
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">visibility</span>
            Worth Considering
            <span className="text-[9px] font-bold text-amber-400/60 bg-amber-900/20 border border-amber-800/30 px-1.5 py-0.5 rounded-full">{considering.length}</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {considering.map(s => <ConsideringCard key={`${s.ticker}-${s.tradeDirection}-${s.timestamp}`} s={s} />)}
          </div>
        </div>
      )}

      {/* FILTERED */}
      {filtered.length > 0 && (
        <div>
          <button
            onClick={() => setShowFiltered(v => !v)}
            className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
          >
            <span className="material-symbols-outlined text-sm" style={{ transform: showFiltered ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              chevron_right
            </span>
            Show {filtered.length} filtered
          </button>
          {showFiltered && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {filtered.map(s => <FilteredCard key={`${s.ticker}-${s.tradeDirection}-${s.timestamp}`} s={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IronGateSignalBoard;
