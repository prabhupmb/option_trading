import React from 'react';
import { OptionSignal, AccessLevel } from '../types';

interface Props {
  signal: OptionSignal;
  onViewAnalysis?: (signal: any) => void;
  onExecute?: (signal: any) => void;
  accessLevel?: AccessLevel;
}

const StockSignalCard: React.FC<Props> = ({ signal, onViewAnalysis, onExecute, accessLevel = 'signal' }) => {
  const isNoTrade = signal.tier === 'NO_TRADE';
  const signalText = signal.trading_recommendation?.toUpperCase() || '';

  const getSignalBadgeStyle = (text: string) => {
    if (text.includes('STRONG BUY')) return 'bg-green-600 text-white border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
    if (text.includes('STRONG SELL')) return 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
    if (text === 'BUY' || text.includes('WEAK BUY')) return 'bg-green-500/10 text-green-400 border-green-500/30';
    if (text === 'SELL' || text.includes('WEAK SELL')) return 'bg-red-500/10 text-red-400 border-red-500/30';
    return 'bg-gray-700 text-gray-400 border-gray-600';
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
            {/* Replaced Call/Put/Tier with OptionType Tag for Context */}
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${signal.option_type === 'CALL' ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'}`}>
              {signal.option_type}
            </span>
          </div>
          {/* Replaced Tier Badge with Signal Badge */}
          <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${getSignalBadgeStyle(signalText)}`}>
            {signalText}
          </div>
        </div>

        <div className="flex justify-between items-center mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">{formatCurrency(signal.current_price)}</span>
            <span className="text-[10px] font-bold text-gray-500">Tier {signal.tier}</span>
          </div>
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{new Date(signal.analyzed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Body: Gates & Strength */}
      <div className="p-5 space-y-5">

        {/* Gates Row (Signal text moved to header badge) */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <div>
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-0.5">ADX {signal.adx_value?.toFixed(1)}</span>
              <span className={`text-[10px] uppercase tracking-wide ${adxColor(signal.adx_trend)}`}>
                {signal.adx_trend?.replace('_', ' ')}
              </span>
            </div>
            {signal.sma_direction && (
              <div className="pl-3 border-l border-gray-800">
                <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-0.5">SMA Trend</span>
                <div className="flex items-center gap-1">
                  <span className={`material-symbols-outlined text-[14px] ${signal.sma_direction === 'UP' ? 'text-green-500' : signal.sma_direction === 'DOWN' ? 'text-red-500' : 'text-gray-500'}`}>
                    {signal.sma_direction === 'UP' ? 'north_east' : signal.sma_direction === 'DOWN' ? 'south_east' : 'remove'}
                  </span>
                  <span className={`text-[10px] font-bold uppercase ${signal.sma_direction === 'UP' ? 'text-green-500' : signal.sma_direction === 'DOWN' ? 'text-red-500' : 'text-gray-500'}`}>
                    {signal.sma_direction}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 max-w-[140px] text-right">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Confirmation Gates</span>
              <span className="text-[10px] text-white font-mono font-bold">{signal.gates_passed}</span>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getGatesProgress(signal.gates_passed).color}`}
                style={{ width: getGatesProgress(signal.gates_passed).width }}
              ></div>
            </div>
          </div>
        </div>

        {/* Targets Section */}
        {!isNoTrade && (
          <div className="space-y-2 pt-2 border-t border-gray-800/50 border-dashed">
            <div className="flex justify-between items-center bg-green-900/5 px-2 py-1.5 rounded border border-green-500/10">
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

            <div className="flex justify-between items-center bg-red-900/5 px-2 py-1.5 rounded mt-1 border border-red-500/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-red-500">do_not_disturb_on</span>
                <span className="text-[10px] font-bold text-red-500/70 uppercase">Stop Loss</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-gray-500">R/R {signal.risk_reward_ratio}</span>
                <span className="font-mono text-xs font-bold text-red-500">{formatCurrency(signal.fib_stop_loss)}</span>
              </div>
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
            <button
              onClick={() => onExecute && onExecute(signal)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Paper Trade {signal.option_type}
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
