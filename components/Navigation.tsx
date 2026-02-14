import React from 'react';
import type { User } from '@supabase/supabase-js';
import { UserRole, AccessLevel } from '../types';

export type View = 'signals' | 'smart-feed' | 'portfolio' | 'ai-hub' | 'watchlist' | 'history' | 'settings' | 'admin';

interface NavigationProps {
  activeView: View;
  onNavigate: (view: View) => void;
  user?: User | null;
  onSignOut?: () => void;
  role?: UserRole;
  accessLevel?: AccessLevel;
}

const Navigation: React.FC<NavigationProps> = ({ activeView, onNavigate, user, onSignOut, role, accessLevel }) => {
  let tabs: { id: View; label: string; icon: string }[] = [
    { id: 'signals', label: 'Option Feed', icon: 'dashboard' },
    { id: 'smart-feed', label: 'Stock Feed', icon: 'query_stats' },
    { id: 'portfolio', label: 'Portfolio', icon: 'analytics' },
    { id: 'ai-hub', label: 'AI Hub', icon: 'auto_awesome' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  // Hide Portfolio for Signal-only users
  if (accessLevel === 'signal') {
    tabs = tabs.filter(tab => tab.id !== 'portfolio');
  }

  // Add Admin Panel for Admins
  if (role === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin Panel', icon: 'admin_panel_settings' });
  }

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-black border-r border-gray-100 dark:border-white/10 flex flex-col z-50 transition-colors">
      {/* Logo Area */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10">
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

      {/* Nav Items */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-left ${activeView === tab.id
              ? 'bg-rh-green/10 text-rh-green font-bold'
              : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span className={`material-symbols-outlined text-xl ${activeView === tab.id ? 'text-rh-green' : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`}>{tab.icon}</span>
            <span className="text-sm uppercase tracking-wide">{tab.label}</span>
            {activeView === tab.id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-rh-green shadow-[0_0_8px_rgba(0,200,5,0.6)]"></div>
            )}
          </button>
        ))}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex-shrink-0">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-slate-400 text-lg flex items-center justify-center w-full h-full">person</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">Pro Plan</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-slate-400 hover:text-red-500 transition-colors"
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
