import React from 'react';
import { HL } from '../../types/portfolio';
import { formatPnlWithArrow, formatET, pnlColor, closeReasonLabel } from './helpers';

interface Props {
    best: HL | null;
    worst: HL | null;
}

const Card: React.FC<{ hl: HL | null; label: string; accent: 'green' | 'red' }> = ({ hl, label, accent }) => {
    const border = accent === 'green' ? 'border-emerald-500/25' : 'border-red-500/25';
    const bg = accent === 'green' ? 'bg-emerald-500/5' : 'bg-red-500/5';

    if (!hl) {
        return (
            <div className={`${bg} rounded-2xl border ${border} p-4 flex items-center justify-center min-h-[100px]`}>
                <span className="text-xs text-slate-600">No closed trades this month</span>
            </div>
        );
    }

    return (
        <div className={`${bg} rounded-2xl border ${border} p-4 space-y-2`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <div className="text-lg font-black text-white">{hl.symbol}</div>
            <span className={`text-xl font-black font-mono tabular-nums ${pnlColor(hl.pnl)}`}>
                {formatPnlWithArrow(hl.pnl)}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                    hl.direction === 'LONG' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}>{hl.direction}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                    {hl.qty} {hl.assetType === 'OPTION' ? 'ct' : 'sh'}
                </span>
                {hl.closeReason && (
                    <span className="text-[10px] text-slate-500">{closeReasonLabel(hl.closeReason)}</span>
                )}
            </div>
            <div className="text-[10px] text-slate-600">{formatET(hl.exitAt)}</div>
        </div>
    );
};

const HighlightsCards: React.FC<Props> = ({ best, worst }) => (
    <div className="space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">This Month Highlights</span>
        <div className="grid grid-cols-1 gap-3">
            <Card hl={best} label="Most Profitable Trade" accent="green" />
            <Card hl={worst} label="Most Loss-Making Trade" accent="red" />
        </div>
    </div>
);

export default HighlightsCards;
