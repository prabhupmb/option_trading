import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrokerCredential } from '../types';
import { useBrokers } from '../hooks/useBrokers';
import { useAuth } from '../services/useAuth';

interface BrokerContextType {
    brokers: BrokerCredential[];
    selectedBroker: BrokerCredential | null;
    loading: boolean;
    error: string | null;
    selectBroker: (brokerId: string) => void;
    refreshBrokers: () => Promise<void>;
}

const BrokerContext = createContext<BrokerContextType | undefined>(undefined);

export const BrokerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { brokers, loading, error, fetchBrokers } = useBrokers();
    const { user } = useAuth();
    const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);

    // Auto-select default broker or first available
    useEffect(() => {
        if (!loading && brokers.length > 0) {
            // If already selected and valid, keep it
            if (selectedBrokerId && brokers.find(b => b.id === selectedBrokerId && b.is_active)) {
                return;
            }

            // Otherwise, pick default
            const defaultBroker = brokers.find(b => b.is_default && b.is_active);
            if (defaultBroker) {
                setSelectedBrokerId(defaultBroker.id);
            } else {
                // Fallback to first active
                const firstActive = brokers.find(b => b.is_active);
                if (firstActive) {
                    setSelectedBrokerId(firstActive.id);
                } else {
                    setSelectedBrokerId(null);
                }
            }
        } else if (!loading && brokers.length === 0) {
            setSelectedBrokerId(null);
        }
    }, [brokers, loading, selectedBrokerId]);

    const selectBroker = (id: string) => {
        setSelectedBrokerId(id);
    };

    const selectedBroker = brokers.find(b => b.id === selectedBrokerId) || null;

    return (
        <BrokerContext.Provider value={{
            brokers,
            selectedBroker,
            loading,
            error,
            selectBroker,
            refreshBrokers: fetchBrokers
        }}>
            {children}
        </BrokerContext.Provider>
    );
};

export const useBrokerContext = () => {
    const context = useContext(BrokerContext);
    if (context === undefined) {
        throw new Error('useBrokerContext must be used within a BrokerProvider');
    }
    return context;
};
