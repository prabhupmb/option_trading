import { useState } from 'react';
import { supabase } from '../services/supabase';

export interface QuickTradeParams {
    symbol: string;
    optionType: 'CALL' | 'PUT';
    expiryType: '0dte' | 'weekly' | 'monthly';
    budget: number;
    orderMode: 'market' | 'limit';
    strikePreference: 'atm' | 'otm' | 'deep_otm';
    bracketOrder: boolean;
    tpPercent: number;
    slPercent: number;
    limitDiscount: number;
}

export interface QuickTradeOrder {
    orderId: string;
    symbol: string;
    contract: string;
    optionType: string;
    orderMode: string;
    strike: number;
    expiry: string;
    quantity: number;
    limitPrice: number;
    entryPrice: number;
    totalCost: number;
    takeProfit?: number;
    stopLoss?: number;
    isBracket: boolean;
    currentPrice: number;
    bid?: number;
    ask?: number;
    spreadPct?: number;
    distFromPrice?: number;
}

export interface QuickTradeResult {
    success: boolean;
    message: string;
    order?: QuickTradeOrder;
    topContracts?: any[];
    error?: string;
}

export function useQuickTrade() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<QuickTradeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const execute = async (params: QuickTradeParams) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // Get authenticated user
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                throw new Error('Authentication failed. Please sign in again.');
            }

            // Get active Schwab broker credentials
            const { data: broker, error: brokerError } = await supabase
                .from('broker_credentials')
                .select('id')
                .eq('user_id', user.id)
                .eq('broker_name', 'schwab')
                .eq('is_active', true)
                .single();

            if (brokerError || !broker) {
                throw new Error('No active Schwab broker found. Please connect your broker in Settings.');
            }

            // Call Quick Trade webhook
            const resp = await fetch(
                'https://prabhupadala01.app.n8n.cloud/webhook/quick-trade',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...params,
                        userId: user.id,
                        brokerId: broker.id,
                    }),
                }
            );

            const data: QuickTradeResult = await resp.json();

            if (!resp.ok || !data.success) {
                const errMsg = data.error || data.message || 'Trade submission failed';
                setError(errMsg);
                return;
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Unexpected error');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setResult(null);
        setError(null);
    };

    return { execute, loading, result, error, reset };
}
