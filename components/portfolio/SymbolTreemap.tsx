import React, { useMemo, useState } from 'react';
import { StatBlock } from '../../types/portfolio';
import { formatPnl, formatMoney, pnlColor } from './helpers';

type SymbolStat = StatBlock & { symbol: string };

interface Props {
    bySymbol: SymbolStat[];
}

interface TreemapRect {
    x: number; y: number; w: number; h: number;
    item: SymbolStat;
}

// Simple squarified treemap layout
function layoutTreemap(items: SymbolStat[], width: number, height: number): TreemapRect[] {
    if (items.length === 0 || width <= 0 || height <= 0) return [];

    const sorted = [...items].sort((a, b) => Math.abs(b.pnl ?? 0) - Math.abs(a.pnl ?? 0));
    const total = sorted.reduce((s, i) => s + Math.abs(i.pnl ?? 0), 0) || 1;
    const rects: TreemapRect[] = [];

    let x = 0, y = 0, remainW = width, remainH = height;
    let remaining = sorted.map(item => ({ item, area: (Math.abs(item.pnl ?? 0) / total) * width * height }));

    while (remaining.length > 0) {
        const isHorizontal = remainW >= remainH;
        const side = isHorizontal ? remainH : remainW;
        let row: typeof remaining = [];
        let rowArea = 0;

        for (const r of remaining) {
            row.push(r);
            rowArea += r.area;
            if (row.length >= Math.ceil(remaining.length / 2)) break;
        }

        const rowSide = rowArea / side;
        let offset = 0;

        for (const r of row) {
            const itemSide = r.area / rowSide;
            if (isHorizontal) {
                rects.push({ x, y: y + offset, w: rowSide, h: itemSide, item: r.item });
            } else {
                rects.push({ x: x + offset, y, w: itemSide, h: rowSide, item: r.item });
            }
            offset += itemSide;
        }

        if (isHorizontal) {
            x += rowSide;
            remainW -= rowSide;
        } else {
            y += rowSide;
            remainH -= rowSide;
        }

        remaining = remaining.slice(row.length);
    }

    return rects;
}

type SortKey = 'symbol' | 'pnl' | 'trades' | 'winRate' | 'avgR';

const SymbolTreemap: React.FC<Props> = ({ bySymbol }) => {
    const [sortKey, setSortKey] = useState<SortKey>('pnl');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const rects = useMemo(() => layoutTreemap(bySymbol, 800, 300), [bySymbol]);

    const sorted = useMemo(() => {
        const list = [...bySymbol];
        list.sort((a, b) => {
            const va = a[sortKey] ?? 0;
            const vb = b[sortKey] ?? 0;
            if (sortKey === 'symbol') return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
        });
        return list;
    }, [bySymbol, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '';

    return (
        <div className="space-y-4">
            {/* Treemap */}
            {bySymbol.length > 0 && (
                <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block">Symbol P&L Map</span>
                    <svg viewBox="0 0 800 300" className="w-full rounded-lg" style={{ maxHeight: 300 }}>
                        {rects.map((r, i) => {
                            const pnl = r.item.pnl ?? 0;
                            const fill = pnl >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
                            const stroke = pnl >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)';
                            const showLabel = r.w > 40 && r.h > 24;
                            return (
                                <g key={i}>
                                    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke={stroke} strokeWidth={1} rx={4} />
                                    {showLabel && (
                                        <>
                                            <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 5} textAnchor="middle" fill="white" fontSize={r.w > 80 ? 11 : 9} fontWeight="bold">{r.item.symbol}</text>
                                            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 9} textAnchor="middle" fill={pnl >= 0 ? '#10b981' : '#ef4444'} fontSize={r.w > 80 ? 10 : 8} fontFamily="monospace">{formatPnl(pnl)}</text>
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            )}

            {/* Table */}
            <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-[#1e2430]">
                                {([['symbol', 'Symbol'], ['pnl', 'P&L'], ['trades', 'Trades'], ['winRate', 'Win %'], ['avgR', 'Avg R']] as [SortKey, string][]).map(([key, label]) => (
                                    <th key={key} className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer hover:text-slate-400" onClick={() => toggleSort(key)}>
                                        {label} {sortIcon(key)}
                                    </th>
                                ))}
                                <th className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Avg Win</th>
                                <th className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">Avg Loss</th>
                                <th className="px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">PF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map(s => (
                                <tr key={s.symbol} className="border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30">
                                    <td className="px-2.5 py-2 font-bold text-white">{s.symbol}</td>
                                    <td className={`px-2.5 py-2 font-mono font-bold tabular-nums ${pnlColor(s.pnl)}`}>{formatPnl(s.pnl)}</td>
                                    <td className="px-2.5 py-2 font-mono text-slate-300">{s.trades}</td>
                                    <td className="px-2.5 py-2 font-mono text-slate-300">{s.winRate != null ? `${s.winRate.toFixed(0)}%` : '—'}</td>
                                    <td className={`px-2.5 py-2 font-mono ${pnlColor(s.avgR)}`}>{s.avgR != null ? s.avgR.toFixed(2) : '—'}</td>
                                    <td className="px-2.5 py-2 font-mono text-emerald-400/70">{formatMoney(s.avgWin)}</td>
                                    <td className="px-2.5 py-2 font-mono text-red-400/70">{formatMoney(s.avgLoss)}</td>
                                    <td className="px-2.5 py-2 font-mono text-slate-400">{s.profitFactor != null ? s.profitFactor.toFixed(2) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SymbolTreemap;
