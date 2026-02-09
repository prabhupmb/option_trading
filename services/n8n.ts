
export interface PortfolioData {
    stats: {
        totalEquity: number;
        dailyGainAmount: number;
        dailyGainPercent: number;
        realizedProfit: string;
        profitGrowth: number;
        openPositions: number;
        buyingPower: number;
    };
    trades: Array<{
        id: string;
        ticker: string;
        name: string;
        price: number;
        entryPrice: number;
        status: 'Strong Buy' | 'Neutral' | 'Weak Sell' | 'Strong Sell';
        gainAmount: number;
        gainPercent: number;
        progress: number;
        icon: string;
    }>;
    aiInsight?: {
        message: string;
        sentiment: 'bullish' | 'bearish' | 'neutral';
    };
}

interface RawN8nResponse {
    success: boolean;
    timestamp: string;
    account: {
        equity: number;
        buyingPower: number;
        cash: number;
        portfolioValue: number;
        dayPL: number;
        dayPLPercent: number;
        totalPL: number;
        totalPLPercent: number;
    };
    stats: {
        totalPositions: number;
        winnersCount: number;
        losersCount: number;
    };
    positions: Array<{
        symbol: string;
        underlyingTicker: string;
        isOption: boolean;
        optionType: string;
        side: string;
        qty: number;
        avgEntryPrice: number;
        currentPrice: number;
        marketValue: number;
        unrealizedPL: number;
        unrealizedPLPercent: number;
        dayPL: number;
        dayPLPercent: number;
    }>;
}

export const fetchPortfolioData = async (): Promise<PortfolioData | null> => {
    try {
        const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/portfolio-dashboard', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch portfolio data:', response.statusText);
            return null;
        }

        const text = await response.text();
        console.log('n8n Raw Response:', text);

        if (!text) {
            console.warn('n8n webhook returned empty response.');
            return null;
        }

        let rawData: RawN8nResponse;
        try {
            rawData = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse n8n response as JSON:', e);
            return null;
        }

        // Map Raw Data to App Interface
        const mappedData: PortfolioData = {
            stats: {
                totalEquity: rawData.account.equity,
                dailyGainAmount: rawData.account.dayPL,
                dailyGainPercent: parseFloat((rawData.account.dayPLPercent * 100).toFixed(2)), // Convert decimal to %
                realizedProfit: `${(rawData.account.totalPL / 1000).toFixed(1)}k`, // Approximation/Formatting
                profitGrowth: parseFloat(rawData.account.totalPLPercent.toFixed(2)),
                openPositions: rawData.stats.totalPositions,
                buyingPower: rawData.account.cash
            },
            trades: rawData.positions.map((pos, index) => ({
                id: `pos-${index}`,
                ticker: pos.underlyingTicker,
                name: pos.symbol, // Use symbol as name for full detail
                optionSymbol: pos.symbol, // Full option symbol for API calls
                price: pos.currentPrice,
                entryPrice: pos.avgEntryPrice,
                status: pos.unrealizedPL >= 0 ? 'Strong Buy' : 'Neutral', // Simple mapping based on PL
                gainAmount: pos.unrealizedPL,
                gainPercent: pos.unrealizedPLPercent,
                progress: Math.min(Math.abs(pos.unrealizedPLPercent), 100), // Visual progress
                icon: 'show_chart' // Default icon
            })),
            aiInsight: {
                message: "Market data synced successfully. Portfolio analysis active.",
                sentiment: "neutral"
            }
        };

        return mappedData;

    } catch (error) {
        console.error('Error fetching portfolio data from n8n:', error);
        return null;
    }
};
