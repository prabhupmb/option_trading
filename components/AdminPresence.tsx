import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface PresenceRow {
  user_id: string;
  last_seen: string;
  session_started_at: string;
  current_page: string | null;
  mode: string | null;
  user_agent: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  user_name: string | null;
}

interface ActiveUser extends PresenceRow {
  email: string;
  name: string;
  initials: string;
  status: 'active' | 'idle';
}

const ACTIVE_THRESHOLD = 45_000;   // 45s
const ONLINE_THRESHOLD = 120_000;  // 2min

const fmtDuration = (ms: number): string => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60_000) % 60;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

const fmtAgo = (ms: number): string => {
  if (ms < 1000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const formatPageName = (page: string | null): string => {
  if (!page) return 'Unknown';
  return page
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

const AdminPresence: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [lastFetched, setLastFetched] = useState<Date>(new Date());

  const processData = useCallback((rows: PresenceRow[], users: UserInfo[]) => {
    const currentTime = Date.now();
    const userMap = new Map(users.map(u => [u.id, u]));

    const active: ActiveUser[] = [];
    for (const row of rows) {
      const elapsed = currentTime - new Date(row.last_seen).getTime();
      if (elapsed > ONLINE_THRESHOLD) continue;

      const info = userMap.get(row.user_id);
      const name = info?.display_name || info?.full_name || info?.user_name || info?.email?.split('@')[0] || 'Unknown';
      active.push({
        ...row,
        email: info?.email || '',
        name: name.charAt(0).toUpperCase() + name.slice(1),
        initials: getInitials(name),
        status: elapsed <= ACTIVE_THRESHOLD ? 'active' : 'idle',
      });
    }

    active.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
    return active;
  }, []);

  const fetchPresence = useCallback(async () => {
    const twoMinAgo = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();
    const { data: rows } = await supabase
      .from('user_presence')
      .select('*')
      .gte('last_seen', twoMinAgo)
      .order('last_seen', { ascending: false });

    if (!rows || rows.length === 0) {
      setActiveUsers([]);
      setLastFetched(new Date());
      return;
    }

    const userIds = rows.map(r => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name, display_name, user_name')
      .in('id', userIds);

    setActiveUsers(processData(rows, users || []));
    setLastFetched(new Date());
  }, [processData]);

  // Fetch today's total unique users
  const fetchTodayTotal = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('user_presence')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen', todayStart.toISOString());
    setTodayTotal(count || 0);
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchPresence();
    fetchTodayTotal();
    const poll = setInterval(fetchPresence, 10_000);
    const dailyPoll = setInterval(fetchTodayTotal, 30_000);
    return () => { clearInterval(poll); clearInterval(dailyPoll); };
  }, [fetchPresence, fetchTodayTotal]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('presence-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchPresence();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPresence]);

  // 1-second tick for live durations
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Recompute statuses based on current time
  const liveUsers = activeUsers.map(u => {
    const elapsed = now - new Date(u.last_seen).getTime();
    if (elapsed > ONLINE_THRESHOLD) return null;
    return { ...u, status: (elapsed <= ACTIVE_THRESHOLD ? 'active' : 'idle') as 'active' | 'idle' };
  }).filter(Boolean) as ActiveUser[];

  const activeCount = liveUsers.filter(u => u.status === 'active').length;
  const liveTradeCount = liveUsers.filter(u => u.mode?.toUpperCase() === 'LIVE').length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Breadcrumb + LIVE pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 font-bold">Admin</span>
            <span className="text-slate-700">/</span>
            <span className="text-white font-bold">Presence</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Active Now</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Updated {fmtAgo(now - lastFetched.getTime())} &middot; auto-refreshing
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Active users" value={activeCount} icon="group" color="emerald" />
          <StatCard label="In live mode" value={liveTradeCount} icon="trending_up" color="rose" />
          <StatCard label="Total online today" value={todayTotal} icon="calendar_today" color="blue" />
        </div>

        {/* Table */}
        {liveUsers.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-slate-700 mb-4 block">group_off</span>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No one is active right now.</p>
          </div>
        ) : (
          <div className="bg-[#0f1219] border border-white/5 rounded-2xl overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
              <span>User</span>
              <span>Currently on</span>
              <span>Session</span>
              <span>Last seen</span>
            </div>

            {liveUsers.map(u => {
              const elapsed = now - new Date(u.last_seen).getTime();
              const sessionMs = now - new Date(u.session_started_at).getTime();
              const isIdle = u.status === 'idle';

              return (
                <div
                  key={u.user_id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr] gap-2 md:gap-4 px-5 py-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors items-center"
                >
                  {/* User */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-black text-slate-300">
                        {u.initials}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f1219] ${isIdle ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{u.name}</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Currently on */}
                  <div className="flex items-center gap-2 md:pl-0 pl-12">
                    <span className="material-symbols-outlined text-slate-600 text-sm">monitor</span>
                    <span className="text-xs font-bold text-slate-300">{formatPageName(u.current_page)}</span>
                    {u.mode && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                        u.mode.toUpperCase() === 'LIVE'
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-slate-500 bg-slate-800/50 border-slate-700/50'
                      }`}>
                        {u.mode}
                      </span>
                    )}
                  </div>

                  {/* Session */}
                  <div className="flex items-center gap-1.5 md:pl-0 pl-12">
                    <span className="material-symbols-outlined text-slate-600 text-sm">schedule</span>
                    <span className="text-xs font-mono font-bold text-slate-300 tabular-nums">{fmtDuration(sessionMs)}</span>
                  </div>

                  {/* Last seen */}
                  <div className="md:pl-0 pl-12">
                    <span className={`text-xs font-mono font-bold tabular-nums ${isIdle ? 'text-amber-400' : 'text-slate-400'}`}>
                      {isIdle ? 'idle \u00b7 ' : ''}{fmtAgo(elapsed)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest pt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Idle (&gt;45s)
          </span>
          <span className="text-slate-700">&middot;</span>
          <span className="text-slate-600 normal-case tracking-normal">Dropped after 2 min of no heartbeat.</span>
        </div>
      </div>
    </div>
  );
};

// ─── STAT CARD ───────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: string;
  color: 'emerald' | 'rose' | 'blue';
}> = ({ label, value, icon, color }) => {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose:    'text-rose-400 bg-rose-500/10 border-rose-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  const textColor = {
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    blue:    'text-blue-400',
  };

  return (
    <div className="bg-[#0f1219] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${colors[color]}`}>
          <span className={`material-symbols-outlined text-lg ${textColor[color]}`}>{icon}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-3xl font-black font-mono tabular-nums ${textColor[color]}`}>{value}</span>
    </div>
  );
};

export default AdminPresence;
