import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── TYPES ─────────────────────────────────────────────────

export interface Position {
  symbol: string;
  name?: string;
  type: 'CALL' | 'PUT' | 'STOCK';
  strike?: number;
  expiry?: string;
  dte?: number;
  qty: number;
  avg_cost: number;
  mkt_value: number;
  pl_dollar: number;
  pl_pct: number;
}

export interface BrokerPortfolio {
  broker_label: string;
  broker_name: string;
  mode: 'LIVE' | 'PAPER';
  total_equity: number;
  day_change_dollar: number;
  day_change_pct: number;
  cash_balance: number;
  buying_power: number;
  open_positions: number;
  open_options: number;
  open_stocks: number;
  orders_7d: number;
  orders_filled: number;
  orders_pending: number;
  last_synced: string;
  positions: Position[];
  orders: any[];
}

interface BrokerPortfolioProps {
  fetchPortfolio: () => Promise<BrokerPortfolio | null>;
  onConnect: () => void;
  onClosePosition?: (p: Position) => void;
  pollMs?: number;
}

// ─── HELPERS ───────────────────────────────────────────────

const fmtMoney = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (val: number): string => {
  const rounded = Math.round(val * 100) / 100;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(2)}%`;
};

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ─── COMPONENT ─────────────────────────────────────────────

const BrokerPortfolioView: React.FC<BrokerPortfolioProps> = ({
  fetchPortfolio,
  onConnect,
  onClosePosition,
  pollMs,
}) => {
  const [data, setData] = useState<BrokerPortfolio | null | undefined>(undefined); // undefined = not yet loaded
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [posFilter, setPosFilter] = useState<'all' | 'options' | 'stocks'>('all');
  const mountedRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fetchPortfolio();
      if (!mountedRef.current) return;
      setData(result);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to load portfolio');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // Optional polling
  useEffect(() => {
    if (!pollMs || pollMs <= 0) return;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  // ── STATE 1: Loading ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-[3px] border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-medium">Loading portfolio...</p>
      </div>
    );
  }

  // ── STATE 3: Error ────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl text-red-400">error_outline</span>
        </div>
        <p className="text-red-400 text-sm font-medium max-w-sm text-center">{error}</p>
        <button
          onClick={() => load()}
          className="mt-1 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── STATE 2: Not connected (null) ─────────────────────
  if (data === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-zinc-800/60 border border-zinc-700 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-zinc-500">link_off</span>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-white">Connect your broker</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            Connecting a broker shows your live equity, positions, and orders here.
          </p>
        </div>
        <button
          onClick={onConnect}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          Connect broker
        </button>
      </div>
    );
  }

  // ── STATE 4: Loaded ───────────────────────────────────
  const d = data!;
  const dayPositive = d.day_change_dollar >= 0;

  const filteredPositions = d.positions.filter(p => {
    if (posFilter === 'options') return p.type === 'CALL' || p.type === 'PUT';
    if (posFilter === 'stocks') return p.type === 'STOCK';
    return true;
  });

  const totalMktValue = filteredPositions.reduce((s, p) => s + p.mkt_value, 0);
  const totalPL = filteredPositions.reduce((s, p) => s + p.pl_dollar, 0);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Portfolio</h1>
          <span className="text-xs text-zinc-500 font-medium">
            {d.broker_label} &middot; {d.mode}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-300 tracking-wider border border-zinc-800 bg-zinc-900 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${d.mode === 'LIVE' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            {d.broker_name}
          </span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh portfolio"
            className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Equity */}
        <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Total Equity</span>
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">{fmtMoney(d.total_equity)}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono tabular-nums border ${
              dayPositive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {dayPositive ? '\u25B2' : '\u25BC'} {dayPositive ? '+' : ''}{fmtMoney(d.day_change_dollar)} ({fmtPct(d.day_change_pct)})
            </span>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Cash Balance</span>
          <span className="text-2xl font-extrabold text-white tracking-tight font-mono tabular-nums">{fmtMoney(d.cash_balance)}</span>
          <span className="text-[11px] text-zinc-500 font-medium">Buying Power: <span className="font-mono tabular-nums">{fmtMoney(d.buying_power)}</span></span>
        </div>

        {/* Open Positions */}
        <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Open Positions</span>
          <span className="text-2xl font-extrabold text-white tracking-tight font-mono tabular-nums">{String(d.open_positions).padStart(2, '0')}</span>
          <span className="text-[11px] text-zinc-500 font-medium">{d.open_options} options &middot; {d.open_stocks} stocks</span>
        </div>

        {/* Orders 7d */}
        <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Orders (7d)</span>
          <span className="text-2xl font-extrabold text-white tracking-tight font-mono tabular-nums">{String(d.orders_7d).padStart(2, '0')}</span>
          <span className="text-[11px] text-zinc-500 font-medium">{d.orders_filled} filled &middot; {d.orders_pending} pending</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['positions', 'orders'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
              activeTab === tab
                ? 'text-white border-emerald-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab === 'positions' ? 'Active Positions' : 'Order History'}
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold font-mono tabular-nums ${
              activeTab === tab ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {tab === 'positions' ? d.open_positions : d.orders_7d}
            </span>
          </button>
        ))}
      </div>

      {/* ── Positions tab ─────────────────────────────── */}
      {activeTab === 'positions' && (
        <div>
          {/* Filter row */}
          <div className="flex gap-1.5 mb-3">
            {(['all', 'options', 'stocks'] as const).map(f => (
              <button
                key={f}
                onClick={() => setPosFilter(f)}
                className={`px-3.5 py-1.5 rounded-md border text-xs font-semibold transition-colors capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  posFilter === f
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredPositions.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-2">inventory_2</span>
              <p className="text-zinc-500 text-sm font-medium">No active positions</p>
            </div>
          ) : (
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[2fr_0.6fr_0.7fr_0.9fr_0.5fr_0.5fr_0.7fr_0.8fr_1fr_0.7fr] gap-2 px-4 py-2.5 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                <span>Symbol</span>
                <span className="text-center">Type</span>
                <span className="text-right">Strike</span>
                <span className="text-right">Expiry</span>
                <span className="text-center">DTE</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Avg Cost</span>
                <span className="text-right">Mkt Value</span>
                <span className="text-right">P&L</span>
                <span className="text-right">Action</span>
              </div>

              {filteredPositions.map((p, i) => {
                const plColor = p.pl_dollar > 0 ? 'text-emerald-400' : p.pl_dollar < 0 ? 'text-red-400' : 'text-zinc-400';
                const isOption = p.type === 'CALL' || p.type === 'PUT';
                const dteColor = p.dte != null
                  ? p.dte <= 3 ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : p.dte <= 7 ? 'bg-red-500/10 text-red-400 border-red-500/15'
                      : p.dte <= 14 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40'
                  : '';

                return (
                  <div key={`${p.symbol}-${i}`}>
                    {/* Desktop row */}
                    <div className={`hidden lg:grid grid-cols-[2fr_0.6fr_0.7fr_0.9fr_0.5fr_0.5fr_0.7fr_0.8fr_1fr_0.7fr] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors group ${
                      i < filteredPositions.length - 1 ? 'border-b border-zinc-800/50' : ''
                    }`}>
                      {/* Symbol */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {p.symbol.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-bold text-sm block truncate">{p.symbol}</span>
                          {p.name && <span className="text-zinc-500 text-[10px] block truncate font-mono">{p.name}</span>}
                        </div>
                      </div>
                      {/* Type */}
                      <div className="text-center">
                        <TypeBadge type={p.type} />
                      </div>
                      {/* Strike */}
                      <span className="text-right text-zinc-300 text-sm font-mono tabular-nums">
                        {isOption && p.strike != null ? `$${p.strike.toFixed(2)}` : '\u2014'}
                      </span>
                      {/* Expiry */}
                      <span className="text-right text-zinc-300 text-xs">
                        {isOption && p.expiry ? fmtDate(p.expiry).split(',')[0] : '\u2014'}
                      </span>
                      {/* DTE */}
                      <div className="text-center">
                        {isOption && p.dte != null ? (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${dteColor}`}>
                            {p.dte}d
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">&mdash;</span>
                        )}
                      </div>
                      {/* Qty */}
                      <span className="text-right text-zinc-300 text-sm font-mono tabular-nums">{p.qty}</span>
                      {/* Avg Cost */}
                      <span className="text-right text-zinc-300 text-sm font-mono tabular-nums">{fmtMoney(p.avg_cost)}</span>
                      {/* Mkt Value */}
                      <span className="text-right text-white text-sm font-semibold font-mono tabular-nums">{fmtMoney(p.mkt_value)}</span>
                      {/* P&L */}
                      <div className="text-right">
                        <span className={`text-sm font-semibold font-mono tabular-nums block ${plColor}`}>
                          {p.pl_dollar >= 0 ? '+' : ''}{fmtMoney(p.pl_dollar)}
                        </span>
                        <span className={`text-[10px] font-mono tabular-nums ${plColor}`}>
                          {fmtPct(p.pl_pct)}
                        </span>
                      </div>
                      {/* Action */}
                      <div className="text-right">
                        {onClosePosition && (
                          <button
                            onClick={() => onClosePosition(p)}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className={`lg:hidden px-4 py-3 space-y-2 ${
                      i < filteredPositions.length - 1 ? 'border-b border-zinc-800/50' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{p.symbol}</span>
                          <TypeBadge type={p.type} />
                          {isOption && p.dte != null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${dteColor}`}>{p.dte}d</span>
                          )}
                        </div>
                        <span className={`text-sm font-bold font-mono tabular-nums ${plColor}`}>
                          {p.pl_dollar >= 0 ? '+' : ''}{fmtMoney(p.pl_dollar)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="font-mono tabular-nums">{p.qty} @ {fmtMoney(p.avg_cost)}</span>
                        <span className="font-mono tabular-nums">Mkt {fmtMoney(p.mkt_value)}</span>
                      </div>
                      {isOption && (
                        <div className="flex gap-3 text-[11px] text-zinc-500">
                          {p.strike != null && <span>Strike: <span className="text-zinc-300 font-mono tabular-nums">${p.strike.toFixed(2)}</span></span>}
                          {p.expiry && <span>Exp: <span className="text-zinc-300">{p.expiry}</span></span>}
                        </div>
                      )}
                      {onClosePosition && (
                        <button
                          onClick={() => onClosePosition(p)}
                          className="mt-1 px-3 py-1 rounded-lg text-[11px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Footer totals */}
              <div className="hidden lg:grid grid-cols-[2fr_0.6fr_0.7fr_0.9fr_0.5fr_0.5fr_0.7fr_0.8fr_1fr_0.7fr] gap-2 items-center px-4 py-3 border-t border-zinc-700 bg-zinc-900/50">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {filteredPositions.length} position{filteredPositions.length !== 1 ? 's' : ''}
                </span>
                <span /><span /><span /><span /><span /><span />
                <span className="text-right text-white text-sm font-bold font-mono tabular-nums">{fmtMoney(totalMktValue)}</span>
                <span className={`text-right text-sm font-bold font-mono tabular-nums ${totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPL >= 0 ? '+' : ''}{fmtMoney(totalPL)}
                </span>
                <span />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Orders tab ────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div>
          {d.orders.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-2">receipt_long</span>
              <p className="text-zinc-500 text-sm font-medium">No orders in the last 7 days</p>
            </div>
          ) : (
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
              {/* Header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-2.5 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                <span>Symbol</span>
                <span>Side</span>
                <span className="text-center">Type</span>
                <span className="text-right">Qty</span>
                <span className="text-center">Status</span>
                <span className="text-right">Time</span>
              </div>
              {d.orders.map((o: any, i: number) => (
                <div key={i} className={`grid grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${
                  i < d.orders.length - 1 ? 'border-b border-zinc-800/50' : ''
                }`}>
                  <span className="text-sm text-white font-semibold truncate">{o.symbol || o.underlying || '\u2014'}</span>
                  <span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
                      (o.side || o.instruction || '').toUpperCase().includes('BUY')
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {(o.side || o.instruction || '\u2014').replace(/_/g, ' ')}
                    </span>
                  </span>
                  <span className="text-center text-xs text-zinc-400">{o.order_type || o.orderType || '\u2014'}</span>
                  <span className="text-right text-sm text-zinc-300 font-mono tabular-nums">{o.qty || o.quantity || '\u2014'}</span>
                  <span className="text-center">
                    <OrderStatusBadge status={o.status || 'UNKNOWN'} />
                  </span>
                  <span className="text-right text-zinc-400 text-[11px]">{fmtDate(o.time || o.enteredTime || o.created_at || '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-3 border-t border-zinc-800">
        <span className="text-zinc-600 text-[11px]">Last synced: {fmtDate(d.last_synced)}</span>
      </div>
    </div>
  );
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────

const TypeBadge: React.FC<{ type: 'CALL' | 'PUT' | 'STOCK' }> = ({ type }) => {
  const styles = {
    CALL:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PUT:   'bg-red-500/10 text-red-400 border-red-500/20',
    STOCK: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${styles[type]}`}>
      {type}
    </span>
  );
};

const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    FILLED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CANCELED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CANCELLED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    EXPIRED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    WORKING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    QUEUED: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    NEW: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACCEPTED: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  };
  const cls = styles[s] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border tracking-wide ${cls}`}>
      {s}
    </span>
  );
};

export default BrokerPortfolioView;
