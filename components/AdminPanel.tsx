import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole, AccessLevel } from '../types';
import type { User } from '@supabase/supabase-js';


const WEBHOOK_APPROVE_USER = import.meta.env.VITE_WEBHOOK_APPROVE_USER || '';
const WEBHOOK_UPGRADE_USER = import.meta.env.VITE_WEBHOOK_UPGRADE_USER || '';

interface UpgradeRequest {
    id: number;
    user_id: string;
    email: string;
    full_name: string | null;
    current_level: string;
    requested_level: string;
    request_source: string;
    message: string | null;
    status: string;
    reviewed_by: string | null;
    review_note: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface AdminPanelProps {
    currentUser: User | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [actionReason, setActionReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingChange, setPendingChange] = useState<{ field: keyof UserProfile, value: any } | null>(null);
    const [pendingOpen, setPendingOpen] = useState(true);
    const [upgradeOpen, setUpgradeOpen] = useState(true);

    useEffect(() => {
        fetchUsers();
        fetchUpgradeRequests();
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

    const fetchUpgradeRequests = async () => {
        const { data, error } = await supabase
            .from('upgrade_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching upgrade requests:', error);
        } else {
            setUpgradeRequests(data || []);
        }
    };

    // Derived lists
    const pendingApproval = useMemo(
        () => users.filter(u => !u.is_active),
        [users]
    );

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

        // 1. Update User — use .select() to verify the update actually happened
        const { data: updatedRows, error: updateError } = await supabase
            .from('users')
            .update({ [pendingChange.field]: newValue })
            .eq('id', editingUser.id)
            .select();

        if (updateError) {
            alert('Failed to update user: ' + updateError.message);
            console.error('Update error:', updateError);
            return;
        }

        if (!updatedRows || updatedRows.length === 0) {
            alert('Update failed: No rows were affected. This may be a permissions (RLS) issue. Check your Supabase RLS policies on the "users" table allow admin updates.');
            console.error('Update returned 0 rows. RLS may be blocking the update. User ID:', editingUser.id, 'Field:', pendingChange.field, 'Value:', newValue);
            return;
        }

        console.log('User updated successfully:', updatedRows[0]);

        // 2. Log Access Change
        const { error: logError } = await supabase
            .from('user_access_log')
            .insert({
                user_id: editingUser.id,
                changed_field: pendingChange.field,
                old_value: String(oldValue),
                new_value: String(newValue),
                changed_by: currentUser.email,
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

    const quickAction = async (userId: string, updates: Record<string, any>, reason: string) => {
        // Determine which webhook to call based on the action
        const isApproval = 'is_active' in updates;
        const webhookUrl = isApproval ? WEBHOOK_APPROVE_USER : WEBHOOK_UPGRADE_USER;

        if (!webhookUrl) {
            alert('Webhook URL not configured. Set VITE_WEBHOOK_APPROVE_USER / VITE_WEBHOOK_UPGRADE_USER in your .env file.');
            return;
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    action: reason,
                    updates,
                    admin_email: currentUser?.email || 'unknown',
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                alert('Webhook failed: ' + errorText);
                return;
            }

            await fetchUsers();
        } catch (err: any) {
            alert('Webhook request failed: ' + (err.message || 'Network error'));
        }
    };

    const handleUpgradeAction = async (request: UpgradeRequest, action: 'approved' | 'rejected', newLevel?: string) => {
        const reviewNote = action === 'approved'
            ? `Upgraded to ${newLevel || request.requested_level} access`
            : 'Request rejected by admin';

        try {
            const response = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/upgrade-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: request.id,
                    action: action === 'approved' ? 'approve' : 'reject',
                    reviewed_by: currentUser?.id || currentUser?.email || 'unknown',
                    review_note: reviewNote,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                alert('Failed to process request: ' + errorText);
                return;
            }
        } catch (err: any) {
            alert('Request failed: ' + (err.message || 'Network error'));
            return;
        }

        await fetchUpgradeRequests();
        await fetchUsers();
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    };

    const getDisplayName = (user: UserProfile) =>
        user.full_name || user.name || user.username || user.user_name || 'Unnamed';

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchUsers(), fetchUpgradeRequests()]);
        setRefreshing(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black flex items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-rh-green">admin_panel_settings</span>
                    Admin Panel
                </h1>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white font-bold py-2.5 px-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-60"
                >
                    <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>sync</span>
                    <span className="text-sm">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="material-symbols-outlined animate-spin text-4xl text-rh-green">sync</span>
                </div>
            ) : (
                <>
                    {/* Section A: Pending Approval */}
                    <div className="mb-6 bg-white dark:bg-[#1e2124] rounded-2xl border border-amber-500/20 shadow-lg overflow-hidden">
                        <button
                            onClick={() => setPendingOpen(!pendingOpen)}
                            className="w-full flex items-center justify-between p-5 hover:bg-amber-500/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-amber-500">pending_actions</span>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">Pending Approval</span>
                                {pendingApproval.length > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        {pendingApproval.length}
                                    </span>
                                )}
                            </div>
                            <span className={`material-symbols-outlined text-slate-400 transition-transform ${pendingOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {pendingOpen && (
                            <div className="border-t border-amber-500/10">
                                {pendingApproval.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">
                                        <span className="material-symbols-outlined text-3xl mb-2 block text-slate-300 dark:text-slate-600">check_circle</span>
                                        No pending approval requests
                                    </div>
                                ) : (
                                    <div className="divide-y divide-amber-500/10">
                                        {pendingApproval.map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-4 px-5 hover:bg-amber-500/5 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{getDisplayName(user)}</p>
                                                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">Requested on {formatDate(user.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button
                                                        onClick={() => quickAction(user.id, { is_active: true }, 'Approved new user signup')}
                                                        className="flex items-center gap-1.5 bg-rh-green/10 hover:bg-rh-green/20 text-rh-green px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">check</span>
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => quickAction(user.id, { is_active: false }, 'Rejected new user signup')}
                                                        className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section B: Upgrade Requests */}
                    <div className="mb-6 bg-white dark:bg-[#1e2124] rounded-2xl border border-blue-500/20 shadow-lg overflow-hidden">
                        <button
                            onClick={() => setUpgradeOpen(!upgradeOpen)}
                            className="w-full flex items-center justify-between p-5 hover:bg-blue-500/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-blue-500">upgrade</span>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">Upgrade Requests</span>
                                {upgradeRequests.length > 0 && (
                                    <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        {upgradeRequests.length}
                                    </span>
                                )}
                            </div>
                            <span className={`material-symbols-outlined text-slate-400 transition-transform ${upgradeOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {upgradeOpen && (
                            <div className="border-t border-blue-500/10">
                                {upgradeRequests.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">
                                        <span className="material-symbols-outlined text-3xl mb-2 block text-slate-300 dark:text-slate-600">verified</span>
                                        No pending upgrade requests
                                    </div>
                                ) : (
                                    <div className="divide-y divide-blue-500/10">
                                        {upgradeRequests.map(req => (
                                            <div key={req.id} className="flex items-center justify-between p-4 px-5 hover:bg-blue-500/5 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{req.full_name || 'Unknown'}</p>
                                                    <p className="text-xs text-slate-400 truncate">{req.email}</p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${req.current_level === 'paper' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                                            {req.current_level}
                                                        </span>
                                                        <span className="material-symbols-outlined text-[12px] text-slate-500">arrow_forward</span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-rh-green/10 text-rh-green">
                                                            {req.requested_level}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${req.request_source === 'trial_expired' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                                            {req.request_source === 'trial_expired' ? 'Trial Expired' : 'Settings'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {timeAgo(req.created_at)}
                                                        </span>
                                                    </div>
                                                    {req.message && (
                                                        <p className="text-[11px] text-slate-400 mt-1.5 italic">&ldquo;{req.message}&rdquo;</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleUpgradeAction(req, 'approved', 'paper')}
                                                        className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">description</span>
                                                        Paper
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpgradeAction(req, 'approved', 'trade')}
                                                        className="flex items-center gap-1.5 bg-rh-green/10 hover:bg-rh-green/20 text-rh-green px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">trending_up</span>
                                                        Trade
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpgradeAction(req, 'rejected')}
                                                        className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Existing Users Table */}
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
                                        const displayName = getDisplayName(user);
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
                </>
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
