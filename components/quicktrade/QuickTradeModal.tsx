import React from 'react';
import QuickTradeForm from './QuickTradeForm';
import { OptionSignal } from '../../types';

interface QuickTradeModalProps {
    isOpen: boolean;
    signal: OptionSignal | null;
    onClose: () => void;
    onSuccess?: () => void;
    onNavigate?: (view: string) => void;
}

const QuickTradeModal: React.FC<QuickTradeModalProps> = ({ isOpen, signal, onClose, onSuccess, onNavigate }) => {
    if (!isOpen || !signal) return null;

    // Determine default direction from signal recommendation
    const rec = (signal.trading_recommendation || '').toUpperCase();
    const defaultDir: 'CALL' | 'PUT' = rec.includes('SELL') ? 'PUT' : 'CALL';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-[#0f1219] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-purple-400 text-lg">bolt</span>
                        </div>
                        <div>
                            <h2 className="text-white font-black text-sm uppercase tracking-tight">Quick Trade</h2>
                            <p className="text-gray-500 text-[10px]">{signal.symbol} • One-click execution</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    <QuickTradeForm
                        symbol={signal.symbol}
                        currentPrice={signal.current_price}
                        defaultDirection={defaultDir}
                        signalTier={signal.tier}
                        onClose={onClose}
                        onSuccess={onSuccess}
                        onNavigate={onNavigate}
                    />
                </div>
            </div>
        </div>
    );
};

export default QuickTradeModal;
