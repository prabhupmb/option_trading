import React from 'react';
import { PortfolioPayload } from '../../types/portfolio';
import { formatMoney, formatPnlWithArrow, formatPct, pnlColor } from './helpers';

interface Props {
    account: PortfolioPayload['account'];
}

const Row: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-sm font-black font-mono tabular-nums ${className}`}>{value}</span>
    </div>
);

const AccountSummaryCard: React.FC<Props> = ({ account: a }) => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account</span>
        <Row label="Total Equity" value={formatMoney(a.totalEquity)} />
        <Row
            label="Day P&L"
            value={`${formatPnlWithArrow(a.dayPL)} (${formatPct(a.dayPLPct)})`}
            className={pnlColor(a.dayPL)}
        />
        <Row label="Cash" value={formatMoney(a.cashBalance)} />
        <Row label="Buying Power" value={formatMoney(a.buyingPower)} />
        <Row label="Unrealized P&L" value={formatPnlWithArrow(a.unrealizedPL)} className={pnlColor(a.unrealizedPL)} />
        <div className="pt-2 border-t border-[#1e2430] space-y-1">
            <Row
                label="Open Positions"
                value={`${a.openPositions.total} (${a.openPositions.options} options · ${a.openPositions.stocks} stocks)`}
            />
            <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Orders 7d</span>
                <span className="text-sm font-mono tabular-nums flex items-center gap-1.5">
                    <span className="text-slate-300 font-bold">{a.orders7d.filled} filled</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{a.orders7d.pending} pending</span>
                    <span className="text-slate-600">·</span>
                    <span className={`font-bold ${a.orders7d.rejected > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {a.orders7d.rejected} rejected
                    </span>
                </span>
            </div>
        </div>
    </div>
);

export default AccountSummaryCard;
