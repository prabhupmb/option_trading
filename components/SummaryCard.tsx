
import React from 'react';
import { SignalType, SummaryStat } from '../types';

interface Props {
  stat: SummaryStat;
  isPrimary?: boolean;
}

const SummaryCard: React.FC<Props> = ({ stat, isPrimary }) => {
  return (
    <div className={`bg-white dark:bg-[#111111] border shadow-sm rounded-xl p-3 flex flex-col gap-1 transition-all h-full ${isPrimary
      ? stat.type === SignalType.STRONG_SELL
        ? 'border-rh-red/50 ring-1 ring-rh-red/50 bg-rh-red/5 hover:border-rh-red/30'
        : 'border-rh-green/50 ring-1 ring-rh-green/50 bg-rh-green/5 hover:border-rh-green/20'
      : 'border-gray-100 dark:border-white/10 hover:border-rh-green/20'
      }`}>
      <span className={`text-[10px] font-black uppercase tracking-wider ${stat.type === SignalType.STRONG_BUY ? 'text-rh-green' :
        stat.type === SignalType.STRONG_SELL ? 'text-rh-red' :
          'text-slate-400'
        }`}>
        {stat.type.replace('_', ' ')}
      </span>
      <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">
        {stat.count}
      </span>
      <div className={`flex items-center gap-1 ${stat.change >= 0 ? 'text-rh-green' : 'text-rh-red'}`}>
        <span className="material-symbols-outlined text-xs">
          {stat.change >= 0 ? 'trending_up' : 'trending_down'}
        </span>
        <span className="text-xs font-bold">{stat.change > 0 ? '+' : ''}{stat.change}%</span>
      </div>
    </div>
  );
};

export default SummaryCard;
