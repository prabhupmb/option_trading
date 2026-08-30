import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInbox, InboxItem, InboxChannel } from '../hooks/useInbox';

// ─── Relative time ──────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  if (days < 7) return remHrs > 0 ? `${days}d ${remHrs}h ago` : `${days}d ago`;
  return `${days}d ago`;
}

// ─── Severity colors ────────────────────────────────────────

const SEVERITY_RAIL: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  WARN: 'bg-amber-400',
  SUCCESS: 'bg-emerald-500',
  INFO: 'bg-slate-500',
};

// ─── Tab type ───────────────────────────────────────────────

type Tab = 'all' | 'alerts' | 'messages';

// ─── Skeleton row ───────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="flex gap-3 px-4 py-3 animate-pulse">
    <div className="w-[3px] rounded-full bg-zinc-800 shrink-0 self-stretch" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-3/4 bg-zinc-800 rounded" />
      <div className="h-3 w-full bg-zinc-800/60 rounded" />
      <div className="h-2.5 w-1/3 bg-zinc-800/40 rounded" />
    </div>
  </div>
);

// ─── Single row ─────────────────────────────────────────────

const InboxRow: React.FC<{
  item: InboxItem;
  onRead: (id: string) => void;
  onNavigate?: (url: string) => void;
}> = ({ item, onRead, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const isUnread = item.status === 'UNREAD';

  const handleClick = () => {
    if (item.action_url) {
      if (isUnread) onRead(item.id);
      onNavigate?.(item.action_url);
    } else {
      setExpanded(v => !v);
      if (isUnread) onRead(item.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] ${
        isUnread ? 'bg-white/[0.02]' : ''
      }`}
    >
      {/* Severity rail */}
      <div className={`w-[3px] rounded-full shrink-0 self-stretch ${SEVERITY_RAIL[item.severity] || 'bg-slate-500'}`} />

      <div className="flex-1 min-w-0">
        {/* Title line */}
        <div className="flex items-center gap-2">
          {item.symbol && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700/40 shrink-0">
              {item.symbol}
            </span>
          )}
          <span className={`text-sm truncate ${isUnread ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>
            {item.title}
          </span>
          {isUnread && (
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          )}
        </div>

        {/* Body */}
        {item.body && (
          <p className={`text-xs mt-1 leading-relaxed ${isUnread ? 'text-zinc-400' : 'text-zinc-500'} ${expanded ? '' : 'line-clamp-2'}`}>
            {item.body}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 mt-1.5">
          {item.system && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{item.system}</span>
          )}
          <span className="text-[10px] text-zinc-600">{relativeTime(item.created_at)}</span>
        </div>
      </div>
    </button>
  );
};

// ─── Main component ─────────────────────────────────────────

interface NotificationInboxProps {
  onNavigate?: (view: string) => void;
}

const NotificationInbox: React.FC<NotificationInboxProps> = ({ onNavigate }) => {
  const { items, unread, loading, error, refetch, markRead, markAllRead } = useInbox();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Close on route change (currentView passed via onNavigate)
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && open) setOpen(false);
    prevOpen.current = open;
  }, [onNavigate]);

  // Refetch on open
  const togglePanel = useCallback(() => {
    setOpen(v => {
      if (!v) refetch();
      return !v;
    });
  }, [refetch]);

  // Filtered items
  const filtered = tab === 'all'
    ? items
    : items.filter(i => i.channel === (tab === 'alerts' ? 'ALERT' : 'MESSAGE'));

  // Badge logic
  const hasCritOrWarn = items.some(i => i.status === 'UNREAD' && (i.severity === 'CRITICAL' || i.severity === 'WARN'));
  const badgeColor = hasCritOrWarn ? 'bg-red-500' : 'bg-emerald-500';
  const badgeText = unread.total > 9 ? '9+' : String(unread.total);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: unread.total },
    { id: 'alerts', label: 'Alerts', count: unread.alerts },
    { id: 'messages', label: 'Messages', count: unread.messages },
  ];

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={togglePanel}
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5 ${
          unread.total > 0 ? 'text-zinc-300' : 'text-zinc-300/60'
        }`}
        title="Notifications"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unread.total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black text-white px-1 ${badgeColor}`}>
            {badgeText}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[420px] max-h-[70vh] bg-[#0d1117] border border-[#1e2430] rounded-xl shadow-2xl shadow-black/50 z-[60] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[#1e2430] shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Inbox</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    tab === t.id
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className="ml-1 font-black">{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e2430]/60">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span className="material-symbols-outlined text-2xl text-red-400">cloud_off</span>
                <p className="text-xs text-zinc-400">Couldn't load inbox</p>
                <button
                  onClick={refetch}
                  className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide hover:text-emerald-300 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <span className="material-symbols-outlined text-3xl text-zinc-700 mb-2">
                  {tab === 'alerts' ? 'notifications_off' : tab === 'messages' ? 'chat_bubble_outline' : 'inbox'}
                </span>
                <p className="text-xs text-zinc-500">
                  {tab === 'alerts' ? 'No alerts' : tab === 'messages' ? 'No messages' : 'Nothing here yet'}
                </p>
              </div>
            ) : (
              filtered.map(item => (
                <InboxRow
                  key={item.id}
                  item={item}
                  onRead={markRead}
                  onNavigate={(url) => {
                    setOpen(false);
                    onNavigate?.(url);
                  }}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[#1e2430] shrink-0 flex items-center justify-between">
            <button
              onClick={() => markAllRead(tab === 'alerts' ? 'ALERT' : tab === 'messages' ? 'MESSAGE' : undefined)}
              disabled={
                (tab === 'all' && unread.total === 0) ||
                (tab === 'alerts' && unread.alerts === 0) ||
                (tab === 'messages' && unread.messages === 0)
              }
              className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onNavigate?.('notifications');
              }}
              className="text-[10px] font-bold uppercase tracking-wide text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationInbox;
