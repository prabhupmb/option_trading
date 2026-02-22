import React, { useState, useMemo } from 'react';
import ExecuteTradeModal from './components/ExecuteTradeModal';
import Header from './components/Header';
import StockSignalCard from './components/StockSignalCard';
import OptionSignalStats from './components/signals/OptionSignalStats';
import OptionSignalFilters from './components/signals/OptionSignalFilters';
import Navigation, { View } from './components/Navigation';
import Portfolio from './components/Portfolio';
import LoginPage from './components/LoginPage';
import AccessDeniedPage from './components/AccessDeniedPage';
import TrialExpiredPage from './components/TrialExpiredPage';
import SignupForm from './components/SignupForm';
import AIHub from './components/AIHub';
import AdminPanel from './components/AdminPanel';
import SignalFeed from './components/SignalFeed';
import UserProfilePage from './components/UserProfilePage';
import { useAuth } from './services/useAuth';
import { OptionSignal } from './types';
import { useOptionSignals } from './hooks/useOptionSignals';
import { useStrategyConfigs } from './hooks/useStrategyConfigs';
import { useScanProgress } from './hooks/useScanProgress';

const App: React.FC = () => {
  const { user, session, loading: authLoading, isAuthenticated, verificationStatus, verificationData, signInWithGoogle, signOut, role, accessLevel, trialDaysLeft, isTrialUser } = useAuth();

  // Strategy filter
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>('swing_trade');
  const { strategies } = useStrategyConfigs();

  // New Hook
  const { signals, loading, error, refresh, lastUpdated } = useOptionSignals(selectedStrategy);
  const { progress: scanProgress, startScan } = useScanProgress(user?.email || undefined, selectedStrategy);

  // Execution Modal State
  const [executingSignal, setExecutingSignal] = useState<OptionSignal | null>(null);

  const [currentView, setCurrentView] = useState<View>('signals');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('Tier');
  const [selectedBrokerage, setSelectedBrokerage] = useState<string>('Alpaca');

  // Filter & Sort Logic
  const processedSignals = useMemo(() => {
    let result = [...signals];

    // Filter Logic
    if (activeFilter !== 'ALL') {
      const normalize = (s: string) => s?.toUpperCase() || '';
      const signal = (s: any) => normalize(s.trading_recommendation);

      if (activeFilter === 'STRONG_BUY') {
        // Must contain STRONG and BUY
        result = result.filter(s => signal(s).includes('STRONG') && signal(s).includes('BUY'));
      } else if (activeFilter === 'BUY') {
        // Must contain BUY but NOT STRONG and NOT WEAK
        result = result.filter(s => signal(s).includes('BUY') && !signal(s).includes('STRONG') && !signal(s).includes('WEAK'));
      } else if (activeFilter === 'STRONG_SELL') {
        // Must contain STRONG and SELL
        result = result.filter(s => signal(s).includes('STRONG') && signal(s).includes('SELL'));
      } else if (activeFilter === 'SELL') {
        // Must contain SELL but NOT STRONG and NOT WEAK
        result = result.filter(s => signal(s).includes('SELL') && !signal(s).includes('STRONG') && !signal(s).includes('WEAK'));
      }
    }

    // Sort Logic
    result.sort((a, b) => {
      if (sortBy === 'Symbol') {
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'Signal') {
        // Sort by signal strength order usually? Or just string?
        // Let's do simple string for now or custom rank
        const rank = { 'STRONG BUY': 5, 'BUY': 4, 'WEAK BUY': 3, 'WEAK SELL': 2, 'SELL': 1, 'STRONG SELL': 0 };
        const getRank = (s: string) => {
          const u = s?.toUpperCase() || '';
          if (u.includes('STRONG BUY')) return 5;
          if (u === 'BUY') return 4;
          if (u.includes('WEAK BUY')) return 3;
          if (u.includes('WEAK SELL')) return 2;
          if (u === 'SELL') return 1;
          if (u.includes('STRONG SELL')) return 0;
          return -1;
        };
        return getRank(b.trading_recommendation) - getRank(a.trading_recommendation);
      }
      if (sortBy === 'Tier') {
        const rank = { 'A+': 4, 'A': 3, 'B+': 2, 'NO_TRADE': 1 };
        // @ts-ignore
        return (rank[b.tier] || 0) - (rank[a.tier] || 0);
      }
      if (sortBy === 'Analysis Time') {
        return new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime();
      }
      return 0;
    });
    return result;
  }, [signals, activeFilter, sortBy]);

  const handleManualRefresh = () => {
    startScan(refresh);
  };

  const handleExecute = (signal: OptionSignal) => {
    setExecutingSignal(signal);
  };

  const handleViewAnalysis = (signal: OptionSignal) => {
    console.log('View analysis:', signal);
  };

  // Auth Loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30 inline-block mb-4">
            <span className="material-symbols-outlined text-white text-4xl animate-spin">insights</span>
          </div>
          <p className="text-slate-400 font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // Not Authenticated
  if (!isAuthenticated || verificationStatus === 'unauthorized') {
    return <LoginPage onGoogleLogin={signInWithGoogle} />;
  }

  // Verifying
  if (verificationStatus === 'verifying' || verificationStatus === 'idle') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-rh-green p-4 rounded-2xl shadow-2xl shadow-rh-green/30 inline-block mb-4">
            <span className="material-symbols-outlined text-white text-4xl animate-spin">verified_user</span>
          </div>
          <p className="text-slate-400 font-medium animate-pulse">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Signup
  if (verificationStatus === 'signup') {
    return <SignupForm verificationData={verificationData} session={session} onSignOut={signOut} />;
  }

  // Access Denied
  if (verificationStatus === 'denied') {
    return <AccessDeniedPage onSignOut={signOut} userEmail={verificationData.email || user?.email || undefined} message={verificationData.message} />;
  }

  // Trial Expired
  if (verificationStatus === 'trial_expired') {
    return <TrialExpiredPage onSignOut={signOut} userEmail={verificationData.email || user?.email || undefined} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0712] transition-colors font-sans text-slate-900 dark:text-white">
      <Navigation activeView={currentView} onNavigate={setCurrentView} user={user} onSignOut={signOut} role={role} accessLevel={accessLevel} trialDaysLeft={trialDaysLeft} isTrialUser={isTrialUser} />

      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header
          lastUpdated={lastUpdated}
          onRefresh={handleManualRefresh}
          loading={loading}
          user={user}
          onSignOut={signOut}
          selectedBrokerage={selectedBrokerage}
          onBrokerageChange={setSelectedBrokerage}
          onNavigate={setCurrentView}
          scanProgress={scanProgress}
          strategies={strategies}
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
        />

        {currentView === 'signals' ? (
          <main className="flex-1 p-8 overflow-y-auto">
            {/* Stats Bar */}
            <OptionSignalStats signals={signals} onFilterClick={setActiveFilter} />

            {/* Header / Filter Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Option Feed
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md align-middle">{processedSignals.length} Active</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Real-time data stream'} • Connected to Supabase
                </p>
              </div>

              {/* Filters */}
              <div className="flex-1 md:flex-none">
                <OptionSignalFilters
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onStrategyChange={setSelectedStrategy}
                />
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">Connection Failed</p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">{error}</p>
                </div>
                <button onClick={refresh} className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wide">Retry</button>
              </div>
            )}

            {/* Loading State */}
            {loading && signals.length === 0 && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl text-rh-green animate-spin-slow">refresh</span>
                  <p className="text-slate-400 mt-4 font-medium animate-pulse">Syncing OptionChain Data...</p>
                </div>
              </div>
            )}

            {/* Signals Grid */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {processedSignals.map((signal) => (
                  <StockSignalCard
                    key={signal.id || signal.symbol}
                    signal={signal}
                    onViewAnalysis={handleViewAnalysis}
                    onExecute={handleExecute}
                    accessLevel={accessLevel}
                  />
                ))}
                {processedSignals.length === 0 && (
                  <div className="col-span-full py-20 text-center opacity-50">
                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-white/10 mb-4">filter_list_off</span>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No signals match your filter</p>
                    <button onClick={() => setActiveFilter('ALL')} className="mt-4 text-rh-green font-bold text-xs uppercase hover:underline">Clear Filters</button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-12 text-center border-t border-gray-100 dark:border-white/5 pt-8">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest opacity-60">
                Option Feed AI • v2.1.0 • Connected to Supabase
              </p>
            </div>
          </main>
        ) : currentView === 'portfolio' ? (
          <div className="flex-1 overflow-y-auto">
            <Portfolio />
          </div>
        ) : currentView === 'ai-hub' ? (
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <AIHub />
          </div>
        ) : currentView === 'smart-feed' ? (
          <SignalFeed />
        ) : currentView === 'settings' ? (
          <div className="flex-1 overflow-y-auto">
            <UserProfilePage />
          </div>
        ) : currentView === 'admin' && role === 'admin' ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0a0712]">
            <AdminPanel currentUser={user} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl opacity-40">construction</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Coming Soon</h3>
          </div>
        )}
      </div>

      {/* Trade Modal */}
      <ExecuteTradeModal
        isOpen={!!executingSignal}
        signal={executingSignal}
        onClose={() => setExecutingSignal(null)}
        onSuccess={() => {
          setExecutingSignal(null);
          refresh();
        }}
        onNavigate={(view) => { setExecutingSignal(null); setCurrentView(view as View); }}
      />
    </div>
  );
};

export default App;
