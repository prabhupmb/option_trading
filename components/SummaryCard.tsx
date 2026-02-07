
import React from 'react';
import { SignalType, SummaryStat } from '../types';

interface Props {
  stat: SummaryStat;
  isPrimary?: boolean;
}

const SummaryCard: React.FC<Props> = ({ stat, isPrimary }) => {
  const labelColor = stat.type === SignalType.STRONG_BUY ? 'text-primary' : 'text-slate-400';
  const borderColor = isPrimary ? 'border-primary/50 shadow-[0_0_10px_rgba(127,19,236,0.2)]' : 'border-white/5';
  
  return (
    <div className={`glass-card ${borderColor} rounded-xl p-4 min-w-[140px] flex flex-col gap-1 transition-all hover:scale-[1.02]`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>
        {stat.type.replace('_', ' ')}
      </span>
      <span className="text-2xl font-bold text-white tracking-tighter">
        {stat.count}
      </span>
      <div className={`flex items-center gap-1 ${stat.change >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
        <span className="material-symbols-outlined text-sm">
          {stat.change >= 0 ? 'trending_up' : 'trending_down'}
        </span>
        <span className="text-xs font-semibold">{stat.change >= 0 ? '+' : ''}{stat.change}%</span>
      </div>
    </div>
  );
};

export default SummaryCard;
