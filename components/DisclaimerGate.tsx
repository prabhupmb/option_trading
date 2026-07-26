import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DISCLAIMER_VERSION, recordDisclaimerAcceptance } from '../services/disclaimer';
import { DISCLAIMER_CLAUSES } from './disclaimerContent';

interface DisclaimerGateProps {
  userId: string;
  onAccepted: () => void;
}

const DisclaimerGate: React.FC<DisclaimerGateProps> = ({ userId, onAccepted }) => {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || scrolledToEnd) return;
    // Within 20px of the bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setScrolledToEnd(true);
    }
  }, [scrolledToEnd]);

  // Check if content is shorter than container (no scroll needed)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 20) {
      setScrolledToEnd(true);
    }
  }, []);

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const record = await recordDisclaimerAcceptance(userId);
      const ts = record?.accepted_at
        ? new Date(record.accepted_at).toLocaleString()
        : new Date().toLocaleString();
      setConfirmation(`Recorded \u00b7 v${DISCLAIMER_VERSION} \u00b7 ${ts}`);
      setTimeout(() => onAccepted(), 1500);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-amber-400 text-xl">warning</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Risk Disclosure</h2>
              <p className="text-xs text-slate-500">Please read the following before using TradingKarna</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white/5 px-2 py-1 rounded border border-white/10 flex-shrink-0">
              v{DISCLAIMER_VERSION}
            </span>
          </div>
        </div>

        {/* Scrollable clauses */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar"
        >
          {DISCLAIMER_CLAUSES.map((clause, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-amber-400 font-mono font-black text-sm leading-6 flex-shrink-0 w-6 text-right">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white leading-6">{clause.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed mt-1">{clause.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0 space-y-3">
          {/* Scroll hint */}
          <p className={`text-[10px] font-bold uppercase tracking-widest text-center transition-colors ${scrolledToEnd ? 'text-emerald-400' : 'text-slate-600'}`}>
            {scrolledToEnd ? "You've reached the end." : 'Scroll to the end to enable acceptance.'}
          </p>

          {confirmation ? (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{confirmation}</span>
            </div>
          ) : (
            <>
              {/* Checkbox */}
              <label
                className={`flex items-start gap-3 select-none rounded-lg px-3 py-2.5 border transition-colors ${
                  scrolledToEnd
                    ? 'border-white/10 hover:bg-white/5 cursor-pointer'
                    : 'border-transparent opacity-40 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!scrolledToEnd}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-transparent text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-1 disabled:opacity-40 flex-shrink-0"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I have read and understood the risk disclosure, and I accept that I trade at my own risk.
                </span>
              </label>

              {/* Accept button */}
              <button
                onClick={handleAccept}
                disabled={!checked || submitting}
                className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                  checked && !submitting
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Recording...
                  </span>
                ) : (
                  'Accept & Continue'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisclaimerGate;
