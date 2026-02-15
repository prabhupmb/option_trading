import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import BrokerSelector from './layout/BrokerSelector';

interface HeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
  user?: User | null;
  onSignOut?: () => void;
  selectedBrokerage?: string;
  onBrokerageChange?: (brokerage: string) => void;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated, onRefresh, loading, user, onSignOut, selectedBrokerage, onBrokerageChange }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.email || 'User';

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-gray-100 dark:border-white/10 px-4 py-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or simplified status */}
        <div className="flex items-center gap-3 text-slate-400">
          <span className="material-symbols-outlined text-xl">home</span>
          <span className="text-xs font-bold text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">Dashboard</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Brokerage Selector */}
        <div className="relative z-50">
          <BrokerSelector />
        </div>
        <button
          onClick={() => {
            const html = document.documentElement;
            if (html.classList.contains('dark')) {
              html.classList.remove('dark');
              localStorage.setItem('theme', 'light');
            } else {
              html.classList.add('dark');
              localStorage.setItem('theme', 'dark');
            }
          }}
          className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">contrast</span>
        </button>
        <button
          onClick={onRefresh}
          className={`text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors ${loading ? 'animate-spin' : ''}`}
        >
          <span className="material-symbols-outlined text-2xl">refresh</span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden bg-slate-100 dark:bg-gray-800 hover:ring-2 hover:ring-rh-green/50 transition-all"
          >
            {userAvatar ? (
              <img alt={userName} className="w-full h-full object-cover" src={userAvatar} />
            ) : (
              <span className="material-symbols-outlined text-slate-400 text-lg flex items-center justify-center w-full h-full">person</span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1e2124] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-gray-800 flex-shrink-0">
                      {userAvatar ? (
                        <img alt={userName} className="w-full h-full object-cover" src={userAvatar} />
                      ) : (
                        <span className="material-symbols-outlined text-slate-400 text-xl flex items-center justify-center w-full h-full">person</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut?.();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
