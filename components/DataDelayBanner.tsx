import React, { useState } from 'react';

interface DataDelayBannerProps {
    onRefresh: () => void;
    loading?: boolean;
    isAdmin?: boolean;
}

const DataDelayBanner: React.FC<DataDelayBannerProps> = ({ onRefresh, loading, isAdmin }) => {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <div className="mb-4 bg-amber-950/20 border border-amber-900/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-amber-400 text-base shrink-0">schedule</span>
                <p className="text-amber-300/90 text-xs font-medium truncate">
                    Market data may be <strong className="text-amber-200">15–20 min delayed</strong>.{' '}
                    {isAdmin ? 'Click refresh for the latest data.' : 'Request an admin to refresh for the latest data.'}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-[11px] font-bold border border-amber-800/40 transition-colors flex items-center gap-1.5"
                    >
                        <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh
                    </button>
                )}
                <button
                    onClick={() => setDismissed(true)}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors"
                    title="Dismiss"
                >
                    <span className="material-symbols-outlined text-gray-500 text-sm">close</span>
                </button>
            </div>
        </div>
    );
};

export default DataDelayBanner;
