import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type StageKey =
  | 'WATCHING' | 'BREAKOUT_DETECTED' | 'OPEN_T1' | 'OPEN_T2'
  | 'DIP' | 'FAILED_BREAKOUT' | 'CLOSED_WIN' | 'CLOSED_LOSS';

type SortKey = 'stage' | 'symbol' | 'price' | 'updated';
type ViewMode = 'list' | 'board';

interface StageItem {
  symbol: string;
  price: number | null;
  stage: StageKey;
  reason: string;
  updated_at: string;
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK: StageItem[] = [
  { symbol: 'NVDA',  price: 118.42, stage: 'OPEN_T1',           reason: 'ST flipped UP, breakout confirmed',        updated_at: new Date(Date.now() -  12 * 60000).toISOString() },
  { symbol: 'META',  price: 614.30, stage: 'OPEN_T2',           reason: 'T1 hit, SL moved to breakeven',            updated_at: new Date(Date.now() -   7 * 60000).toISOString() },
  { symbol: 'TSLA',  price: 248.10, stage: 'BREAKOUT_DETECTED', reason: 'Volume 2.3x, VWAP cross',                  updated_at: new Date(Date.now() -   4 * 60000).toISOString() },
  { symbol: 'AAPL',  price: 198.55, stage: 'WATCHING',          reason: 'SMA20 > SMA50, waiting ST confirm',        updated_at: new Date(Date.now() -  33 * 60000).toISOString() },
  { symbol: 'SOFI',  price:  14.82, stage: 'WATCHING',          reason: 'ADX rising, watching VWAP',                updated_at: new Date(Date.now() -   8 * 60000).toISOString() },
  { symbol: 'AMD',   price: 142.80, stage: 'DIP',               reason: 'Price dipped below VWAP',                  updated_at: new Date(Date.now() -  18 * 60000).toISOString() },
  { symbol: 'AMZN',  price: 195.20, stage: 'FAILED_BREAKOUT',   reason: 'Volume dried up, ST flipped DOWN',         updated_at: new Date(Date.now() -  45 * 60000).toISOString() },
  { symbol: 'MSFT',  price: 441.60, stage: 'CLOSED_WIN',        reason: 'T2 target hit',                            updated_at: new Date(Date.now() -  95 * 60000).toISOString() },
  { symbol: 'GOOG',  price: 178.30, stage: 'CLOSED_LOSS',       reason: 'Stop hit at $176.50',                      updated_at: new Date(Date.now() - 120 * 60000).toISOString() },
  { symbol: 'PLTR',  price:  82.15, stage: 'BREAKOUT_DETECTED', reason: 'Vol surge 3.1x, above VWAP',               updated_at: new Date(Date.now() -   2 * 60000).toISOString() },
  { symbol: 'HOOD',  price:  29.44, stage: 'WATCHING',          reason: 'Coiling near resistance',                  updated_at: new Date(Date.now() -  51 * 60000).toISOString() },
  { symbol: 'COIN',  price: 237.80, stage: 'DIP',               reason: 'Pulled back to SMA20, holding',            updated_at: new Date(Date.now() -  25 * 60000).toISOString() },
];

// ─── STAGE CONFIG ─────────────────────────────────────────────────────────────

const STAGE_ORDER: StageKey[] = [
  'WATCHING', 'BREAKOUT_DETECTED', 'OPEN_T1', 'OPEN_T2',
  'DIP', 'FAILED_BREAKOUT', 'CLOSED_WIN', 'CLOSED_LOSS',
];

const STAGE_IDX = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]));

interface StageCfg {
  label: string;
  dot: string;          // Tailwind bg color for the dot
  pill: string;         // full pill Tailwind classes
  chipActive: string;   // chip when selected
  chipInactive: string; // chip when not selected
  rowAccent: string;    // left border accent color (Tailwind border-l-*)
}

const STAGE_CFG: Record<StageKey, StageCfg> = {
  WATCHING:          {
    label: 'Watching',
    dot: 'bg-slate-400',
    pill: 'text-slate-300 bg-slate-800/60 border border-slate-600/50',
    chipActive:   'bg-slate-700/60 border-slate-500 text-slate-200 ring-1 ring-slate-500/50',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-slate-600 hover:text-slate-400',
    rowAccent: 'border-l-slate-500/40',
  },
  BREAKOUT_DETECTED: {
    label: 'Breakout',
    dot: 'bg-indigo-400',
    pill: 'text-indigo-300 bg-indigo-900/30 border border-indigo-500/40',
    chipActive:   'bg-indigo-900/40 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-indigo-700/50 hover:text-indigo-400',
    rowAccent: 'border-l-indigo-500/60',
  },
  OPEN_T1:           {
    label: 'Open · T1',
    dot: 'bg-emerald-400',
    pill: 'text-emerald-300 bg-emerald-900/30 border border-emerald-500/40',
    chipActive:   'bg-emerald-900/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-emerald-700/50 hover:text-emerald-400',
    rowAccent: 'border-l-emerald-500/70',
  },
  OPEN_T2:           {
    label: 'Open · T2',
    dot: 'bg-green-400',
    pill: 'text-green-300 bg-green-900/30 border border-green-500/40',
    chipActive:   'bg-green-900/40 border-green-500 text-green-300 ring-1 ring-green-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-green-700/50 hover:text-green-400',
    rowAccent: 'border-l-green-500/70',
  },
  DIP:               {
    label: 'Dip',
    dot: 'bg-amber-400',
    pill: 'text-amber-300 bg-amber-900/30 border border-amber-500/40',
    chipActive:   'bg-amber-900/40 border-amber-500 text-amber-300 ring-1 ring-amber-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-amber-700/50 hover:text-amber-400',
    rowAccent: 'border-l-amber-500/60',
  },
  FAILED_BREAKOUT:   {
    label: 'Failed',
    dot: 'bg-rose-400',
    pill: 'text-rose-300 bg-rose-900/20 border border-rose-500/30',
    chipActive:   'bg-rose-900/30 border-rose-500 text-rose-300 ring-1 ring-rose-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-rose-700/50 hover:text-rose-400',
    rowAccent: 'border-l-rose-500/50',
  },
  CLOSED_WIN:        {
    label: 'Win',
    dot: 'bg-green-400',
    pill: 'text-green-300 bg-green-900/20 border border-green-500/30',
    chipActive:   'bg-green-900/30 border-green-400 text-green-300 ring-1 ring-green-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-green-700/50 hover:text-green-400',
    rowAccent: 'border-l-green-400/60',
  },
  CLOSED_LOSS:       {
    label: 'Loss',
    dot: 'bg-red-500',
    pill: 'text-red-400 bg-red-900/20 border border-red-500/30',
    chipActive:   'bg-red-900/30 border-red-500 text-red-400 ring-1 ring-red-500/40',
    chipInactive: 'bg-[#131316] border-[#1f1f23] text-slate-500 hover:border-red-700/50 hover:text-red-400',
    rowAccent: 'border-l-red-500/60',
  },
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'stage',   label: 'Stage' },
  { key: 'symbol',  label: 'Symbol' },
  { key: 'price',   label: 'Price' },
  { key: 'updated', label: 'Updated' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtPrice = (n: number | null): string =>
  n != null ? `$${n.toFixed(2)}` : '—';

// ─── SKELETON ─────────────────────────────────────────────────────────────────

const RowSkeleton = ({ idx }: { idx: number }) => (
  <div
    className={`flex items-center gap-4 px-4 py-3 border-l-2 border-l-transparent border-b border-[#1f1f23] animate-pulse ${idx % 2 === 0 ? 'bg-[#0e0e11]' : 'bg-[#0a0a0b]'}`}
  >
    <div className="h-3 w-14 rounded bg-slate-800" />
    <div className="h-3 w-16 rounded bg-slate-800 ml-auto" />
    <div className="h-5 w-20 rounded-full bg-slate-800" />
    <div className="h-3 w-32 rounded bg-slate-800" />
    <div className="h-3 w-12 rounded bg-slate-800" />
  </div>
);

const CardSkeleton = () => (
  <div className="rounded-lg border border-[#1f1f23] bg-[#131316] p-2.5 animate-pulse space-y-1.5">
    <div className="h-3 w-12 rounded bg-slate-800" />
    <div className="h-2.5 w-10 rounded bg-slate-800" />
    <div className="h-2.5 w-full rounded bg-slate-800" />
  </div>
);

// ─── BOARD VIEW ───────────────────────────────────────────────────────────────

const BoardView: React.FC<{ items: StageItem[]; allItems: StageItem[]; loading: boolean }> = ({ items, allItems, loading }) => {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
      <div className="flex gap-3 p-4 h-full min-w-max">
        {STAGE_ORDER.map(stage => {
          const cfg = STAGE_CFG[stage];
          const stageItems = items.filter(i => i.stage === stage);
          const totalInStage = allItems.filter(i => i.stage === stage).length;
          return (
            <div key={stage} className="w-44 flex-shrink-0 flex flex-col gap-2 h-full">
              {/* Column header */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${cfg.pill} flex-shrink-0`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className="text-[9px] font-black uppercase tracking-widest truncate flex-1">{cfg.label}</span>
                <span className="text-[9px] font-black opacity-70 bg-black/20 px-1 py-0.5 rounded-full flex-shrink-0">{totalInStage}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 min-h-0">
                {loading ? (
                  [1, 2].map(i => <CardSkeleton key={i} />)
                ) : stageItems.length === 0 ? (
                  <p className="text-[9px] text-slate-700 text-center py-4">—</p>
                ) : (
                  stageItems.map(item => (
                    <div
                      key={item.symbol}
                      className="rounded-lg border border-[#1f1f23] bg-[#131316] p-2.5 hover:border-slate-600/50 transition-colors cursor-default"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-white font-mono tracking-tight">{item.symbol}</span>
                        {item.price != null && (
                          <span className="text-[10px] font-mono text-slate-400">{fmtPrice(item.price)}</span>
                        )}
                      </div>
                      {item.reason && (
                        <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2 mb-1">{item.reason}</p>
                      )}
                      <span className="text-[8px] font-mono text-slate-600">{timeAgo(item.updated_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const StageTrackerList: React.FC = () => {
  const [allItems, setAllItems]     = useState<StageItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [useMock, setUseMock]       = useState(false);
  const [search, setSearch]         = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | StageKey>('all');
  const [sort, setSort]             = useState<SortKey>('stage');
  const [sortAsc, setSortAsc]       = useState(true);
  const [viewMode, setViewMode]     = useState<ViewMode>('list');

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stock_lifecycle')
        .select('symbol, last_price, current_stage, last_reason, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: StageItem[] = (data || []).map((row: any) => ({
        symbol:     row.symbol,
        price:      row.last_price ?? null,
        stage:      row.current_stage as StageKey,
        reason:     row.last_reason ?? '',
        updated_at: row.updated_at,
      }));

      setAllItems(mapped);
      setUseMock(false);
    } catch {
      setAllItems(MOCK);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  // ── Derived state ────────────────────────────────────────────────────────

  const stageCounts = useMemo(
    () => Object.fromEntries(STAGE_ORDER.map(s => [s, allItems.filter(i => i.stage === s).length])),
    [allItems],
  );

  const filtered = useMemo(() => {
    let items = [...allItems];

    if (stageFilter !== 'all') items = items.filter(i => i.stage === stageFilter);

    const q = search.trim().toUpperCase();
    if (q) items = items.filter(i => i.symbol.toUpperCase().includes(q));

    items.sort((a, b) => {
      let cmp = 0;
      switch (sort) {
        case 'symbol':  cmp = a.symbol.localeCompare(b.symbol); break;
        case 'price':   cmp = (b.price ?? -Infinity) - (a.price ?? -Infinity); break;
        case 'updated': cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(); break;
        default:        cmp = (STAGE_IDX[a.stage] ?? 99) - (STAGE_IDX[b.stage] ?? 99); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return items;
  }, [allItems, stageFilter, search, sort, sortAsc]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const cycleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(p => !p);
    else { setSort(key); setSortAsc(true); }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0b', color: '#e2e8f0' }}>

      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: '#131316', borderColor: '#1f1f23' }}
      >
        {/* Count */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-black text-white tabular-nums">
            {loading ? '—' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">
            of {loading ? '—' : allItems.length} symbols
          </span>
          {useMock && (
            <span className="ml-1 text-[9px] font-bold text-amber-400 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded-full">
              MOCK
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Board / List toggle */}
        <div
          className="flex rounded-lg border overflow-hidden"
          style={{ borderColor: '#1f1f23' }}
        >
          {(['list', 'board'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                viewMode === m
                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={viewMode === m ? {} : { background: '#0e0e11' }}
            >
              <span className="material-symbols-outlined text-sm leading-none">
                {m === 'list' ? 'view_list' : 'view_column'}
              </span>
              {m}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchData}
          className="text-slate-600 hover:text-[#22c55e] transition-colors"
          title="Refresh"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
        </button>
      </div>

      {/* ── FILTER BAR ── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b flex-wrap"
        style={{ background: '#0e0e11', borderColor: '#1f1f23' }}
      >
        {/* Symbol search */}
        <div className="relative flex-shrink-0">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-sm pointer-events-none select-none">
            search
          </span>
          <input
            type="text"
            placeholder="Symbol…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 rounded-lg text-xs font-mono w-28 focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:w-36 transition-all"
            style={{ background: '#131316', border: '1px solid #1f1f23', color: '#e2e8f0' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <span className="text-slate-700 select-none text-xs">|</span>

        {/* Stage filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* All chip */}
          <button
            onClick={() => setStageFilter('all')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
              stageFilter === 'all'
                ? 'bg-[#22c55e]/10 border-[#22c55e]/60 text-[#22c55e] ring-1 ring-[#22c55e]/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={stageFilter !== 'all' ? { background: '#131316', borderColor: '#1f1f23' } : {}}
          >
            <span className="uppercase tracking-wide">All</span>
            <span className="font-black opacity-70 text-[9px]">{allItems.length}</span>
          </button>

          {STAGE_ORDER.map(stage => {
            const cfg   = STAGE_CFG[stage];
            const count = stageCounts[stage] ?? 0;
            const active = stageFilter === stage;
            return (
              <button
                key={stage}
                onClick={() => setStageFilter(active ? 'all' : stage)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
                  active ? cfg.chipActive : cfg.chipInactive
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className="uppercase tracking-wide">{cfg.label}</span>
                {count > 0 && <span className="font-black text-[9px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Sort control — only in list mode */}
        {viewMode === 'list' && (
          <>
            <span className="text-slate-700 select-none text-xs ml-auto">|</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Sort:</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => cycleSort(key)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    sort === key
                      ? 'text-[#22c55e] bg-[#22c55e]/10'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {label}
                  {sort === key && (
                    <span className="material-symbols-outlined text-[10px] leading-none">
                      {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── CONTENT ── */}
      {viewMode === 'board' ? (
        <BoardView items={filtered} allItems={allItems} loading={loading} />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Column headers */}
          <div
            className="sticky top-0 z-10 flex items-center gap-0 border-b text-[9px] font-bold text-slate-600 uppercase tracking-widest"
            style={{ background: '#0e0e11', borderColor: '#1f1f23' }}
          >
            <div className="w-2 flex-shrink-0" />   {/* left accent stripe */}
            <div className="flex-1 min-w-0 px-4 py-2">Symbol</div>
            <div className="w-28 flex-shrink-0 px-4 py-2 text-right">Price</div>
            <div className="w-36 flex-shrink-0 px-4 py-2">Stage</div>
            <div className="flex-[2] min-w-0 px-4 py-2 hidden sm:block">Reason</div>
            <div className="w-24 flex-shrink-0 px-4 py-2 text-right">Updated</div>
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 8 }, (_, i) => <RowSkeleton key={i} idx={i} />)
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 gap-3">
              <span className="material-symbols-outlined text-4xl text-slate-700">search_off</span>
              <p className="text-sm font-bold text-slate-600">No symbols match</p>
              <p className="text-xs text-slate-700 text-center">
                {search ? `No results for "${search}"` : 'No items in this stage'}
              </p>
              <button
                onClick={() => { setSearch(''); setStageFilter('all'); }}
                className="mt-1 text-xs text-[#22c55e] hover:underline font-bold"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const cfg = STAGE_CFG[item.stage];
              return (
                <div
                  key={item.symbol}
                  className={`group flex items-center gap-0 border-b border-l-2 transition-colors ${cfg.rowAccent} ${
                    idx % 2 === 0 ? 'bg-[#0e0e11]' : 'bg-[#0a0a0b]'
                  } hover:bg-[#131316]`}
                  style={{ borderBottomColor: '#1f1f23' }}
                >
                  {/* Symbol */}
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <span className="text-sm font-black text-white font-mono tracking-tight">
                      {item.symbol}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="w-28 flex-shrink-0 px-4 py-3 text-right">
                    <span className="text-xs font-mono text-slate-300 tabular-nums">
                      {fmtPrice(item.price)}
                    </span>
                  </div>

                  {/* Stage pill */}
                  <div className="w-36 flex-shrink-0 px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Reason */}
                  <div className="flex-[2] min-w-0 px-4 py-3 hidden sm:block">
                    <span className="text-[11px] text-slate-500 truncate block" title={item.reason}>
                      {item.reason || '—'}
                    </span>
                  </div>

                  {/* Updated */}
                  <div className="w-24 flex-shrink-0 px-4 py-3 text-right">
                    <span className="text-[10px] font-mono text-slate-600">
                      {timeAgo(item.updated_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default StageTrackerList;
