import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserRole, AccessLevel } from '../types';

export type View = 'signals' | 'smart-feed' | 'portfolio' | 'quick-trade' | 'auto-trade' | 'iron-dip' | 'iron-gate' | 'iron-gate-day' | 'ai-hub' | 'chat' | 'watchlist' | 'history' | 'settings' | 'admin' | 'faq' | 'trending' | 'market-news' | 'stage-tracker' | 'lifecycle';

interface NavigationProps {
  activeView: View;
  onNavigate: (view: View) => void;
  user?: User | null;
  onSignOut?: () => void;
  role?: UserRole;
  accessLevel?: AccessLevel;
  trialDaysLeft?: number;
  isTrialUser?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ activeView, onNavigate, user, onSignOut, role, accessLevel, trialDaysLeft, isTrialUser }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  let tabs: { id: View; label: string; icon: string }[] = [
    { id: 'signals', label: 'Option Feed', icon: 'dashboard' },
    { id: 'iron-dip', label: 'Iron Dip', icon: 'pool' },
    { id: 'smart-feed', label: 'Stock Feed', icon: 'query_stats' },
    { id: 'lifecycle',  label: 'Lifecycle',  icon: 'timeline' },
    { id: 'portfolio', label: 'Portfolio', icon: 'analytics' },
    { id: 'quick-trade', label: 'Quick Trade', icon: 'bolt' },
    { id: 'auto-trade', label: 'Auto-Trade', icon: 'smart_toy' },
    { id: 'ai-hub', label: 'AI Hub', icon: 'auto_awesome' },
    { id: 'chat', label: 'Group Chat', icon: 'forum' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'faq', label: 'FAQ / Help', icon: 'help' },
    { id: 'trending', label: 'Trending', icon: 'trending_up' },
    { id: 'market-news', label: 'Market News', icon: 'newspaper' }
  ];

  if (role !== 'admin') {
    const allowedForCustomer: View[] = ['signals', 'smart-feed', 'lifecycle', 'portfolio', 'auto-trade', 'chat', 'settings', 'faq', 'trending', 'market-news'];
    tabs = tabs.filter(tab => allowedForCustomer.includes(tab.id));
  }

  if (role === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin Panel', icon: 'admin_panel_settings' });
  }

  // Bottom tab bar: 5 most important tabs
  const bottomTabIds: View[] = role === 'admin'
    ? ['signals', 'smart-feed', 'chat', 'admin', 'settings']
    : ['signals', 'smart-feed', 'chat', 'trending', 'settings'];
  const bottomTabs = bottomTabIds.map(id => tabs.find(t => t.id === id)).filter(Boolean) as typeof tabs;

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const navigate = (view: View) => { onNavigate(view); setDrawerOpen(false); };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-rh-green p-2 rounded-xl flex items-center justify-center shadow-lg shadow-rh-green/20">
            <span className="material-symbols-outlined text-white text-xl">insights</span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Signal Feed</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PRO TERMINAL</span>
          </div>
        </div>
      </div>

      {/* Trial Badge */}
      {isTrialUser && trialDaysLeft !== undefined && trialDaysLeft > 0 && (
        <div className={`mx-4 mt-4 px-3 py-2 rounded-xl border text-center ${trialDaysLeft <= 2 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <div className="flex items-center justify-center gap-2">
            <span className={`material-symbols-outlined text-sm ${trialDaysLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}>timer</span>
            <span className={`text-xs font-bold ${trialDaysLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}>
              {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left in trial
            </span>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-left ${activeView === tab.id
              ? 'bg-rh-green/10 text-rh-green font-bold'
              : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <span className={`material-symbols-outlined text-xl ${activeView === tab.id ? 'text-rh-green' : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`}>{tab.icon}</span>
            <span className="text-sm uppercase tracking-wide">{tab.label}</span>
            {activeView === tab.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-rh-green shadow-[0_0_8px_rgba(0,200,5,0.6)]" />}
          </button>
        ))}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex-shrink-0">
            {userAvatar
              ? <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              : <span className="material-symbols-outlined text-slate-400 text-lg flex items-center justify-center w-full h-full">person</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">Pro Plan</p>
          </div>
          <button onClick={onSignOut} className="text-slate-400 hover:text-red-500 transition-colors" title="Sign Out">
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── DESKTOP SIDEBAR (unchanged) ── */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-black border-r border-gray-100 dark:border-white/10 flex-col z-50 transition-colors">
        <SidebarContent />
      </nav>

      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-black border-b border-gray-100 dark:border-white/10 flex items-center px-4 gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="bg-rh-green p-1.5 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">insights</span>
          </div>
          <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">TradingKarna</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex-shrink-0">
          {userAvatar
            ? <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            : <span className="material-symbols-outlined text-slate-400 text-base flex items-center justify-center w-full h-full">person</span>}
        </div>
      </div>

      {/* ── MOBILE DRAWER ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-black flex flex-col h-full shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors z-10"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-100 dark:border-white/10 flex items-stretch safe-area-inset-bottom">
        {bottomTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors ${activeView === tab.id
              ? 'text-rh-green'
              : 'text-slate-400 dark:text-slate-500'}`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeView === tab.id ? 'text-rh-green' : ''}`}>{tab.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{tab.label.split(' ')[0]}</span>
            {activeView === tab.id && <div className="absolute bottom-0 w-8 h-0.5 bg-rh-green rounded-full" />}
          </button>
        ))}
      </div>
    </>
  );
};

export default Navigation;
