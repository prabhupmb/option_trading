import React, { useMemo } from 'react';
import StockSignalCard from '../StockSignalCard';
import { useMdBars } from '../../hooks/useMdBars';
import { OptionSignal, AccessLevel } from '../../types';

interface Props {
  signals: OptionSignal[];
  onViewAnalysis?: (signal: any) => void;
  onExecute?: (signal: any) => void;
  onQuickTrade?: (signal: OptionSignal) => void;
  accessLevel?: AccessLevel;
  onClearFilters?: () => void;
}

const OptionFeedGrid: React.FC<Props> = ({ signals, onViewAnalysis, onExecute, onQuickTrade, accessLevel, onClearFilters }) => {
  const symbols = useMemo(() => signals.map(s => s.symbol), [signals]);
  const { barsBySymbol } = useMdBars(symbols);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {signals.map((signal) => (
        <StockSignalCard
          key={signal.id || signal.symbol}
          signal={signal}
          bars={barsBySymbol[signal.symbol]}
          onViewAnalysis={onViewAnalysis}
          onExecute={onExecute}
          onQuickTrade={onQuickTrade}
          accessLevel={accessLevel}
        />
      ))}
      {signals.length === 0 && (
        <div className="col-span-full py-20 text-center opacity-50">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-white/10 mb-4">filter_list_off</span>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No signals match your filter</p>
          {onClearFilters && (
            <button onClick={onClearFilters} className="mt-4 text-rh-green font-bold text-xs uppercase hover:underline">Clear Filters</button>
          )}
        </div>
      )}
    </div>
  );
};

export default OptionFeedGrid;
