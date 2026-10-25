import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import type {
  MROpenPosition, MRSignal, MRHistoryPosition,
  MRScorecard, MRPromotion, MRWeekly,
  MRScanRun, MRShadow, MRSkip,
  ConnectionStatus, Toast,
} from './types';

/* ── Timezone helpers ── */
function isDST(d: Date): boolean {
  const y = d.getUTCFullYear();
  const ms = new Date(Date.UTC(y, 2, 8, 7));
  ms.setUTCDate(8 + ((7 - ms.getUTCDay()) % 7));
  const ne = new Date(Date.UTC(y, 10, 1, 6));
  ne.setUTCDate(1 + ((7 - ne.getUTCDay()) % 7));
  return d >= ms && d < ne;
}

function isMarketHoursET(): boolean {
  const now = new Date();
  const offset = isDST(now) ? -4 : -5;
  const et = new Date(now.getTime() + offset * 3600_000);
  const h = et.getUTCHours();
  const m = et.getUTCMinutes();
  const mins = h * 60 + m;
  return mins >= 570 && mins <= 960; // 09:30–16:00
}

/* ── Toast sequence ── */
let _seq = 0;
function mkToast(message: string, type: Toast['type']): Toast {
  return { id: String(++_seq), message, type };
}

/* ── Hook ── */
export interface IronGateMRState {
  open: MROpenPosition[];
  pendingSignals: MRSignal[];
  history: MRHistoryPosition[];
  scorecard: MRScorecard[];
  promotion: MRPromotion[];
  weekly: MRWeekly[];
  lastScan: MRScanRun | null;
  shadow: MRShadow[];
  skips: MRSkip[];
  loading: boolean;
  connected: ConnectionStatus;
  error: string | null;
  toasts: Toast[];
  refetch: () => void;
  dismissToast: (id: string) => void;
}

export function useIronGateMR(): IronGateMRState {
  const [open, setOpen] = useState<MROpenPosition[]>([]);
  const [pendingSignals, setPendingSignals] = useState<MRSignal[]>([]);
  const [history, setHistory] = useState<MRHistoryPosition[]>([]);
  const [scorecard, setScorecard] = useState<MRScorecard[]>([]);
  const [promotion, setPromotion] = useState<MRPromotion[]>([]);
  const [weekly, setWeekly] = useState<MRWeekly[]>([]);
  const [lastScan, setLastScan] = useState<MRScanRun | null>(null);
  const [shadow, setShadow] = useState<MRShadow[]>([]);
  const [skips, setSkips] = useState<MRSkip[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastActivity = useRef(Date.now());

  const pushToast = useCallback((msg: string, type: Toast['type']) => {
    const t = mkToast(msg, type);
    setToasts(prev => [t, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [openR, sigR, histR, scR, proR, wkR, scanR, shR, skR] = await Promise.all([
        supabase.from('v_iron_mr_open').select('*'),
        supabase.from('iron_mr_signals').select('*').eq('state', 'PENDING'),
        supabase.from('iron_mr_positions').select('*').in('status', ['WIN', 'LOSS', 'MANUAL_CLOSE']).order('closed_at', { ascending: false }).limit(200),
        supabase.from('v_iron_mr_scorecard').select('*'),
        supabase.from('v_iron_mr_promotion').select('*'),
        supabase.from('v_iron_mr_weekly').select('*').order('week', { ascending: false }).limit(20),
        supabase.from('iron_mr_scan_runs').select('*').order('ran_at', { ascending: false }).limit(1),
        supabase.from('iron_mr_shadow').select('*'),
        supabase.from('iron_mr_skips').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (openR.error) throw openR.error;
      setOpen((openR.data || []) as MROpenPosition[]);
      setPendingSignals((sigR.data || []) as MRSignal[]);
      setHistory((histR.data || []) as MRHistoryPosition[]);
      setScorecard((scR.data || []) as MRScorecard[]);
      setPromotion((proR.data || []) as MRPromotion[]);
      setWeekly((wkR.data || []) as MRWeekly[]);
      setLastScan(scanR.data?.[0] as MRScanRun ?? null);
      setShadow((shR.data || []) as MRShadow[]);
      setSkips((skR.data || []) as MRSkip[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load MR data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    /* Real-time subscriptions */
    const posCh = supabase
      .channel('mr-positions-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iron_mr_positions' }, (payload) => {
        lastActivity.current = Date.now();
        if (payload.eventType === 'INSERT') {
          const row = payload.new as MRHistoryPosition;
          if (['WIN', 'LOSS', 'MANUAL_CLOSE'].includes(row.status)) {
            setHistory(prev => [row, ...prev].slice(0, 200));
            const sign = (row.pnl_pct ?? 0) >= 0 ? '+' : '';
            pushToast(`${row.status}: ${row.symbol} ${sign}${(row.pnl_pct ?? 0).toFixed(2)}%`, row.status === 'WIN' ? 'win' : 'loss');
          }
        }
        // Any position change — refetch open + history
        fetchAll();
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    const sigCh = supabase
      .channel('mr-signals-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iron_mr_signals' }, (payload) => {
        lastActivity.current = Date.now();
        if (payload.eventType === 'INSERT') {
          const row = payload.new as MRSignal;
          if (row.state === 'PENDING') {
            pushToast(`New signal: ${row.symbol} ${row.side}`, 'new');
          }
        }
        // Refetch signals
        supabase.from('iron_mr_signals').select('*').eq('state', 'PENDING').then(({ data }) => {
          if (data) setPendingSignals(data as MRSignal[]);
        });
      })
      .subscribe();

    /* Polling: 60s during market hours, 10min otherwise */
    const pollInterval = setInterval(() => {
      fetchAll();
    }, isMarketHoursET() ? 60_000 : 600_000);

    /* Idle detection */
    const idleInterval = setInterval(() => {
      const sec = (Date.now() - lastActivity.current) / 1000;
      setConnected(prev => prev === 'disconnected' ? prev : sec > 60 ? 'idle' : 'connected');
    }, 10_000);

    return () => {
      supabase.removeChannel(posCh);
      supabase.removeChannel(sigCh);
      clearInterval(pollInterval);
      clearInterval(idleInterval);
    };
  }, [fetchAll, pushToast]);

  return {
    open, pendingSignals, history, scorecard, promotion, weekly,
    lastScan, shadow, skips, loading, connected, error, toasts,
    refetch: fetchAll, dismissToast,
  };
}
