import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface OptionSignal {
    id: string; // assumed
    symbol: string;
    current_price: number;
    option_type: 'CALL' | 'PUT' | 'NO_TRADE';
    tier: 'A+' | 'A' | 'B+' | 'NO_TRADE';
    trading_recommendation: string; // "STRONG BUY"
    gates_passed: string; // "6/6"
    adx_value: number;
    adx_trend: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NO_TREND';
    sma_direction?: 'UP' | 'DOWN' | 'Neutral';
    fib_target1: number;
    fib_target2: number;
    fib_stop_loss: number;
    risk_reward_ratio: string;
    analyzed_at: string;
}

export const useOptionSignals = () => {
    // Using OptionSignal type strictly
    const [signals, setSignals] = useState<OptionSignal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchSignals = async () => {
        try {
            // Only set loading on initial fetch
            if (signals.length === 0) setLoading(true);

            const { data, error } = await supabase
                .from('option_signals')
                .select('*')
                .eq('is_latest', true)
                .order('analyzed_at', { ascending: false });

            if (error) throw error;

            setSignals(data as OptionSignal[]);
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
        const interval = setInterval(fetchSignals, 900000); // Poll every 15 minutes
        return () => clearInterval(interval);
    }, []);

    return { signals, loading, error, refresh: fetchSignals, lastUpdated };
};
