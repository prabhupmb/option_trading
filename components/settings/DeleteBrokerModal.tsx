import React from 'react';

interface Props {
    isOpen: boolean;
    brokerName?: string;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

const DeleteBrokerModal: React.FC<Props> = ({ isOpen, brokerName, onClose, onConfirm, isDeleting }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0f1219] border border-red-900/50 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-red-900/20">
                <div className="p-6 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-red-900/20 items-center justify-center flex mb-4 border border-red-500/20">
                        <span className="material-symbols-outlined text-3xl text-red-500">delete_forever</span>
                    </div>

                    <h3 className="text-xl font-black text-white mb-2">Delete Broker?</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        Are you sure you want to remove <span className="text-white font-bold">{brokerName}</span>?
                        <br />
                        <span className="text-red-400 text-xs font-bold mt-2 block bg-red-900/10 p-2 rounded">
                            ⚠️ Any active strategies using this broker will stop functioning immediately.
                        </span>
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteBrokerModal;
