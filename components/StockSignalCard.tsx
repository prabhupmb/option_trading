import React from 'react';
import { OptionSignal } from '../hooks/useOptionSignals'; // Updated import
import { AccessLevel } from '../types';

interface Props {
  signal: OptionSignal;
  onViewAnalysis?: (signal: any) => void;
  onExecute?: (signal: any) => void;
  accessLevel?: AccessLevel;
}

const StockSignalCard: React.FC<Props> = ({ signal, onViewAnalysis, onExecute, accessLevel = 'signal' }) => {
  const isNoTrade = signal.tier === 'NO_TRADE';

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A+': return 'bg-[#eab308] text-black border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
      case 'A': return 'bg-[#94a3b8] text-black border-gray-400/50';
      case 'B+': return 'bg-[#d97706] text-white border-orange-600/50';
      default: return 'bg-gray-700 text-gray-400 border-gray-600';
    }
  };

  const adxColor = (trend: string) => {
    switch (trend) {
      case 'VERY_STRONG': return 'text-green-400 font-black'; // Bright Green
      case 'STRONG': return 'text-green-500 font-bold';
      case 'MODERATE': return 'text-yellow-500';
      case 'WEAK': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getGatesProgress = (gates: string) => {
    const [passed, total] = gates.split('/').map(Number);
    if (!total) return { width: '0%', color: 'bg-gray-700' };
    const pct = (passed / total) * 100;

    let color = 'bg-red-500';
    if (missedGateCount(gates) === 0) color = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
    else if (passed >= 4) color = 'bg-amber-500';

    return { width: `${pct}%`, color };
  };

  const missedGateCount = (gates: string) => {
    const [passed, total] = gates.split('/').map(Number);
    return total - passed;
  }

  const formatCurrency = (val?: number) => val ? `$${val.toFixed(2)}` : '-';

  return (
    <div className={`bg-[#1a1f2e] border border-gray-800 rounded-xl overflow-hidden relative group transition-all duration-300 hover:border-gray-600 hover:shadow-2xl ${isNoTrade ? 'opacity-60 grayscale-[0.5]' : ''}`}>

      {/* Header */}
      <div className="p-5 border-b border-gray-800/50 relative">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-black text-white tracking-tighter">{signal.symbol}</h3>
            <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border ${getTierColor(signal.tier)}`}>
              {signal.tier}
            </span>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-bold text-white tracking-tight">{formatCurrency(signal.current_price)}</div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {!isNoTrade ? (
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${signal.option_type === 'CALL' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
              {signal.option_type}
            </span>
          ) : (
            <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-gray-700/30 text-gray-500 border border-gray-700">
              No Trade
            </span>
          )}
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{new Date(signal.analyzed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Body: Signal & Gates */}
      <div className="p-5 space-y-5">

        {/* Signal & Gates Row */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-1">Signal</span>
            <span className="text-xs font-bold text-white uppercase tracking-wide">{signal.trading_recommendation}</span>
          </div>
          <div className="flex-1 max-w-[120px] text-right">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Gates</span>
              <span className="text-[10px] text-white font-mono font-bold">{signal.gates_passed}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getGatesProgress(signal.gates_passed).color}`}
                style={{ width: getGatesProgress(signal.gates_passed).width }}
              ></div>
            </div>
          </div>
        </div>

        {/* ADX & RR */}
        <div className="grid grid-cols-2 gap-4 bg-[#0f1219] p-3 rounded-lg border border-gray-800">
          <div>
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-0.5">ADX {signal.adx_value?.toFixed(1)}</span>
            <span className={`text-[10px] uppercase tracking-wide ${adxColor(signal.adx_trend)}`}>
              {signal.adx_trend?.replace('_', ' ')}
            </span>
          </div>
          <div className="text-right border-l border-gray-800 pl-4">
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-0.5">R/R Ratio</span>
            <span className="text-sm font-mono font-bold text-blue-400">{signal.risk_reward_ratio || '-'}</span>
          </div>
        </div>

        {/* Targets Section */}
        {!isNoTrade && (
          <div className="space-y-2 pt-2 border-t border-gray-800/50 border-dashed">
            <div className="flex justify-between items-center bg-green-900/5 px-2 py-1 rounded">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-green-500">my_location</span>
                <span className="text-[10px] font-bold text-green-500/70 uppercase">Target 1</span>
              </div>
              <span className="font-mono text-xs font-bold text-green-400">{formatCurrency(signal.fib_target1)}</span>
            </div>

            <div className="flex justify-between items-center px-2 py-1 opacity-70">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-green-500/40">flag</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Target 2</span>
              </div>
              <span className="font-mono text-xs font-bold text-green-600/70">{formatCurrency(signal.fib_target2)}</span>
            </div>

            <div className="flex justify-between items-center bg-red-900/5 px-2 py-1 rounded mt-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-red-500">do_not_disturb_on</span>
                <span className="text-[10px] font-bold text-red-500/70 uppercase">Stop Loss</span>
              </div>
              <span className="font-mono text-xs font-bold text-red-500">{formatCurrency(signal.fib_stop_loss)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Execute Button */}
      <div className="p-4 border-t border-gray-800 bg-[#0f1219]/50 flex gap-2">
        <button
          onClick={() => onViewAnalysis && onViewAnalysis(signal)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#1a1f2e] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          title="View Chart"
        >
          <span className="material-symbols-outlined text-lg">show_chart</span>
        </button>

        {!isNoTrade ? (
          accessLevel === 'trade' ? (
            <button
              onClick={() => onExecute && onExecute(signal)}
              className={`flex-1 rounded-lg text-xs font-black uppercase tracking-wide shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2
                            ${signal.option_type === 'CALL'
                  ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
                  : 'bg-transparent border border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              Execute {signal.option_type}
            </button>
          ) : accessLevel === 'paper' ? (
            <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
              <span className="material-symbols-outlined text-sm">description</span>
              Paper Trade
            </button>
          ) : (
            <button className="flex-1 bg-[#1a1f2e] border border-gray-700 text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">lock</span>
              Signal Only
            </button>
          )
        ) : (
          <button disabled className="flex-1 bg-transparent border border-gray-800 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-2">
            No Trade setup
          </button>
        )}
      </div>
    </div>
  );
};

export default StockSignalCard;
