import React from 'react';
import { BrokerCredential } from '../../types';

interface Props {
    broker: BrokerCredential;
    onEdit: (broker: BrokerCredential) => void;
    onDelete: (id: string) => void;
    onToggleActive: (id: string, current: boolean) => void;
    onSetDefault: (id: string) => void;
}

const BrokerCard: React.FC<Props> = ({ broker, onEdit, onDelete, onToggleActive, onSetDefault }) => {
    const isAlpaca = broker.broker_name === 'alpaca';
    const isSchwab = broker.broker_name === 'schwab';

    const maskKey = (key?: string) => {
        if (!key || key.length < 8) return '••••••••';
        return `${key.slice(0, 4)}••••${key.slice(-4)}`;
    };

    const getStatusColor = () => {
        if (!broker.is_active) return 'text-gray-500';
        return 'text-green-500 animate-pulse';
    };

    return (
        <div className={`border rounded-xl p-5 relative overflow-hidden transition-all duration-300 group
        ${broker.is_default
                ? 'bg-[#1a1f2e] border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                : 'bg-[#0f1219] border-gray-800 hover:border-gray-600'
            }
        ${!broker.is_active ? 'opacity-60 grayscale' : ''}
    `}>
            {broker.is_default && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-lg">
                    Default
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border
                    ${isAlpaca ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-blue-500/10 border-blue-500/30'}
                `}>
                        <span className="material-symbols-outlined text-lg">
                            {isAlpaca ? 'savings' : 'account_balance'}
                        </span>
                    </div>
                    <div>
                        <h4 className="text-white font-black text-lg tracking-tight">{broker.display_name}</h4>
                        <span className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded border 
                        ${broker.broker_mode === 'live' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-green-500/10 text-green-500 border-green-500/30'}
                    `}>
                            {broker.broker_mode} Trading
                        </span>
                    </div>
                </div>

                <button className="text-gray-600 hover:text-white transition-colors" title="Manage">
                    <span className="material-symbols-outlined">more_vert</span>
                </button>
            </div>

            <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">
                        {isAlpaca ? 'API Key' : isSchwab ? 'Account Hash' : 'Connection'}
                    </span>
                    <span className="text-gray-300 font-mono">
                        {maskKey(broker.api_key || broker.account_id || 'Active')}
                    </span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">Status</span>
                    <span className={`font-bold flex items-center gap-1.5 ${getStatusColor()}`}>
                        {broker.is_active ? 'Active' : 'Disabled'}
                        <span className="material-symbols-outlined text-[10px] font-black">circle</span>
                    </span>
                </div>
                {isSchwab && (
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase tracking-wider text-red-400">Token Exp</span>
                        <span className="text-red-400 font-mono">2h 15m</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(broker)}
                    className="bg-[#1a1f2e] hover:bg-[#2a2f3e] text-gray-300 text-xs font-bold py-2 rounded-lg border border-gray-700 transition-colors"
                >
                    Edit
                </button>
                <button
                    onClick={() => onDelete(broker.id)}
                    className="bg-red-900/10 hover:bg-red-900/20 text-red-500 text-xs font-bold py-2 rounded-lg border border-red-900/30 transition-colors"
                >
                    Delete
                </button>
                {!broker.is_default && (
                    <button
                        onClick={() => onSetDefault(broker.id)}
                        className="col-span-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold py-2 rounded-lg border border-blue-600/30 transition-colors"
                    >
                        Set as Default
                    </button>
                )}
            </div>
        </div>
    );
};

export default BrokerCard;
