import React from 'react';

interface HeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated, onRefresh, loading }) => {
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
        <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden bg-slate-100 dark:bg-gray-800">
          <img
            alt="Profile"
            className="w-full h-full object-cover"
            src="https://picsum.photos/seed/finance/100/100"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
