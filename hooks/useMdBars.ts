import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Bar } from '../lib/supertrend';

export interface RawBar {
  symbol: string;
  tf: string;
  bar_time: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Timeframe = '5min' | '15min' | '1h' | '4h' | '1D';

/** Calendar-day lookback per TF (generous to cover weekends/holidays) */
const TF_LOOKBACK: Record<Timeframe, number> = {
  '5min': 5,    // ~3 trading days
  '15min': 10,  // ~6 trading days
  '1h': 30,     // ~20 trading days
  '4h': 60,     // ~40 trading days
  '1D': 365,    // ~1 year
};

/** Only filter RTH for intraday TFs */
const INTRADAY_TFS = new Set<Timeframe>(['5min', '15min', '1h', '4h']);

/**
 * Fetches bars from md_bars for a set of symbols at a given timeframe.
 * Filters to RTH only (09:30-16:00 NY) for intraday TFs.
 * Refreshes every 60s.
 *
 * bar_time is NY wall-clock time stored with a UTC label -
 * we parse it as-is (no UTC->local shift).
 */
export function useMdBars(symbols: string[], tf: Timeframe = '5min') {
  const [barsBySymbol, setBarsBySymbol] = useState<Record<string, Bar[]>>({});
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef('');

  const fetchBars = useCallback(async (syms: string[], timeframe: Timeframe) => {
    if (syms.length === 0) return;
    setLoading(true);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TF_LOOKBACK[timeframe]);
    const cutoffStr = cutoff.toISOString();

    const { data, error } = await supabase
      .from('md_bars')
      .select('symbol,tf,bar_time,o,h,l,c,v')
      .eq('tf', timeframe)
      .in('symbol', syms)
      .gte('bar_time', cutoffStr)
      .order('bar_time', { ascending: true });

    if (error) {
      console.error('[useMdBars] query error:', error);
      setLoading(false);
      return;
    }

    const isIntraday = INTRADAY_TFS.has(timeframe);
    const grouped: Record<string, Bar[]> = {};

    for (const row of (data ?? []) as RawBar[]) {
      const match = row.bar_time.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (!match) continue;
      const [, yr, mo, dy, hr, mn] = match;
      const hhmm = parseInt(hr) * 100 + parseInt(mn);

      // RTH filter for intraday
      if (isIntraday && (hhmm < 930 || hhmm >= 1600)) continue;

      const nyDateStr = `${yr}-${mo}-${dy}T${hr}:${mn}:00`;
      const utcDate = nyToUnix(nyDateStr);

      if (!grouped[row.symbol]) grouped[row.symbol] = [];
      grouped[row.symbol].push({
        time: utcDate,
        open: row.o,
        high: row.h,
        low: row.l,
        close: row.c,
        volume: row.v,
      });
    }

    setBarsBySymbol(grouped);
    setLoading(false);
  }, []);

  useEffect(() => {
    const key = `${tf}:${[...symbols].sort().join(',')}`;
    if (key === prevKeyRef.current && Object.keys(barsBySymbol).length > 0) return;
    prevKeyRef.current = key;
    fetchBars(symbols, tf);
  }, [symbols, tf, fetchBars]);

  // Refresh every 60s
  useEffect(() => {
    if (symbols.length === 0) return;
    const id = setInterval(() => fetchBars(symbols, tf), 60_000);
    return () => clearInterval(id);
  }, [symbols, tf, fetchBars]);

  return { barsBySymbol, loading };
}

/** Convert a NY wall-clock datetime string to unix seconds */
function nyToUnix(nyDatetime: string): number {
  const d = new Date(nyDatetime + 'Z');
  const utcMs = d.getTime();

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const nyAtUtc = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
  const offsetMs = nyAtUtc.getTime() - utcMs;

  return Math.floor((utcMs - offsetMs) / 1000);
}
