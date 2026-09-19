import React, { useMemo } from 'react';
import { StatBlock } from '../../types/portfolio';
import { formatPnl, pnlColor } from './helpers';

type MonthRow = StatBlock & { month: string; year: number; monthNum: number };

interface Props {
    monthly: MonthRow[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MonthlyStatsTable: React.FC<Props> = ({ monthly }) => {
    const years = useMemo(() => {
        const yrs: number[] = Array.from(new Set(monthly.map(m => m.year)));
        yrs.sort((a, b) => b - a);
        return yrs;
    }, [monthly]);

    const lookup = useMemo(() => {
        const map = new Map<string, MonthRow>();
        monthly.forEach(m => map.set(`${m.year}-${m.monthNum}`, m));
        return map;
    }, [monthly]);

    if (monthly.length === 0) {
        return (
            <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-6 text-center text-xs text-slate-600">
                No monthly data yet
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e2430]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Monthly Stats</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="border-b border-[#1e2430]">
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-[#0d1117] z-10">Year</th>
                            {MONTHS.map(m => (
                                <th key={m} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600 min-w-[80px]">{m}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {years.map(year => (
                            <tr key={year} className="border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30">
                                <td className="px-3 py-2 font-bold text-slate-300 sticky left-0 bg-[#0d1117] z-10">{year}</td>
                                {MONTHS.map((_, mi) => {
                                    const row = lookup.get(`${year}-${mi + 1}`);
                                    if (!row) return <td key={mi} className="px-2 py-2 text-center text-slate-700">—</td>;
                                    return (
                                        <td key={mi} className="px-2 py-2 text-center">
                                            <div className={`font-mono font-bold tabular-nums ${pnlColor(row.pnl)}`}>
                                                {formatPnl(row.pnl)}
                                            </div>
                                            <div className="text-[9px] text-slate-600 mt-0.5">
                                                {row.trades} trades · {row.winRate != null ? `${row.winRate.toFixed(0)}%` : '—'} win
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlyStatsTable;
