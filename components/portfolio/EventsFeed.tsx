import React, { useState, useMemo } from 'react';
import { FeedEvent } from '../../types/portfolio';
import { formatMoney, formatPnl, pnlColor } from './helpers';

interface Props {
    events: FeedEvent[];
}

const toneColor: Record<string, string> = {
    win: 'bg-emerald-500',
    loss: 'bg-red-500',
    warn: 'bg-amber-500',
    info: 'bg-slate-500',
};

const formatTimeET = (iso: string) => {
    try {
        return new Date(iso).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
        }) + ' ET';
    } catch { return '—'; }
};

const toETDate = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return ''; }
};

const EventsFeed: React.FC<Props> = ({ events }) => {
    const [dateFilter, setDateFilter] = useState('');
    const [applied, setApplied] = useState('');

    const filtered = useMemo(() => {
        let list = events.slice(0, 50);
        if (applied) {
            const target = new Date(applied + 'T12:00:00').toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
            list = list.filter(e => toETDate(e.at) === target);
        }
        return list;
    }, [events, applied]);

    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rolling Updates</span>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono"
                    />
                    <button
                        onClick={() => setApplied(dateFilter)}
                        className="px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold"
                    >Apply</button>
                    {applied && (
                        <button
                            onClick={() => { setApplied(''); setDateFilter(''); }}
                            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold"
                        >Clear</button>
                    )}
                </div>
            </div>
            <div className="space-y-0.5 max-h-[320px] overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-600">No events</div>
                ) : filtered.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1f2e]/50 transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneColor[e.tone] || toneColor.info}`} />
                        <span className="text-xs font-bold text-white truncate max-w-[70px]">{e.symbol}</span>
                        <span className="text-[11px] text-slate-400 flex-1 truncate">{e.message}</span>
                        {e.price != null && <span className="text-[11px] font-mono text-slate-500">{formatMoney(e.price)}</span>}
                        {e.pnl != null && <span className={`text-[11px] font-mono font-bold ${pnlColor(e.pnl)}`}>{formatPnl(e.pnl)}</span>}
                        <span className="text-[10px] text-slate-600 font-mono shrink-0">{formatTimeET(e.at)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventsFeed;
