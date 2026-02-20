import { useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

interface ScanProgress {
    status: ScanStatus;
    updated: number;      // how many symbols refreshed so far
    total: number;         // total symbols being tracked
    message: string;
    errorMsg?: string;
}

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 120000; // 2 minutes
const DONE_DISPLAY_MS = 2500;

// Strategy-specific webhook URLs and table names
const STRATEGY_SCAN_CONFIG: Record<string, { webhook: string; table: string }> = {
    day_trade: {
        webhook: 'https://prabhupadala01.app.n8n.cloud/webhook/scan-options-daytrade',
        table: 'day_trade',
    },
};

const DEFAULT_WEBHOOK = 'https://prabhupadala01.app.n8n.cloud/webhook/scan-options';
const DEFAULT_TABLE = 'option_signals';

export const useScanProgress = (userEmail?: string, strategyFilter?: string | null) => {
    const [progress, setProgress] = useState<ScanProgress>({
        status: 'idle',
        updated: 0,
        total: 0,
        message: '',
    });

    // Refs to manage polling lifecycle without stale closures
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanup = useCallback(() => {
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }, []);

    const startScan = useCallback(async (onComplete?: () => Promise<void>) => {
        // Prevent double-trigger
        if (progress.status === 'scanning') return;

        cleanup();

        // Determine which webhook + table to use based on strategy
        const config = strategyFilter ? STRATEGY_SCAN_CONFIG[strategyFilter] : null;
        const webhookUrl = config?.webhook || DEFAULT_WEBHOOK;
        const tableName = config?.table || DEFAULT_TABLE;

        // 1. Snapshot pre-scan timestamps per symbol
        let preTimestamps: Record<string, string> = {};
        try {
            const { data: currentSignals } = await supabase
                .from(tableName)
                .select('symbol, analyzed_at')
                .eq('is_latest', true);

            if (currentSignals) {
                currentSignals.forEach((s: any) => {
                    preTimestamps[s.symbol] = s.analyzed_at;
                });
            }
        } catch (err) {
            console.warn('Failed to snapshot pre-scan timestamps:', err);
        }

        const totalSymbols = Object.keys(preTimestamps).length || 1;

        setProgress({
            status: 'scanning',
            updated: 0,
            total: totalSymbols,
            message: `Scanning... 0/${totalSymbols} stocks updated`,
        });

        // 2. Call webhook (fire-and-forget, returns 202)
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggered_by: userEmail || 'manual' }),
            });
        } catch (err) {
            console.error('Scan webhook failed:', err);
            setProgress({
                status: 'error',
                updated: 0,
                total: totalSymbols,
                message: 'Scan failed',
                errorMsg: 'Could not reach scan service.',
            });
            // Auto-reset after 3s
            doneTimerRef.current = setTimeout(() => {
                setProgress({ status: 'idle', updated: 0, total: 0, message: '' });
            }, 3000);
            return;
        }

        // 3. Start polling Supabase
        const pollForUpdates = async () => {
            try {
                const { data: freshSignals } = await supabase
                    .from(tableName)
                    .select('symbol, analyzed_at')
                    .eq('is_latest', true);

                if (!freshSignals) return;

                let updatedCount = 0;
                freshSignals.forEach((s: any) => {
                    const priorTimestamp = preTimestamps[s.symbol];
                    // Count as updated if analyzed_at is newer OR if it's a newly added symbol
                    if (!priorTimestamp || s.analyzed_at > priorTimestamp) {
                        updatedCount++;
                    }
                });

                // Use the larger of pre-scan total or current total (handles new symbols)
                const currentTotal = Math.max(totalSymbols, freshSignals.length);

                setProgress(prev => ({
                    ...prev,
                    updated: updatedCount,
                    total: currentTotal,
                    message: `Scanning... ${updatedCount}/${currentTotal} stocks updated`,
                }));

                // All done?
                if (updatedCount >= currentTotal) {
                    finishScan(onComplete);
                }
            } catch (err) {
                console.warn('Poll error:', err);
            }
        };

        pollingRef.current = setInterval(pollForUpdates, POLL_INTERVAL_MS);

        // 4. Timeout safety net
        timeoutRef.current = setTimeout(() => {
            console.log('Scan timeout reached (2 min). Finishing scan.');
            finishScan(onComplete);
        }, TIMEOUT_MS);

    }, [progress.status, cleanup, userEmail, strategyFilter]);

    const finishScan = useCallback(async (onComplete?: () => Promise<void>) => {
        cleanup();

        // Final reload of signals from Supabase
        if (onComplete) {
            await onComplete();
        }

        setProgress(prev => ({
            ...prev,
            status: 'done',
            message: 'Updated!',
        }));

        // Reset to idle after short display
        doneTimerRef.current = setTimeout(() => {
            setProgress({ status: 'idle', updated: 0, total: 0, message: '' });
        }, DONE_DISPLAY_MS);
    }, [cleanup]);

    return { progress, startScan };
};
