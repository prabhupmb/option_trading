import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatMoney } from './helpers';

interface CurvePoint { date: string; equity: number }
interface DailyPoint { date: string; cumulativePnl: number }

interface Props {
    equityCurve: CurvePoint[];
    daily: DailyPoint[];
}

const EquityChart: React.FC<Props> = ({ equityCurve, daily }) => {
    const [mode, setMode] = useState<'equity' | 'pnl'>('equity');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number; label: string; value: string } | null>(null);

    const data = mode === 'equity'
        ? equityCurve.map(p => ({ date: p.date, value: p.equity }))
        : daily.map(p => ({ date: p.date, value: p.cumulativePnl }));

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || data.length === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = 200;
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

        const values = data.map(d => d.value);
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const range = maxV - minV || 1;

        const xScale = (i: number) => pad.left + (i / (data.length - 1)) * cw;
        const yScale = (v: number) => pad.top + ch - ((v - minV) / range) * ch;

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (ch / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();

            const val = maxV - (range / 4) * i;
            ctx.fillStyle = '#64748b';
            ctx.font = '10px ui-monospace, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(formatMoney(val), pad.left - 6, y + 4);
        }

        // X-axis labels
        const step = Math.max(1, Math.floor(data.length / 6));
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.font = '10px ui-monospace, monospace';
        for (let i = 0; i < data.length; i += step) {
            const d = new Date(data[i].date);
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ctx.fillText(label, xScale(i), h - 8);
        }

        // Gradient fill
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
        grad.addColorStop(0, 'rgba(59,130,246,0.15)');
        grad.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.beginPath();
        ctx.moveTo(xScale(0), yScale(data[0].value));
        for (let i = 1; i < data.length; i++) ctx.lineTo(xScale(i), yScale(data[i].value));
        ctx.lineTo(xScale(data.length - 1), pad.top + ch);
        ctx.lineTo(xScale(0), pad.top + ch);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(xScale(0), yScale(data[0].value));
        for (let i = 1; i < data.length; i++) ctx.lineTo(xScale(i), yScale(data[i].value));
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [data]);

    useEffect(() => { draw(); }, [draw]);
    useEffect(() => {
        const handleResize = () => draw();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || data.length === 0) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pad = { left: 65, right: 10 };
        const cw = container.clientWidth - pad.left - pad.right;
        const idx = Math.round(((x - pad.left) / cw) * (data.length - 1));
        if (idx < 0 || idx >= data.length) { setTooltip(null); return; }
        const d = data[idx];
        const dateStr = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setTooltip({ x, label: dateStr, value: formatMoney(d.value) });
    };

    if (data.length === 0) {
        return (
            <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-6 flex items-center justify-center h-[240px]">
                <span className="text-sm text-slate-600">Equity history starts from your first sync.</span>
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account Balance</span>
                <div className="flex bg-[#1a1f2e] rounded-lg border border-[#2a2f3e] p-0.5">
                    {(['equity', 'pnl'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                                mode === m ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {m === 'equity' ? 'Equity' : 'Cumulative P&L'}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={containerRef} className="relative">
                <canvas
                    ref={canvasRef}
                    className="w-full rounded-lg"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(null)}
                />
                {tooltip && (
                    <div
                        className="absolute top-2 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2.5 py-1.5 text-[10px] font-mono pointer-events-none z-10"
                        style={{ left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 200) - 120) }}
                    >
                        <div className="text-slate-400">{tooltip.label}</div>
                        <div className="text-white font-bold">{tooltip.value}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EquityChart;
