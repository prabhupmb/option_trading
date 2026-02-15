import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BrokerCredential, BrokerName, BrokerMode } from '../types';
import { useAuth } from '../services/useAuth';

export const useBrokers = () => {
    const { user } = useAuth();
    const [brokers, setBrokers] = useState<BrokerCredential[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBrokers = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('broker_credentials')
                .select('*')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBrokers(data as BrokerCredential[]);
        } catch (err: any) {
            console.error('Error fetching brokers:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrokers();
    }, [user]);

    const addBroker = async (broker: Partial<BrokerCredential>) => {
        try {
            if (!user) throw new Error('User not authenticated');

            // If this is the first broker, make it default
            const isFirst = brokers.length === 0;

            const { data, error } = await supabase
                .from('broker_credentials')
                .insert({
                    user_id: user.id,
                    ...broker,
                    is_default: broker.is_default || isFirst
                })
                .select()
                .single();

            if (error) throw error;

            if (data.is_default) {
                // Unset other defaults if this one is default
                await unsetOtherDefaults(data.id);
            }

            setBrokers(prev => [data, ...prev].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)));
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err };
        }
    };

    const updateBroker = async (id: string, updates: Partial<BrokerCredential>) => {
        try {
            const { data, error } = await supabase
                .from('broker_credentials')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            if (updates.is_default) {
                await unsetOtherDefaults(id);
            }

            setBrokers(prev => prev.map(b => b.id === id ? data : b).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)));
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err };
        }
    };

    const deleteBroker = async (id: string) => {
        try {
            const { error } = await supabase
                .from('broker_credentials')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setBrokers(prev => prev.filter(b => b.id !== id));
            return { error: null };
        } catch (err: any) {
            return { error: err };
        }
    };

    const setAsDefault = async (id: string) => {
        // Set this one to default
        const { error } = await supabase
            .from('broker_credentials')
            .update({ is_default: true })
            .eq('id', id);

        if (error) throw error;

        // Unset others
        await unsetOtherDefaults(id);

        // Optimistic update
        setBrokers(prev => prev.map(b => ({
            ...b,
            is_default: b.id === id
        })).sort((a, b) => (b.id === id ? 1 : -1))); // simplistic sort

        // Refetch to be sure
        fetchBrokers();
    };

    const toggleActive = async (id: string, currentState: boolean) => {
        return updateBroker(id, { is_active: !currentState });
    };

    const unsetOtherDefaults = async (currentId: string) => {
        if (!user) return;
        await supabase
            .from('broker_credentials')
            .update({ is_default: false })
            .neq('id', currentId)
            .eq('user_id', user.id); // Extra safety
    };

    return {
        brokers,
        loading,
        error,
        fetchBrokers,
        addBroker,
        updateBroker,
        deleteBroker,
        setAsDefault,
        toggleActive
    };
};
