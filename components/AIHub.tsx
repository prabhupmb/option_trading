import React, { useState, useEffect, useCallback } from 'react';

// --- Types ---
interface StockData {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    logo: string;
}

interface StrategyPlan {
    stock: {
        entry: string;
        target: string;
        stopLoss: string;
        horizon: string;
        riskReward: string;
    };
    options: {
        strategy: string;
        strike: string;
        expiry: string;
        maxRisk: string;
    };
    reasons: string[];
    catalysts: {
        type: string;
        time: string;
        desc: string;
    }[];
    conviction: number;
    sentimentDetails: string[];
    analystRating: number;
    movingAverages: {
        ema20: string;
        sma50: string;
        sma200: string;
    };
}

interface NewsItem {
    time: string;
    source: string;
    title: string;
}

// --- Services ---

// Fetch data from n8n webhook
const fetchAIInsights = async (ticker: string) => {
    try {
        const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/stock-insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticker: ticker.toUpperCase() })
        });

        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`);
        }

        const text = await response.text();
        console.log("Raw Webhook Response:", text);

        if (!text) {
            throw new Error("Webhook returned empty response");
        }

        try {
            const data = JSON.parse(text);
            return data;
        } catch (e) {
            throw new Error(`Failed to parse webhook JSON: ${text.substring(0, 100)}...`);
        }
    } catch (error) {
        console.error("Failed to fetch AI insights:", error);
        throw error;
    }
};

// --- Components ---

const StockHeader: React.FC<{ data: StockData }> = ({ data }) => {
    const isPositive = data.change >= 0;

    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-white/10 overflow-hidden p-2">
                    <img
                        alt={`${data.name} Logo`}
                        className="w-full h-full object-contain"
                        src={data.logo}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${data.ticker}&background=333&color=fff` }}
                    />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight text-white">{data.name}</h1>
                        <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs font-mono uppercase">{data.ticker}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                        <span className="text-4xl font-mono font-bold text-white">${data.price.toFixed(2)}</span>
                        <div className={`flex items-center font-medium ${isPositive ? 'text-rh-green' : 'text-red-500'}`}>
                            <span className="material-symbols-outlined text-sm">{isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
                            <span>{isPositive ? '+' : ''}{data.changePercent.toFixed(2)}% (${isPositive ? '+' : ''}{data.change.toFixed(2)})</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                <button className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-800 transition-colors text-white">
                    <span className="material-symbols-outlined text-sm">notifications</span> Alert
                </button>
                <button className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-800 transition-colors text-white">
                    <span className="material-symbols-outlined text-sm">bookmark</span> Watchlist
                </button>
            </div>
        </div>
    );
};

const DEFAULT_STOCK: StockData = {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    price: 235.42,
    change: 2.61,
    changePercent: 1.12,
    logo: 'https://logo.clearbit.com/apple.com',
};

const AIHub: React.FC = () => {
    const [tickerInput, setTickerInput] = useState('AAPL');
    const [currentStock, setCurrentStock] = useState<StockData>(DEFAULT_STOCK);
    const [strategy, setStrategy] = useState<StrategyPlan | null>(null);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Strategic Plan');

    const fetchData = useCallback(async (ticker: string) => {
        setLoading(true);
        try {
            // Call webhook
            const data = await fetchAIInsights(ticker);

            console.log("Parsed Webhook Data:", data);

            // Map Webhook Response to Component State
            if (data) {
                const strat: StrategyPlan = {
                    stock: {
                        entry: data.stockPlan?.entryStrategy || "Wait for setup",
                        target: data.stockPlan?.target?.price?.toString() || "N/A",
                        stopLoss: data.stockPlan?.stopLoss?.price?.toString() || "N/A",
                        horizon: data.stockPlan?.timeHorizon || "1-4 Weeks",
                        riskReward: data.stockPlan?.riskReward?.toString() || "N/A"
                    },
                    options: {
                        strategy: data.optionsPlan?.action?.replace(/_/g, ' ') || "N/A",
                        strike: data.optionsPlan?.idealStrike || "N/A",
                        expiry: data.optionsPlan?.idealExpiry || "N/A",
                        maxRisk: data.optionsPlan?.maxRisk || "N/A"
                    },
                    reasons: data.recommendation?.reasons || [],
                    catalysts: (data.catalysts || []).map((cat: string) => ({
                        type: "Catalyst",
                        time: "Upcoming",
                        desc: cat
                    })),
                    conviction: data.recommendation?.confidence || 50,
                    sentimentDetails: [
                        `RSI: ${data.indicatorAnalysis?.rsiInterpretation || 'Neutral'}`,
                        `MACD: ${data.indicatorAnalysis?.macdInterpretation || 'Neutral'}`,
                        `Trend: ${data.indicatorAnalysis?.trendStrength || 'Neutral'}`
                    ],
                    analystRating: 4.2, // Default or fetch if available
                    movingAverages: {
                        ema20: data.technicalData?.indicators?.sma20?.toFixed(2) || "N/A", // Using SMA20 as proxy if EMA20 missing
                        sma50: data.technicalData?.indicators?.sma50?.toFixed(2) || "N/A",
                        sma200: "N/A" // Not in sample data
                    }
                };
                setStrategy(strat);

                if (data.recentNews) {
                    const mappedNews: NewsItem[] = data.recentNews.map((n: any) => ({
                        time: new Date(n.datetime).toLocaleDateString(),
                        source: n.source,
                        title: n.headline
                    }));
                    setNews(mappedNews);
                }

                setCurrentStock(prev => ({
                    ...prev,
                    ticker: data.ticker || ticker.toUpperCase(),
                    name: data.companyName || prev.name,
                    price: data.price?.current || prev.price,
                    change: (data.price?.current - data.price?.previousClose) || 0,
                    changePercent: data.price?.changePercent || 0,
                    logo: `https://logo.clearbit.com/${data.ticker?.toLowerCase()}.com`
                }));
            }
        } catch (err) {
            console.error("Failed to fetch AI data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData('AAPL');
    }, [fetchData]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (tickerInput.trim()) {
            fetchData(tickerInput.trim());
        }
    };

    const tabs = ['Strategic Plan', 'Technical Analysis'];

    return (
        <div className="flex-1 flex flex-col h-full bg-[#0a0712] overflow-hidden">
            {/* Search Header */}
            <header className="h-16 flex items-center px-8 border-b border-white/10 sticky top-0 z-10 bg-black/80 backdrop-blur-md">
                <form onSubmit={handleSearch} className="relative w-full max-w-xl">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                    <input
                        className="w-full bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 focus:ring-1 focus:ring-rh-green text-sm transition-all outline-none text-white placeholder-slate-500"
                        placeholder="Search tickers (e.g. NVDA, MSFT)..."
                        type="text"
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value)}
                    />
                </form>
                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rh-green/10 text-rh-green rounded-full border border-rh-green/20 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rh-green animate-pulse"></span>
                        LIVE MARKET
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <div className="space-y-8 max-w-7xl mx-auto">
                    <StockHeader data={currentStock} />

                    <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap border-b-2 ${activeTab === tab ? 'text-rh-green border-rh-green' : 'text-slate-500 hover:text-slate-200 border-transparent'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-12 h-12 border-4 border-rh-green border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-medium animate-pulse">AI is analyzing {currentStock.ticker} market dynamics...</p>
                        </div>
                    ) : strategy && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Stock Strategy Card */}
                                    <div className="bg-[#1e2124] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-rh-green/30 transition-all">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h2 className="text-lg font-bold text-white mb-1">Stock Strategy Plan</h2>
                                                <span className="text-xs text-slate-500 font-mono">EQUITY FOCUS</span>
                                            </div>
                                            <div className="px-4 py-1.5 bg-rh-green/20 text-rh-green rounded-full text-sm font-black italic tracking-widest uppercase border border-rh-green/30">BUY</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-8 mb-8">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Entry Price</p>
                                                <p className="text-sm font-medium text-white leading-relaxed">{strategy.stock.entry}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Profit Target</p>
                                                <p className="text-2xl font-mono font-bold text-rh-green">{strategy.stock.target}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Stop Loss</p>
                                                <p className="text-2xl font-mono font-bold text-red-500">{strategy.stock.stopLoss}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Time Horizon</p>
                                                <p className="text-lg font-bold text-white">{strategy.stock.horizon}</p>
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-400">Risk/Reward Ratio</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-mono font-bold text-white">{strategy.stock.riskReward}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Option Strategy Card */}
                                    <div className="bg-[#1e2124] border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h2 className="text-lg font-bold text-white mb-1">Options Strategy Plan</h2>
                                                <span className="text-xs text-slate-500 font-mono">DERIVATIVES FOCUS</span>
                                            </div>
                                            <div className="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black italic tracking-widest uppercase border border-blue-500/30">BUY_CALL</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-8 mb-8">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Strategy</p>
                                                <p className="text-lg text-white capitalize">{strategy.options.strategy.toLowerCase()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Ideal Strike</p>
                                                <p className="text-sm font-bold text-rh-green leading-relaxed">{strategy.options.strike}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Ideal Expiry</p>
                                                <p className="text-sm font-bold text-white">{strategy.options.expiry}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Max Risk</p>
                                                <p className="text-sm font-medium text-red-400 leading-relaxed">{strategy.options.maxRisk}</p>
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-400">Greeks Profile</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-bold text-slate-500 bg-zinc-800 px-2 py-1 rounded">MODERATE THETA</span>
                                                <div className="flex gap-1">
                                                    <div className="w-8 h-1 bg-rh-green rounded-full"></div>
                                                    <div className="w-8 h-1 bg-rh-green/50 rounded-full"></div>
                                                    <div className="w-8 h-1 bg-zinc-700 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-[#1e2124] rounded-2xl p-6 border border-white/10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-rh-green">lightbulb</span>
                                            <h3 className="font-bold text-white">Strategy Reasons</h3>
                                        </div>
                                        <ul className="space-y-4">
                                            {strategy.reasons.map((reason, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rh-green flex-shrink-0"></div>
                                                    <p className="text-sm text-slate-400">{reason}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="bg-[#1e2124] rounded-2xl p-6 border border-white/10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-orange-400">bolt</span>
                                            <h3 className="font-bold text-white">Key Catalysts</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {strategy.catalysts.map((cat, idx) => (
                                                <div key={idx} className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-white uppercase tracking-tight">{cat.type}</span>
                                                        <span className="text-[10px] text-slate-500">{cat.time}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400">{cat.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-4 space-y-6">
                                {/* AI Conviction Details */}
                                <div className="bg-[#1e2124] rounded-2xl border border-rh-green/20 p-6 relative overflow-hidden">
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="material-symbols-outlined text-rh-green">auto_awesome</span>
                                        <h3 className="font-bold text-white">AI Conviction Details</h3>
                                    </div>
                                    <div className="flex items-end justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-500">Signal Strength</span>
                                        <span className="text-2xl font-mono font-bold text-rh-green">{strategy.conviction}%</span>
                                    </div>
                                    <div className="h-2 bg-zinc-900 rounded-full mb-6">
                                        <div className="h-full bg-rh-green rounded-full shadow-[0_0_10px_rgba(0,255,100,0.5)]" style={{ width: `${strategy.conviction}%` }}></div>
                                    </div>
                                    <div className="space-y-4">
                                        {strategy.sentimentDetails.map((detail, idx) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <span className="material-symbols-outlined text-rh-green text-sm mt-0.5">check_circle</span>
                                                <p className="text-xs text-slate-400 leading-relaxed font-medium">{detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Analyst Ratings */}
                                <div className="bg-[#1e2124] rounded-2xl border border-white/10 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-white">Analyst Ratings</h3>
                                    </div>
                                    <div className="flex items-center gap-6 mb-6">
                                        <div className="w-16 h-16 rounded-full border-4 border-rh-green flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl font-bold text-white">{strategy.analystRating || 4.2}</span>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white">Strong Buy</h4>
                                            <p className="text-xs text-slate-500">Based on 32 analysts</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium text-slate-400 w-8">Buy</span>
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-rh-green w-[75%]"></div>
                                            </div>
                                            <span className="text-xs font-mono text-slate-500 w-4 text-right">24</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium text-slate-400 w-8">Hold</span>
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-slate-600 w-[20%]"></div>
                                            </div>
                                            <span className="text-xs font-mono text-slate-500 w-4 text-right">6</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium text-slate-400 w-8">Sell</span>
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 w-[5%]"></div>
                                            </div>
                                            <span className="text-xs font-mono text-slate-500 w-4 text-right">2</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent News */}
                                <div className="bg-[#1e2124] rounded-2xl border border-white/10 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-white">Recent News</h3>
                                        <button className="text-[10px] font-bold text-rh-green uppercase hover:underline">View All</button>
                                    </div>
                                    <div className="space-y-5">
                                        {news.map((item, idx) => (
                                            <div key={idx} className="group cursor-pointer">
                                                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest">{item.time} • {item.source}</p>
                                                <h4 className="text-sm font-semibold text-slate-300 group-hover:text-rh-green transition-colors line-clamp-2">{item.title}</h4>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="h-32"></div>
                </div>
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-8 flex items-center gap-4 z-[100]">
                <button className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl transition-all active:scale-95 flex items-center gap-2">
                    <span className="material-symbols-outlined">trending_down</span> EXECUTE PUT
                </button>
                <button className="bg-rh-green hover:bg-green-600 text-black px-8 py-4 rounded-2xl font-black shadow-2xl transition-all active:scale-95 flex items-center gap-2">
                    <span className="material-symbols-outlined">trending_up</span> EXECUTE CALL
                </button>
            </div>
        </div>
    );
};

export default AIHub;
