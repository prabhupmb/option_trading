import React from 'react';
import { AlpacaDetails } from '../../types/portfolio';
import { formatMoney } from './helpers';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-sm font-black font-mono tabular-nums text-slate-300">{value}</span>
    </div>
);

const Chip: React.FC<{ label: string; active: boolean; danger?: boolean }> = ({ label, active, danger }) => {
    const cls = active
        ? danger
            ? 'bg-red-500/10 border-red-500/25 text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
        : 'bg-slate-800/50 border-slate-700/50 text-slate-600';
    return <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${cls}`}>{label}</span>;
};

interface Props {
    details: AlpacaDetails;
    equity?: number;
}

const AlpacaAccountCard: React.FC<Props> = ({ details: d, equity }) => {
    const pdtWarn = (d.daytradeCount ?? 0) >= 3 && (equity ?? 0) < 25000;
    return (
        <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 space-y-1">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Alpaca Account</span>
                <div className="flex items-center gap-2 flex-wrap">
                    <Chip label={d.status || 'UNKNOWN'} active={d.status === 'ACTIVE'} />
                    {d.tradingBlocked && <Chip label="Trading Blocked" active danger />}
                    {d.accountBlocked && <Chip label="Account Blocked" active danger />}
                </div>
            </div>

            <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PDT Flag</span>
                <span className="flex items-center gap-2">
                    {d.patternDayTrader && <Chip label="PDT" active danger />}
                    <span className={`text-sm font-mono font-bold ${pdtWarn ? 'text-amber-400' : 'text-slate-300'}`}>
                        {d.daytradeCount ?? 0} / 3
                    </span>
                </span>
            </div>

            <Row label="Shorting" value={d.shortingEnabled ? 'Yes' : 'No'} />
            <Row label="Margin Multiplier" value={d.marginMultiplier != null ? `${d.marginMultiplier}x` : '—'} />

            <div className="pt-2 border-t border-[#1e2430] space-y-1">
                <Row label="Day-Trading BP" value={formatMoney(d.daytradingBuyingPower)} />
                <Row label="Reg-T BP" value={formatMoney(d.regtBuyingPower)} />
                <Row label="Non-Marginable BP" value={formatMoney(d.nonMarginableBuyingPower)} />
            </div>

            {d.optionsLevel != null && (
                <div className="pt-2 border-t border-[#1e2430] space-y-1">
                    <Row label="Options Level" value={d.optionsLevel} />
                    <Row label="Options BP" value={formatMoney(d.optionsBuyingPower)} />
                </div>
            )}

            <div className="pt-2 border-t border-[#1e2430] space-y-1">
                <Row label="Long Market Value" value={formatMoney(d.longMarketValue)} />
                <Row label="Short Market Value" value={formatMoney(d.shortMarketValue)} />
            </div>
        </div>
    );
};

export default AlpacaAccountCard;
