import React from 'react';
import { Position } from '../../types/portfolio';
import { formatMoney, formatPnl, formatPct, formatET, formatOptionSymbol, pnlColor } from './helpers';

interface Props {
    positions: Position[];
}

const PositionsTable: React.FC<Props> = ({ positions }) => {
    const renderSymbol = (p: Position) => {
        if (p.assetType === 'OPTION') return formatOptionSymbol({ underlying: p.underlying, strike: p.strike, putCall: p.putCall, expirationDate: p.expirationDate });
        return p.underlying || p.symbol;
    };

    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="border-b border-[#1e2430]">
                            {['Symbol', 'Qty', 'Avg', 'Current', 'Mkt Value', 'Unreal $', 'Unreal %', 'Day P&L', 'Opened', 'TP', 'SL'].map(h => (
                                <th key={h} className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {positions.length === 0 ? (
                            <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-slate-600">No open positions</td></tr>
                        ) : positions.map((p, i) => (
                            <tr key={i} className="border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30">
                                <td className="px-2.5 py-2 font-bold text-white whitespace-nowrap">{renderSymbol(p)}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-300">{p.quantity}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-300">{formatMoney(p.avgPrice)}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-300">{formatMoney(p.currentPrice)}</td>
                                <td className="px-2.5 py-2 font-mono text-slate-300">{formatMoney(p.marketValue)}</td>
                                <td className={`px-2.5 py-2 font-mono font-bold tabular-nums ${pnlColor(p.unrealizedPL)}`}>{formatPnl(p.unrealizedPL)}</td>
                                <td className={`px-2.5 py-2 font-mono tabular-nums ${pnlColor(p.unrealizedPLPct)}`}>{formatPct(p.unrealizedPLPct)}</td>
                                <td className={`px-2.5 py-2 font-mono font-bold tabular-nums ${pnlColor(p.dayPL)}`}>{formatPnl(p.dayPL)}</td>
                                <td className="px-2.5 py-2 text-[10px] text-slate-500 font-mono whitespace-nowrap">{formatET(p.openedAt)}</td>
                                <td className="px-2.5 py-2 font-mono text-emerald-400/60">{formatMoney(p.plannedTP)}</td>
                                <td className="px-2.5 py-2 font-mono text-red-400/60">{formatMoney(p.plannedSL)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PositionsTable;
