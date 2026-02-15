import React, { useState } from 'react';
import { UserProfile, UserRole, AccessLevel } from '../types';
import { useAuth } from '../services/useAuth';
import BrokerSettings from './settings/BrokerSettings';

const UserProfilePage: React.FC = () => {
    const { user, role, accessLevel, verificationData } = useAuth();
    const [requesting, setRequesting] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpgradeRequest = async (type: 'trade' | 'live') => {
        setRequesting(true);
        setMessage('');

        try {
            // Mocking the request - in production this would hit a webhook
            // const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/request-upgrade', ...);

            await new Promise(r => setTimeout(r, 1000)); // Simulate delay

            setMessage(`Request for ${type === 'trade' ? 'Trading Access' : 'Live Trading'} sent to admin.`);
        } catch (e) {
            setMessage('Failed to send request.');
        } finally {
            setRequesting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="p-8 max-w-4xl mx-auto text-slate-900 dark:text-white">
            <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-rh-green">person</span>
                User Profile
            </h1>

            <div className="bg-white dark:bg-[#1e2124] rounded-3xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-xl p-8 mb-8">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden shadow-id">
                        {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt={user.email} className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-6xl text-slate-400 flex items-center justify-center w-full h-full">person</span>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{user.user_metadata?.full_name || 'User'}</h2>
                        <p className="text-slate-500 font-medium">{user.email}</p>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-white/5 pt-8">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Account Status</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                <span className="font-bold text-sm">Role</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                                    {role || 'Customer'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                <span className="font-bold text-sm">Access Level</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${accessLevel === 'trade' ? 'bg-rh-green/10 text-rh-green' :
                                    accessLevel === 'paper' ? 'bg-blue-500/10 text-blue-500' :
                                        'bg-orange-500/10 text-orange-500'
                                    }`}>
                                    {accessLevel || 'Signal Only'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions</h3>

                        <div className="space-y-3">
                            {accessLevel === 'signal' && (
                                <button
                                    onClick={() => handleUpgradeRequest('trade')}
                                    disabled={requesting}
                                    className="w-full bg-rh-green hover:bg-rh-green/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-rh-green/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">upgrade</span>
                                    {requesting ? 'Sending...' : 'Request Upgrade to Trade'}
                                </button>
                            )}

                            {accessLevel === 'paper' && (
                                <button
                                    onClick={() => handleUpgradeRequest('live')}
                                    disabled={requesting}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    {requesting ? 'Sending...' : 'Request Live Trading'}
                                </button>
                            )}

                            {message && (
                                <p className="text-center text-xs font-bold text-rh-green animate-in fade-in bg-rh-green/10 py-2 rounded-lg">{message}</p>
                            )}

                            {!message && (accessLevel === 'signal' || accessLevel === 'paper') && (
                                <p className="text-center text-[10px] text-slate-400">
                                    Requests are reviewed by admins within 24 hours.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Broker Settings Section */}
            <BrokerSettings />
        </div>
    );
};

export default UserProfilePage;
