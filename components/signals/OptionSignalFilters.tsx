import React from 'react';

interface Props {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    sortBy: string;
    onSortChange: (sort: string) => void;
}

const OptionSignalFilters: React.FC<Props> = ({
    activeFilter,
    onFilterChange,
    sortBy,
    onSortChange
}) => {
    const tabs = [
        { id: 'ALL', label: 'All Signals', color: 'text-gray-400' },
        { id: 'A+', label: 'A+ Signals', color: 'text-yellow-500' },
        { id: 'CALL', label: 'Calls', color: 'text-green-500' },
        { id: 'PUT', label: 'Puts', color: 'text-red-500' },
        { id: 'NO_TRADE', label: 'No Trade', color: 'text-gray-500' },
    ];

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-[#1a1f2e] border border-gray-800 rounded-xl p-2 md:sticky md:top-6 z-10 shadow-lg shadow-black/20">
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onFilterChange(tab.id)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeFilter === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105'
                                : 'bg-transparent text-gray-500 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        <span className={activeFilter !== tab.id ? tab.color : ''}>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-3 px-2 border-t md:border-t-0 border-gray-800 pt-3 md:pt-0">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sort By:</span>
                <div className="flex gap-2">
                    {['Tier', 'Symbol', 'Analysis Time'].map((option) => (
                        <button
                            key={option}
                            onClick={() => onSortChange(option)}
                            className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${sortBy === option ? 'text-blue-400' : 'text-gray-600 hover:text-gray-300'
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
