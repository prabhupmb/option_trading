import React from 'react';
import { MissedTrade } from '../../types/portfolio';
import { formatMoney, formatET, missedReasonLabel } from './helpers';

interface Props {
    missed: MissedTrade[];
}

const MissedTable: React.FC<Props> = ({ missed }) => (
    <div className="space-y-3">
        <div className="text-xs text-slate-500">
            Signals the auto-trader evaluated but didn't place (last 30 days).
        </div>
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="border-b border-[#1e2430]">
                            {['Time', 'Symbol', 'Side', 'Decision', 'Reason', 'Regime', 'Conf', 'Entry', 'SL', 'TP', 'RR'].map(h => (
                                <th key={h} className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {missed.length === 0 ? (
                            <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-slate-600">No missed trades</td></tr>
                        ) : missed.map((m, i) => (
                            <tr key={i} className="border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30">
                                <td className="px-2.5 py-2 text-[10px] text-slate-500 font-mono whitespace-nowrap">{formatET(m.decidedAt)}</td>
                                <td className="px-2.5 py-2 font-bold text-white">{m.symbol}</td>
                                <td className="px-2.5 py-2">
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${
                                        m.side === 'LONG' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
                                    }`}>{m.side}</span>
                                </td>
                                <td className="px-2.5 py-2">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[9px] font-bold uppercase">
                                        {m.decision}
                                    </span>
                                </td>
                                <td className="px-2.5 py-2 text-[10px] text-slate-400 max-w-[180px] truncate">{missedReasonLabel(m.reason)}</td>
                                <td className="px-2.5 py-2 text-[10px] text-slate-400">{m.regime ?? '—'}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-400">{m.confidence != null ? `${(m.confidence * 100).toFixed(0)}%` : '—'}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-300">{formatMoney(m.entry)}</td>
                                <td className="px-2.5 py-2 font-mono text-red-400/60">{formatMoney(m.stop)}</td>
                                <td className="px-2.5 py-2 font-mono text-emerald-400/60">{formatMoney(m.target)}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-400">{m.rr != null ? `${m.rr.toFixed(1)}:1` : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default MissedTable;
