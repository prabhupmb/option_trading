import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const HEARTBEAT_INTERVAL = 45_000; // 45 seconds

/**
 * Sends a presence heartbeat every ~45s, on page/view change,
 * and when the tab becomes visible. Upserts user_presence without
 * overwriting session_started_at.
 */
export function usePresenceHeartbeat(
  userId: string | undefined,
  currentPage: string,
  mode?: string
) {
  const currentPageRef = useRef(currentPage);
  const modeRef = useRef(mode);
  currentPageRef.current = currentPage;
  modeRef.current = mode;

  const send = useRef(async () => {
    if (!userId) return;
    try {
      await supabase.from('user_presence').upsert(
        {
          user_id: userId,
          last_seen: new Date().toISOString(),
          current_page: currentPageRef.current,
          mode: modeRef.current || null,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'user_id', ignoreDuplicates: false }
      );
    } catch {
      // silent — presence is best-effort
    }
  });

  // Update the ref so the callback always has the latest userId
  useEffect(() => {
    send.current = async () => {
      if (!userId) return;
      try {
        await supabase.from('user_presence').upsert(
          {
            user_id: userId,
            last_seen: new Date().toISOString(),
            current_page: currentPageRef.current,
            mode: modeRef.current || null,
            user_agent: navigator.userAgent,
          },
          { onConflict: 'user_id', ignoreDuplicates: false }
        );
      } catch {
        // silent
      }
    };
  }, [userId]);

  // Periodic heartbeat
  useEffect(() => {
    if (!userId) return;
    send.current();
    const id = setInterval(() => send.current(), HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, [userId]);

  // On page/view change
  useEffect(() => {
    if (!userId) return;
    send.current();
  }, [userId, currentPage]);

  // On tab visibility change
  useEffect(() => {
    if (!userId) return;
    const handler = () => {
      if (document.visibilityState === 'visible') send.current();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [userId]);
}
