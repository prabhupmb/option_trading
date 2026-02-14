import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../services/useAuth';

interface Watchlist {
    id: string;
    name: string;
    type: 'default' | 'custom';
    is_active: boolean;
    created_at: string;
    stock_count?: number;
}

const WatchlistManager: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const { user } = useAuth();
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);

    const fetchWatchlists = async () => {
        if (!user) return;
        try {
            setLoading(true);
            // Fetch watchlists and count of stocks
            const { data, error } = await supabase
                .from('watchlists')
                .select(`
          *,
          watchlist_stocks (count)
        `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to include count
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
    }, [user]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this watchlist?')) return;
        try {
            const { error } = await supabase.from('watchlists').delete().eq('id', id);
            if (error) throw error;
            fetchWatchlists();
            onUpdate(); // Trigger refresh in parent
        } catch (err) {
            console.error('Error deleting watchlist:', err);
            alert('Failed to delete watchlist');
        }
    };

    const handleAnalyze = async (watchlist: Watchlist) => {
        setAnalyzingId(watchlist.id);
        try {
            // Trigger N8N webhook
            await fetch('https://prabhupadala01.app.n8n.cloud/webhook/analyze-watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id,
                    watchlist_id: watchlist.id
                })
            });
            alert(`Analysis started for ${watchlist.name}! Signals will appear shortly.`);
        } catch (err) {
            console.error('Error triggering analysis:', err);
            alert('Failed to start analysis');
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
                                        onClick={() => handleDelete(list.id)}
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
        </div>
    );
};

export default WatchlistManager;
