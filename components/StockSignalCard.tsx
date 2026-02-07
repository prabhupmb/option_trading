
import React from 'react';
import { StockSignal } from '../types';

interface Props {
  signal: StockSignal;
  onViewAnalysis: (signal: StockSignal) => void;
}

const StockSignalCard: React.FC<Props> = ({ signal, onViewAnalysis }) => {
  const isAnalyzing = signal.status === 'ANALYZING';
  const isRescan = signal.status === 'RESCAN';
  const isPositive = signal.changePercent >= 0;

  return (
    <div className={`glass-card rounded-xl p-4 border-l-4 transition-all hover:translate-x-1 ${
      isAnalyzing ? 'border-l-slate-600' : isRescan ? 'border-l-orange-500' : 'border-l-primary'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
            <span className="material-symbols-outlined text-white">{signal.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-none">{signal.symbol}</h3>
            <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-tight">{signal.name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-white tracking-tight">${signal.price.toFixed(2)}</div>
          <div className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-orange-400'}`}>
            {isPositive ? '+' : ''}{signal.changePercent}%
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 mb-4 ${isAnalyzing ? 'opacity-60' : ''}`}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
            <span>AI Conviction</span>
            <span className={isRescan ? 'text-orange-400' : 'text-primary'}>
              {isAnalyzing ? <span className="italic">Calculating...</span> : `${signal.conviction}%`}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                isAnalyzing ? 'bg-white/20 w-1/3 animate-pulse' : isRescan ? 'bg-orange-500' : 'bg-primary shadow-[0_0_8px_rgba(127,19,236,0.6)]'
              }`}
              style={{ width: isAnalyzing ? '33%' : `${signal.conviction}%` }}
            ></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Trend Matrix</div>
          <div className="flex gap-2">
            {(['4H', '1H', '15M'] as const).map((time) => (
              <div key={time} className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${
                  signal.matrix[time] === 'UP' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                  signal.matrix[time] === 'DOWN' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                  'bg-yellow-500'
                }`}></div>
                <span className="text-[8px] text-slate-500 uppercase font-bold">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {isAnalyzing ? (
          <button className="flex-1 bg-white/5 text-primary text-xs font-bold py-2.5 rounded-lg border border-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(127,19,236,0.1)]">
            <span className="material-symbols-outlined text-sm animate-spin-slow">refresh</span> ANALYZING TRENDS
          </button>
        ) : isRescan ? (
          <>
            <button 
              onClick={() => onViewAnalysis(signal)}
              className="flex-[1.5] bg-white/10 text-white text-xs font-bold py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-2 active:bg-white/20 transition-all"
            >
              VIEW ANALYSIS
            </button>
            <button className="flex-1 bg-white/5 text-slate-400 text-xs font-bold py-2.5 rounded-lg border border-white/5 flex items-center justify-center gap-2 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-sm">rebase_edit</span> RE-SCAN
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => onViewAnalysis(signal)}
              className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(127,19,236,0.3)] hover:brightness-110"
            >
              <span className="material-symbols-outlined text-sm">bolt</span> EXECUTE SIGNAL
            </button>
            <button className="px-3 bg-white/5 text-slate-300 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
              <span className="material-symbols-outlined text-lg">show_chart</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StockSignalCard;
