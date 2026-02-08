
import React, { useState } from 'react';
import Header from './components/Header';
import SummaryCard from './components/SummaryCard';
import StockSignalCard from './components/StockSignalCard';
import Navigation from './components/Navigation';
import AnalysisModal from './components/AnalysisModal';
import { StockSignal, SignalType, SummaryStat } from './types';
import {
  useSheetData,
  SheetSignal,
  parseTrend,
  getSignalType,
  getConviction
} from './services/googleSheets';
import { GoogleGenAI } from '@google/genai';

// Stock icon mapping
const STOCK_ICONS: Record<string, string> = {
  TSLA: 'electric_car',
  NVDA: 'memory',
  AAPL: 'phone_iphone',
  AMD: 'developer_board',
  GOOGL: 'search',
  META: 'groups',
  MSFT: 'window',
  AMZN: 'shopping_cart',
  SPY: 'trending_up',
  QQQ: 'analytics',
  DEFAULT: 'show_chart'
};

// Convert sheet data to StockSignal format
function convertToStockSignal(sheetSignal: SheetSignal): StockSignal {
  return {
    symbol: sheetSignal.ticker,
    name: sheetSignal.ticker, // Using ticker as name since full name not in sheet
    price: sheetSignal.currentPrice,
    changePercent: 0, // No change percent in sheet, will be calculated
    conviction: getConviction(sheetSignal.gatesPassed),
    status: 'READY',
    matrix: {
      '4H': parseTrend(sheetSignal.g1_4H),
      '1H': parseTrend(sheetSignal.g2_1H),
      '15M': parseTrend(sheetSignal.g3_15m),
    },
    icon: STOCK_ICONS[sheetSignal.ticker] || STOCK_ICONS.DEFAULT,
    signal: sheetSignal.signal,
    optionType: sheetSignal.optionType,
    tier: sheetSignal.tier,
    gatesPassed: sheetSignal.gatesPassed,
    tradingRecommendation: sheetSignal.tradingRecommendation,
    tradeReason: sheetSignal.tradeReason,
    adxValue: sheetSignal.adxValue,
    adxTrend: sheetSignal.adxTrend,
    timestamp: sheetSignal.timestamp,
  };
}

// Calculate summary stats from signals
function calculateSummaryStats(signals: StockSignal[]): SummaryStat[] {
  let strongBuyCount = 0;
  let buyCount = 0;
  let sellCount = 0;
  let weakCount = 0;

  signals.forEach(signal => {
    const signalStr = signal.signal || '';
    if (signalStr.includes('STRONG BUY')) strongBuyCount++;
    else if (signalStr.includes('✅ BUY')) buyCount++;
    else if (signalStr.includes('✅ SELL') || signalStr.includes('WEAK SELL')) sellCount++;
    else if (signalStr.includes('WEAK BUY')) weakCount++;
  });

  return [
    { type: SignalType.STRONG_BUY, count: strongBuyCount, change: 15 },
    { type: SignalType.BUY, count: buyCount + weakCount, change: 8 },
    { type: SignalType.SELL, count: sellCount, change: -2 },
  ];
}

const App: React.FC = () => {
  const { data: sheetData, loading, error, warning, lastUpdated, refresh } = useSheetData(900000); // Refresh every 15 minutes
  const [selectedSignal, setSelectedSignal] = useState<StockSignal | null>(null);
  const [filter, setFilter] = useState<SignalType | 'ALL'>('ALL');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Convert sheet data to app format
  const signals: StockSignal[] = sheetData.map(convertToStockSignal);
  const summaryStats = calculateSummaryStats(signals);

  // Filter signals that have actionable recommendations AND match the selected filter
  const actionableSignals = signals.filter(s => {
    // First check if it's actionable
    if (!s.tradingRecommendation || s.tradingRecommendation.includes('NO TRADE')) return false;

    // Then check if it matches filter
    if (filter === 'ALL') return true;

    const signalStr = s.signal || '';
    if (filter === SignalType.STRONG_BUY) return signalStr.includes('STRONG BUY');
    if (filter === SignalType.BUY) return signalStr.includes('✅ BUY') || signalStr.includes('WEAK BUY');
    if (filter === SignalType.SELL) return signalStr.includes('✅ SELL') || signalStr.includes('WEAK SELL');

    return true;
  });

  const handleViewAnalysis = async (signal: StockSignal) => {
    setSelectedSignal(signal);
    if (signal.analysis) return;

    setIsAnalysisLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analyze the stock ${signal.symbol} which is currently at $${signal.price.toFixed(2)}. 
      Technical trends: 4H: ${signal.matrix['4H']}, 1H: ${signal.matrix['1H']}, 15M: ${signal.matrix['15M']}. 
      ADX: ${signal.adxValue} (${signal.adxTrend}).
      Signal: ${signal.signal}, Tier: ${signal.tier}, Gates Passed: ${signal.gatesPassed}.
      Provide a concise 3-sentence technical summary and a conviction rating.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const analysisText = response.text || "Unable to retrieve technical analysis at this time.";
      setSelectedSignal(prev => prev ? { ...prev, analysis: analysisText } : null);
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar */}
      <Navigation />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col">
        <Header lastUpdated={lastUpdated} onRefresh={refresh} loading={loading} />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Loading State */}
          {loading && signals.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-primary animate-spin-slow">refresh</span>
                <p className="text-slate-400 mt-4">Loading signals from Google Sheets...</p>
              </div>
            </div>
          )}

          {/* Warning State (Cached Data) */}
          {warning && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6 animate-in">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-orange-400">warning</span>
                <div>
                  <p className="text-orange-400 font-semibold">Using Cached Data</p>
                  <p className="text-orange-400/70 text-sm">{warning}</p>
                </div>
                <button
                  onClick={refresh}
                  className="ml-auto px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors"
                >
                  Retry Sync
                </button>
              </div>
            </div>
          )}

          {/* Error State (No Data) */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-red-400">error</span>
                <div>
                  <p className="text-red-400 font-semibold">Failed to load data</p>
                  <p className="text-red-400/70 text-sm">{error}</p>
                </div>
                <button
                  onClick={refresh}
                  className="ml-auto px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Summary Cards Row */}
          {(!loading || signals.length > 0) && (
            <section className="mb-8">
              <div className="grid grid-cols-4 gap-4">
                {summaryStats.map((stat, idx) => (
                  <div key={stat.type} onClick={() => setFilter(filter === stat.type ? 'ALL' : stat.type)} className="cursor-pointer transition-transform active:scale-95">
                    <SummaryCard stat={stat} isPrimary={filter === stat.type} />
                  </div>
                ))}
                {/* Total Signals Card */}
                <div
                  onClick={() => setFilter('ALL')}
                  className={`glass-card rounded-xl p-4 flex flex-col gap-1 border border-white/5 cursor-pointer transition-transform active:scale-95 ${filter === 'ALL' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Signals
                  </span>
                  <span className="text-2xl font-bold text-white tracking-tighter">
                    {signals.length}
                  </span>
                  <div className="flex items-center gap-1 text-primary">
                    <span className="material-symbols-outlined text-sm">sync</span>
                    <span className="text-xs font-semibold">Live</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* List Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-white tracking-tight">Market Signals</h2>
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Powered by Google Sheets'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                className="text-sm font-semibold text-slate-400 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:text-white transition-all"
              >
                <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
              <button className="text-sm font-semibold text-slate-400 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                <span className="material-symbols-outlined text-lg">sort</span>
                Sort
              </button>
              <button
                onClick={() => setFilter('ALL')}
                className={`text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${filter !== 'ALL' ? 'text-primary bg-primary/10 border-primary/20' : 'text-slate-400 bg-white/5 border-white/10'}`}
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                {filter === 'ALL' ? 'Filter' : 'Clear Filter'}
              </button>
            </div>
          </div>

          {/* Signals Grid */}
          <section className="grid grid-cols-3 gap-6">
            {actionableSignals.map((signal) => (
              <StockSignalCard
                key={signal.symbol}
                signal={signal}
                onViewAnalysis={handleViewAnalysis}
              />
            ))}
          </section>

          {actionableSignals.length > 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-600 uppercase font-bold tracking-widest">
                Showing {actionableSignals.length} actionable signals • {signals.length - actionableSignals.length} filtered out
              </p>
            </div>
          )}
        </main>
      </div>

      <AnalysisModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        loading={isAnalysisLoading}
      />
    </div>
  );
};

export default App;
