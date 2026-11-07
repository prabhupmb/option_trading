import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

export interface IndexQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
}

export interface MarketMoodData {
  indices: IndexQuote[];
  loading: boolean;
  isMarketOpen: boolean;
  lastUpdated: Date | null;
}

const SYMBOLS = ['SPY', 'QQQ', 'IWM'];

/** Check if US market is currently open (9:30-16:00 ET, Mon-Fri) */
function checkMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const hhmm = et.getHours() * 100 + et.getMinutes();
  return hhmm >= 930 && hhmm < 1600;
}

export function useMarketMood(): MarketMoodData {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchMood = useCallback(async () => {
    // Get the last 2 trading days of 4h bars to compute daily change
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5); // 5 calendar days covers weekends

    const { data, error } = await supabase
      .from('md_bars')
      .select('symbol,bar_time,o,h,l,c')
      .in('symbol', SYMBOLS)
      .eq('tf', '4h')
      .gte('bar_time', cutoff.toISOString())
      .order('bar_time', { ascending: true });

    if (error || !data || !mountedRef.current) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    // Group by symbol
    const grouped: Record<string, { bar_time: string; o: number; c: number }[]> = {};
    for (const row of data) {
      if (!grouped[row.symbol]) grouped[row.symbol] = [];
      grouped[row.symbol].push({ bar_time: row.bar_time, o: row.o, c: row.c });
    }

    const quotes: IndexQuote[] = [];
    for (const sym of SYMBOLS) {
      const bars = grouped[sym];
      if (!bars || bars.length === 0) continue;

      // Find today's date in ET
      const now = new Date();
      const etStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
      const [mo, dy, yr] = etStr.split('/');
      const todayPrefix = `${yr}-${mo}-${dy}`;

      // Get today's bars, or fall back to last available day's bars
      let todayBars = bars.filter(b => b.bar_time.startsWith(todayPrefix));
      let prevDayClose: number | null = null;

      if (todayBars.length > 0) {
        // Find the last bar before today for prev close
        const prevBars = bars.filter(b => !b.bar_time.startsWith(todayPrefix));
        prevDayClose = prevBars.length > 0 ? prevBars[prevBars.length - 1].c : todayBars[0].o;
      } else {
        // Market closed — use last 2 distinct days
        const days = [...new Set(bars.map(b => b.bar_time.slice(0, 10)))];
        if (days.length >= 2) {
          const lastDay = days[days.length - 1];
          const prevDay = days[days.length - 2];
          todayBars = bars.filter(b => b.bar_time.startsWith(lastDay));
          const prevBars = bars.filter(b => b.bar_time.startsWith(prevDay));
          prevDayClose = prevBars.length > 0 ? prevBars[prevBars.length - 1].c : todayBars[0].o;
        } else {
          todayBars = bars.slice(-1);
          prevDayClose = todayBars[0].o;
        }
      }

      const currentPrice = todayBars[todayBars.length - 1].c;
      const dayOpen = todayBars[0].o;
      const refPrice = prevDayClose ?? dayOpen;
      const change = currentPrice - refPrice;
      const changePct = refPrice !== 0 ? (change / refPrice) * 100 : 0;

      quotes.push({ symbol: sym, price: currentPrice, change, changePct, open: dayOpen });
    }

    if (mountedRef.current) {
      setIndices(quotes);
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchMood();
    // Refresh every 60s during market hours, 5min otherwise
    const id = setInterval(() => {
      fetchMood();
    }, checkMarketOpen() ? 60_000 : 300_000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetchMood]);

  return { indices, loading, isMarketOpen: checkMarketOpen(), lastUpdated };
}
