import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface Watchlist {
    id: string;
    name: string;
    type: 'default' | 'custom';
    is_active: boolean;
    created_at: string;
    stock_count?: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error';
}

const WatchlistManager: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Toast state
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchWatchlists = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('watchlists')
                .select(`
          *,
          watchlist_stocks (count)
        `)
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedData = data.map((item: any) => ({
                ...item,
                stock_count: item.watchlist_stocks?.[0]?.count || 0
            }));

            setWatchlists(formattedData);
        } catch (err) {
            console.error('Error fetching watchlists:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWatchlists();
    }, []);

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;

        try {
            setDeleting(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Authentication error. Please refresh and try again.', 'error');
                return;
            }

            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/delete-watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    watchlist_id: deleteTarget.id,
                    user_id: user.id
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to delete watchlist');
            }

            // Remove from list without full reload
            setWatchlists(prev => prev.filter(w => w.id !== deleteTarget.id));
            setDeleteTarget(null);
            showToast(`"${deleteTarget.name}" deleted successfully`, 'success');
            onUpdate(); // Refresh parent signal feed

        } catch (err: any) {
            console.error('Delete watchlist error:', err);
            showToast(err.message || 'Failed to delete watchlist', 'error');
            // Keep modal open on error
        } finally {
            setDeleting(false);
        }
    };

    const handleAnalyze = async (watchlist: Watchlist) => {
        setAnalyzingId(watchlist.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch('https://prabhupadala01.app.n8n.cloud/webhook/analyze-watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: session?.user?.id,
                    email: session?.user?.email,
                    watchlist_id: watchlist.id
                })
            });
            showToast(`Analysis started for "${watchlist.name}"! Signals will appear shortly.`, 'success');
        } catch (err) {
            console.error('Error triggering analysis:', err);
            showToast('Failed to start analysis', 'error');
        } finally {
            setAnalyzingId(null);
        }
    };

    if (loading) {
        return <div className="text-gray-500 text-sm animate-pulse">Loading watchlists...</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2">
                My Watchlists
            </h3>

            {watchlists.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No watchlists found.</p>
            ) : (
                <div className="space-y-3">
                    {watchlists.map(list => (
                        <div key={list.id} className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-3 flex items-center justify-between group hover:border-gray-700 transition-colors">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-gray-500">list</span>
                                    <span className="text-white font-bold text-sm">{list.name}</span>
                                    {list.type === 'default' && (
                                        <span className="bg-blue-500/10 text-blue-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Default</span>
                                    )}
                                </div>
                                <p className="text-gray-500 text-xs mt-1 pl-6">
                                    {list.stock_count} stocks • {list.is_active ? <span className="text-green-500">Active ⚡</span> : 'Inactive'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleAnalyze(list)}
                                    disabled={!!analyzingId}
                                    className="text-xs font-bold uppercase tracking-wider text-blue-500 hover:text-blue-400 px-2 py-1 bg-blue-500/10 rounded flex items-center gap-1 disabled:opacity-50"
                                >
                                    <span className={`material-symbols-outlined text-sm ${analyzingId === list.id ? 'animate-spin' : ''}`}>
                                        {analyzingId === list.id ? 'sync' : 'rocket_launch'}
                                    </span>
                                    Analyze
                                </button>

                                {list.type !== 'default' && (
                                    <button
                                        onClick={() => setDeleteTarget(list)}
                                        className="text-gray-500 hover:text-red-500 p-1 rounded hover:bg-red-500/10 transition-colors"
                                        title="Delete Watchlist"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── DELETE CONFIRMATION MODAL ─── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-tight">Delete Watchlist</h3>
                                <p className="text-gray-500 text-xs mt-0.5">This action cannot be undone</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div className="bg-[#0f1219] rounded-lg p-3 border border-gray-700/50 flex items-center gap-3">
                                <span className="material-symbols-outlined text-gray-400">list</span>
                                <div>
                                    <p className="text-white font-bold text-sm">{deleteTarget.name}</p>
                                    <p className="text-gray-500 text-xs">{deleteTarget.stock_count} stocks • {deleteTarget.type}</p>
                                </div>
                            </div>

                            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-red-400 text-base mt-0.5 shrink-0">error</span>
                                <p className="text-red-300/90 text-xs leading-relaxed">
                                    This will permanently delete the watchlist, all stocks in it, and all analysis signals. This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-800 flex justify-end gap-3 bg-[#0f1219]/50 rounded-b-xl">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="px-4 py-2.5 rounded-lg text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all flex items-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                                        Delete Watchlist
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TOAST NOTIFICATION ─── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-4 fade-in duration-300 ${toast.type === 'success'
                        ? 'bg-green-950/90 border-green-800/50 text-green-300'
                        : 'bg-red-950/90 border-red-800/50 text-red-300'
                    }`}>
                    <span className="material-symbols-outlined text-lg">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => setToast(null)}
                        className="ml-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default WatchlistManager;
