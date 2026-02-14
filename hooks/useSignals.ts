import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface SmartSignal {
    id: string;
    symbol: string;
    market_status: string; // consolidation, breakout, falling, uptrend, downtrend, reversal
    signal_type: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    confidence: 'strong' | 'moderate' | 'weak';
    current_price: number;
    entry_price?: number;
    target_price?: number;
    stop_loss?: number;
    risk_reward_ratio?: string;
    indicators: {
        sma20?: number;
        sma50?: number;
        sma200?: number;
        rsi?: number;
        adx?: number;
        plus_di?: number;
        minus_di?: number;
        vwap?: 'UP' | 'DOWN' | 'NEUTRAL';
        supertrend_1h?: string;
        supertrend_4h?: string;
        volume_ratio?: number;
        fibonacci?: {
            high: number;
            low: number;
            level_236: number;
            level_382: number;
            level_50: number;
            level_618: number;
        };
    };
    ai_summary: string;
    ai_reasoning: string;
    when_to_buy: string;
    risk_factors: string;
    analyzed_at: string;
}

export const useSignals = () => {
    const [signals, setSignals] = useState<SmartSignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchSignals = async () => {
        try {
            // Don't set loading to true on refresh to avoid screen flicker, only on initial load
            if (signals.length === 0) setLoading(true);

            const { data, error } = await supabase
                .from('stock_signals')
                .select('*')
                .eq('is_latest', true)
                .order('analyzed_at', { ascending: false });

            if (error) throw error;

            setSignals(data as SmartSignal[]);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error('Error fetching signals:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSignals();
        const interval = setInterval(fetchSignals, 3600000); // Poll every 1 hour
        return () => clearInterval(interval);
    }, []);

    return { signals, loading, error, refresh: fetchSignals, lastUpdated };
};
