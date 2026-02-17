import React, { useState, useEffect } from 'react';
import { BrokerCredential, BrokerName, BrokerMode } from '../../types';
import { useAuth } from '../../services/useAuth';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (broker: Partial<BrokerCredential>) => Promise<void>;
    initialData?: BrokerCredential;
}

const AddBrokerModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
    const { user, accessLevel } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [brokerName, setBrokerName] = useState<BrokerName>('alpaca');
    const [mode, setMode] = useState<BrokerMode>('paper');
    const [displayName, setDisplayName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [accountId, setAccountId] = useState(''); // Schwab hash
    const [accessToken, setAccessToken] = useState('');
    const [refreshToken, setRefreshToken] = useState('');
    const [port, setPort] = useState('5000'); // IBKR
    const [isDefault, setIsDefault] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    useEffect(() => {
        if (initialData) {
            setBrokerName(initialData.broker_name);
            setMode(initialData.broker_mode);
            setDisplayName(initialData.display_name);
            setApiKey(initialData.api_key || '');
            setApiSecret(initialData.api_secret || '');
            setAccountId(initialData.account_id || '');
            setAccessToken(initialData.access_token || '');
            setRefreshToken(initialData.refresh_token || '');
            setPort(initialData.settings?.port || '5000');
            setIsDefault(initialData.is_default);
        } else {
            // Reset defaults
            setBrokerName('alpaca');
            // Logic for default mode based on access level
            setMode(accessLevel === 'trade' ? 'paper' : 'paper');
            setDisplayName('');
            setApiKey('');
            setApiSecret('');
            setAccountId('');
            setAccessToken('');
            setRefreshToken('');
            setIsDefault(false);
        }
    }, [initialData, isOpen, accessLevel]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!displayName) throw new Error('Display Name is required');
            if (mode === 'live' && accessLevel !== 'trade' && user?.role !== 'admin') {
                throw new Error('Live trading requires a Trade plan. Please contact admin.');
            }

            const brokerData: Partial<BrokerCredential> = {
                broker_name: brokerName,
                broker_mode: mode,
                display_name: displayName,
                is_default: isDefault,
                is_active: true
            };

            if (brokerName === 'alpaca') {
                if (!apiKey || !apiSecret) throw new Error('API Key and Secret are required for Alpaca');
                brokerData.api_key = apiKey;
                brokerData.api_secret = apiSecret;
                brokerData.base_url = mode === 'paper' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
            } else if (brokerName === 'schwab') {
                if (!accountId || !accessToken || !refreshToken) throw new Error('All Schwab fields are required');
                brokerData.api_key = accountId;
                brokerData.api_secret = accessToken;
                brokerData.account_id = accountId;
                brokerData.access_token = accessToken;
                brokerData.refresh_token = refreshToken;
                brokerData.base_url = 'https://api.schwabapi.com';
            } else if (brokerName === 'ibkr') {
                brokerData.api_key = apiKey || 'ibkr';
                brokerData.api_secret = apiSecret || 'ibkr';
                brokerData.settings = { port };
                brokerData.base_url = `https://localhost:${port}`;
            }

            await onSave(initialData ? { ...initialData, ...brokerData } : brokerData);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isTradeAccess = accessLevel === 'trade' || user?.role === 'admin';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white">{initialData ? 'Edit Broker' : 'Add Broker'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm font-bold">{error}</div>}

                    {/* Broker Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Broker</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['alpaca', 'schwab', 'ibkr'].map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => setBrokerName(b as BrokerName)}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold capitalize border ${brokerName === b ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0f1219] border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mode */}
                    {brokerName !== 'schwab' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trading Mode</label>
                            <div className="flex bg-[#0f1219] rounded-lg p-1 border border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setMode('paper')}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold uppercase ${mode === 'paper' ? 'bg-green-600/20 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Paper
                                </button>
                                {isTradeAccess && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('live')}
                                        className={`flex-1 py-1.5 rounded text-xs font-bold uppercase ${mode === 'live' ? 'bg-red-600/20 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Live
                                    </button>
                                )}
                            </div>
                            {mode === 'live' && <p className="text-[10px] text-red-400 mt-1 font-bold">⚠️ Live trading uses real money. Proceed with caution.</p>}
                        </div>
                    )}

                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="e.g. My Alpaca Account"
                            className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div className="border-t border-gray-800 my-4"></div>

                    {/* Specific Fields */}
                    {brokerName === 'alpaca' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Key</label>
                                <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="PK..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Secret</label>
                                <div className="relative">
                                    <input type={showSecret ? "text" : "password"} value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="Expected secret..." />
                                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-2 text-gray-500 hover:text-white"><span className="material-symbols-outlined text-sm">{showSecret ? 'visibility_off' : 'visibility'}</span></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {brokerName === 'schwab' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account Hash</label>
                                <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Access Token</label>
                                <input type="password" value={accessToken} onChange={e => setAccessToken(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Refresh Token</label>
                                <input type="password" value={refreshToken} onChange={e => setRefreshToken(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                            </div>
                        </div>
                    )}

                    {brokerName === 'ibkr' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Local API Port</label>
                                <input type="number" value={port} onChange={e => setPort(e.target.value)} className="w-full bg-[#0f1219] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="5000" />
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600" />
                            <span className="text-sm text-gray-300 font-bold">Set as Default Broker</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-800">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save Broker'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddBrokerModal;
