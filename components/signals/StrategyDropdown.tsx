import React, { useState, useRef, useEffect } from 'react';
import { StrategyConfig } from '../../hooks/useStrategyConfigs';

interface StrategyDropdownProps {
    strategies: StrategyConfig[];
    selectedStrategy: string | null;
    onStrategyChange: (strategy: string | null) => void;
}

const StrategyDropdown: React.FC<StrategyDropdownProps> = ({ strategies, selectedStrategy, onStrategyChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const current = strategies.find(s => s.strategy === selectedStrategy);
    const displayLabel = current ? current.display_name : 'All Strategies';
    const displayIcon = current?.icon || 'tune';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 bg-[#1a1f2e] hover:bg-[#252b3b] text-white px-4 py-2 rounded-lg border border-gray-800 transition-all active:scale-[0.98] shadow-sm"
            >
                <span className="material-symbols-outlined text-sm">{displayIcon}</span>
                <span className="font-bold text-sm uppercase tracking-wide">{displayLabel}</span>
                <span
                    className="material-symbols-outlined text-gray-400 text-sm transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-[#1a1f2e] border border-gray-800 rounded-xl shadow-2xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-gray-800 mb-1">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Strategy Filter</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {/* All Strategies option */}
                        <button
                            onClick={() => { onStrategyChange(null); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-3 hover:bg-[#252b3b] transition-colors flex items-center justify-between group
                                ${selectedStrategy === null ? 'bg-[#252b3b]/50' : ''}
                            `}
                        >
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-gray-400">tune</span>
                                <span className={`font-bold text-sm ${selectedStrategy === null ? 'text-blue-400' : 'text-gray-300 group-hover:text-white'}`}>
                                    All Strategies
                                </span>
                            </div>
                            {selectedStrategy === null && (
                                <span className="material-symbols-outlined text-blue-500 text-sm">check</span>
                            )}
                        </button>

                        {strategies.map((strategy) => (
                            <button
                                key={strategy.id}
                                onClick={() => { onStrategyChange(strategy.strategy); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-3 hover:bg-[#252b3b] transition-colors flex items-center justify-between group
                                    ${selectedStrategy === strategy.strategy ? 'bg-[#252b3b]/50' : ''}
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-gray-400">{strategy.icon}</span>
                                    <span className={`font-bold text-sm ${selectedStrategy === strategy.strategy ? 'text-blue-400' : 'text-gray-300 group-hover:text-white'}`}>
                                        {strategy.display_name}
                                    </span>
                                </div>
                                {selectedStrategy === strategy.strategy && (
                                    <span className="material-symbols-outlined text-blue-500 text-sm">check</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyDropdown;
