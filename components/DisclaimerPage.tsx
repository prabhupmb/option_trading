import React, { useEffect, useState } from 'react';
import { DISCLAIMER_VERSION, hasAcceptedCurrentDisclaimer, DisclaimerAcceptance } from '../services/disclaimer';
import { DISCLAIMER_CLAUSES } from './disclaimerContent';

interface DisclaimerPageProps {
  userId?: string;
  onBack?: () => void;
}

const DisclaimerPage: React.FC<DisclaimerPageProps> = ({ userId, onBack }) => {
  const [acceptance, setAcceptance] = useState<DisclaimerAcceptance | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    hasAcceptedCurrentDisclaimer(userId).then(r => {
      setAcceptance(r);
      setLoaded(true);
    });
  }, [userId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-400 text-xl">gavel</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white uppercase tracking-tight">Legal & Risk Disclosure</h1>
            <p className="text-xs text-slate-500 mt-0.5">TradingKarna Risk Disclosure</p>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-600 bg-white/5 px-2 py-1 rounded border border-white/10">
            v{DISCLAIMER_VERSION}
          </span>
        </div>

        {/* Clauses */}
        <div className="space-y-6">
          {DISCLAIMER_CLAUSES.map((clause, i) => (
            <div key={i} className="bg-[#0f1219] border border-white/5 rounded-xl p-5">
              <div className="flex gap-4">
                <span className="text-amber-400 font-mono font-black text-sm leading-6 flex-shrink-0 w-6 text-right">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white leading-6">{clause.title}</h3>
                  <p className="text-[13px] text-slate-400 leading-relaxed mt-1.5">{clause.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acceptance record */}
        {loaded && acceptance && (
          <div className="mt-8 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-lg">verified</span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              You accepted v{acceptance.disclaimer_version} on{' '}
              {new Date(acceptance.accepted_at).toLocaleString()}
            </span>
          </div>
        )}

        {loaded && !acceptance && userId && (
          <div className="mt-8 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
            <span className="text-xs font-bold text-amber-400">
              You have not yet accepted the current disclosure version.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DisclaimerPage;
