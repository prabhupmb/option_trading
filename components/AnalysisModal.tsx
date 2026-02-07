
import React from 'react';
import { StockSignal } from '../types';

interface Props {
  signal: StockSignal | null;
  onClose: () => void;
  loading: boolean;
}

const AnalysisModal: React.FC<Props> = ({ signal, onClose, loading }) => {
  if (!signal && !loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-primary/30 animate-in fade-in slide-in-from-bottom-10 duration-300">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Technical Report</h3>
              <p className="text-xs text-slate-400 uppercase tracking-widest">{signal?.symbol || 'Analyzing...'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar text-slate-300 leading-relaxed text-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              <p className="font-medium animate-pulse">Consulting Gemini Intelligence...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-primary font-bold mb-2">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  VERDICT: {signal?.conviction && signal.conviction > 70 ? 'HIGH CONVICTION BUY' : 'STRENGTHENING TREND'}
                </div>
                <p className="whitespace-pre-wrap">{signal?.analysis || 'No analysis available for this ticker.'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Risk Score</div>
                  <div className="text-orange-400 font-bold">MEDIUM-LOW</div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Target 1w</div>
                  <div className="text-green-400 font-bold">+12.4%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-white/5 flex gap-3">
          <button 
            disabled={loading}
            onClick={onClose}
            className="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(127,19,236,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
