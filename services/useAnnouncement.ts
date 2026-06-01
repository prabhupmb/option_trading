import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface Announcement {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    is_active: boolean;
    created_at: string;
}

export function useAnnouncement() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);

    const fetchLatest = useCallback(async () => {
        const { data } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        setAnnouncement(data ?? null);
    }, []);

    useEffect(() => {
        fetchLatest();

        const channel = supabase
            .channel('announcements_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchLatest)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchLatest]);

    return announcement;
}
