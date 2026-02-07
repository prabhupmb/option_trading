
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
    <div className="flex flex-col min-h-screen pb-24 max-w-md mx-auto relative shadow-2xl bg-background-dark/30 ring-1 ring-white/5">
      <Header />
      
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {/* Summary Horizontal Scroll */}
        <section className="px-4 py-6 overflow-x-auto no-scrollbar">
          <div className="flex gap-4 w-max pb-2">
            {SUMMARY_STATS.map((stat, idx) => (
              <SummaryCard key={stat.type} stat={stat} isPrimary={idx === 0} />
            ))}
          </div>
        </section>

        {/* List Header */}
        <div className="px-4 flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-white tracking-tight">Market Signals</h2>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Powered by Gemini AI</span>
          </div>
          <button className="text-xs font-bold text-primary flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20 hover:bg-primary/20 transition-all">
            Filter <span className="material-symbols-outlined text-sm">tune</span>
          </button>
        </div>

        {/* Signals List */}
        <section className="px-4 flex flex-col gap-4">
          {signals.map((signal) => (
            <StockSignalCard 
              key={signal.symbol} 
              signal={signal} 
              onViewAnalysis={handleViewAnalysis}
            />
          ))}
          
          <div className="py-8 text-center">
            <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">End of signal stream</p>
          </div>
        </section>
      </main>

      <AnalysisModal 
        signal={selectedSignal} 
        onClose={() => setSelectedSignal(null)} 
        loading={isAnalysisLoading}
      />
      
      <Navigation />
    </div>
  );
};

export default App;
