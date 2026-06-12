import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ──────────────────────────────────────────────────────
interface TrendingStock {
    symbol: string;
    name: string;
    price: number;
    change_pct: number;
    change_amount: number;
    volume: number;
    market_cap: number;
    sector: string;
    day_high: number;
    day_low: number;
    previous_close: number;
    trending_type: 'most_active' | 'top_gainer' | 'top_loser';
    trending_rank: number;
    scanned_at: string;
}

type FilterType = 'all' | 'most_active' | 'top_gainer' | 'top_loser';
type SortColumn = 'symbol' | 'price' | 'change_pct' | 'volume' | 'market_cap';
type SortDir = 'asc' | 'desc';

// ─── Formatters ─────────────────────────────────────────────────
const fmtPrice = (v: number) =>
    `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const fmtLarge = (v: number, prefix = '') => {
    if (v >= 1e12) return `${prefix}${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `${prefix}${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `${prefix}${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3)  return `${prefix}${(v / 1e3).toFixed(1)}K`;
    return `${prefix}${v}`;
};

const fmtTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m ago`;
};

const N8N_SCAN_URL = 'https://prabhupadala01.app.n8n.cloud/webhook/trending-stocks-scan';
const MIN_MARKET_CAP = 3_000_000_000;
const AUTO_SCAN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const isMarketHours = (): boolean => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = now.getDay();
    if (day === 0 || day === 6) return false; // weekend
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMins = h * 60 + m;
    return totalMins >= 9 * 60 + 30 && totalMins < 16 * 60; // 9:30 AM – 4:00 PM ET
};

// ─── Sub-components ─────────────────────────────────────────────
const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
        most_active: { bg: 'rgba(99,179,237,0.15)',  color: '#63b3ed', label: 'ACTIVE'  },
        top_gainer:  { bg: 'rgba(104,211,145,0.15)', color: '#68d391', label: 'GAINER'  },
        top_loser:   { bg: 'rgba(252,129,129,0.15)', color: '#fc8181', label: 'LOSER'   },
    };
    const s = cfg[type] ?? { bg: 'rgba(113,128,150,0.15)', color: '#718096', label: type.toUpperCase() };
    return (
        <span style={{
            background: s.bg, color: s.color,
            fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 6,
            letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>
            {s.label}
        </span>
    );
};

const SortArrow: React.FC<{ col: SortColumn; active: SortColumn; dir: SortDir }> = ({ col, active, dir }) => (
    <span style={{ marginLeft: 3, fontSize: 9, color: active === col ? '#68d391' : '#4a5568' }}>
        {active === col ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
);

// ─── Main Component ─────────────────────────────────────────────
const TrendingStocks: React.FC = () => {
    const [stocks, setStocks]           = useState<TrendingStock[]>([]);
    const [loading, setLoading]         = useState(true);
    const [scanning, setScanning]       = useState(false);
    const [filter, setFilter]           = useState<FilterType>('all');
    const [sortCol, setSortCol]         = useState<SortColumn>('change_pct');
    const [sortDir, setSortDir]         = useState<SortDir>('desc');
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchStocks = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('trending_stocks')
                .select('*')
                .gte('market_cap', MIN_MARKET_CAP)
                .order('change_pct', { ascending: false });

            if (!error && data) {
                setStocks(data);
                const latest = data.find(d => d.scanned_at)?.scanned_at ?? null;
                if (latest) setLastScanned(latest);
            }
        } catch (e) {
            console.error('[TrendingStocks] fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const triggerScan = useCallback(async () => {
        try { await fetch(N8N_SCAN_URL, { method: 'POST' }); } catch { /* ignore */ }
        scanTimer.current = setTimeout(fetchStocks, 15_000);
    }, [fetchStocks]);

    useEffect(() => {
        fetchStocks();
        // Fetch from DB every 60s
        const fetchInterval = setInterval(fetchStocks, 60_000);
        // Auto-trigger n8n scan every 15 min during market hours
        const scanInterval = setInterval(() => {
            if (isMarketHours()) triggerScan();
        }, AUTO_SCAN_INTERVAL_MS);
        // Trigger immediately on mount if market is open
        if (isMarketHours()) triggerScan();
        return () => {
            clearInterval(fetchInterval);
            clearInterval(scanInterval);
            if (scanTimer.current) clearTimeout(scanTimer.current);
        };
    }, [fetchStocks, triggerScan]);

    const handleScanNow = async () => {
        if (scanning) return;
        setScanning(true);
        await triggerScan();
        setTimeout(() => setScanning(false), 16_000);
    };

    const handleSort = (col: SortColumn) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    // Filter
    const filtered = stocks.filter(s => {
        if (filter === 'all')         return true;
        if (filter === 'most_active') return s.trending_type === 'most_active';
        if (filter === 'top_gainer')  return s.trending_type === 'top_gainer';
        if (filter === 'top_loser')   return s.trending_type === 'top_loser';
        return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
        let av: number | string = 0, bv: number | string = 0;
        if (sortCol === 'symbol')     { av = a.symbol;     bv = b.symbol; }
        if (sortCol === 'price')      { av = a.price;      bv = b.price; }
        if (sortCol === 'change_pct') { av = a.change_pct; bv = b.change_pct; }
        if (sortCol === 'volume')     { av = a.volume;     bv = b.volume; }
        if (sortCol === 'market_cap') { av = a.market_cap; bv = b.market_cap; }
        if (typeof av === 'string')
            return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
        return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    // Stats
    const gainers = stocks.filter(s => s.change_pct > 0).length;
    const losers  = stocks.filter(s => s.change_pct < 0).length;
    const avgPnl  = stocks.length > 0
        ? stocks.reduce((acc, s) => acc + s.change_pct, 0) / stocks.length
        : 0;

    const statCards = [
        { label: 'Tracked', value: stocks.length.toString(),                      color: '#a0aec0' },
        { label: 'Gainers', value: gainers.toString(),                             color: '#68d391' },
        { label: 'Losers',  value: losers.toString(),                              color: '#fc8181' },
        { label: 'Avg P&L', value: `${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}%`, color: avgPnl >= 0 ? '#68d391' : '#fc8181' },
    ];

    const thStyle: React.CSSProperties = {
        padding: '10px 16px',
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 700,
        color: '#718096',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid #2d3748',
        background: 'rgba(26,32,44,0.8)',
    };

    const COLS: { label: string; col: SortColumn | null; }[] = [
        { label: '#',        col: null          },
        { label: 'Symbol',   col: 'symbol'      },
        { label: 'Price',    col: 'price'       },
        { label: 'Change %', col: 'change_pct'  },
        { label: 'Volume',   col: 'volume'      },
        { label: 'Mkt Cap',  col: 'market_cap'  },
        { label: 'Sector',   col: null          },
        { label: 'Type',     col: null          },
    ];

    return (
        <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', color: '#e2e8f0', maxWidth: 1400 }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        background: 'rgba(104,211,145,0.08)',
                        border: '1px solid rgba(104,211,145,0.25)',
                        borderRadius: 12, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontSize: 22 }}>🔥</span>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: '#e2e8f0', textTransform: 'uppercase' }}>
                            Trending Stocks
                        </h2>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#718096' }}>
                            Top movers · Market cap &gt; $3B · {lastScanned ? fmtTimeAgo(lastScanned) : 'Not yet scanned'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleScanNow}
                    disabled={scanning}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        background: scanning ? 'rgba(104,211,145,0.08)' : 'transparent',
                        border: '1.5px solid #68d391',
                        color: '#68d391',
                        borderRadius: 9,
                        padding: '9px 18px',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: scanning ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.06em',
                        opacity: scanning ? 0.65 : 1,
                        transition: 'all 0.2s',
                    }}
                >
                    <span style={{ fontSize: 13 }}>{scanning ? '⏳' : '▶'}</span>
                    {scanning ? 'SCANNING...' : 'SCAN NOW'}
                </button>
            </div>

            {/* ── Stats Bar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {statCards.map(card => (
                    <div key={card.label} style={{
                        background: '#1a202c',
                        border: '1px solid #2d3748',
                        borderRadius: 10, padding: '14px 18px',
                    }}>
                        <p style={{ margin: 0, fontSize: 10, color: '#718096', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {card.label}
                        </p>
                        <p style={{ margin: '5px 0 0', fontSize: 24, fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Filter Pills ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {([
                    { id: 'all',         label: 'ALL'          },
                    { id: 'most_active', label: '📊 ACTIVE'    },
                    { id: 'top_gainer',  label: '📈 GAINERS'   },
                    { id: 'top_loser',   label: '📉 LOSERS'    },
                ] as { id: FilterType; label: string }[]).map(pill => {
                    const active = filter === pill.id;
                    return (
                        <button
                            key={pill.id}
                            onClick={() => setFilter(pill.id)}
                            style={{
                                background: active ? 'rgba(104,211,145,0.10)' : 'transparent',
                                border: active ? '1.5px solid #68d391' : '1px solid #2d3748',
                                color: active ? '#68d391' : '#718096',
                                borderRadius: 20,
                                padding: '6px 18px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                transition: 'all 0.15s',
                            }}
                        >
                            {pill.label}
                        </button>
                    );
                })}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a5568', alignSelf: 'center' }}>
                    {sorted.length} result{sorted.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ── Table ── */}
            <div style={{ background: '#1a202c', border: '1px solid #2d3748', borderRadius: 12, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '56px 32px', color: '#718096' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid #2d3748', borderTop: '3px solid #68d391', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
                        <p style={{ margin: 0, fontSize: 12 }}>Loading trending stocks...</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '72px 32px', color: '#718096' }}>
                        <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            No Trending Stocks
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: 12 }}>Click SCAN NOW to fetch latest data</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                            <thead>
                                <tr>
                                    {COLS.map(h => (
                                        <th
                                            key={h.label}
                                            onClick={h.col ? () => handleSort(h.col!) : undefined}
                                            style={{ ...thStyle, cursor: h.col ? 'pointer' : 'default' }}
                                        >
                                            {h.label}
                                            {h.col && <SortArrow col={h.col} active={sortCol} dir={sortDir} />}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((s, i) => (
                                    <tr
                                        key={`${s.symbol}-${i}`}
                                        style={{ borderBottom: '1px solid rgba(45,55,72,0.5)', transition: 'background 0.1s', cursor: 'default' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,55,72,0.27)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '13px 16px', color: '#4a5568', fontSize: 11, width: 40 }}>{i + 1}</td>
                                        <td style={{ padding: '13px 16px', minWidth: 150 }}>
                                            <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' }}>{s.symbol}</div>
                                            <div style={{ fontSize: 10, color: '#718096', marginTop: 2, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.name || '—'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>
                                            {fmtPrice(s.price)}
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <span style={{
                                                background: s.change_pct >= 0 ? 'rgba(104,211,145,0.15)' : 'rgba(252,129,129,0.15)',
                                                color: s.change_pct >= 0 ? '#68d391' : '#fc8181',
                                                padding: '3px 9px', borderRadius: 6,
                                                fontSize: 12, fontWeight: 700,
                                            }}>
                                                {fmtPct(s.change_pct)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 16px', fontSize: 12, color: '#a0aec0' }}>{fmtLarge(s.volume)}</td>
                                        <td style={{ padding: '13px 16px', fontSize: 12, color: '#a0aec0' }}>{fmtLarge(s.market_cap, '$')}</td>
                                        <td style={{ padding: '13px 16px', fontSize: 11, color: '#718096', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {s.sector || '—'}
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <TypeBadge type={s.trending_type} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default TrendingStocks;
