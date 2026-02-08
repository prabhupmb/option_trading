
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SummaryCard from './components/SummaryCard';
import StockSignalCard from './components/StockSignalCard';
import Navigation from './components/Navigation';
import AnalysisModal from './components/AnalysisModal';
import { INITIAL_SIGNALS, SUMMARY_STATS } from './constants';
import { StockSignal } from './types';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const [signals, setSignals] = useState<StockSignal[]>(INITIAL_SIGNALS);
  const [selectedSignal, setSelectedSignal] = useState<StockSignal | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Simulation: Update a price every few seconds to show "Live" nature
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(s => {
        if (s.status === 'READY') {
          const delta = (Math.random() - 0.5) * 0.2;
          return { ...s, price: s.price + delta };
        }
        return s;
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleViewAnalysis = async (signal: StockSignal) => {
    setSelectedSignal(signal);
    if (signal.analysis) return; // Don't re-fetch if already present

    setIsAnalysisLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analyze the stock ${signal.symbol} (${signal.name}) which is currently at $${signal.price.toFixed(2)}. 
      Technical trends: 4H: ${signal.matrix['4H']}, 1H: ${signal.matrix['1H']}, 15M: ${signal.matrix['15M']}. 
      Provide a concise 3-sentence technical summary and a conviction rating.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const analysisText = response.text || "Unable to retrieve technical analysis at this time.";

      setSignals(prev => prev.map(s =>
        s.symbol === signal.symbol
          ? { ...s, analysis: analysisText, conviction: Math.floor(75 + Math.random() * 20), status: 'READY' }
          : s
      ));

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
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Summary Cards Row */}
          <section className="mb-8">
            <div className="grid grid-cols-4 gap-4">
              {SUMMARY_STATS.map((stat, idx) => (
                <SummaryCard key={stat.type} stat={stat} isPrimary={idx === 0} />
              ))}
              {/* Quick Stats Card */}
              <div className="glass-card rounded-xl p-4 flex flex-col gap-1 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Win Rate
                </span>
                <span className="text-2xl font-bold text-white tracking-tighter">
                  87.2%
                </span>
                <div className="flex items-center gap-1 text-green-400">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span className="text-xs font-semibold">+3.4%</span>
                </div>
              </div>
            </div>
          </section>

          {/* List Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-white tracking-tight">Market Signals</h2>
              <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Powered by Gemini AI</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-sm font-semibold text-slate-400 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                <span className="material-symbols-outlined text-lg">sort</span>
                Sort
              </button>
              <button className="text-sm font-semibold text-primary flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all">
                <span className="material-symbols-outlined text-lg">tune</span>
                Filter
              </button>
            </div>
          </div>

          {/* Signals Grid */}
          <section className="grid grid-cols-3 gap-6">
            {signals.map((signal) => (
              <StockSignalCard
                key={signal.symbol}
                signal={signal}
                onViewAnalysis={handleViewAnalysis}
              />
            ))}
          </section>

          <div className="py-8 text-center">
            <p className="text-xs text-slate-600 uppercase font-bold tracking-widest">End of signal stream</p>
          </div>
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
