import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ───────────────────────────────────────────────────

export type InboxChannel = 'ALERT' | 'MESSAGE';
export type InboxSeverity = 'CRITICAL' | 'WARN' | 'SUCCESS' | 'INFO';
export type InboxStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export interface InboxItem {
  id: string;
  channel: InboxChannel;
  kind: string;
  severity: InboxSeverity;
  title: string;
  body: string | null;
  symbol: string | null;
  system: string | null;
  ref_table: string | null;
  ref_id: string | null;
  action_url: string | null;
  status: InboxStatus;
  created_at: string;
}

export interface UnreadCounts {
  total: number;
  alerts: number;
  messages: number;
}

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState<UnreadCounts>({ total: 0, alerts: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInbox = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notifications_inbox')
      .select('*')
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!alive.current) return;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as InboxItem[];
    setItems(rows);

    // Compute unread counts
    let total = 0, alerts = 0, messages = 0;
    for (const r of rows) {
      if (r.status === 'UNREAD') {
        total++;
        if (r.channel === 'ALERT') alerts++;
        if (r.channel === 'MESSAGE') messages++;
      }
    }
    setUnread({ total, alerts, messages });
    setError(null);
    setLoading(false);
  }, []);

  // Start/stop polling based on visibility
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(fetchInbox, 30_000);
  }, [fetchInbox]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    fetchInbox();
    startPolling();

    const onVisChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchInbox();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      alive.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [fetchInbox, startPolling, stopPolling]);

  // Mark single item read — optimistic
  const markRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'READ' as InboxStatus } : i));
    setUnread(prev => {
      const item = items.find(i => i.id === id);
      if (!item || item.status !== 'UNREAD') return prev;
      return {
        total: Math.max(0, prev.total - 1),
        alerts: item.channel === 'ALERT' ? Math.max(0, prev.alerts - 1) : prev.alerts,
        messages: item.channel === 'MESSAGE' ? Math.max(0, prev.messages - 1) : prev.messages,
      };
    });

    const { error: err } = await supabase
      .from('notifications_inbox')
      .update({ status: 'READ' })
      .eq('id', id);

    if (err) {
      // Roll back
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'UNREAD' as InboxStatus } : i));
      fetchInbox(); // re-sync counts
    }
  }, [items, fetchInbox]);

  // Mark all read — optionally filtered by channel
  const markAllRead = useCallback(async (channel?: InboxChannel) => {
    const prev = { items: [...items], unread: { ...unread } };

    // Optimistic
    setItems(old => old.map(i => {
      if (i.status !== 'UNREAD') return i;
      if (channel && i.channel !== channel) return i;
      return { ...i, status: 'READ' as InboxStatus };
    }));
    setUnread(old => {
      if (!channel) return { total: 0, alerts: 0, messages: 0 };
      if (channel === 'ALERT') return { ...old, total: Math.max(0, old.total - old.alerts), alerts: 0 };
      return { ...old, total: Math.max(0, old.total - old.messages), messages: 0 };
    });

    let query = supabase
      .from('notifications_inbox')
      .update({ status: 'READ' })
      .eq('status', 'UNREAD');
    if (channel) query = query.eq('channel', channel);

    const { error: err } = await query;
    if (err) {
      setItems(prev.items);
      setUnread(prev.unread);
    }
  }, [items, unread]);

  return { items, unread, loading, error, refetch: fetchInbox, markRead, markAllRead };
}
