import React, { useRef, useEffect, useCallback } from 'react';
import { StatBlock } from '../../types/portfolio';
import { formatPnl, formatMoney, pnlColor } from './helpers';

interface DailyRow { date: string; pnl: number; trades: number; wins: number; losses: number; cumulativePnl: number }
type SourceStat = StatBlock & { source: string };
type ReasonStat = StatBlock & { reason: string };

interface Props {
    daily: DailyRow[];
    bySource: SourceStat[];
    byCloseReason: ReasonStat[];
}

const DailyPnlChart: React.FC<{ daily: DailyRow[] }> = ({ daily }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || daily.length === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = 220;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const pad = { top: 20, right: 10, bottom: 30, left: 65 };
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;

        const pnls = daily.map(d => d.pnl);
        const cumPnls = daily.map(d => d.cumulativePnl);
        const maxBar = Math.max(...pnls.map(Math.abs), 1);
        const maxCum = Math.max(...cumPnls.map(Math.abs), 1);

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        // Grid
        const zero = pad.top + ch / 2;
        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, zero);
        ctx.lineTo(w - pad.right, zero);
        ctx.stroke();

        // Bars
        const barW = Math.max(2, (cw / daily.length) * 0.7);
        const gap = cw / daily.length;

        daily.forEach((d, i) => {
            const x = pad.left + i * gap + gap / 2 - barW / 2;
            const barH = (Math.abs(d.pnl) / maxBar) * (ch / 2);
            const y = d.pnl >= 0 ? zero - barH : zero;
            ctx.fillStyle = d.pnl >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)';
            ctx.fillRect(x, y, barW, barH);
        });

        // Cumulative P&L line
        ctx.beginPath();
        daily.forEach((d, i) => {
            const x = pad.left + i * gap + gap / 2;
            const y = pad.top + ch / 2 - (d.cumulativePnl / maxCum) * (ch / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // X labels
        const step = Math.max(1, Math.floor(daily.length / 8));
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.font = '10px ui-monospace, monospace';
        for (let i = 0; i < daily.length; i += step) {
            const label = new Date(daily[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ctx.fillText(label, pad.left + i * gap + gap / 2, h - 8);
        }

        // Y labels
        ctx.textAlign = 'right';
        ctx.fillText(formatMoney(maxBar), pad.left - 6, pad.top + 12);
        ctx.fillText(formatMoney(-maxBar), pad.left - 6, h - pad.bottom - 4);
        ctx.fillText('$0', pad.left - 6, zero + 4);
    }, [daily]);

    useEffect(() => { draw(); }, [draw]);
    useEffect(() => {
        window.addEventListener('resize', draw);
        return () => window.removeEventListener('resize', draw);
    }, [draw]);

    if (daily.length === 0) {
        return <div className="h-[220px] flex items-center justify-center text-xs text-slate-600">No daily data</div>;
    }

    return (
        <div ref={containerRef}>
            <canvas ref={canvasRef} className="w-full rounded-lg" />
        </div>
    );
};

const BreakdownTable: React.FC<{ title: string; rows: Array<{ label: string } & StatBlock> }> = ({ title, rows }) => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2430]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
        </div>
        <table className="w-full text-[11px]">
            <thead>
                <tr className="border-b border-[#1e2430]">
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-600">Name</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Trades</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Win %</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-600">P&L</th>
                    <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Avg R</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(r => (
                    <tr key={r.label} className="border-b border-[#1e2430]/50 hover:bg-[#1a1f2e]/30">
                        <td className="px-3 py-2 font-bold text-slate-300">{r.label}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{r.trades}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{r.winRate != null ? `${r.winRate.toFixed(0)}%` : '—'}</td>
                        <td className={`px-2 py-2 text-right font-mono font-bold ${pnlColor(r.pnl)}`}>{formatPnl(r.pnl)}</td>
                        <td className={`px-2 py-2 text-right font-mono ${pnlColor(r.avgR)}`}>{r.avgR != null ? r.avgR.toFixed(2) : '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const sourceLabel = (s: string) => {
    if (s === 'stock_gate') return 'Stock Gate';
    if (s === 'option_auto_trade') return 'Options Auto';
    if (s === 'manual') return 'Manual';
    return s;
};

const reasonLabel = (r: string) => {
    if (r === 'TAKE_PROFIT') return '🎯 Take Profit';
    if (r === 'STOP_LOSS') return '🛑 Stop Loss';
    if (r === 'MARKET_EXIT') return '⏏ Market Exit';
    if (r === 'LIMIT_EXIT') return 'Limit Exit';
    if (r === 'EXPIRED') return '⌛ Expired';
    return r;
};

const TrendsPanel: React.FC<Props> = ({ daily, bySource, byCloseReason }) => (
    <div className="space-y-4">
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block">Daily P&L (bars) + Cumulative P&L (line)</span>
            <DailyPnlChart daily={daily} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BreakdownTable title="By Source" rows={bySource.map(s => ({ ...s, label: sourceLabel(s.source) }))} />
            <BreakdownTable title="By Close Reason" rows={byCloseReason.map(r => ({ ...r, label: reasonLabel(r.reason) }))} />
        </div>
    </div>
);

export default TrendsPanel;
