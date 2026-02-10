import React, { useState } from 'react';
import Header from './components/Header';
import SummaryCard from './components/SummaryCard';
import StockSignalCard from './components/StockSignalCard';
import Navigation, { View } from './components/Navigation';
import AnalysisModal from './components/AnalysisModal';
import ExecuteCallModal from './components/ExecuteCallModal';
import Portfolio from './components/Portfolio';
import LoginPage from './components/LoginPage';
import { StockSignal, SignalType, SummaryStat } from './types';
import {
  useSheetData,
  SheetSignal,
  parseTrend,
  getConviction
} from './services/googleSheets';
import { useAuth } from './services/useAuth';
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
  let strongSellCount = 0;
  let weakCount = 0;

  signals.forEach(signal => {
    const signalStr = signal.signal || '';
    if (signalStr.includes('STRONG BUY')) strongBuyCount++;
    else if (signalStr.includes('STRONG SELL')) strongSellCount++;
    else if (signalStr.includes('✅ BUY')) buyCount++;
    else if (signalStr.includes('✅ SELL') || signalStr.includes('WEAK SELL')) sellCount++;
    else if (signalStr.includes('WEAK BUY')) weakCount++;
  });

  return [
    { type: SignalType.STRONG_BUY, count: strongBuyCount, change: 15 },
    { type: SignalType.BUY, count: buyCount + weakCount, change: 8 },
    { type: SignalType.STRONG_SELL, count: strongSellCount, change: -12 },
    { type: SignalType.SELL, count: sellCount, change: -2 },
  ];
}

const App: React.FC = () => {
  const { user, loading: authLoading, isAuthenticated, signInWithGoogle, signOut } = useAuth();
  const { data: sheetData, loading, error, warning, lastUpdated, refresh } = useSheetData(900000); // Refresh every 15 minutes
  const [selectedSignal, setSelectedSignal] = useState<StockSignal | null>(null);
  const [executeSignal, setExecuteSignal] = useState<StockSignal | null>(null);
  const [filter, setFilter] = useState<SignalType | 'ALL'>('ALL');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('signals');
  const [isScanning, setIsScanning] = useState(false);

  // Show loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30 inline-block mb-4">
            <span className="material-symbols-outlined text-white text-4xl animate-spin">insights</span>
          </div>
          <p className="text-slate-400 font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onGoogleLogin={signInWithGoogle} />;
  }

  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh clicked - calling scan webhook...');
    setIsScanning(true);
    try {
      const webhookUrl = 'https://prabhupadala01.app.n8n.cloud/webhook/scan-stock';
      console.log('🚀 Calling webhook:', webhookUrl);

      // Trigger n8n webhook to scan stocks (no-cors to avoid CORS blocking)
      await fetch(webhookUrl, {
        method: 'GET',
        mode: 'no-cors',
      });

      console.log('✅ Webhook triggered successfully (scan-stock)');

      // Refresh the sheet data to get latest results
      console.log('📊 Refreshing sheet data...');
      await refresh();
    } catch (error) {
      console.error('❌ Webhook call failed:', error);
      // Still try to refresh data even if webhook fails
      await refresh();
    } finally {
      setIsScanning(false);
      console.log('🏁 Refresh complete');
    }
  };

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
    if (filter === SignalType.STRONG_SELL) return signalStr.includes('STRONG SELL');
    // Explicitly exclude STRONG signals to prevent overlap
    if (filter === SignalType.BUY) return (signalStr.includes('✅ BUY') || signalStr.includes('WEAK BUY')) && !signalStr.includes('STRONG BUY');
    if (filter === SignalType.SELL) return (signalStr.includes('✅ SELL') || signalStr.includes('WEAK SELL')) && !signalStr.includes('STRONG SELL');

    return true;
  });

  const handleViewAnalysis = async (signal: StockSignal) => {
    setSelectedSignal(signal);
    if (signal.analysis) return;

    setIsAnalysisLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_API_KEY || '' });
      const prompt = `Analyze the stock ${signal.symbol} which is currently at $${signal.price.toFixed(2)}. 
      Technical trends: 4H: ${signal.matrix['4H']}, 1H: ${signal.matrix['1H']}, 15M: ${signal.matrix['15M']}. 
      ADX: ${signal.adxValue} (${signal.adxTrend}).
      Signal: ${signal.signal}, Tier: ${signal.tier}, Gates Passed: ${signal.gatesPassed}.
      Provide a concise 3-sentence technical summary and a conviction rating.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
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

  const handleExecute = (signal: StockSignal) => {
    setExecuteSignal(signal);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0712] transition-colors font-sans text-slate-900 dark:text-white">
      {/* Sidebar */}
      <Navigation activeView={currentView} onNavigate={setCurrentView} user={user} onSignOut={signOut} />

      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header lastUpdated={lastUpdated} onRefresh={refresh} loading={loading} user={user} onSignOut={signOut} />

        {currentView === 'signals' ? (
          <main className="flex-1 p-8 overflow-y-auto">
            {/* Loading State */}
            {loading && signals.length === 0 && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl text-rh-green animate-spin-slow">refresh</span>
                  <p className="text-slate-400 mt-4 font-medium animate-pulse">Syncing Market Data...</p>
                </div>
              </div>
            )}

            {warning && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-orange-500 text-xl">warning</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">Using Cached Data</p>
                  <p className="text-xs text-orange-600/70 dark:text-orange-400/70">{warning}</p>
                </div>
                <button onClick={refresh} className="text-xs font-bold text-orange-500 hover:text-orange-600 uppercase tracking-wide">Retry</button>
              </div>
            )}

            {error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">Connection Failed</p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">{error}</p>
                </div>
                <button onClick={refresh} className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wide">Retry</button>
              </div>
            )}

            {(!loading || signals.length > 0) && (
              <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryStats.map((stat) => (
                  <div key={stat.type} onClick={() => setFilter(filter === stat.type ? 'ALL' : stat.type)} className="cursor-pointer active:scale-[0.98] transition-transform">
                    <SummaryCard stat={stat} isPrimary={filter === stat.type} />
                  </div>
                ))}
                {/* Total Signals Card */}
                <div
                  onClick={() => setFilter('ALL')}
                  className={`bg-white dark:bg-[#1e2124] border border-gray-100 dark:border-white/5 shadow-sm rounded-xl p-4 flex flex-col justify-between hover:border-rh-green/30 transition-all cursor-pointer group ${filter === 'ALL' ? 'ring-1 ring-rh-green border-rh-green bg-rh-green/5' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-rh-green transition-colors">
                      Total Signals
                    </span>
                    <div className="flex items-center gap-1 text-rh-green bg-rh-green/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rh-green animate-pulse"></span>
                      LIVE
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter block">
                      {signals.length}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Active Opportunities</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Market Feed
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md align-middle">{actionableSignals.length} Active</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Real-time data stream'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white dark:bg-[#1e2124] rounded-lg border border-gray-200 dark:border-white/5 p-1">
                  <button
                    onClick={() => setFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${filter === 'ALL' ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter(SignalType.STRONG_BUY)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${filter === SignalType.STRONG_BUY ? 'bg-rh-green text-white shadow-lg shadow-rh-green/20' : 'text-slate-400 hover:text-rh-green'}`}
                  >
                    Strong Buy
                  </button>
                  <button
                    onClick={() => setFilter(SignalType.STRONG_SELL)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${filter === SignalType.STRONG_SELL ? 'bg-rh-red text-white shadow-lg shadow-rh-red/20' : 'text-slate-400 hover:text-rh-red'}`}
                  >
                    Strong Sell
                  </button>
                  <button
                    onClick={() => setFilter(SignalType.SELL)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${filter === SignalType.SELL ? 'bg-rh-red text-white shadow-lg shadow-rh-red/20' : 'text-slate-400 hover:text-rh-red'}`}
                  >
                    Sell
                  </button>
                </div>
                <button
                  onClick={handleManualRefresh}
                  className="bg-white dark:bg-[#1e2124] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg border border-gray-200 dark:border-white/5 transition-all active:scale-95"
                  title="Scan & Refresh"
                >
                  <span className={`material-symbols-outlined text-xl ${loading || isScanning ? 'animate-spin' : ''}`}>refresh</span>
                </button>
              </div>
            </div>

            {/* Signals Grid - Desktop Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {actionableSignals.map((signal, index) => (
                <div key={`${signal.symbol}-${index}`} className="hover:z-10 relative">
                  <StockSignalCard
                    signal={signal}
                    onViewAnalysis={handleViewAnalysis}
                    onExecute={handleExecute}
                  />
                </div>
              ))}
            </div>

            {actionableSignals.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-white/10 mb-4">filter_list_off</span>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No signals match your filter</p>
                <button onClick={() => setFilter('ALL')} className="mt-4 text-rh-green font-bold text-xs uppercase hover:underline">Clear Filters</button>
              </div>
            )}

            <div className="mt-12 text-center border-t border-gray-100 dark:border-white/5 pt-8">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest opacity-60">
                Signal Feed AI • v2.0.4 • Connected to Google Sheets
              </p>
            </div>
          </main>
        ) : currentView === 'portfolio' ? (
          <div className="flex-1 overflow-y-auto">
            <Portfolio />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl opacity-40">construction</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Coming Soon</h3>
            <p className="max-w-xs text-center text-sm font-medium opacity-70">This module is currently under development.</p>
          </div>
        )}
      </div>

      <AnalysisModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        loading={isAnalysisLoading}
      />

      {executeSignal && (
        <ExecuteCallModal
          signal={executeSignal}
          onClose={() => setExecuteSignal(null)}
          onSuccess={() => setCurrentView('portfolio')}
        />
      )}
    </div>
  );
};

export default App;
