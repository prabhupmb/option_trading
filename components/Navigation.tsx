
import React from 'react';

export type View = 'signals' | 'portfolio' | 'ai-hub' | 'watchlist' | 'history' | 'settings';

interface NavigationProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

interface NavItem {
  icon: string;
  label: string;
  id: View;
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Option Signals', id: 'signals' },
  { icon: 'analytics', label: 'Portfolio', id: 'portfolio' },
  { icon: 'auto_awesome', label: 'AI Hub', id: 'ai-hub' },
  { icon: 'trending_up', label: 'Watchlist', id: 'watchlist' },
  { icon: 'history', label: 'History', id: 'history' },
  { icon: 'settings', label: 'Settings', id: 'settings' },
];

const Navigation: React.FC<NavigationProps> = ({ activeView, onNavigate }) => {
  return (
    <nav className="fixed left-0 top-0 bottom-0 w-64 glass-sidebar flex flex-col z-50">
      {/* Logo Section */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(127,19,236,0.4)]">
            <span className="material-symbols-outlined text-white text-2xl">insights</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Zero to Hero</h1>
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-green-500 pulse-live"></span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Live Market</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group w-full ${isActive
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(127,19,236,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span className={`material-symbols-outlined text-xl ${isActive ? 'text-primary' : 'group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="text-sm font-semibold tracking-wide">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(127,19,236,0.8)]"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* User Profile Section */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 overflow-hidden">
            <img
              alt="User Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxAYywO2Fu9hoUIg6vKs2SkJqrV1wO6H05i1HrLlwPOd3aDCVqpBkObqhTjLnWL1V4MJEpG4eWzFPXmF430c0r-NCE8SG32Rc_tIbJCK9dI_vX5pWJbaxS8WQnRnr5488CCc6GO4jqpczR0Vsc-Ir3PhG97jSls7yJKuefBmXzf0WOPQRYWeCyL-BY6GlOIHVvg6t4fEwSos-UU51drxaPkHW7XnTbPsh07hY81wZXvikwV-P9awwKcAMUo-kdEPT6wDE9bn5hUhU"
            />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-white">Prabhu Padala</div>
            <div className="text-[11px] text-slate-400">Pro Trader</div>
          </div>
          <span className="material-symbols-outlined text-slate-500 text-lg">chevron_right</span>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
