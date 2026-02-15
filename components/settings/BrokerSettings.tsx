import React, { useState } from 'react';
import { useBrokers } from '../../hooks/useBrokers';
import { useAuth } from '../../services/useAuth';
import BrokerCard from './BrokerCard';
import AddBrokerModal from './AddBrokerModal';
import DeleteBrokerModal from './DeleteBrokerModal';
import { BrokerCredential } from '../../types';

const BrokerSettings: React.FC = () => {
    const { user, accessLevel } = useAuth();
    const { brokers, loading, error, addBroker, updateBroker, deleteBroker, setAsDefault, toggleActive } = useBrokers();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingBroker, setEditingBroker] = useState<BrokerCredential | undefined>(undefined);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Hide for signal-only users
    if (accessLevel === 'signal' && user?.role !== 'admin') {
        return null;
    }

    const handleSave = async (brokerData: Partial<BrokerCredential>) => {
        if (editingBroker) {
            await updateBroker(editingBroker.id, brokerData);
        } else {
            await addBroker(brokerData);
        }
        setIsAddOpen(false);
        setEditingBroker(undefined);
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setIsDeleting(true);
        await deleteBroker(deletingId);
        setIsDeleting(false);
        setDeletingId(null);
    };

    return (
        <div className="border border-gray-800 rounded-2xl bg-[#0f1219] p-6 mb-8 relative overflow-hidden group">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">hub</span>
                        Connected Brokers
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Manage your API connections for live and paper trading.</p>
                </div>
                <button
                    onClick={() => { setEditingBroker(undefined); setIsAddOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wide rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-sm">add_link</span>
                    Connect Broker
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-900/10 border border-red-900/30 rounded-xl flex items-center gap-3 text-red-400">
                    <span className="material-symbols-outlined">error</span>
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2].map(i => (
                        <div key={i} className="h-48 bg-gray-800/20 rounded-xl animate-pulse border border-gray-800/50"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brokers.map((broker) => (
                        <BrokerCard
                            key={broker.id}
                            broker={broker}
                            onEdit={(b) => { setEditingBroker(b); setIsAddOpen(true); }}
                            onDelete={(id) => setDeletingId(id)}
                            onToggleActive={(id, current) => toggleActive(id, current)}
                            onSetDefault={(id) => setAsDefault(id)}
                        />
                    ))}

                    {brokers.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-3xl text-gray-600">link_off</span>
                            </div>
                            <h3 className="text-lg font-black text-gray-400">No Brokers Connected</h3>
                            <p className="text-sm text-gray-600 mt-2 max-w-xs mx-auto">Connect your Alpaca, Schwab, or IBKR account to start trading directly from the platform.</p>
                            <button
                                onClick={() => setIsAddOpen(true)}
                                className="mt-6 text-blue-500 text-xs font-bold uppercase hover:underline"
                            >
                                Add First Broker
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <AddBrokerModal
                isOpen={isAddOpen}
                onClose={() => { setIsAddOpen(false); setEditingBroker(undefined); }}
                onSave={handleSave}
                initialData={editingBroker}
            />

            <DeleteBrokerModal
                isOpen={!!deletingId}
                brokerName={brokers.find(b => b.id === deletingId)?.display_name}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default BrokerSettings;
