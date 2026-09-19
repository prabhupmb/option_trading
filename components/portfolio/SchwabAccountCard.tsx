import React from 'react';
import { SchwabDetails } from '../../types/portfolio';
import { formatMoney } from './helpers';

const Row: React.FC<{ label: string; value: React.ReactNode; warn?: boolean; tooltip?: string }> = ({ label, value, warn, tooltip }) => (
    <div className="flex items-center justify-between py-1.5" title={tooltip}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-sm font-black font-mono tabular-nums ${warn ? 'text-amber-400' : 'text-slate-300'}`}>{value}</span>
    </div>
);

interface Props {
    details: SchwabDetails;
}

const SchwabAccountCard: React.FC<Props> = ({ details: d }) => (
    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Schwab Account</span>
            <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded border text-[10px] font-bold uppercase bg-slate-800 border-slate-700 text-slate-400">
                    {d.accountType}
                </span>
                {d.closingOnlyRestricted && (
                    <span className="px-2 py-0.5 rounded border text-[10px] font-bold uppercase bg-red-500/10 border-red-500/25 text-red-400">
                        Closing-only restricted
                    </span>
                )}
            </div>
        </div>
        <Row label="Cash for Trading" value={formatMoney(d.cashAvailableForTrading)} />
        <Row label="Cash for Withdrawal" value={formatMoney(d.cashAvailableForWithdrawal)} />
        <Row
            label="Unsettled Cash"
            value={formatMoney(d.unsettledCash)}
            warn={(d.unsettledCash ?? 0) > 0}
            tooltip={(d.unsettledCash ?? 0) > 0 ? "Cash accounts can't reuse unsettled proceeds until T+1" : undefined}
        />
        {d.cashCall != null && d.cashCall > 0 && (
            <Row label="Cash Call" value={formatMoney(d.cashCall)} warn />
        )}
        <div className="pt-2 border-t border-[#1e2430] space-y-1">
            <Row label="Long Stock Value" value={formatMoney(d.longStockValue)} />
            <Row label="Long Option Value" value={formatMoney(d.longOptionValue)} />
            <Row label="Short Option Value" value={formatMoney(d.shortOptionValue)} />
        </div>
        <div className="pt-2 border-t border-[#1e2430] space-y-1">
            <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Round Trips</span>
                <span className="text-sm font-mono font-bold text-slate-300">
                    {d.roundTrips ?? '—'}
                    {d.isDayTrader && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[9px] font-bold uppercase">
                            PDT
                        </span>
                    )}
                </span>
            </div>
        </div>
        {d.accountType === 'MARGIN' && (
            <div className="pt-2 border-t border-[#1e2430] space-y-1">
                <Row label="Margin Balance" value={formatMoney(d.marginBalance)} />
                <Row label="Maintenance Req" value={formatMoney(d.maintenanceRequirement)} />
            </div>
        )}
    </div>
);

export default SchwabAccountCard;
