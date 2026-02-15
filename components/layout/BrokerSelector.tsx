import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../services/useAuth';
import { useBrokerContext } from '../../context/BrokerContext';

const BrokerSelector: React.FC = () => {
    const { user, accessLevel } = useAuth();
    const { brokers, selectedBroker, selectBroker } = useBrokerContext();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Hide for signal-only users
    if (accessLevel === 'signal' && user?.role !== 'admin') {
        return null;
    }

    const availableBrokers = brokers.filter(b => b.is_active);

    // If no brokers, show placeholder or setup button?
    // We'll show "No Broker" or similar if critical.
    if (availableBrokers.length === 0) {
        return (
            <div className="relative">
                <button
                    disabled
                    className="flex items-center space-x-2 bg-[#1a1f2e] text-gray-400 px-4 py-2 rounded-lg border border-gray-800 cursor-not-allowed opacity-70"
                >
                    <span className="material-symbols-outlined text-gray-500">link_off</span>
                    <span className="font-bold text-sm uppercase tracking-wide">No Broker</span>
                </button>
            </div>
        );
    }

    const currentBroker = selectedBroker || availableBrokers[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 bg-[#1a1f2e] hover:bg-[#252b3b] text-white px-4 py-2 rounded-lg border border-gray-800 transition-all active:scale-[0.98] shadow-sm"
            >
                <div className={`w-2 h-2 rounded-full ${currentBroker?.broker_mode === 'live' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                    {currentBroker?.display_name || 'Select Broker'}
                </span>
                <span className="material-symbols-outlined text-gray-400 text-sm transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#1a1f2e] border border-gray-800 rounded-xl shadow-2xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-gray-800 mb-1">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Select Broker</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {availableBrokers.map((broker) => (
                            <button
                                key={broker.id}
                                onClick={() => {
                                    selectBroker(broker.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-[#252b3b] transition-colors flex items-center justify-between group
                                    ${currentBroker?.id === broker.id ? 'bg-[#252b3b]/50' : ''}
                                `}
                            >
                                <div className="flex flex-col">
                                    <span className={`font-bold text-sm ${currentBroker?.id === broker.id ? 'text-blue-400' : 'text-gray-300 group-hover:text-white'}`}>
                                        {broker.display_name}
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 w-fit px-1.5 rounded border 
                                        ${broker.broker_mode === 'live' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}
                                    `}>
                                        {broker.broker_mode}
                                    </span>
                                </div>
                                {currentBroker?.id === broker.id && (
                                    <span className="material-symbols-outlined text-blue-500 text-sm">check</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-gray-800 mt-1 pt-1">
                        <a href="#settings" className="block px-4 py-3 text-xs font-bold text-gray-400 hover:text-white hover:bg-[#252b3b] transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">settings</span>
                            Manage Brokers
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrokerSelector;
