import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ─────────────────────────────────────────────────

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

interface TodayUser {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
  current_page: string | null;
  mode: string | null;
  session_started_at: string;
  last_seen: string;
  seconds_since_seen: number;
  is_active: boolean;
  is_idle: boolean;
}

type ViewMode = 'active' | 'today';

// ─── CONSTANTS ─────────────────────────────────────────────

const ACTIVE_THRESHOLD = 45_000;   // 45s
const ONLINE_THRESHOLD = 120_000;  // 2min

// ─── HELPERS ───────────────────────────────────────────────

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

const fmtRelative = (isoStr: string): string => {
  const ms = Date.now() - new Date(isoStr).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
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

const resolveName = (row: { display_name?: string | null; full_name?: string | null; email?: string | null }): string => {
  const raw = row.display_name || row.full_name || row.email?.split('@')[0] || 'Unknown';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

// ─── COMPONENT ─────────────────────────────────────────────

const AdminPresence: React.FC = () => {
  const [view, setView] = useState<ViewMode>('active');
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [todayUsers, setTodayUsers] = useState<TodayUser[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [lastFetched, setLastFetched] = useState<Date>(new Date());

  // ─── DATA FETCHING ─────────────────────────────────────

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

  const fetchTodayUsers = useCallback(async () => {
    const { data } = await supabase.rpc('presence_online_today');
    if (data) {
      setTodayUsers(data as TodayUser[]);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchPresence();
    fetchTodayUsers();
    const poll = setInterval(() => {
      fetchPresence();
      fetchTodayUsers();
    }, 10_000);
    return () => clearInterval(poll);
  }, [fetchPresence, fetchTodayUsers]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('presence-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchPresence();
        fetchTodayUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPresence, fetchTodayUsers]);

  // 1-second tick for live durations
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // ─── DERIVED DATA ──────────────────────────────────────

  const liveUsers = useMemo(() =>
    activeUsers.map(u => {
      const elapsed = now - new Date(u.last_seen).getTime();
      if (elapsed > ONLINE_THRESHOLD) return null;
      return { ...u, status: (elapsed <= ACTIVE_THRESHOLD ? 'active' : 'idle') as 'active' | 'idle' };
    }).filter(Boolean) as ActiveUser[]
  , [activeUsers, now]);

  const activeCount = liveUsers.filter(u => u.status === 'active').length;
  const liveTradeCount = liveUsers.filter(u => u.mode?.toUpperCase() === 'LIVE').length;
  const todayCount = todayUsers.length;

  // ─── RENDER ────────────────────────────────────────────

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

        {/* Title — changes with view */}
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            {view === 'active' ? 'Active Now' : 'Online Today'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {view === 'active'
              ? <>Updated {fmtAgo(now - lastFetched.getTime())} &middot; auto-refreshing</>
              : <>Everyone who opened the app today &middot; auto-refreshing</>}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Active users"
            value={activeCount}
            icon="group"
            color="emerald"
            selected={view === 'active'}
            onClick={() => setView('active')}
          />
          <StatCard
            label="In live mode"
            value={liveTradeCount}
            icon="trending_up"
            color="rose"
          />
          <StatCard
            label="Total online today"
            value={todayCount}
            icon="calendar_today"
            color="blue"
            selected={view === 'today'}
            onClick={() => setView('today')}
          />
        </div>

        {/* Active view table */}
        {view === 'active' && (
          <>
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
                      <UserCell
                        name={u.name}
                        email={u.email}
                        initials={u.initials}
                        dotColor={isIdle ? 'amber' : 'emerald'}
                      />
                      <PageCell page={u.current_page} mode={u.mode} />
                      {/* Session — live ticking */}
                      <div className="flex items-center gap-1.5 md:pl-0 pl-12">
                        <span className="material-symbols-outlined text-slate-600 text-sm">schedule</span>
                        <span className="text-xs font-mono font-bold text-slate-300 tabular-nums">{fmtDuration(sessionMs)}</span>
                      </div>
                      <LastSeenCell elapsed={elapsed} isIdle={isIdle} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend — active view */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Idle (&gt;45s)
              </span>
              <span className="text-slate-700">&middot;</span>
              <span className="text-slate-600 normal-case tracking-normal">Dropped from active after 2 min of no heartbeat.</span>
            </div>
          </>
        )}

        {/* Today view table */}
        {view === 'today' && (
          <>
            {todayUsers.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-slate-700 mb-4 block">event_busy</span>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No one has opened the app today yet.</p>
              </div>
            ) : (
              <div className="bg-[#0f1219] border border-white/5 rounded-2xl overflow-hidden">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  <span>User</span>
                  <span>Currently on</span>
                  <span>First seen</span>
                  <span>Last seen</span>
                </div>

                {todayUsers.map(u => {
                  const name = resolveName(u);
                  const initials = getInitials(name);
                  const dotColor = u.is_active ? 'emerald' : u.is_idle ? 'amber' : 'slate';
                  const isIdle = u.is_idle;
                  const elapsedMs = u.seconds_since_seen * 1000;

                  return (
                    <div
                      key={u.user_id}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr] gap-2 md:gap-4 px-5 py-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors items-center"
                    >
                      <UserCell
                        name={name}
                        email={u.email}
                        initials={initials}
                        dotColor={dotColor}
                      />
                      <PageCell page={u.current_page} mode={u.mode} />
                      {/* First seen — static relative, no ticking timer */}
                      <div className="flex items-center gap-1.5 md:pl-0 pl-12">
                        <span className="material-symbols-outlined text-slate-600 text-sm">login</span>
                        <span className="text-xs font-mono font-bold text-slate-300 tabular-nums">
                          {fmtRelative(u.session_started_at)}
                        </span>
                      </div>
                      <LastSeenCell elapsed={elapsedMs} isIdle={isIdle} isOffline={!u.is_active && !u.is_idle} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend — today view */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Idle (&gt;45s)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> Earlier today
              </span>
              <span className="text-slate-700">&middot;</span>
              <span className="text-slate-600 normal-case tracking-normal">Dropped from active after 2 min of no heartbeat.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────

const UserCell: React.FC<{
  name: string;
  email: string;
  initials: string;
  dotColor: 'emerald' | 'amber' | 'slate';
}> = ({ name, email, initials, dotColor }) => {
  const dotBg = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    slate: 'bg-slate-500',
  }[dotColor];

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-black text-slate-300">
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f1219] ${dotBg}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white truncate">{name}</p>
        <p className="text-[10px] font-mono text-slate-500 truncate">{email}</p>
      </div>
    </div>
  );
};

const PageCell: React.FC<{ page: string | null; mode: string | null }> = ({ page, mode }) => (
  <div className="flex items-center gap-2 md:pl-0 pl-12">
    <span className="material-symbols-outlined text-slate-600 text-sm">monitor</span>
    <span className="text-xs font-bold text-slate-300">{formatPageName(page)}</span>
    {mode && (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
        mode.toUpperCase() === 'LIVE'
          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
          : 'text-slate-500 bg-slate-800/50 border-slate-700/50'
      }`}>
        {mode}
      </span>
    )}
  </div>
);

const LastSeenCell: React.FC<{
  elapsed: number;
  isIdle: boolean;
  isOffline?: boolean;
}> = ({ elapsed, isIdle, isOffline }) => {
  const color = isOffline ? 'text-slate-500' : isIdle ? 'text-amber-400' : 'text-slate-400';
  const prefix = isIdle ? 'idle \u00b7 ' : '';

  return (
    <div className="md:pl-0 pl-12">
      <span className={`text-xs font-mono font-bold tabular-nums ${color}`}>
        {prefix}{fmtAgo(elapsed)}
      </span>
    </div>
  );
};

// ─── STAT CARD ───────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: string;
  color: 'emerald' | 'rose' | 'blue';
  selected?: boolean;
  onClick?: () => void;
}> = ({ label, value, icon, color, selected, onClick }) => {
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
  const ringColor = {
    emerald: 'ring-emerald-500/50 border-emerald-500/40',
    rose:    'ring-rose-500/50 border-rose-500/40',
    blue:    'ring-blue-500/50 border-blue-500/40',
  };

  const isClickable = !!onClick;
  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`bg-[#0f1219] border rounded-2xl p-5 text-left transition-all ${
        selected
          ? `ring-2 ${ringColor[color]}`
          : 'border-white/5'
      } ${isClickable ? 'cursor-pointer hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d14] focus-visible:ring-slate-400' : ''}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${colors[color]}`}>
          <span className={`material-symbols-outlined text-lg ${textColor[color]}`}>{icon}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-3xl font-black font-mono tabular-nums ${textColor[color]}`}>{value}</span>
    </Tag>
  );
};

export default AdminPresence;
