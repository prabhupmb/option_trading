import React from 'react';
import { StockSignal } from '../types';

interface Props {
  signal: StockSignal;
  onViewAnalysis: (signal: StockSignal) => void;
  onExecute: (signal: StockSignal) => void;
}

const StockSignalCard: React.FC<Props> = ({ signal, onViewAnalysis, onExecute }) => {
  const signalStr = signal.signal || '';

  const getBorderColor = () => {
    if (signalStr.includes('STRONG BUY')) return 'border-l-rh-green';
    if (signalStr.includes('BUY')) return 'border-l-rh-green/50';
    if (signalStr.includes('SELL')) return 'border-l-rh-red';
    return 'border-l-slate-300';
  };

  const borderColor = getBorderColor();
  const convictionVal = signal.conviction || 0;
  const isHighConviction = convictionVal > 70;

  // Map matrix to trend colors for dots
  const trendColors = ['4H', '1H', '15M'].map(time => {
    const trend = signal.matrix[time as keyof typeof signal.matrix];
    if (trend === 'UP') return 'bg-rh-green';
    if (trend === 'DOWN') return 'bg-rh-red';
    return 'bg-yellow-400';
  });

  return (
    <div className={`bg-white dark:bg-[#111111] border border-gray-100 dark:border-white/10 shadow-sm rounded-xl p-4 border-l-4 ${borderColor} transition-all duration-300 hover:shadow-md active:scale-[0.98]`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-lg flex items-center justify-center border border-gray-100 dark:border-white/5">
            <span className="material-symbols-outlined text-slate-600 dark:text-gray-300">{signal.icon || 'show_chart'}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-none">{signal.symbol}</h3>
            <p className="text-[11px] text-slate-400 mt-1 uppercase font-semibold">{signal.name || signal.symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-slate-900 dark:text-white">${signal.price.toFixed(2)}</div>
          <div className={`text-xs font-bold ${signal.optionType === 'CALL' ? 'text-rh-green' : 'text-rh-red'}`}>
            {signal.optionType}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-2 mb-4 ${signal.status === 'ANALYZING' ? 'opacity-50' : ''}`}>
        {/* AI Conviction */}
        <div className="flex flex-col gap-1.5 col-span-2">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-black mb-1">
            <span>AI Conviction</span>
            <span className={convictionVal > 70 ? 'text-rh-green' : 'text-rh-red'}>
              {convictionVal}%
            </span>
          </div>
          <div className="h-1.5 w-full max-w-[120px] bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${signal.status === 'ANALYZING' ? 'bg-gray-300 animate-pulse w-1/3' :
                (isHighConviction ? 'bg-rh-green' : 'bg-rh-red')
                }`}
              style={{ width: `${convictionVal}%` }}
            ></div>
          </div>
        </div>

        {/* ADX Strength */}
        <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 rounded-lg px-2 py-1.5">
          <span className="text-[9px] text-slate-400 uppercase font-black tracking-wide">ADX</span>
          <span className={`text-sm font-black tracking-tight ${signal.adxTrend?.toLowerCase().replace('_', ' ').includes('very strong') ? 'text-rh-green' : 'text-yellow-500'}`}>
            {signal.adxValue || '--'}
          </span>
          <span className={`text-[8px] font-bold uppercase tracking-wider ${signal.adxTrend?.toLowerCase().replace('_', ' ').includes('very strong') ? 'text-rh-green' : 'text-yellow-500'}`}>
            {signal.adxTrend?.replace('_', ' ') || 'N/A'}
          </span>
        </div>
      </div>

      {/* Timeframe Trend Matrix - Small Dots with Labels */}
      <div className={`flex items-center justify-center gap-4 mb-4 ${signal.status === 'ANALYZING' ? 'opacity-50' : ''}`}>
        {['4H', '1H', '15M'].map((time) => {
          const trend = signal.matrix[time as keyof typeof signal.matrix];
          const dotColor = trend === 'UP' ? 'bg-rh-green' : trend === 'DOWN' ? 'bg-rh-red' : 'bg-yellow-400';
          return (
            <div key={time} className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">{time}</span>
              <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => signalStr.includes('SELL') ? onViewAnalysis(signal) : onExecute(signal)}
          className={`flex-1 text-white text-xs font-bold py-3 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm ${signalStr.includes('SELL') ? 'bg-slate-900 dark:bg-white/10' : 'bg-rh-green hover:bg-rh-green/90'
            }`}
        >
          {signalStr.includes('SELL') ? 'VIEW ANALYSIS' : 'EXECUTE CALL'}
        </button>

        {signalStr.includes('SELL') ? (
          <button className="flex-1 bg-white dark:bg-transparent text-slate-500 border border-gray-200 dark:border-white/10 text-xs font-bold py-3 rounded-full flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-sm">rebase_edit</span> RE-SCAN
          </button>
        ) : (
          <button className="px-4 bg-slate-50 dark:bg-white/5 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-lg">show_chart</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default StockSignalCard;
