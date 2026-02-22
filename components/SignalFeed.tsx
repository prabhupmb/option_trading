import React, { useState, useMemo } from 'react';
import { useSignals, SmartSignal } from '../hooks/useSignals';
import { useAuth } from '../services/useAuth';
import SignalCard from './signals/SignalCard';
import SignalFilters from './signals/SignalFilters';
import SignalStats from './signals/SignalStats';
import SignalSkeleton from './signals/SignalSkeleton';
import UploadWatchlistModal from './signals/UploadWatchlistModal';
import WatchlistManager from './signals/WatchlistManager';
import ExecuteStockTradeModal from './ExecuteStockTradeModal';

const SignalFeed: React.FC = () => {
    const { signals, loading, error, lastUpdated, refresh } = useSignals();
    const { accessLevel } = useAuth();

    const [activeFilter, setActiveFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('Confidence');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showWatchlists, setShowWatchlists] = useState(false);
    const [executingSignal, setExecutingSignal] = useState<SmartSignal | null>(null);

    // Filter and Sort Logic
    const processedSignals = useMemo(() => {
        let result = [...signals];

        // Filter
        if (activeFilter !== 'ALL') {
            result = result.filter(s => s.signal_type === activeFilter);
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'Symbol') return a.symbol.localeCompare(b.symbol);
            if (sortBy === 'Signal') return a.signal_type.localeCompare(b.signal_type);
            if (sortBy === 'Confidence') {
                const rank = { strong: 3, moderate: 2, weak: 1 };
                return (rank[b.confidence] || 0) - (rank[a.confidence] || 0);
            }
            return 0;
        });

        return result;
    }, [signals, activeFilter, sortBy]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0f1219] min-h-screen text-slate-900 dark:text-white font-sans">
            <div className="max-w-[1600px] mx-auto p-6 lg:p-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-blue-500">smart_toy</span>
                            Stock Feed
                        </h1>
                        <p className="text-gray-500 text-sm font-medium mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Live Analysis • Auto-refreshing every 1 hour
                            <span className="text-gray-400 dark:text-gray-600">•</span>
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="bg-blue-50 dark:bg-[#1a1f2e] hover:bg-blue-100 dark:hover:bg-blue-600/10 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined text-sm">upload_file</span>
                            Upload Watchlist
                        </button>

                        <button
                            onClick={() => setShowWatchlists(!showWatchlists)}
                            className={`bg-gray-100 dark:bg-[#1a1f2e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${showWatchlists ? 'text-slate-900 dark:text-white border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-800' : ''}`}
                        >
                            <span className="material-symbols-outlined text-sm">list</span>
                            Watchlists
                        </button>

                        <button
                            onClick={refresh}
                            className="bg-gray-100 dark:bg-[#1a1f2e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                        >
                            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Refresh
                        </button>
                        <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-[#1a1f2e] border border-gray-300 dark:border-gray-800 rounded-lg px-3 py-2">
                            <span className="material-symbols-outlined text-gray-500 text-sm">search</span>
                            <input
                                type="text"
                                placeholder="Search Ticker..."
                                className="bg-transparent border-none outline-none text-xs text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 w-32 focus:w-48 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Collapsible Watchlist Manager */}
                {showWatchlists && (
                    <div className="mb-8 animate-in slide-in-from-top-2 fade-in duration-300">
                        <WatchlistManager onUpdate={refresh} />
                    </div>
                )}

                <UploadWatchlistModal
                    isOpen={showUploadModal}
                    onClose={() => setShowUploadModal(false)}
                    onUploadSuccess={refresh}
                />

                {/* Loading State or Content */}
                {loading && signals.length === 0 ? (
                    <div className="space-y-6">
                        <div className="h-24 bg-gray-200 dark:bg-[#1a1f2e] rounded-xl animate-pulse"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => <SignalSkeleton key={i} />)}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error_outline</span>
                        <h3 className="text-xl font-bold">Analysis Failed</h3>
                        <p className="text-red-400 mt-2">{error}</p>
                        <button onClick={refresh} className="mt-6 bg-red-600 text-white px-6 py-2 rounded-lg font-bold uppercase hover:bg-red-500 transition-colors">Try Again</button>
                    </div>
                ) : (
                    <>
                        <SignalStats signals={signals} />

                        <SignalFilters
                            activeFilter={activeFilter}
                            onFilterChange={setActiveFilter}
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                            {processedSignals.map((signal) => (
                                <SignalCard
                                    key={signal.id}
                                    signal={signal}
                                    accessLevel={accessLevel || 'signal'}
                                    onExecute={setExecutingSignal}
                                />
                            ))}
                        </div>

                        {processedSignals.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 text-gray-500 border border-dashed border-gray-300 dark:border-gray-800 rounded-xl bg-gray-100/50 dark:bg-[#1a1f2e]/50">
                                <span className="material-symbols-outlined text-6xl mb-4 opacity-50">filter_list_off</span>
                                <p className="text-lg font-medium">No signals match your filter</p>
                                <button onClick={() => setActiveFilter('ALL')} className="mt-4 text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest text-sm">Clear Filters</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Stock Trade Modal */}
            <ExecuteStockTradeModal
                isOpen={!!executingSignal}
                signal={executingSignal}
                onClose={() => setExecutingSignal(null)}
                onSuccess={() => {
                    setExecutingSignal(null);
                    refresh();
                }}
            />
        </div>
    );
};

export default SignalFeed;
