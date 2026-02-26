import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { OptionSignal } from '../types';

// Maps strategy name to its dedicated table (if any)
const STRATEGY_TABLE_MAP: Record<string, string> = {
    day_trade: 'day_trade',
    swing_trade: 'swing_trade',
    market_profile: 'mp_signals',
};

const getAdxTrend = (adx?: number): OptionSignal['adx_trend'] => {
    if (!adx) return 'NO_TREND';
    if (adx >= 40) return 'VERY_STRONG';
    if (adx >= 30) return 'STRONG';
    if (adx >= 20) return 'MODERATE';
    if (adx >= 15) return 'WEAK';
    return 'NO_TREND';
};

const mapDayTradeToSignal = (row: any): OptionSignal => ({
    id: String(row.id),
    symbol: row.symbol,
    current_price: row.current_price,
    option_type: row.option_type?.toUpperCase() || 'NO_TRADE',
    tier: row.tier || 'NO_TRADE',
    trading_recommendation: row.trading_recommendation || row.signal || '',
    gates_passed: row.gates_passed || '0/6',
    adx_value: row.adx_value || 0,
    adx_trend: getAdxTrend(row.adx_value),
    sma_direction: undefined,
    fib_target1: row.target1 || 0,
    fib_target2: row.target2 || 0,
    fib_profit_zone_label: row.profit_zone_label || undefined,
    fib_stop_loss: row.stop_loss || 0,
    risk_reward_ratio: row.target1 && row.stop_loss && row.current_price
        ? ((row.target1 - row.current_price) / (row.current_price - row.stop_loss)).toFixed(1)
        : '-',
    analyzed_at: row.analyzed_at || row.created_at,
    ai_entry_hint: row.ai_entry_hint || undefined,
    ai_reason: row.ai_reason || undefined,
});

const mapMpSignalToOptionSignal = (row: any): OptionSignal => {
    const direction = (row.direction || '').toUpperCase();
    const optionType = direction === 'LONG' || direction === 'BULLISH' ? 'CALL'
        : direction === 'SHORT' || direction === 'BEARISH' ? 'PUT'
            : 'NO_TRADE';

    const signalType = (row.signal_type || '').toUpperCase();
    const recommendation = signalType.includes('STRONG')
        ? (optionType === 'CALL' ? 'STRONG BUY' : 'STRONG SELL')
        : signalType.includes('BUY') || direction === 'LONG' || direction === 'BULLISH'
            ? 'BUY'
            : signalType.includes('SELL') || direction === 'SHORT' || direction === 'BEARISH'
                ? 'SELL'
                : signalType || 'NO_TRADE';

    return {
        id: String(row.id),
        symbol: row.ticker,
        current_price: Number(row.current_price) || 0,
        option_type: optionType as OptionSignal['option_type'],
        tier: row.tier || 'NO_TRADE',
        trading_recommendation: recommendation,
        gates_passed: row.gates_passed ? `${row.gates_passed}/6` : '0/6',
        adx_value: 0,
        adx_trend: 'NO_TREND',
        sma_direction: undefined,
        fib_target1: Number(row.target) || 0,
        fib_target2: 0,
        fib_profit_zone_label: row.poc ? `POC: $${Number(row.poc).toFixed(2)}` : undefined,
        fib_stop_loss: Number(row.stop) || 0,
        risk_reward_ratio: row.risk_reward ? String(row.risk_reward) : '-',
        analyzed_at: row.signal_time || row.created_at,
    };
};

export const useOptionSignals = (strategyFilter?: string | null) => {
    const [signals, setSignals] = useState<OptionSignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchSignals = async () => {
        try {
            if (signals.length === 0) setLoading(true);

            const strategyTable = strategyFilter ? STRATEGY_TABLE_MAP[strategyFilter] : null;

            if (strategyTable) {
                let data: any[], queryError: any;

                if (strategyFilter === 'market_profile') {
                    // mp_signals: try today's profile_date first, fall back to latest
                    const today = new Date().toISOString().split('T')[0];
                    let result = await supabase
                        .from(strategyTable)
                        .select('*')
                        .eq('profile_date', today)
                        .order('signal_time', { ascending: false });

                    // If no data for today, fetch the most recent signals
                    if (!result.error && (!result.data || result.data.length === 0)) {
                        console.log('No MP signals for today, fetching latest...');
                        result = await supabase
                            .from(strategyTable)
                            .select('*')
                            .order('signal_time', { ascending: false })
                            .limit(50);
                    }

                    data = result.data || [];
                    queryError = result.error;
                    console.log('MP Signals fetched:', data.length, 'rows', queryError);
                } else {
                    // Other strategies: filter by is_latest, order by analyzed_at
                    const result = await supabase
                        .from(strategyTable)
                        .select('*')
                        .eq('is_latest', true)
                        .order('analyzed_at', { ascending: false });
                    data = result.data || [];
                    queryError = result.error;
                }

                if (queryError) throw queryError;

                // day_trade table uses different column names (target1, target2, stop_loss)
                // swing_trade table columns already match OptionSignal directly
                // mp_signals table uses ticker, entry_price, target, stop, poc etc.
                const mapped = strategyFilter === 'day_trade'
                    ? (data || []).map(mapDayTradeToSignal)
                    : strategyFilter === 'market_profile'
                        ? (data || []).map(mapMpSignalToOptionSignal)
                        : (data as OptionSignal[]);
                setSignals(mapped);
            } else if (strategyFilter) {
                // Strategy exists but has no dedicated table — filter swing_trade by watchlist
                const { data: watchlistData, error: watchlistError } = await supabase
                    .from('strategy_watchlists')
                    .select('symbol')
                    .eq('strategy', strategyFilter);

                if (watchlistError) throw watchlistError;
                const symbols = (watchlistData || []).map(w => w.symbol);

                const { data, error } = await supabase
                    .from('swing_trade')
                    .select('*')
                    .eq('is_latest', true)
                    .in('symbol', symbols)
                    .order('analyzed_at', { ascending: false });

                if (error) throw error;
                setSignals(data as OptionSignal[]);
            } else {
                // No filter — fetch all from swing_trade
                const { data, error } = await supabase
                    .from('swing_trade')
                    .select('*')
                    .eq('is_latest', true)
                    .order('analyzed_at', { ascending: false });

                if (error) throw error;
                setSignals(data as OptionSignal[]);
            }

            setLastUpdated(new Date());
        } catch (err: any) {
            console.error('Error fetching option signals:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSignals();
        const interval = setInterval(fetchSignals, 900000);
        return () => clearInterval(interval);
    }, [strategyFilter]);

    return { signals, loading, error, refresh: fetchSignals, lastUpdated };
};
