import React from 'react';
import { StatBlock } from '../../types/portfolio';
import { formatPnlWithArrow, pnlColor, formatMoney } from './helpers';

const WinRateGauge: React.FC<{ rate: number | null }> = ({ rate }) => {
    if (rate == null) return <span className="text-[10px] text-slate-600 font-mono">—</span>;
    const pct = Math.min(100, Math.max(0, rate));
    const r = 24;
    const circumHalf = Math.PI * r;
    const filled = (pct / 100) * circumHalf;
    const color = pct >= 60 ? '#10b981' : pct >= 45 ? '#f59e0b' : '#ef4444';
    return (
        <div className="flex flex-col items-center">
            <svg width="56" height="32" viewBox="0 0 56 32">
                <path d="M4,28 A24,24 0 0,1 52,28" fill="none" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
                <path d="M4,28 A24,24 0 0,1 52,28" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${filled} ${circumHalf}`} />
            </svg>
            <span className="text-xs font-black font-mono -mt-1" style={{ color }}>{pct.toFixed(0)}%</span>
        </div>
    );
};

interface Props {
    label: string;
    stat: StatBlock;
}

const KpiPeriodCard: React.FC<Props> = ({ label, stat }) => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 flex flex-col gap-2 relative overflow-hidden">
        <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <WinRateGauge rate={stat.winRate} />
        </div>
        <span className={`text-2xl font-black font-mono tabular-nums ${pnlColor(stat.pnl)}`}>
            {formatPnlWithArrow(stat.pnl)}
        </span>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
            <span>● {stat.trades} trades</span>
            <span className="text-emerald-500">● {stat.wins} wins</span>
            <span className="text-red-400">● {stat.losses} losses</span>
        </div>
        <div className="mt-auto pt-2 border-t border-[#1e2430] flex items-center gap-2 text-[9px] font-mono text-slate-600 flex-wrap">
            <span>PF {stat.profitFactor != null ? stat.profitFactor.toFixed(2) : '—'}</span>
            <span>·</span>
            <span>Exp {stat.expectancy != null ? formatMoney(stat.expectancy) : '—'}</span>
            <span>·</span>
            <span>Avg R {stat.avgR != null ? (stat.avgR > 0 ? '+' : '') + stat.avgR.toFixed(2) : '—'}</span>
        </div>
    </div>
);

export default KpiPeriodCard;
