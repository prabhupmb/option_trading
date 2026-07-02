import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number;
  headline: string;
  summary: string | null;
  author: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  symbols: string[] | null;
  published_at: string | null;
  created_at: string | null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000;
const PAGE_SIZE  = 50;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m  = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h  = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div
    className="flex gap-3 px-4 py-3.5 border-b animate-pulse"
    style={{ borderColor: '#1a1a1f' }}
  >
    <div className="flex-shrink-0 w-[4.5rem] h-[4.5rem] rounded-lg" style={{ background: '#131318' }} />
    <div className="flex-1 min-w-0 space-y-2 py-0.5">
      <div className="h-3.5 rounded w-5/6"  style={{ background: '#131318' }} />
      <div className="h-3   rounded w-full"  style={{ background: '#131318' }} />
      <div className="h-3   rounded w-3/4"   style={{ background: '#131318' }} />
      <div className="flex gap-1.5 mt-1">
        <div className="h-3   rounded w-14"  style={{ background: '#131318' }} />
        <div className="h-[18px] w-10 rounded-full" style={{ background: '#131318' }} />
        <div className="h-[18px] w-10 rounded-full" style={{ background: '#131318' }} />
      </div>
    </div>
  </div>
);

// ─── NEWS CARD ────────────────────────────────────────────────────────────────

const NewsCard: React.FC<{
  item:           NewsItem;
  isUnread:       boolean;
  isExpanded:     boolean;
  onExpand:       (e: React.MouseEvent) => void;
  onMarkRead:     () => void;
  onSymbolClick:  (sym: string) => void;
  activeSymbol:   string;
}> = ({ item, isUnread, isExpanded, onExpand, onMarkRead, onSymbolClick, activeSymbol }) => {
  const [imgError, setImgError] = useState(false);

  const symbols    = item.symbols ?? [];
  const maxSymbols = 5;
  const visible    = symbols.slice(0, maxSymbols);
  const extra      = symbols.length - maxSymbols;
  const hasLong    = (item.summary?.length ?? 0) > 120;

  return (
    <div
      className="group flex gap-3 px-4 py-3.5 border-b transition-colors"
      style={{
        borderColor: '#1a1a1f',
        background: isUnread ? 'rgba(255,255,255,0.01)' : 'transparent',
      }}
    >
      {/* Unread indicator bar */}
      {isUnread && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
          style={{ background: '#22c55e', position: 'absolute' }}
        />
      )}

      {/* Thumbnail */}
      <div
        className="flex-shrink-0 w-[4.5rem] h-[4.5rem] rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: '#131318', border: '1px solid #1a1a1f' }}
      >
        {item.image_url && !imgError ? (
          <img
            src={item.image_url}
            alt=""
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="material-symbols-outlined text-2xl" style={{ color: '#2a2a30' }}>newspaper</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Headline — opens URL */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onMarkRead}
          className="block text-sm font-semibold leading-snug line-clamp-2 transition-colors focus-visible:outline-none focus-visible:underline"
          style={{ color: isUnread ? '#f4f4f5' : '#a1a1aa' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
          onMouseLeave={e => (e.currentTarget.style.color = isUnread ? '#f4f4f5' : '#a1a1aa')}
        >
          {item.headline}
        </a>

        {/* Summary — collapsible, does NOT open URL */}
        {item.summary && (
          <div>
            <p
              className="text-xs leading-relaxed transition-all"
              style={{
                color: '#71717a',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: isExpanded ? 'unset' : 2,
                overflow: isExpanded ? 'visible' : 'hidden',
              }}
            >
              {item.summary}
            </p>
            {hasLong && (
              <button
                onClick={onExpand}
                className="text-[10px] font-bold mt-0.5 transition-colors"
                style={{ color: '#3f3f46' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3f3f46')}
              >
                {isExpanded ? 'Show less ↑' : 'Show more ↓'}
              </button>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">

          {/* Source · timestamp */}
          {(item.author ?? item.source) && (
            <span className="text-[10px] truncate max-w-[110px]" style={{ color: '#52525b' }}>
              {item.author ?? item.source}
            </span>
          )}
          {(item.author ?? item.source) && <span style={{ color: '#2a2a30' }} className="text-[10px]">·</span>}
          {(item.published_at ?? item.created_at) && (
            <span className="text-[10px] font-mono" style={{ color: '#52525b' }}>
              {timeAgo(item.published_at ?? item.created_at!)}
            </span>
          )}

          {/* Ticker chips */}
          {visible.length > 0 && (
            <>
              <span style={{ color: '#2a2a30' }} className="text-[10px]">·</span>
              {visible.map(sym => {
                const isActive = activeSymbol.toUpperCase() === sym.toUpperCase();
                return (
                  <button
                    key={sym}
                    onClick={() => onSymbolClick(sym)}
                    className="px-1.5 py-px rounded-full text-[9px] font-black uppercase tracking-wider transition-all"
                    style={{
                      background:  isActive ? 'rgba(34,197,94,0.2)'  : 'rgba(34,197,94,0.07)',
                      border:      `1px solid ${isActive ? '#22c55e' : 'rgba(34,197,94,0.18)'}`,
                      color:       '#22c55e',
                      boxShadow:   isActive ? '0 0 6px rgba(34,197,94,0.25)' : 'none',
                    }}
                  >
                    {sym}
                  </button>
                );
              })}
              {extra > 0 && (
                <span className="text-[9px] font-bold" style={{ color: '#3f3f46' }}>+{extra}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const NewsFeed: React.FC = () => {
  const [items, setItems]           = useState<NewsItem[]>([]);
  const [pending, setPending]       = useState<NewsItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readIds, setReadIds]       = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tick, setTick]             = useState(0);

  const knownIds = useRef<Set<number>>(new Set());
  const listRef  = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async (isManual = false) => {
    if (isManual) { setLoading(true); setError(null); }

    try {
      const { data, error: dbErr } = await supabase
        .from('news_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Treat "table does not exist" as empty rather than an error
      if (dbErr && dbErr.code !== '42P01') {
        console.error('[NewsFeed] DB error:', dbErr);
        throw dbErr;
      }

      console.log('[NewsFeed] fetched', data?.length ?? 0, 'items', data?.[0]);
      const fresh = (data ?? []) as NewsItem[];

      if (knownIds.current.size === 0) {
        // Initial load — show everything immediately
        setItems(fresh);
        knownIds.current = new Set(fresh.map(i => i.id));
      } else {
        const newOnes = fresh.filter(i => !knownIds.current.has(i.id));
        knownIds.current = new Set(fresh.map(i => i.id));
        if (newOnes.length > 0) {
          // Background poll found new articles — stage them, don't auto-insert
          setPending(newOnes);
        }
        // Always sync the full list silently so edits/deletions are reflected
        setItems(fresh);
      }

      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load news. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(true);
    const t = setInterval(() => fetchItems(), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchItems]);

  // Re-render relative timestamps every 30s
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const showPending = () => {
    setPending([]);
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markRead = (id: number) =>
    setReadIds(prev => { const n = new Set(prev); n.add(id); return n; });

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSymbolClick = (sym: string) =>
    setSymbolFilter(f => f.toUpperCase() === sym.toUpperCase() ? '' : sym);

  // ── Derived ──────────────────────────────────────────────────────────────

  const q = symbolFilter.trim().toUpperCase();

  const visible = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick; // subscribe to tick so timestamps re-render
    let list = items;
    if (q) list = list.filter(i =>
      (i.symbols ?? []).some(s => s.toUpperCase() === q) ||
      i.headline.toUpperCase().includes(q)
    );
    if (unreadOnly) list = list.filter(i => !readIds.has(i.id));
    return list;
  }, [items, q, unreadOnly, readIds, tick]);

  const unreadCount = useMemo(
    () => items.filter(i => !readIds.has(i.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, readIds, tick],
  );

  const refreshLabel = useMemo(() => {
    if (!lastRefresh) return '';
    const m = Math.floor((Date.now() - lastRefresh.getTime()) / 60000);
    return m < 1 ? 'just now' : `${m}m ago`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh, tick]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0b', color: '#fafafa' }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div
        className="flex-shrink-0 border-b"
        style={{ borderColor: '#1a1a1f', background: '#0d0d10' }}
      >
        {/* Top row */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
          {/* Icon + title */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: '#22c55e' }}>newspaper</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-widest leading-none" style={{ color: '#fafafa' }}>
              Market News
            </p>
            {lastRefresh && (
              <p className="text-[10px] mt-0.5" style={{ color: '#3f3f46' }}>
                Refreshed {refreshLabel}
              </p>
            )}
          </div>

          {/* Unread toggle */}
          <button
            onClick={() => setUnreadOnly(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex-shrink-0"
            style={{
              background:  unreadOnly ? 'rgba(34,197,94,0.08)' : 'transparent',
              borderColor: unreadOnly ? '#22c55e'              : '#1f1f23',
              color:       unreadOnly ? '#22c55e'              : '#52525b',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: unreadOnly ? '#22c55e' : '#3f3f46' }}
            />
            Unread
            {unreadCount > 0 && (
              <span
                className="px-1 rounded-full text-[9px] font-black"
                style={{
                  background: unreadOnly ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                  color: unreadOnly ? '#22c55e' : '#71717a',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchItems(true)}
            disabled={loading}
            className="transition-colors disabled:opacity-30 flex-shrink-0"
            style={{ color: '#3f3f46' }}
            onMouseEnter={e => !loading && (e.currentTarget.style.color = '#22c55e')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3f3f46')}
            title="Refresh now"
          >
            <span className={`material-symbols-outlined text-lg leading-none ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>

        {/* Symbol / keyword search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span
              className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: '#52525b' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Filter by symbol or keyword…"
              value={symbolFilter}
              onChange={e => setSymbolFilter(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg focus:outline-none transition-all"
              style={{ background: '#131318', border: '1px solid #1f1f23', color: '#fafafa' }}
              onFocus={e  => (e.currentTarget.style.borderColor = '#22c55e')}
              onBlur={e   => (e.currentTarget.style.borderColor = '#1f1f23')}
            />
            {symbolFilter && (
              <button
                onClick={() => setSymbolFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#52525b' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
          {q && !loading && (
            <p className="text-[10px] mt-1.5 font-bold" style={{ color: '#52525b' }}>
              {visible.length} result{visible.length !== 1 ? 's' : ''} for &ldquo;{symbolFilter.trim()}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* ═══ PENDING NEW ARTICLES BANNER ════════════════════════════════════ */}
      {pending.length > 0 && (
        <button
          onClick={showPending}
          className="flex-shrink-0 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-colors"
          style={{
            background:   'rgba(34,197,94,0.07)',
            borderBottom: '1px solid rgba(34,197,94,0.14)',
            color: '#22c55e',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.13)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.07)')}
        >
          <span className="material-symbols-outlined text-sm leading-none">arrow_upward</span>
          {pending.length} new article{pending.length !== 1 ? 's' : ''} — tap to show
        </button>
      )}

      {/* ═══ ERROR BANNER ════════════════════════════════════════════════════ */}
      {error && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b"
          style={{ background: 'rgba(239,68,68,0.06)', borderColor: '#450a0a' }}
        >
          <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: '#ef4444' }}>error</span>
          <p className="text-xs flex-1" style={{ color: '#fca5a5' }}>{error}</p>
          <button
            onClick={() => fetchItems(true)}
            className="text-xs font-bold underline transition-colors flex-shrink-0"
            style={{ color: '#fca5a5' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fef2f2')}
            onMouseLeave={e => (e.currentTarget.style.color = '#fca5a5')}
          >
            Retry
          </button>
        </div>
      )}

      {/* ═══ FEED LIST ══════════════════════════════════════════════════════ */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 relative">

        {/* Loading skeletons */}
        {loading && (
          <div>{Array.from({ length: 7 }, (_, i) => <SkeletonCard key={i} />)}</div>
        )}

        {/* Empty state */}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: '#0d0d10', border: '1px solid #1a1a1f' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#27272a' }}>newspaper</span>
            </div>
            <p className="text-sm font-bold text-center" style={{ color: '#3f3f46' }}>
              {unreadOnly
                ? 'All caught up.'
                : q
                  ? `No news for "${symbolFilter.trim()}"`
                  : 'No news yet.'}
            </p>
            <p className="text-xs text-center" style={{ color: '#27272a', maxWidth: 220 }}>
              {unreadOnly
                ? 'Turn off Unread to see all articles.'
                : q
                  ? 'Try a different symbol or clear the filter.'
                  : 'The feed refreshes automatically every minute.'}
            </p>
            {(q || unreadOnly) && (
              <button
                className="text-xs font-bold mt-1 transition-colors"
                style={{ color: '#22c55e' }}
                onClick={() => { setSymbolFilter(''); setUnreadOnly(false); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* News cards */}
        {!loading && visible.length > 0 &&
          visible.map(item => (
            <NewsCard
              key={item.id}
              item={item}
              isUnread={!readIds.has(item.id)}
              isExpanded={expandedIds.has(item.id)}
              onExpand={(e) => toggleExpand(item.id, e)}
              onMarkRead={() => markRead(item.id)}
              onSymbolClick={handleSymbolClick}
              activeSymbol={symbolFilter}
            />
          ))
        }
      </div>

      {/* ═══ FOOTER ════════════════════════════════════════════════════════ */}
      {!loading && items.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t"
          style={{ borderColor: '#1a1a1f' }}
        >
          <span className="text-[9px]" style={{ color: '#27272a' }}>
            {items.length} articles loaded
          </span>
          <span className="text-[9px]" style={{ color: '#27272a' }}>
            Auto-refreshes every 60s
          </span>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
