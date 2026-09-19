import { useState, useEffect, useCallback, useRef } from 'react';
import { PortfolioPayload, BrokerRef } from '../types/portfolio';

const N8N = (import.meta.env.VITE_N8N_BASE_URL as string | undefined) ?? 'https://prabhupadala01.app.n8n.cloud';
const SECRET = (import.meta.env.VITE_TK_WEBHOOK_SECRET as string | undefined) ?? '';

interface UsePortfolioResult {
    data: PortfolioPayload | null;
    loading: boolean;
    error: string | null;
    availableBrokers: BrokerRef[];
    refetch: () => Promise<void>;
    syncNow: () => Promise<void>;
    syncing: boolean;
    syncCooldown: number;
    syncMessage: string | null;
}

export function usePortfolio(userId: string | undefined, brokerId: string | undefined): UsePortfolioResult {
    const [data, setData] = useState<PortfolioPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [availableBrokers, setAvailableBrokers] = useState<BrokerRef[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncCooldown, setSyncCooldown] = useState(0);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const syncMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchPortfolio = useCallback(async (isInitial = false) => {
        if (!userId || !brokerId) {
            setData(null);
            setLoading(false);
            return;
        }

        if (isInitial) setLoading(true);

        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const res = await fetch(`${N8N}/webhook/portfolio-v2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(SECRET ? { 'X-TK-Secret': SECRET } : {}),
                },
                body: JSON.stringify({ user_id: userId, broker_id: brokerId }),
                signal: ctrl.signal,
            });

            const json = await res.json();

            if (json.success === false) {
                setError(json.error || 'Failed to load portfolio');
                if (json.availableBrokers) setAvailableBrokers(json.availableBrokers);
                setData(null);
            } else {
                setData(json as PortfolioPayload);
                setError(null);
                if (json.scope?.availableBrokers) setAvailableBrokers(json.scope.availableBrokers);
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    }, [userId, brokerId]);

    // Initial fetch + refetch on scope change
    useEffect(() => {
        fetchPortfolio(true);
    }, [fetchPortfolio]);

    // Polling: 60s if market open, 10min otherwise
    useEffect(() => {
        if (!userId || !brokerId) return;
        const intervalMs = data?.sync?.marketOpen ? 60_000 : 600_000;
        const id = setInterval(() => fetchPortfolio(false), intervalMs);
        return () => clearInterval(id);
    }, [userId, brokerId, data?.sync?.marketOpen, fetchPortfolio]);

    // Sync now
    const syncNow = useCallback(async () => {
        if (!userId || syncing || syncCooldown > 0) return;
        setSyncing(true);
        setSyncMessage(null);

        try {
            const res = await fetch(`${N8N}/webhook/broker-sync-now`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(SECRET ? { 'X-TK-Secret': SECRET } : {}),
                },
                body: JSON.stringify({ user_id: userId, broker_id: brokerId, force: true }),
            });
            const json = await res.json();

            if (json.success) {
                // Check if throttled
                const throttled = json.results?.find((r: any) => r.reason?.startsWith('throttled'));
                if (throttled) {
                    const match = throttled.reason.match(/(\d+)s/);
                    const secs = match ? match[1] : '?';
                    showSyncMessage(`Already fresh — synced ${secs}s ago`);
                } else {
                    showSyncMessage('Sync complete');
                    // Refetch data
                    await fetchPortfolio(false);
                }
            } else {
                showSyncMessage(json.error || 'Sync failed');
            }
        } catch (err: any) {
            showSyncMessage(err.message || 'Could not reach sync service');
        } finally {
            setSyncing(false);
            startCooldown();
        }
    }, [userId, brokerId, syncing, syncCooldown, fetchPortfolio]);

    const showSyncMessage = (msg: string) => {
        setSyncMessage(msg);
        if (syncMsgTimerRef.current) clearTimeout(syncMsgTimerRef.current);
        syncMsgTimerRef.current = setTimeout(() => setSyncMessage(null), 5000);
    };

    const startCooldown = () => {
        setSyncCooldown(30);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setSyncCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    return { data, loading, error, availableBrokers, refetch: () => fetchPortfolio(true), syncNow, syncing, syncCooldown, syncMessage };
}
