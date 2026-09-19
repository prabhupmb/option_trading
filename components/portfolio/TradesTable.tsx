import React, { useState, useMemo } from 'react';
import { Trade, StatBlock } from '../../types/portfolio';
import { formatMoney, formatPnl, formatPct, formatET, formatOptionSymbol, formatHold, pnlColor, sourceLabel, closeReasonLabel, computeStatBlock } from './helpers';

interface Props {
    openTrades: Trade[];
    trades: Trade[];
}

const statusChip = (s: string) => {
    switch (s) {
        case 'WIN': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case 'LOSS': return 'bg-red-500/15 text-red-400 border-red-500/30';
        case 'OPEN': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
};

const TradeRowDetail: React.FC<{ t: Trade }> = ({ t }) => {
    const planned = t.plannedEntry != null || t.plannedTP != null || t.plannedSL != null;
    if (!planned) return null;

    // Price ladder
    const points: Array<{ label: string; price: number; color: string }> = [];
    if (t.plannedSL != null) points.push({ label: 'SL', price: t.plannedSL, color: '#ef4444' });
    if (t.plannedEntry != null) points.push({ label: 'Plan Entry', price: t.plannedEntry, color: '#64748b' });
    if (t.entryPrice != null) points.push({ label: 'Entry', price: t.entryPrice, color: '#3b82f6' });
    if (t.exitPrice != null) points.push({ label: 'Exit', price: t.exitPrice, color: t.status === 'WIN' ? '#10b981' : '#ef4444' });
    if (t.plannedTP != null) points.push({ label: 'TP', price: t.plannedTP, color: '#10b981' });
    points.sort((a, b) => a.price - b.price);

    const minP = points.length ? points[0].price : 0;
    const maxP = points.length ? points[points.length - 1].price : 1;
    const range = maxP - minP || 1;

    return (
        <tr>
            <td colSpan={12} className="px-4 py-3 bg-[#0a0e14] border-t border-[#1e2430]">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                        <div className="text-slate-500">Planned Entry</div><div className="font-mono text-slate-300">{formatMoney(t.plannedEntry)}</div>
                        <div className="text-slate-500">Actual Entry</div><div className="font-mono text-slate-300">{formatMoney(t.entryPrice)}</div>
                        <div className="text-slate-500">Planned TP</div><div className="font-mono text-emerald-400">{formatMoney(t.plannedTP)}</div>
                        <div className="text-slate-500">Actual Exit</div><div className={`font-mono ${pnlColor(t.realizedPL)}`}>{formatMoney(t.exitPrice)}</div>
                        <div className="text-slate-500">Planned SL</div><div className="font-mono text-red-400">{formatMoney(t.plannedSL)}</div>
                        <div className="text-slate-500">Planned RR</div><div className="font-mono text-slate-300">{t.plannedRR != null ? `${t.plannedRR.toFixed(1)}:1` : '—'}</div>
                    </div>
                    {points.length > 1 && (
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative h-8 bg-[#1a1f2e] rounded-lg">
                                {points.map((p, i) => {
                                    const left = ((p.price - minP) / range) * 100;
                                    return (
                                        <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${left}%` }}>
                                            <div className="w-0.5 h-full" style={{ backgroundColor: p.color }} />
                                            <span className="absolute -top-4 text-[8px] font-bold whitespace-nowrap" style={{ color: p.color }}>
                                                {p.label} {formatMoney(p.price)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {t.needsReview && (
                    <div className="mt-2 text-[10px] text-amber-400 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        Not found at broker — history incomplete
                    </div>
                )}
            </td>
        </tr>
    );
};

const TradesTable: React.FC<Props> = ({ openTrades, trades }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [reasonFilter, setReasonFilter] = useState<string>('All');
    const [sourceFilter, setSourceFilter] = useState<string>('All');
    const [assetFilter, setAssetFilter] = useState<string>('All');
    const [symbolSearch, setSymbolSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const allTrades = useMemo(() => [...openTrades, ...trades], [openTrades, trades]);

    const filtered = useMemo(() => {
        let list = allTrades;
        if (statusFilter === 'Wins') list = list.filter(t => t.status === 'WIN');
        else if (statusFilter === 'Losses') list = list.filter(t => t.status === 'LOSS');
        else if (statusFilter === 'Open') list = list.filter(t => t.status === 'OPEN');
        if (reasonFilter !== 'All') list = list.filter(t => t.closeReason === reasonFilter);
        if (sourceFilter !== 'All') list = list.filter(t => t.source === sourceFilter);
        if (assetFilter === 'Stocks') list = list.filter(t => t.assetType === 'EQUITY');
        else if (assetFilter === 'Options') list = list.filter(t => t.assetType === 'OPTION');
        if (symbolSearch.trim()) {
            const q = symbolSearch.trim().toUpperCase();
            list = list.filter(t => t.symbol.toUpperCase().includes(q) || t.underlying.toUpperCase().includes(q));
        }
        if (dateFrom) list = list.filter(t => (t.exitAt || t.entryAt) >= dateFrom);
        if (dateTo) list = list.filter(t => (t.exitAt || t.entryAt) <= dateTo + 'T23:59:59');
        return list;
    }, [allTrades, statusFilter, reasonFilter, sourceFilter, assetFilter, symbolSearch, dateFrom, dateTo]);

    const footerStats = useMemo(() => computeStatBlock(filtered), [filtered]);

    const reasons = useMemo(() => ['All', ...new Set(allTrades.map(t => t.closeReason).filter(Boolean) as string[])], [allTrades]);
    const sources = useMemo(() => ['All', ...new Set(allTrades.map(t => t.source).filter(Boolean) as string[])], [allTrades]);

    const renderSymbol = (t: Trade) => {
        if (t.assetType === 'OPTION') return formatOptionSymbol(t);
        return t.underlying || t.symbol;
    };

    return (
        <div className="space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                {['All', 'Wins', 'Losses', 'Open'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${statusFilter === s ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-[#1a1f2e] border-[#2a2f3e] text-slate-500 hover:text-slate-300'}`}>
                        {s}
                    </button>
                ))}
                <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-400 font-bold">
                    {reasons.map(r => <option key={r} value={r}>{r === 'All' ? 'Close Reason' : closeReasonLabel(r)}</option>)}
                </select>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-400 font-bold">
                    {sources.map(s => <option key={s} value={s}>{s === 'All' ? 'Source' : sourceLabel(s)}</option>)}
                </select>
                {['All', 'Stocks', 'Options'].map(a => (
                    <button key={a} onClick={() => setAssetFilter(a)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${assetFilter === a ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-[#1a1f2e] border-[#2a2f3e] text-slate-500 hover:text-slate-300'}`}>
                        {a}
                    </button>
                ))}
                <input
                    placeholder="Symbol..."
                    value={symbolSearch}
                    onChange={e => setSymbolSearch(e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono w-24"
                />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono" />
                <span className="text-[10px] text-slate-600">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1 text-[10px] text-slate-300 font-mono" />
            </div>

            {/* Table */}
            <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-[#1e2430]">
                                {['Symbol', 'Dir', 'Qty', 'Entry', 'Exit', 'Hold', 'P&L', '%', 'R', 'Status', 'Reason', 'Source'].map(h => (
                                    <th key={h} className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={12} className="px-4 py-8 text-center text-xs text-slate-600">No trades match filters</td></tr>
                            ) : filtered.map(t => (
                                <React.Fragment key={t.id}>
                                    <tr
                                        className={`border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30 cursor-pointer transition-colors ${t.needsReview ? 'bg-amber-500/[0.03]' : ''}`}
                                        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                    >
                                        <td className="px-2.5 py-2 font-bold text-white whitespace-nowrap">{renderSymbol(t)}</td>
                                        <td className="px-2.5 py-2">
                                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${
                                                t.direction === 'LONG' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
                                            }`}>{t.direction}</span>
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-slate-300">{t.qty}</td>
                                        <td className="px-2.5 py-2 font-mono text-slate-300 whitespace-nowrap">
                                            <div>{formatMoney(t.entryPrice)}</div>
                                            <div className="text-[9px] text-slate-600">{formatET(t.entryAt)}</div>
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-slate-300 whitespace-nowrap">
                                            {t.exitPrice != null ? (
                                                <>
                                                    <div>{formatMoney(t.exitPrice)}</div>
                                                    <div className="text-[9px] text-slate-600">{formatET(t.exitAt)}</div>
                                                </>
                                            ) : <span className="text-blue-400 text-[10px] font-bold">open</span>}
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-slate-400">{formatHold(t.holdMinutes)}</td>
                                        <td className={`px-2.5 py-2 font-mono font-bold tabular-nums ${
                                            t.status === 'OPEN' ? 'text-slate-400 italic' : pnlColor(t.realizedPL)
                                        }`}>
                                            {t.status === 'OPEN' ? formatPnl(t.unrealizedPL) : formatPnl(t.realizedPL)}
                                        </td>
                                        <td className={`px-2.5 py-2 font-mono tabular-nums ${pnlColor(t.realizedPLPct)}`}>
                                            {formatPct(t.status === 'OPEN' ? null : t.realizedPLPct)}
                                        </td>
                                        <td className={`px-2.5 py-2 font-mono font-bold ${pnlColor(t.rMultiple)}`}>
                                            {t.rMultiple != null ? `${t.rMultiple > 0 ? '+' : ''}${t.rMultiple.toFixed(1)}R` : '—'}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${statusChip(t.status)}`}>{t.status}</span>
                                        </td>
                                        <td className="px-2.5 py-2 text-[10px] text-slate-400 whitespace-nowrap">{closeReasonLabel(t.closeReason)}</td>
                                        <td className="px-2.5 py-2">
                                            {t.source && (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 text-[9px] font-bold text-slate-400">
                                                    {sourceLabel(t.source)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedId === t.id && <TradeRowDetail t={t} />}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer stats */}
                <div className="px-4 py-2.5 border-t border-[#1e2430] flex items-center gap-4 flex-wrap text-[10px] font-mono">
                    <span className="text-slate-500">Filtered: {filtered.length} trades</span>
                    <span className={`font-bold ${pnlColor(footerStats.pnl)}`}>P&L: {formatPnl(footerStats.pnl)}</span>
                    <span className="text-emerald-400">{footerStats.wins}W</span>
                    <span className="text-red-400">{footerStats.losses}L</span>
                    <span className="text-slate-400">WR: {footerStats.winRate != null ? `${footerStats.winRate.toFixed(0)}%` : '—'}</span>
                    <span className="text-slate-400">PF: {footerStats.profitFactor != null ? footerStats.profitFactor.toFixed(2) : '—'}</span>
                    <span className="text-slate-400">Avg R: {footerStats.avgR != null ? footerStats.avgR.toFixed(2) : '—'}</span>
                </div>
            </div>
        </div>
    );
};

export default TradesTable;
