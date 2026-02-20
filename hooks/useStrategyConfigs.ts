import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface StrategyConfig {
    id: string;
    strategy: string;
    display_name: string;
    icon: string;
}

export const useStrategyConfigs = () => {
    const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStrategies = async () => {
            try {
                const { data, error } = await supabase
                    .from('strategy_configs')
                    .select('id, strategy, display_name, icon')
                    .eq('is_active', true);

                if (error) throw error;
                setStrategies(data as StrategyConfig[]);
            } catch (err) {
                console.error('Error fetching strategy configs:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStrategies();
    }, []);

    return { strategies, loading };
};
