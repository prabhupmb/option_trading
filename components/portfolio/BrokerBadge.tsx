import React from 'react';

interface Props {
    brokerName: string;
    brokerMode: 'live' | 'paper';
    accountType: string | null;
}

const BrokerBadge: React.FC<Props> = ({ brokerName, brokerMode, accountType }) => (
    <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-black uppercase tracking-wider text-slate-300">
            {brokerName}
        </span>
        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
            brokerMode === 'live'
                ? 'bg-red-500/10 border-red-500/25 text-red-400'
                : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${brokerMode === 'live' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
            {brokerMode}
        </span>
        {accountType && (
            <span className="px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {accountType}
            </span>
        )}
    </div>
);

export default BrokerBadge;
