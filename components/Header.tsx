import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import BrokerSelector from './layout/BrokerSelector';
import StrategyDropdown from './signals/StrategyDropdown';
import type { StrategyConfig } from '../hooks/useStrategyConfigs';
import type { ScanStatus } from '../hooks/useScanProgress';

interface ScanProgressData {
  status: ScanStatus;
  updated: number;
  total: number;
  message: string;
  errorMsg?: string;
}

interface HeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
  user?: User | null;
  onSignOut?: () => void;
  selectedBrokerage?: string;
  onBrokerageChange?: (brokerage: string) => void;
  onNavigate?: (view: string) => void;
  scanProgress?: ScanProgressData;
  strategies?: StrategyConfig[];
  selectedStrategy?: string | null;
  onStrategyChange?: (strategy: string | null) => void;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated, onRefresh, loading, user, onSignOut, selectedBrokerage, onBrokerageChange, onNavigate, scanProgress, strategies, selectedStrategy, onStrategyChange }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || user?.email || 'User';

  const isScanning = scanProgress?.status === 'scanning';
  const isDone = scanProgress?.status === 'done';
  const isError = scanProgress?.status === 'error';
  const progressPercent = scanProgress && scanProgress.total > 0
    ? Math.round((scanProgress.updated / scanProgress.total) * 100)
    : 0;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-gray-100 dark:border-white/10 transition-colors">
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Breadcrumb or simplified status */}
          <div className="flex items-center gap-3 text-slate-400">
            <span className="material-symbols-outlined text-xl">home</span>
            <span className="text-xs font-bold text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Strategy Filter */}
          {strategies && onStrategyChange && (
            <div className="relative z-50">
              <StrategyDropdown
                strategies={strategies}
                selectedStrategy={selectedStrategy ?? null}
                onStrategyChange={onStrategyChange}
              />
            </div>
          )}
          {/* Brokerage Selector */}
          <div className="relative z-50">
            <BrokerSelector onNavigate={onNavigate} />
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

          {/* Refresh / Scan Button */}
          <button
            onClick={onRefresh}
            disabled={isScanning}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${isScanning
                ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 cursor-wait'
                : isDone
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : isError
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
          >
            {isScanning ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                <span className="hidden sm:inline">
                  Scanning... {scanProgress!.updated}/{scanProgress!.total}
                </span>
              </>
            ) : isDone ? (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span className="hidden sm:inline">Updated!</span>
              </>
            ) : isError ? (
              <>
                <span className="material-symbols-outlined text-lg">error</span>
                <span className="hidden sm:inline">Scan failed</span>
              </>
            ) : (
              <>
                <span className={`material-symbols-outlined text-2xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
              </>
            )}
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
      </div>

      {/* Scan Progress Bar */}
      {isScanning && scanProgress && scanProgress.total > 0 && (
        <div className="h-1 bg-gray-900 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Shimmer effect while scanning */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
      )}
    </header>
  );
};

export default Header;
