// Zerodha token status chip — shows countdown / expired state in header.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const AUTH_URL = 'https://prabhupadala01.app.n8n.cloud/webhook/zerodha-auth';

const fmtCountdown = (ms: number): string => {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const ZerodhaTokenChip: React.FC = () => {
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isActive,  setIsActive]  = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const [now,       setNow]       = useState(() => new Date());

  const fetchCred = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('broker_credentials')
        .select('is_active, token_expires_at')
        .eq('broker_name', 'zerodha')
        .maybeSingle();
      if (data) {
        setIsActive(data.is_active ?? false);
        setExpiresAt(data.token_expires_at ? new Date(data.token_expires_at) : null);
      } else {
        setIsActive(false);
        setExpiresAt(null);
      }
    } catch {
      /* silent — chip just shows expired state */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchCred();
    const id = setInterval(fetchCred, 60_000);
    return () => clearInterval(id);
  }, [fetchCred]);

  // 1-second clock tick for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!loaded) return null;

  const msLeft   = expiresAt ? expiresAt.getTime() - now.getTime() : -1;
  const valid    = isActive && msLeft > 0;
  const expiring = valid && msLeft < 60 * 60 * 1_000; // < 1 hour

  if (!valid) {
    return (
      <a
        href={AUTH_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-wide hover:bg-rose-500/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
        ZERODHA · LOG IN
      </a>
    );
  }

  const dotCls  = expiring ? 'bg-amber-400' : 'bg-emerald-400';
  const chipCls = expiring
    ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${chipCls} text-[10px] font-black uppercase tracking-wide font-mono`}>
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        {!expiring && (
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotCls}`} />
      </span>
      ZERODHA · {fmtCountdown(msLeft)}
    </div>
  );
};

export default ZerodhaTokenChip;
