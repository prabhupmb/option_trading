import React, { useState } from 'react';
import { useBrokerContext } from '../../context/BrokerContext';
import { useAuth } from '../../services/useAuth';
import { usePortfolio } from '../../hooks/usePortfolio';
import { SchwabDetails, AlpacaDetails, StatBlock } from '../../types/portfolio';
import BrokerBadge from './BrokerBadge';
import SyncChip from './SyncChip';
import SyncErrorBanner from './SyncErrorBanner';
import KpiPeriodCard from './KpiPeriodCard';
import AccountSummaryCard from './AccountSummaryCard';
import SchwabAccountCard from './SchwabAccountCard';
import AlpacaAccountCard from './AlpacaAccountCard';
import EquityChart from './EquityChart';
import HighlightsCards from './HighlightsCards';
import EventsFeed from './EventsFeed';
import MonthlyStatsTable from './MonthlyStatsTable';
import TradesTable from './TradesTable';
import PositionsTable from './PositionsTable';
import OrdersTable from './OrdersTable';
import SymbolTreemap from './SymbolTreemap';
import TrendsPanel from './TrendsPanel';
import MissedTable from './MissedTable';

type Tab = 'overview' | 'trades' | 'positions' | 'symbols' | 'trends' | 'missed';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'trades', label: 'Trades', icon: 'receipt_long' },
    { id: 'positions', label: 'Positions & Orders', icon: 'inventory_2' },
    { id: 'symbols', label: 'Symbols', icon: 'grid_view' },
    { id: 'trends', label: 'Trends', icon: 'trending_up' },
    { id: 'missed', label: 'Missed', icon: 'block' },
];

const emptyStat: StatBlock = { pnl: null, trades: 0, wins: 0, losses: 0, winRate: null, avgWin: null, avgLoss: null, profitFactor: null, expectancy: null, avgR: null };

interface Props {
    onNavigate?: (view: string) => void;
}

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 animate-pulse ${className}`}>
        <div className="h-3 bg-[#1e2430] rounded w-1/3 mb-3" />
        <div className="h-7 bg-[#1e2430] rounded w-2/3 mb-2" />
        <div className="h-3 bg-[#1e2430] rounded w-1/2" />
    </div>
);

const PortfolioPage: React.FC<Props> = ({ onNavigate }) => {
    const { user } = useAuth();
    const { selectedBroker } = useBrokerContext();
    const { data, loading, error, syncNow, syncing, syncCooldown, syncMessage } = usePortfolio(user?.id, selectedBroker?.id);
    const [tab, setTab] = useState<Tab>('overview');
    const [positionsSubTab, setPositionsSubTab] = useState<'positions' | 'orders'>('positions');

    // Loading state
    if (loading && !data) {
        return (
            <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
                <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">
                    <SkeletonCard className="h-20" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} className="h-36" />)}
                    </div>
                    <SkeletonCard className="h-[240px]" />
                </div>
            </div>
        );
    }

    // Empty state - no broker / no data
    if (!selectedBroker || !data) {
        return (
            <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
                <div className="max-w-[1600px] mx-auto p-5 lg:p-7">
                    <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-12 text-center space-y-4">
                        <span className="material-symbols-outlined text-4xl text-slate-700">account_balance</span>
                        <h2 className="text-lg font-bold text-slate-400">
                            {error || 'No synced accounts yet'}
                        </h2>
                        <button
                            onClick={syncNow}
                            disabled={syncing}
                            className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-bold hover:bg-blue-600/30 transition-colors"
                        >
                            {syncing ? 'Syncing...' : 'Sync now'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const d = data!;
    const broker = d.broker;
    const isSchwab = broker?.details?.broker === 'schwab';
    const isAlpaca = broker?.details?.broker === 'alpaca';
    const sync = d.sync ?? { lastSyncedAt: null, ageSeconds: null, stale: false, marketOpen: false, errors: [] };
    const account = account ?? { totalEquity: 0, cashBalance: 0, buyingPower: 0, dayPL: 0, dayPLPct: 0, unrealizedPL: 0, openPositions: { total: 0, options: 0, stocks: 0 }, orders7d: { total: 0, filled: 0, pending: 0, rejected: 0 } };
    const periods = d.periods ?? { week: emptyStat, month: emptyStat, year: emptyStat, allTime: emptyStat };

    return (
        <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
            {/* Toast for sync messages */}
            {syncMessage && (
                <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl border text-sm font-bold shadow-2xl bg-[#1a1f2e] border-[#2a2f3e] text-slate-300">
                    {syncMessage}
                </div>
            )}

            <div className="max-w-[1600px] mx-auto p-5 lg:p-7 space-y-5">
                {/* ── HEADER ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-xl font-black tracking-tight uppercase">Portfolio</h1>
                            <p className="text-xs text-slate-500">{d.scope?.label}</p>
                        </div>
                        {broker && (
                            <BrokerBadge
                                brokerName={broker.brokerName}
                                brokerMode={broker.brokerMode}
                                accountType={broker.accountType}
                            />
                        )}
                    </div>
                    <SyncChip
                        ageSeconds={sync.ageSeconds}
                        stale={sync.stale}
                        syncing={syncing}
                        syncCooldown={syncCooldown}
                        onSync={syncNow}
                    />
                </div>

                {/* Sync error banners */}
                <SyncErrorBanner errors={sync.errors} onNavigate={onNavigate} />

                {/* ── TABS ── */}
                <div className="flex bg-[#0d1117] rounded-xl border border-[#1e2430] p-1 gap-1 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                tab === t.id
                                    ? 'bg-blue-600/15 text-blue-400'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-[#1a1f2e]/50'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB CONTENT ── */}
                {tab === 'overview' && (
                    <div className="space-y-5">
                        {/* KPI row + Account card */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiPeriodCard label="This Week" stat={periods.week} />
                                <KpiPeriodCard label="This Month" stat={periods.month} />
                                <KpiPeriodCard label="This Year" stat={periods.year} />
                                <KpiPeriodCard label="All Time" stat={periods.allTime} />
                            </div>
                            <AccountSummaryCard account={account} />
                        </div>

                        {/* Broker-specific card */}
                        {broker && broker.details ? (
                            isSchwab ? <SchwabAccountCard details={broker.details as SchwabDetails} />
                            : isAlpaca ? <AlpacaAccountCard details={broker.details as AlpacaDetails} equity={account.totalEquity} />
                            : null
                        ) : broker ? (
                            <div className="bg-[#0d1117] rounded-2xl border border-[#1e2430] p-4 text-xs text-slate-600">
                                Broker details appear after the first sync.
                            </div>
                        ) : null}

                        {/* Chart + Highlights row */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-3">
                                <EquityChart equityCurve={d.equityCurve ?? []} daily={d.daily ?? []} />
                            </div>
                            <div className="lg:col-span-2">
                                <HighlightsCards best={d.highlights?.bestThisMonth ?? null} worst={d.highlights?.worstThisMonth ?? null} />
                            </div>
                        </div>

                        {/* Events feed */}
                        <EventsFeed events={d.events ?? []} />

                        {/* Monthly stats */}
                        <MonthlyStatsTable monthly={d.monthly ?? []} />
                    </div>
                )}

                {tab === 'trades' && (
                    <TradesTable openTrades={d.openTrades ?? []} trades={d.trades ?? []} />
                )}

                {tab === 'positions' && (
                    <div className="space-y-4">
                        <div className="flex bg-[#0d1117] rounded-xl border border-[#1e2430] p-1 gap-1 w-fit">
                            <button
                                onClick={() => setPositionsSubTab('positions')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    positionsSubTab === 'positions' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Active Positions ({(d.positions ?? []).length})
                            </button>
                            <button
                                onClick={() => setPositionsSubTab('orders')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    positionsSubTab === 'orders' ? 'bg-blue-600/15 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Order History ({(d.orders ?? []).length})
                            </button>
                        </div>
                        {positionsSubTab === 'positions' ? (
                            <PositionsTable positions={d.positions ?? []} />
                        ) : (
                            <OrdersTable orders={d.orders ?? []} />
                        )}
                    </div>
                )}

                {tab === 'symbols' && (
                    <SymbolTreemap bySymbol={d.bySymbol ?? []} />
                )}

                {tab === 'trends' && (
                    <TrendsPanel daily={d.daily ?? []} bySource={d.bySource ?? []} byCloseReason={d.byCloseReason ?? []} />
                )}

                {tab === 'missed' && (
                    <MissedTable missed={d.missed ?? []} />
                )}
            </div>
        </div>
    );
};

export default PortfolioPage;
