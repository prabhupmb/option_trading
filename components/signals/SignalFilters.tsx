import React from 'react';

interface SignalFiltersProps {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    sortBy: string;
    onSortChange: (sort: string) => void;
}

const SignalFilters: React.FC<SignalFiltersProps> = ({
    activeFilter,
    onFilterChange,
    sortBy,
    onSortChange
}) => {
    const tabs = [
        { id: 'ALL', label: 'All Signals', color: 'bg-gray-800' },
        { id: 'BUY', label: 'Buy', color: 'text-green-500' },
        { id: 'SELL', label: 'Sell', color: 'text-red-500' },
        { id: 'HOLD', label: 'Hold', color: 'text-blue-500' },
        { id: 'WAIT', label: 'Wait', color: 'text-yellow-500' },
    ];

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-[#1a1f2e] border border-gray-800 rounded-xl p-2 sticky top-[4rem] z-30">
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onFilterChange(tab.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${activeFilter === tab.id
                                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-3 px-2 border-t md:border-t-0 border-gray-800 pt-3 md:pt-0">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sort By:</span>
                <div className="flex gap-2">
                    {['Confidence', 'Symbol', 'Signal'].map((option) => (
                        <button
                            key={option}
                            onClick={() => onSortChange(option)}
                            className={`text-xs font-medium transition-colors ${sortBy === option
                                    ? 'text-blue-500 font-bold'
                                    : 'text-gray-400 hover:text-white'
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

export default SignalFilters;
