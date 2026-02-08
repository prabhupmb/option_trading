
import React from 'react';
import { StockSignal } from '../types';

interface Props {
  signal: StockSignal;
  onViewAnalysis: (signal: StockSignal) => void;
}

// Get badge color based on signal type
function getSignalBadge(signal: string | undefined): { bg: string; text: string; label: string } {
  if (!signal) return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'ANALYZING' };

  if (signal.includes('STRONG BUY')) return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'STRONG BUY' };
  if (signal.includes('✅ BUY')) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'BUY' };
  if (signal.includes('WEAK BUY')) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'WEAK BUY' };
  if (signal.includes('✅ SELL')) return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'SELL' };
  if (signal.includes('WEAK SELL')) return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'WEAK SELL' };
  if (signal.includes('FAILED')) return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'NO TRADE' };

  return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'NEUTRAL' };
}

// Get tier badge
function getTierBadge(tier: string | undefined): { bg: string; text: string } {
  if (!tier) return { bg: 'bg-slate-500/20', text: 'text-slate-400' };

  if (tier === 'A+') return { bg: 'bg-primary/20', text: 'text-primary' };
  if (tier === 'A') return { bg: 'bg-green-500/20', text: 'text-green-400' };
  if (tier.startsWith('B')) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };

  return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
}

const StockSignalCard: React.FC<Props> = ({ signal, onViewAnalysis }) => {
  const isAnalyzing = signal.status === 'ANALYZING';
  const signalBadge = getSignalBadge(signal.signal);
  const tierBadge = getTierBadge(signal.tier);

  // Get border color based on signal type
  const getBorderColor = () => {
    if (signal.signal?.includes('STRONG BUY')) return 'border-l-green-500';
    if (signal.signal?.includes('✅ BUY')) return 'border-l-emerald-500';
    if (signal.signal?.includes('WEAK BUY')) return 'border-l-yellow-500';
    if (signal.signal?.includes('SELL')) return 'border-l-red-500';
    return 'border-l-primary';
  };

  return (
    <div className={`glass-card rounded-xl p-4 border-l-4 transition-all hover:translate-x-1 ${getBorderColor()}`}>
      {/* Header Row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
            <span className="material-symbols-outlined text-white">{signal.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-none">{signal.symbol}</h3>
            <div className="flex items-center gap-2 mt-1">
              {/* Tier Badge */}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tierBadge.bg} ${tierBadge.text}`}>
                {signal.tier || 'N/A'}
              </span>
              {/* Option Type */}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${signal.optionType === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                {signal.optionType || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white tracking-tight">${signal.price.toFixed(2)}</div>
          {/* Signal Badge */}
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${signalBadge.bg} ${signalBadge.text}`}>
            {signalBadge.label}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className={`grid grid-cols-2 gap-4 mb-3 ${isAnalyzing ? 'opacity-60' : ''}`}>
        {/* AI Conviction */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
            <span>Gates Passed</span>
            <span className="text-primary">{signal.gatesPassed || 'N/A'}</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 bg-primary shadow-[0_0_8px_rgba(127,19,236,0.6)]"
              style={{ width: `${signal.conviction}%` }}
            ></div>
          </div>
        </div>

        {/* Trend Matrix */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Trend Matrix</div>
          <div className="flex gap-2">
            {(['4H', '1H', '15M'] as const).map((time) => (
              <div key={time} className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${signal.matrix[time] === 'UP' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    signal.matrix[time] === 'DOWN' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                      'bg-yellow-500'
                  }`}></div>
                <span className="text-[8px] text-slate-500 uppercase font-bold">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADX Info */}
      {signal.adxValue && (
        <div className="mb-3 px-2 py-1.5 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 uppercase font-bold">ADX Strength</span>
            <span className={`font-bold ${signal.adxTrend === 'VERY_STRONG' ? 'text-green-400' :
                signal.adxTrend === 'STRONG' ? 'text-emerald-400' :
                  signal.adxTrend === 'MODERATE' ? 'text-yellow-400' :
                    'text-slate-400'
              }`}>
              {signal.adxValue.toFixed(1)} ({signal.adxTrend?.replace('_', ' ')})
            </span>
          </div>
        </div>
      )}

      {/* Trade Reason */}
      {signal.tradeReason && (
        <div className="mb-3 text-[10px] text-slate-400 italic">
          {signal.tradeReason}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => onViewAnalysis(signal)}
        className="w-full bg-primary text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(127,19,236,0.3)] hover:brightness-110"
      >
        <span className="material-symbols-outlined text-sm">bolt</span>
        EXECUTE {signal.optionType || 'SIGNAL'}
      </button>
    </div>
  );
};

export default StockSignalCard;
