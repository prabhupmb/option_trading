import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import type { OptionDipTrade, DipLifecycle, OptionDipSkip, EnrichedTrade } from './types';

function computeDTE(expiry: string | null): number | null {
  if (!expiry) return null;
  const exp = new Date(`${expiry}T16:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86400000));
}

export function useOptionDipTrades() {
  const [trades, setTrades] = useState<EnrichedTrade[]>([]);
  const [skips, setSkips] = useState<OptionDipSkip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const fetch_ = useCallback(async () => {
    const [tradeRes, lifecycleRes, skipRes] = await Promise.all([
      supabase
        .from('option_dip_trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('stock_dip_lifecycle')
        .select('symbol, dip_state, price, price_as_of, data_stale, trend_4h'),
      supabase
        .from('stock_auto_trade_skips')
        .select('*')
        .eq('context->>source', 'option_dip_exec')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (!alive.current) return;

    if (tradeRes.error) {
      setError(tradeRes.error.message);
      setLoading(false);
      return;
    }

    const rawTrades = (tradeRes.data || []) as OptionDipTrade[];
    const lifecycles = (lifecycleRes.data || []) as DipLifecycle[];
    const lcMap = new Map(lifecycles.map(l => [l.symbol, l]));

    const enriched: EnrichedTrade[] = rawTrades.map(t => {
      const lc = lcMap.get(t.symbol);
      return {
        ...t,
        live_price: lc?.price ?? null,
        price_as_of: lc?.price_as_of ?? null,
        data_stale: lc?.data_stale ?? false,
        live_dte: computeDTE(t.expiry),
      };
    });

    setTrades(enriched);
    setSkips((skipRes.data || []) as OptionDipSkip[]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    fetch_();
    const interval = setInterval(fetch_, 30_000);
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, [fetch_]);

  return { trades, skips, loading, error, refresh: fetch_ };
}
