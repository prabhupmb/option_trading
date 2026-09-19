import React from 'react';

interface SyncError {
    brokerId: string;
    displayName: string;
    status: 'ERROR' | 'AUTH_EXPIRED';
    error: string | null;
}

interface Props {
    errors: SyncError[];
    onNavigate?: (view: string) => void;
}

const SyncErrorBanner: React.FC<Props> = ({ errors, onNavigate }) => {
    if (!errors.length) return null;
    return (
        <div className="space-y-2">
            {errors.map(e => (
                <div
                    key={e.brokerId}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-bold ${
                        e.status === 'AUTH_EXPIRED'
                            ? 'bg-red-500/10 border-red-500/25 text-red-400'
                            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    }`}
                >
                    <span className="material-symbols-outlined text-base">
                        {e.status === 'AUTH_EXPIRED' ? 'link_off' : 'warning'}
                    </span>
                    <span className="flex-1">
                        {e.displayName}: {e.status === 'AUTH_EXPIRED'
                            ? 'broker session expired'
                            : (e.error || 'sync error')}
                    </span>
                    {e.status === 'AUTH_EXPIRED' && onNavigate && (
                        <button
                            onClick={() => onNavigate('settings')}
                            className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors"
                        >
                            Reconnect
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default SyncErrorBanner;
