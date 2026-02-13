import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole, AccessLevel } from '../types';
import type { User } from '@supabase/supabase-js';

interface AdminPanelProps {
    currentUser: User | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [actionReason, setActionReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingChange, setPendingChange] = useState<{ field: keyof UserProfile, value: any } | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    const handleEditClick = (user: UserProfile) => {
        setEditingUser(user);
        setActionReason('');
        setShowConfirm(false);
        setPendingChange(null);
    };

    const confirmChange = (field: keyof UserProfile, value: any) => {
        setPendingChange({ field, value });
        setShowConfirm(true);
    };

    const executeChange = async () => {
        if (!editingUser || !pendingChange || !currentUser) return;

        const oldValue = editingUser[pendingChange.field];
        const newValue = pendingChange.value;

        // 1. Update User
        const { error: updateError } = await supabase
            .from('users')
            .update({ [pendingChange.field]: newValue })
            .eq('id', editingUser.id);

        if (updateError) {
            alert('Failed to update user: ' + updateError.message);
            return;
        }

        // 2. Log Access Change
        const { error: logError } = await supabase
            .from('user_access_log')
            .insert({
                user_id: editingUser.id,
                changed_field: pendingChange.field,
                old_value: String(oldValue),
                new_value: String(newValue),
                changed_by: currentUser.email, // Using email for readability or ID
                reason: actionReason || 'Admin Update'
            });

        if (logError) {
            console.error('Failed to log access change:', logError);
        }

        // Refresh & Close
        await fetchUsers();
        setEditingUser(null);
        setShowConfirm(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-900 dark:text-white">
            <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-rh-green">admin_panel_settings</span>
                Admin Panel
            </h1>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="material-symbols-outlined animate-spin text-4xl text-rh-green">sync</span>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1e2124] rounded-3xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-xs uppercase tracking-widest font-bold text-slate-500">
                                    <th className="p-6">User</th>
                                    <th className="p-6">Email</th>
                                    <th className="p-6">Role</th>
                                    <th className="p-6">Access Level</th>
                                    <th className="p-6 text-center">Status</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {users.map(user => {
                                    // Robust name resolution
                                    // Try full_name (DB convention), then name, then username, then email part
                                    const displayName = user.full_name || user.name || user.username || user.user_name || 'Unnamed';
                                    const username = user.username || user.user_name;

                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{displayName}</span>
                                                    {username && username !== displayName && (
                                                        <span className="text-[10px] font-mono text-slate-400">@{username}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-xs text-slate-500 font-medium">{user.email}</span>
                                            </td>
                                            <td className="p-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${user.access_level === 'trade' ? 'bg-rh-green/10 text-rh-green' :
                                                    user.access_level === 'paper' ? 'bg-blue-500/10 text-blue-500' :
                                                        'bg-orange-500/10 text-orange-500'
                                                    }`}>
                                                    {user.access_level}
                                                </span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <button
                                                    onClick={() => confirmChange('is_active', !user.is_active)}
                                                    className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${user.is_active ? 'bg-rh-green' : 'bg-slate-300 dark:bg-white/20'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${user.is_active ? 'translate-x-4' : ''}`}></div>
                                                </button>
                                            </td>
                                            <td className="p-6 text-right">
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-md bg-[#1e2124] rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 space-y-6">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-white">Edit User Access</h3>
                            <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Role</label>
                                <select
                                    value={editingUser.role}
                                    onChange={(e) => confirmChange('role', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rh-green font-medium"
                                >
                                    <option value="customer">Customer</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Access Level</label>
                                <select
                                    value={editingUser.access_level}
                                    onChange={(e) => confirmChange('access_level', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rh-green font-medium"
                                >
                                    <option value="signal">Signal Only</option>
                                    <option value="paper">Paper Trading</option>
                                    <option value="trade">Live Trading</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Is Active?</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => confirmChange('is_active', !editingUser.is_active)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all ${editingUser.is_active
                                            ? 'bg-rh-green text-white border-rh-green'
                                            : 'bg-transparent text-slate-400 border-white/10 hover:border-white/30'
                                            }`}
                                    >
                                        {editingUser.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Confirmation Sub-Modal */}
                        {showConfirm && (
                            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl animate-in slide-in-from-top-2">
                                <p className="text-sm font-bold text-yellow-500 mb-2">Confirm Change</p>
                                <p className="text-xs text-slate-400 mb-3">
                                    Changing <span className="font-bold text-white">{pendingChange?.field}</span> to <span className="font-bold text-white">{String(pendingChange?.value)}</span>.
                                </p>
                                <input
                                    type="text"
                                    placeholder="Enter reason for change..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:border-yellow-500 outline-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={executeChange}
                                        disabled={!actionReason}
                                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-lg text-xs uppercase tracking-wide disabled:opacity-50"
                                    >
                                        Update
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        className="px-3 bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-lg text-xs uppercase"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
