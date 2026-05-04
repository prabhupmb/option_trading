import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { IronGateDayHistory, IronGateDayPosition } from './types';
import type { ConnectionStatus, Toast } from './types';

function isDSTNow(d: Date): boolean {
  const y = d.getUTCFullYear();
  const ms = new Date(Date.UTC(y, 2, 8, 7));
  ms.setUTCDate(8 + ((7 - ms.getUTCDay()) % 7));
  const ne = new Date(Date.UTC(y, 10, 1, 6));
  ne.setUTCDate(1 + ((7 - ne.getUTCDay()) % 7));
  return d >= ms && d < ne;
}

function getETMidnightISO(): string {
  const now = new Date();
  const offset = isDSTNow(now) ? -4 : -5;
  // Build midnight in ET as UTC
  const etNow = new Date(now.getTime() + offset * 3600 * 1000);
  etNow.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  return new Date(etNow.getTime() - offset * 3600 * 1000).toISOString();
}

let _toastSeq = 0;
function makeToast(message: string, type: Toast['type']): Toast {
  return { id: String(++_toastSeq), message, type };
}

export interface IronGateDayState {
  openPositions: IronGateDayPosition[];
  todayHistory: IronGateDayHistory[];
  loading: boolean;
  connected: ConnectionStatus;
  error: string | null;
  toasts: Toast[];
  flashIds: Set<string>;        // IDs that recently got inserted
  updatedIds: Set<string>;      // IDs that recently got updated
  historyPulse: boolean;        // pulse on history tab indicator
  refetch: () => void;
  dismissToast: (id: string) => void;
}

export function useIronGateDay(): IronGateDayState {
  const [openPositions, setOpenPositions] = useState<IronGateDayPosition[]>([]);
  const [todayHistory, setTodayHistory] = useState<IronGateDayHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [historyPulse, setHistoryPulse] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const pushToast = useCallback((message: string, type: Toast['type']) => {
    const t = makeToast(message, type);
    setToasts(prev => [t, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);

  const flashRow = useCallback((id: string) => {
    setFlashIds(prev => new Set(prev).add(id));
    setTimeout(() => setFlashIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 1600);
  }, []);

  const pulseRow = useCallback((id: string) => {
    setUpdatedIds(prev => new Set(prev).add(id));
    setTimeout(() => setUpdatedIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 500);
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('iron_gate_day_history')
      .select('*')
      .gte('closed_at', getETMidnightISO())
      .order('closed_at', { ascending: false });
    if (!e && data) setTodayHistory(data as IronGateDayHistory[]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, histRes] = await Promise.all([
        supabase
          .from('iron_gate_day_positions')
          .select('*')
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false }),
        supabase
          .from('iron_gate_day_history')
          .select('*')
          .gte('closed_at', getETMidnightISO())
          .order('closed_at', { ascending: false }),
      ]);
      if (posRes.error) throw posRes.error;
      if (histRes.error) throw histRes.error;
      setOpenPositions((posRes.data || []) as IronGateDayPosition[]);
      setTodayHistory((histRes.data || []) as IronGateDayHistory[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const posChannel = supabase
      .channel('igd-positions-' + Date.now())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'iron_gate_day_positions' },
        (payload) => {
          lastActivityRef.current = Date.now();
          const row = payload.new as IronGateDayPosition;
          if (row.status === 'OPEN') {
            setOpenPositions(prev => [row, ...prev]);
            flashRow(row.id);
            const tier = row.tier === 'A+' ? 'STRONG ' : '';
            pushToast(`New signal locked: ${row.symbol} ${tier}${row.action} ${row.tier}`, 'new');
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'iron_gate_day_positions' },
        (payload) => {
          lastActivityRef.current = Date.now();
          const updated = payload.new as IronGateDayPosition;
          setOpenPositions(prev =>
            prev.map(p => p.id === updated.id ? updated : p)
          );
          pulseRow(updated.id);
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'iron_gate_day_positions' },
        (payload) => {
          lastActivityRef.current = Date.now();
          const deletedId = (payload.old as any).id;
          setOpenPositions(prev => prev.filter(p => p.id !== deletedId));
          // Position was closed — refetch history
          fetchHistory();
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    const histChannel = supabase
      .channel('igd-history-' + Date.now())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'iron_gate_day_history' },
        (payload) => {
          lastActivityRef.current = Date.now();
          const row = payload.new as IronGateDayHistory;
          setTodayHistory(prev => [row, ...prev]);
          setHistoryPulse(true);
          setTimeout(() => setHistoryPulse(false), 3000);
          const sign = (row.pnl_pct || 0) >= 0 ? '+' : '';
          const type = row.result === 'WIN' ? 'win' : row.result === 'LOSS' ? 'loss' : 'info';
          pushToast(
            `${row.result === 'WIN' ? 'WIN' : row.result === 'LOSS' ? 'LOSS' : 'BREAKEVEN'}: ${row.symbol} ${sign}${(row.pnl_pct || 0).toFixed(2)}% (${row.exit_reason})`,
            type
          );
        }
      )
      .subscribe();

    // Idle detection — mark as idle if no activity for 60s
    const idleInterval = setInterval(() => {
      const secondsSince = (Date.now() - lastActivityRef.current) / 1000;
      setConnected(prev => {
        if (prev === 'disconnected') return prev;
        return secondsSince > 60 ? 'idle' : 'connected';
      });
    }, 10000);

    // Fallback poll every 15s
    const pollInterval = setInterval(fetchAll, 15000);

    return () => {
      supabase.removeChannel(posChannel);
      supabase.removeChannel(histChannel);
      clearInterval(idleInterval);
      clearInterval(pollInterval);
    };
  }, [fetchAll, fetchHistory, flashRow, pulseRow, pushToast]);

  return {
    openPositions,
    todayHistory,
    loading,
    connected,
    error,
    toasts,
    flashIds,
    updatedIds,
    historyPulse,
    refetch: fetchAll,
    dismissToast,
  };
}
