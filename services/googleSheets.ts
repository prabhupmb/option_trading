// Google Sheets Data Service
// Fetches trading signals from the public Google Sheet and auto-refreshes
// RESILIENT: Keeps existing data if new fetch returns empty or fails

const SHEET_ID = '1Ncb-35Ro4wS3RFRA_lgTMZESZvz2uvoGTPPKYCSkhi0';
const SHEET_GID = '353803842';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

export interface SheetSignal {
    ticker: string;
    currentPrice: number;
    signal: string;
    optionType: string;
    tier: string;
    gatesPassed: string;
    tradingRecommendation: string;
    tradeReason: string;
    tradeDirection: string;
    g1_4H: string;
    g2_1H: string;
    g3_15m: string;
    g4_5m: string;
    g5_ADX: string;
    timestamp: string;
    adxValue: number;
    adxTrend: string;
}

// Parse CSV to JSON
function parseCSV(csv: string): SheetSignal[] {
    const lines = csv.trim().split('\n');

    // Check if we only have headers or empty content
    if (lines.length <= 1) {
        return []; // Only headers, no data
    }

    const headers = lines[0].split(',');

    // Validate that we have expected headers
    if (!headers.includes('ticker') || !headers.includes('currentPrice')) {
        console.warn('CSV does not contain expected headers');
        return [];
    }

    return lines.slice(1).map(line => {
        // Handle CSV parsing properly (commas in quoted strings)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj: any = {};
        headers.forEach((header, i) => {
            obj[header.trim()] = values[i] || '';
        });

        return {
            ticker: obj.ticker || '',
            currentPrice: parseFloat(obj.currentPrice) || 0,
            signal: obj.signal || '',
            optionType: obj.optionType || '',
            tier: obj.tier || '',
            gatesPassed: obj.gatesPassed || '',
            tradingRecommendation: obj.tradingRecommendation || '',
            tradeReason: obj.tradeReason || '',
            tradeDirection: obj.tradeDirection || '',
            g1_4H: obj.g1_4H || '',
            g2_1H: obj.g2_1H || '',
            g3_15m: obj.g3_15m || '',
            g4_5m: obj.g4_5m || '',
            g5_ADX: obj.g5_ADX || '',
            timestamp: obj.timestamp || '',
            adxValue: parseFloat(obj.adxValue) || 0,
            adxTrend: obj.adxTrend || '',
        } as SheetSignal;
    }).filter(signal => signal.ticker !== ''); // Filter out empty rows
}

// Extract trend status from gate string (e.g., "BULLISH@$56.01 ✓" -> "UP")
export function parseTrend(gateString: string): 'UP' | 'DOWN' | 'NEUTRAL' {
    if (gateString.includes('BULLISH') && gateString.includes('✓')) {
        return 'UP';
    }
    if (gateString.includes('BEARISH') && gateString.includes('✓')) {
        return 'DOWN';
    }
    if (gateString.includes('BULLISH') && gateString.includes('✗')) {
        return 'NEUTRAL';
    }
    if (gateString.includes('BEARISH') && gateString.includes('✗')) {
        return 'NEUTRAL';
    }
    return 'NEUTRAL';
}

// Get signal type for display
export function getSignalType(signal: string): 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'SELL' | 'WEAK_SELL' | 'NO_TRADE' {
    if (signal.includes('STRONG BUY')) return 'STRONG_BUY';
    if (signal.includes('✅ BUY')) return 'BUY';
    if (signal.includes('WEAK BUY')) return 'WEAK_BUY';
    if (signal.includes('✅ SELL')) return 'SELL';
    if (signal.includes('WEAK SELL')) return 'WEAK_SELL';
    return 'NO_TRADE';
}

// Get conviction percentage from gates passed (e.g., "4/5" -> 80)
export function getConviction(gatesPassed: string): number {
    const match = gatesPassed.match(/(\d+)\/(\d+)/);
    if (match) {
        const [, passed, total] = match;
        return Math.round((parseInt(passed) / parseInt(total)) * 100);
    }
    return 50;
}

// Fetch data from Google Sheets
export async function fetchSheetData(): Promise<SheetSignal[]> {
    try {
        const response = await fetch(`${CSV_URL}&t=${Date.now()}&r=${Math.random()}`, {
            cache: 'no-store', // Always get fresh data
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch sheet: ${response.status}`);
        }

        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Error fetching Google Sheet:', error);
        throw error;
    }
}

// Import React for the hook
import React from 'react';

// Auto-refresh hook with RESILIENT data handling
// - Keeps existing data if new fetch fails
// - Keeps existing data if new data is empty
// - Only updates when valid new data is received
export function useSheetData(refreshIntervalMs: number = 30000) {
    const [data, setData] = React.useState<SheetSignal[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
    const [warning, setWarning] = React.useState<string | null>(null);
    const isFirstLoad = React.useRef(true);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        setWarning(null);

        try {
            const newSignals = await fetchSheetData();

            // Check if we received valid data
            if (newSignals.length === 0) {
                // Sheet is empty or has no valid data
                if (isFirstLoad.current) {
                    // First load - show error since we have no cached data
                    setError('No data found in the spreadsheet');
                    setWarning('The Google Sheet appears to be empty. Please check if data is present.');
                } else {
                    // Subsequent refresh - keep existing data and show warning
                    setWarning('Sheet returned empty data. Keeping previous data.');
                    console.warn('Google Sheet returned empty data, keeping existing data');
                }
                // Don't update data - keep existing
            } else {
                // Valid data received - update everything
                setData(newSignals);
                setLastUpdated(new Date());
                setError(null);
                setWarning(null);
                isFirstLoad.current = false;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';

            if (isFirstLoad.current) {
                // First load failed - show error
                setError(errorMessage);
            } else {
                // Subsequent refresh failed - keep existing data and show warning
                setWarning(`Refresh failed: ${errorMessage}. Showing cached data.`);
                console.warn('Failed to refresh data, keeping existing data:', err);
            }
            // Don't update data - keep existing
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        refresh();
        const interval = setInterval(refresh, refreshIntervalMs);
        return () => clearInterval(interval);
    }, [refresh, refreshIntervalMs]);

    return { data, loading, error, warning, lastUpdated, refresh };
}
