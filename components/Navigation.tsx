
import React from 'react';

const Navigation: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-header px-6 py-4 flex items-center justify-between z-50 rounded-t-2xl shadow-2xl">
      <button className="text-primary flex flex-col items-center gap-1 transition-transform active:scale-90">
        <span className="material-symbols-outlined">dashboard</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">Signal</span>
      </button>
      <button className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-1 active:scale-90">
        <span className="material-symbols-outlined">analytics</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">Portfolio</span>
      </button>
      <button className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-1 active:scale-90">
        <span className="material-symbols-outlined">auto_awesome</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">AI Hub</span>
      </button>
      <button className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-1 active:scale-90">
        <span className="material-symbols-outlined">settings</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">More</span>
      </button>
    </nav>
  );
};

export default Navigation;
