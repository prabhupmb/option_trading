
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 glass-header px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-xl">insights</span>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white uppercase">Prabhu Stocks</h1>
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-green-500 pulse-live"></span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none">Live Market</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="text-slate-300 hover:text-white transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 overflow-hidden">
          <img 
            alt="User Profile" 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxAYywO2Fu9hoUIg6vKs2SkJqrV1wO6H05i1HrLlwPOd3aDCVqpBkObqhTjLnWL1V4MJEpG4eWzFPXmF430c0r-NCE8SG32Rc_tIbJCK9dI_vX5pWJbaxS8WQnRnr5488CCc6GO4jqpczR0Vsc-Ir3PhG97jSls7yJKuefBmXzf0WOPQRYWeCyL-BY6GlOIHVvg6t4fEwSos-UU51drxaPkHW7XnTbPsh07hY81wZXvikwV-P9awwKcAMUo-kdEPT6wDE9bn5hUhU"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
