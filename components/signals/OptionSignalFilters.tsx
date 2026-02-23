import React from 'react';

interface Props {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    sortBy: string;
    onSortChange: (sort: string) => void;
    onStrategyChange?: (strategy: string | null) => void;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

const OptionSignalFilters: React.FC<Props> = ({
    activeFilter,
    onFilterChange,
    sortBy,
    onSortChange,
    onStrategyChange,
    searchQuery = '',
    onSearchChange,
}) => {
    const tabs = [
        { id: 'ALL', label: 'All', color: 'text-gray-400' },
        { id: 'STRONG_BUY', label: 'Strong Buy', color: 'text-green-500' },
        { id: 'BUY', label: 'Buy', color: 'text-green-400' },
        { id: 'STRONG_SELL', label: 'Strong Sell', color: 'text-red-500' },
        { id: 'SELL', label: 'Sell', color: 'text-red-400' },
    ];

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-800 rounded-xl p-2 md:sticky md:top-6 z-10 shadow-sm dark:shadow-lg dark:shadow-black/20">
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            onFilterChange(tab.id);
                            if (tab.id === 'ALL' && onStrategyChange) onStrategyChange(null);
                        }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeFilter === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105'
                                : 'bg-transparent text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                    >
                        <span className={activeFilter !== tab.id ? tab.color : ''}>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-3 px-2 border-t md:border-t-0 border-gray-200 dark:border-gray-800 pt-3 md:pt-0">
                {/* Ticker Search */}
                {onSearchChange && (
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search ticker..."
                            className="w-28 md:w-36 pl-7 pr-7 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>
                )}

                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sort By:</span>
                <div className="flex gap-2">
                    {['Signal', 'Tier', 'Symbol', 'Time'].map((option) => (
                        <button
                            key={option}
                            onClick={() => onSortChange(option)}
                            className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${sortBy === option ? 'text-blue-400' : 'text-gray-400 dark:text-gray-600 hover:text-slate-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OptionSignalFilters;
