import React from 'react';

interface Props {
    ageSeconds: number | null;
    stale: boolean;
    syncing: boolean;
    syncCooldown: number;
    onSync: () => void;
}

const SyncChip: React.FC<Props> = ({ ageSeconds, stale, syncing, syncCooldown, onSync }) => {
    const ageLabel = ageSeconds == null
        ? 'Never synced'
        : ageSeconds < 60
            ? `Synced ${ageSeconds}s ago`
            : ageSeconds < 3600
                ? `Synced ${Math.floor(ageSeconds / 60)}m ago`
                : `Synced ${Math.floor(ageSeconds / 3600)}h ago`;

    return (
        <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                stale
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {stale ? 'Stale' : ageLabel}
            </div>
            <button
                onClick={onSync}
                disabled={syncing || syncCooldown > 0}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${
                    syncing || syncCooldown > 0
                        ? 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
            >
                <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
                {syncing ? 'Syncing...' : syncCooldown > 0 ? `Wait ${syncCooldown}s` : 'Sync now'}
            </button>
        </div>
    );
};

export default SyncChip;
