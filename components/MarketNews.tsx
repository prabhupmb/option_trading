import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── TYPES ────────────────────────────────────────────────────

export interface NewsItem {
  id: number;
  headline: string;
  summary: string | null;
  author: string | null;
  url: string;
  image_url: string | null;
  symbols: string[];
  published_at: string;
}

interface MarketNewsProps {
  fetchNews: () => Promise<NewsItem[]>;
}

// ─── HELPERS ─────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function updatedLabel(date: Date | null): string {
  if (!date) return '';
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return 'Just updated';
  return `Updated ${m}m ago`;
}

// ─── SKELETON ─────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="flex gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse">
    <div className="hidden sm:block flex-shrink-0 w-24 h-16 rounded-lg bg-slate-800" />
    <div className="flex-1 space-y-2.5">
      <div className="h-4 bg-slate-800 rounded w-5/6" />
      <div className="h-3 bg-slate-800 rounded w-full" />
      <div className="h-3 bg-slate-800 rounded w-3/4" />
      <div className="flex gap-2 mt-1">
        <div className="h-3 bg-slate-800 rounded w-12" />
        <div className="h-3 bg-slate-800 rounded w-16" />
        <div className="h-5 bg-slate-800 rounded-full w-10" />
        <div className="h-5 bg-slate-800 rounded-full w-10" />
      </div>
    </div>
  </div>
);

// ─── NEWS CARD ────────────────────────────────────────────────

const NewsCard: React.FC<{ item: NewsItem; isNew: boolean }> = ({ item, isNew }) => {
  const [imgError, setImgError] = useState(false);
  const showThumb = item.image_url && !imgError;
  const visibleSymbols = item.symbols.slice(0, 6);
  const extraCount = item.symbols.length - 6;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex gap-3 p-4 rounded-xl border transition-all duration-200 outline-none
        focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950
        hover:border-white/10 hover:bg-white/[0.04]
        ${isNew
          ? 'border-emerald-500/25 bg-emerald-950/20 animate-[newsHighlight_2s_ease-out_forwards]'
          : 'border-white/5 bg-white/[0.02]'
        }`}
    >
      {/* Thumbnail */}
      {showThumb && (
        <div className="hidden sm:block flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-slate-800">
          <img
            src={item.image_url!}
            alt=""
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Headline */}
        <p className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
          {item.headline}
        </p>

        {/* Summary */}
        {item.summary && (
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <span className="text-[10px] font-mono text-slate-500">{timeAgo(item.published_at)}</span>

          {item.author && (
            <>
              <span className="text-slate-700 text-[10px]">·</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.author}</span>
            </>
          )}

          {visibleSymbols.length > 0 && (
            <>
              <span className="text-slate-700 text-[10px]">·</span>
              <div className="flex items-center gap-1 flex-wrap">
                {visibleSymbols.map(sym => (
                  <span
                    key={sym}
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-950/60 border border-emerald-800/40 text-emerald-400"
                  >
                    {sym}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-[9px] text-slate-500 font-bold">+{extraCount}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </a>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const MarketNews: React.FC<MarketNewsProps> = ({ fetchNews }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatedTick, setUpdatedTick] = useState(0);
  const [filter, setFilter] = useState('');
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevIdsRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    setError(null);
    try {
      const items = await fetchNews();
      const incoming = new Set(items.map(i => i.id));
      const fresh = new Set<number>();
      if (prevIdsRef.current.size > 0) {
        incoming.forEach((id: number) => { if (!prevIdsRef.current.has(id)) fresh.add(id); });
      }
      prevIdsRef.current = incoming;
      setNews(items);
      setLastUpdated(new Date());
      if (fresh.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 3000);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [fetchNews]);

  // Initial load + auto-refresh
  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // Tick the "Updated Xm ago" label every 30s
  useEffect(() => {
    const t = setInterval(() => setUpdatedTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Client-side filter
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? news.filter(n =>
        n.headline.toLowerCase().includes(q) ||
        n.symbols.some(s => s.toLowerCase().includes(q))
      )
    : news;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 min-h-screen">
      <style>{`
        @keyframes newsHighlight {
          0%   { background-color: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.35); }
          100% { background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-emerald-400 text-lg">newspaper</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black uppercase tracking-tight text-white leading-none">Market News</h2>
              {lastUpdated && (
                <p key={updatedTick} className="text-[10px] text-slate-500 mt-0.5">
                  {updatedLabel(lastUpdated)}
                </p>
              )}
            </div>
          </div>

          {/* Filter input */}
          <div className="relative flex-shrink-0 w-full sm:w-48">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Symbol or keyword…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/8 text-slate-200 placeholder-slate-600
                focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 transition-all"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-white/8
              bg-white/[0.03] text-slate-400 hover:text-emerald-400 hover:border-emerald-800/50 hover:bg-emerald-950/30
              disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-800/40 bg-red-950/30 text-red-400">
            <span className="material-symbols-outlined text-lg flex-shrink-0">error</span>
            <p className="text-xs flex-1">{error}</p>
            <button
              onClick={() => load(true)}
              className="text-xs font-bold underline text-red-300 hover:text-red-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-slate-600 text-2xl">newspaper</span>
            </div>
            <p className="text-sm text-slate-500">
              {q ? `No news matching "${q}"` : 'No news yet. The feed updates every 5 minutes.'}
            </p>
            {q && (
              <button
                onClick={() => setFilter('')}
                className="text-xs text-emerald-500 hover:text-emerald-400 underline transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* ── News list ── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2.5">
            {/* Result count when filtering */}
            {q && (
              <p className="text-[10px] text-slate-500 font-bold">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{q}"
              </p>
            )}
            {filtered.map(item => (
              <NewsCard key={item.id} item={item} isNew={newIds.has(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketNews;
