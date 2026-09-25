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

/**
 * Fetches 5-min bars from md_bars for a set of symbols (last 3 trading days).
 * Filters to RTH only (09:30–16:00 NY).
 * Refreshes every 60s.
 *
 * bar_time is NY wall-clock time stored with a UTC label —
 * we parse it as-is (no UTC→local shift).
 */
export function useMdBars(symbols: string[]) {
  const [barsBySymbol, setBarsBySymbol] = useState<Record<string, Bar[]>>({});
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef('');

  const fetchBars = useCallback(async (syms: string[]) => {
    if (syms.length === 0) return;
    setLoading(true);

    // 3 trading days ago (rough: go back 5 calendar days to cover weekends)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);
    const cutoffStr = cutoff.toISOString();

    const { data, error } = await supabase
      .from('md_bars')
      .select('symbol,tf,bar_time,o,h,l,c,v')
      .eq('tf', '5min')
      .in('symbol', syms)
      .gte('bar_time', cutoffStr)
      .order('bar_time', { ascending: true });

    if (error) {
      console.error('[useMdBars] query error:', error);
      setLoading(false);
      return;
    }

    const grouped: Record<string, Bar[]> = {};
    for (const row of (data ?? []) as RawBar[]) {
      // Parse bar_time as NY wall-clock (it's stored with UTC label but means NY time)
      // Extract the date/time parts directly — do NOT apply timezone offset
      const match = row.bar_time.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (!match) continue;
      const [, yr, mo, dy, hr, mn] = match;
      const hhmm = parseInt(hr) * 100 + parseInt(mn);

      // RTH filter: 09:30–16:00 NY
      if (hhmm < 930 || hhmm >= 1600) continue;

      // Build unix timestamp treating the parsed time as NY local
      // Create a Date in NY by using the Intl trick
      const nyDateStr = `${yr}-${mo}-${dy}T${hr}:${mn}:00`;
      // We want the unix timestamp that corresponds to this NY wall-clock time
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
    const key = [...symbols].sort().join(',');
    if (key === prevKeyRef.current && Object.keys(barsBySymbol).length > 0) return;
    prevKeyRef.current = key;
    fetchBars(symbols);
  }, [symbols, fetchBars]);

  // Refresh every 60s
  useEffect(() => {
    if (symbols.length === 0) return;
    const id = setInterval(() => fetchBars(symbols), 60_000);
    return () => clearInterval(id);
  }, [symbols, fetchBars]);

  return { barsBySymbol, loading };
}

/** Convert a NY wall-clock datetime string to unix seconds */
function nyToUnix(nyDatetime: string): number {
  // Parse components
  const d = new Date(nyDatetime + 'Z'); // treat as UTC temporarily
  const utcMs = d.getTime();

  // Find NY offset at this moment using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  // What time does this UTC instant show in NY?
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const nyAtUtc = new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
  const offsetMs = nyAtUtc.getTime() - utcMs;

  // The actual UTC timestamp = input time (which we want as NY) shifted by offset
  return Math.floor((utcMs - offsetMs) / 1000);
}
