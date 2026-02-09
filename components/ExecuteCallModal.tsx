import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { StockSignal } from '../types';

// --- Types & Constants ---
export enum RiskLevel {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High'
}

export interface AIAnalysis {
    sentiment: string;
    reasoning: string;
    confidence: number;
}

const API_KEY = (import.meta as any).env.VITE_API_KEY || '';

// --- Services ---
const analyzeTrade = async (symbol: string, amount: number, risk: RiskLevel): Promise<AIAnalysis> => {
    if (!API_KEY) {
        console.error("API_KEY is missing");
        return {
            sentiment: "Neutral",
            reasoning: "AI analysis unavailable - API Key missing.",
            confidence: 0
        };
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Analyze a potential BUY call for ${symbol} with a budget of $${amount} and a ${risk} risk profile. Provide a professional financial outlook in JSON format.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.STRING, description: "Bullish, Bearish, or Neutral" },
                        reasoning: { type: Type.STRING, description: "Short reasoning for this trade" },
                        confidence: { type: Type.NUMBER, description: "Confidence score from 0-100" }
                    },
                    required: ["sentiment", "reasoning", "confidence"]
                }
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Analysis failed:", error);
        return {
            sentiment: "Neutral",
            reasoning: "AI analysis is currently unavailable. Market indicators remain stable.",
            confidence: 50
        };
    }
};

interface Props {
    signal: StockSignal;
    onClose: () => void;
}

const ExecuteCallModal: React.FC<Props> = ({ signal, onClose }) => {
    const [budget, setBudget] = useState<string>("1,000.00");
    const [risk, setRisk] = useState<RiskLevel>(RiskLevel.LOW);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [availableBalance, setAvailableBalance] = useState<number>(0);

    // Fetch available balance from portfolio
    React.useEffect(() => {
        const fetchBalance = async () => {
            // Try to get from cache first
            const cached = localStorage.getItem('portfolio_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                // Check if it's the new version 'v2' (implied by new structure or explicit version check)
                if (parsed.version === 'v2' && parsed.stats?.buyingPower) {
                    setAvailableBalance(parsed.stats.buyingPower);
                    return;
                }
            }

            // Fallback to fresh fetch if not in cache or missing buyingPower
            const data = await import('../services/n8n').then(m => m.fetchPortfolioData());
            if (data?.stats?.buyingPower) {
                setAvailableBalance(data.stats.buyingPower);
            }
        };
        fetchBalance();
    }, []);

    const numericBudget = parseFloat(budget.replace(/,/g, '')) || 0;

    const estimatedShares = useMemo(() => {
        return (numericBudget / signal.price).toFixed(2);
    }, [numericBudget, signal.price]);

    const totalCost = useMemo(() => {
        const fee = numericBudget * 0.005;
        return (numericBudget + fee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [numericBudget]);

    const setPercentage = (percent: number) => {
        const value = (availableBalance * percent).toFixed(2);
        setBudget(parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2 }));
    };

    const handleAIAnalysis = async () => {
        setIsAnalyzing(true);
        const result = await analyzeTrade(signal.symbol, numericBudget, risk);
        setAnalysis(result);
        setIsAnalyzing(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-black dark:bg-[#0a0712] rounded-3xl border border-rh-green/20 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Ambient Glows */}
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rh-green/20 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-rh-green/10 rounded-full blur-[80px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-start relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-rh-green/10 text-rh-green text-[10px] font-bold rounded tracking-wider uppercase">Execute Call</span>
                            <span className="text-slate-500 text-sm">{signal.symbol}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white flex items-baseline gap-2 tracking-tight">
                            {signal.name || signal.symbol}
                            <span className="text-slate-400 text-lg font-medium">${signal.price.toLocaleString()}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/5">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8 relative z-10">

                    {/* Budget Input */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Budget Allocation</label>
                            <span className="text-slate-500 text-xs font-medium">Available: ${availableBalance.toLocaleString()}</span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                            <input
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-xl font-bold text-white focus:ring-1 focus:ring-rh-green focus:border-rh-green transition-all outline-none hover:border-white/20"
                                type="text"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[0.25, 0.5, 0.75].map((p) => (
                                <button key={p} onClick={() => setPercentage(p)} className="py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 text-xs font-bold hover:border-rh-green/50 hover:text-rh-green transition-all">
                                    {p * 100}%
                                </button>
                            ))}
                            <button onClick={() => setPercentage(1)} className="py-2.5 rounded-xl bg-rh-green/10 border border-rh-green text-rh-green text-xs font-bold hover:bg-rh-green/20 transition-all">MAX</button>
                        </div>
                    </div>

                    {/* Risk Level */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Risk Management</label>
                        <div className="grid grid-cols-3 gap-3 p-1 bg-white/5 rounded-2xl">
                            {[RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH].map((level) => (
                                <button key={level} onClick={() => setRisk(level)} className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-xs ${risk === level ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${level === RiskLevel.LOW ? 'bg-rh-green shadow-[0_0_8px_rgba(0,200,5,0.5)]' : level === RiskLevel.MEDIUM ? 'bg-yellow-500' : 'bg-rh-red'}`}></div>
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Analysis & Summary */}
                    <div className="space-y-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-500 text-xs font-medium">Estimated Shares</span>
                                <span className="text-white font-bold">{estimatedShares} Shares</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-xs font-medium">Total Cost (inc. fees)</span>
                                <span className="text-white font-black text-lg">${totalCost}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 px-2">
                            <button onClick={handleAIAnalysis} disabled={isAnalyzing} className="flex items-center gap-2 text-rh-green text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                                <span className={`material-symbols-outlined text-sm ${isAnalyzing ? 'animate-spin' : ''}`}>auto_awesome</span>
                                {isAnalyzing ? 'Analyzing...' : analysis ? 'Re-Analyze Trade' : 'Analyze with Gemini AI'}
                            </button>
                            {analysis && <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">Confidence: <span className="text-rh-green font-bold">{analysis.confidence}%</span></div>}
                        </div>

                        {analysis && (
                            <div className="bg-rh-green/5 border border-rh-green/20 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${analysis.sentiment.toLowerCase().includes('bullish') ? 'bg-rh-green/20 text-rh-green' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                        {analysis.sentiment}
                                    </span>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Gemini Prediction</p>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed italic">"{analysis.reasoning}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 flex gap-3 relative z-10 w-full">
                    <button onClick={onClose} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all uppercase tracking-wide text-xs">Cancel</button>
                    <button className="flex-[2] py-4 bg-rh-green hover:bg-rh-green/90 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(0,200,5,0.3)] hover:shadow-[0_0_25px_rgba(0,200,5,0.5)] transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-xs active:scale-[0.98]">
                        <span className="material-symbols-outlined font-bold group-hover:scale-110 transition-transform">bolt</span>
                        BUY NOW
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExecuteCallModal;
