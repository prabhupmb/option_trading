
import React from 'react';

interface HeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated, onRefresh, loading }) => {
  return (
    <header className="sticky top-0 z-40 glass-header px-8 py-4 flex items-center justify-between">
      {/* Left: Page Title */}
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-white tracking-tight">Trading Terminal</h2>
        <span className="text-xs text-slate-400">
          {lastUpdated
            ? `Last synced: ${lastUpdated.toLocaleTimeString()}`
            : 'Real-time market signals from Google Sheets'}
        </span>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input
            type="text"
            placeholder="Search stocks, signals, or commands..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-500">
            <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘</kbd>
            <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">K</kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Sync Status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <span className={`flex h-2 w-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'} pulse-live`}></span>
          <span className="text-xs text-primary font-semibold uppercase tracking-wide">
            {loading ? 'Syncing...' : 'Live Sync'}
          </span>
        </div>

        <button
          onClick={onRefresh}
          className="text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          title="Refresh data"
        >
          <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>sync</span>
        </button>
        <button className="relative text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
          <span className="material-symbols-outlined text-xl">notifications</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
        </button>
        <button className="text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
          <span className="material-symbols-outlined text-xl">help</span>
        </button>
        <div className="w-px h-6 bg-white/10"></div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
          <span className="flex h-2 w-2 rounded-full bg-green-500 pulse-live"></span>
          <span className="text-xs text-green-400 font-semibold uppercase tracking-wide">Market Open</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
