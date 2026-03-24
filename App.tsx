import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ExecuteTradeModal from './components/ExecuteTradeModal';
import Header from './components/Header';
import StockSignalCard from './components/StockSignalCard';
import OptionSignalStats from './components/signals/OptionSignalStats';
import OptionSignalFilters from './components/signals/OptionSignalFilters';
import Navigation, { View } from './components/Navigation';
import Portfolio from './components/Portfolio';
import GroupChat from './components/GroupChat';
import LoginPage from './components/LoginPage';
import AccessDeniedPage from './components/AccessDeniedPage';
import TrialExpiredPage from './components/TrialExpiredPage';
import SignupForm from './components/SignupForm';
import AIHub from './components/AIHub';
import AdminPanel from './components/AdminPanel';
import SignalFeed from './components/SignalFeed';
import UserProfilePage from './components/UserProfilePage';
import QuickTradePage from './components/QuickTradePage';
import AutoTradeSettings from './components/AutoTradeSettings';
import IronGateTracker from './components/IronGateTracker';
import IronGateDayTracker from './components/IronGateDayTracker';
import StockGateTracker from './components/StockGateTracker';
import QuickTradeModal from './components/quicktrade/QuickTradeModal';
import { useAuth } from './services/useAuth';
import { OptionSignal } from './types';
import { useOptionSignals } from './hooks/useOptionSignals';
import { useStrategyConfigs } from './hooks/useStrategyConfigs';
import { useScanProgress } from './hooks/useScanProgress';
import DataDelayBanner from './components/DataDelayBanner';

// ─── STOCK FEED VIEW (sub-tabs: Signal Feed + Stock Gate) ─────

const StockFeedView: React.FC<{ onExecute: (s: any) => void }> = ({ onExecute }) => {
  const [stockTab, setStockTab] = React.useState<'signal-feed' | 'stock-gate'>('stock-gate');
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-8 pt-5 pb-0 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-transparent">
        {([
          { id: 'stock-gate', label: 'Stock Gate', icon: 'trending_up' },
          { id: 'signal-feed', label: 'Signal Feed', icon: 'query_stats' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setStockTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${stockTab === tab.id
              ? 'border-rh-green text-rh-green'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {stockTab === 'stock-gate' && (
        <div className="flex-1 overflow-y-auto">
          <StockGateTracker onExecute={onExecute} />
        </div>
      )}
      {stockTab === 'signal-feed' && (
        <div className="flex-1 overflow-hidden">
          <SignalFeed />
        </div>
      )}
    </div>
  );
};

// ─── SCAN TIMES BAR ───────────────────────────────────────────

const SCAN_TIMES = ['08:31', '08:45', '09:00', '09:10', '09:20', '09:35', '09:50', '10:15', '10:45', '12:10', '13:30', '14:15', '14:50'];

const STRATEGY_WEBHOOKS: Record<string, string> = {
  swing_trade: 'https://prabhupadala01.app.n8n.cloud/webhook/scan-options',
  day_trade: 'https://prabhupadala01.app.n8n.cloud/webhook/refresh-daytrade',
};

const isCSTWeekday = () => {
  const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const day = cst.getDay();
  return day !== 0 && day !== 6;
};

const getNextScanTime = () => {
  const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const hhmm = cst.toTimeString().slice(0, 5);
  return SCAN_TIMES.find(t => t > hhmm) || null;
};

const ScanTimesBar: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const [triggering, setTriggering] = React.useState(false);
  const [triggerStatus, setTriggerStatus] = React.useState<'idle' | 'ok' | 'err'>('idle');
  const [firedTimes, setFiredTimes] = React.useState<Set<string>>(new Set());
  const [lastTriggeredTime, setLastTriggeredTime] = React.useState<string | null>(null);
  const firedTimesRef = React.useRef<Set<string>>(new Set());
  const webhookUrl = STRATEGY_WEBHOOKS[activeTab];
  const canTrigger = !!webhookUrl && isCSTWeekday();
  const nextScan = getNextScanTime();

  const getCSTHHMM = () => {
    const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    return cst.toTimeString().slice(0, 5);
  };

  const fireWebhook = async (scheduledTime?: string) => {
    if (!webhookUrl || !isCSTWeekday()) return;
    setTriggering(true);
    setTriggerStatus('idle');
    try {
      await fetch(webhookUrl, { method: 'POST' });
      const fired = scheduledTime || getCSTHHMM();
      setTriggerStatus('ok');
      setLastTriggeredTime(fired);
      setFiredTimes(prev => new Set(prev).add(fired));
      setTimeout(() => setTriggerStatus('idle'), 3000);
    } catch {
      setTriggerStatus('err');
      setTimeout(() => setTriggerStatus('idle'), 3000);
    } finally {
      setTriggering(false);
    }
  };

  // Auto-scheduler: fire webhook at each scan time
  React.useEffect(() => {
    if (!webhookUrl) return;
    const check = () => {
      if (!isCSTWeekday()) return;
      const hhmm = getCSTHHMM();
      if (SCAN_TIMES.includes(hhmm) && !firedTimesRef.current.has(hhmm)) {
        firedTimesRef.current.add(hhmm);
        fireWebhook(hhmm);
      }
    };
    check();
    const i = setInterval(check, 30000);
    const midnight = setInterval(() => {
      if (getCSTHHMM() === '00:00') { firedTimesRef.current.clear(); setFiredTimes(new Set()); }
    }, 60000);
    return () => { clearInterval(i); clearInterval(midnight); };
  }, [activeTab]);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4 px-1 py-2 border-b border-gray-100 dark:border-white/5">
      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest">Scan Times:</span>
      {SCAN_TIMES.map((t, i) => {
        const hhmm = getCSTHHMM();
        const isFired = firedTimes.has(t);
        const isPast = t < hhmm && !isFired;
        return (
          <span key={i} className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-colors ${
            isFired
              ? 'bg-rh-green/10 border-rh-green/40 text-rh-green'
              : t === nextScan
                ? 'bg-rh-green/10 border-rh-green/40 text-rh-green'
                : isPast
                  ? 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-300 dark:text-slate-600'
                  : 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400'
          }`}>{t}</span>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        {lastTriggeredTime && (
          <span className="text-[9px] text-rh-green font-bold">last: {lastTriggeredTime}</span>
        )}
        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-600 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-rh-green animate-pulse" />polling every 30s
        </span>
        {webhookUrl && (
          <button
            onClick={() => fireWebhook()}
            disabled={!canTrigger || triggering}
            title={!isCSTWeekday() ? 'Only available on weekdays (CST)' : 'Trigger scan now'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
              triggerStatus === 'ok'
                ? 'bg-rh-green/10 border-rh-green/30 text-rh-green'
                : triggerStatus === 'err'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : canTrigger
                    ? 'bg-slate-100 dark:bg-[#111620] border-gray-200 dark:border-[#1e2430] text-slate-500 dark:text-slate-400 hover:text-rh-green hover:border-rh-green/40'
                    : 'bg-slate-50 dark:bg-[#0d1117] border-gray-100 dark:border-[#1a1f2e] text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${triggering ? 'animate-spin' : ''}`}>
              {triggerStatus === 'ok' ? 'check_circle' : triggerStatus === 'err' ? 'error' : 'play_arrow'}
            </span>
            {triggerStatus === 'ok' ? 'Triggered!' : triggerStatus === 'err' ? 'Failed' : triggering ? 'Triggering...' : 'Scan Now'}
          </button>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { user, session, loading: authLoading, isAuthenticated, verificationStatus, verificationData, signInWithGoogle, signOut, role, accessLevel, trialDaysLeft, isTrialUser } = useAuth();

  // Strategy filter
  const [activeTab, setActiveTab] = useState<string>('iron-gate');
  const selectedStrategy = ['iron-gate', 'iron-gate-day'].includes(activeTab) ? null : activeTab;
  const { strategies } = useStrategyConfigs();

  // New Hook
  const { signals, loading, error, refresh, lastUpdated } = useOptionSignals(selectedStrategy);
  const { progress: scanProgress, startScan } = useScanProgress(user?.email || undefined, selectedStrategy);

  // Execution Modal State
  const [executingSignal, setExecutingSignal] = useState<OptionSignal | null>(null);
  const [quickTradeSignal, setQuickTradeSignal] = useState<OptionSignal | null>(null);

  const [currentView, setCurrentView] = useState<View>('signals');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('Tier');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrokerage, setSelectedBrokerage] = useState<string>('Alpaca');

  // ─── AUTO-REFRESH on Option Feed ───
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAutoRefreshIntervalMs = useCallback(() => {
    // Only auto-refresh on signals view
    if (currentView !== 'signals') return null;
    if (!selectedStrategy) return null;

    // Get current time in ET
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    if (day === 0 || day === 6) return null; // weekends off

    const hour = et.getHours();
    const mins = et.getMinutes();
    const timeInMins = hour * 60 + mins;

    // Before 9:30 AM or after 4:00 PM ET → no refresh
    if (timeInMins < 570 || timeInMins >= 960) return null;

    const isBeforeNoon = timeInMins < 720; // 12:00 PM

    if (isBeforeNoon) {
      // Before noon: day_trade=1min, swing_trade=3min, others=3min
      if (selectedStrategy === 'day_trade') return 60_000;   // 1 min
      return 180_000;                                         // 3 min
    } else {
      // After noon to 4 PM: 15 min for all
      return 900_000;                                         // 15 min
    }
  }, [currentView, selectedStrategy]);

  useEffect(() => {
    // Clear previous timer
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
      autoRefreshTimer.current = null;
    }

    const intervalMs = getAutoRefreshIntervalMs();
    if (intervalMs) {
      autoRefreshTimer.current = setInterval(() => {
        // Re-check time each tick (handles noon crossover)
        const nowMs = getAutoRefreshIntervalMs();
        if (nowMs) {
          refresh();
        } else {
          // Market closed mid-interval, stop
          if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);
          autoRefreshTimer.current = null;
        }
      }, intervalMs);
    }

    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
        autoRefreshTimer.current = null;
      }
    };
  }, [currentView, selectedStrategy, getAutoRefreshIntervalMs, refresh]);

  // ─── GLOBAL IRON GATE SCHEDULER ───
  // Runs app-wide so webhook fires regardless of which screen is active
  useEffect(() => {
    const IRON_GATE_WEBHOOK = 'https://prabhupadala01.app.n8n.cloud/webhook/irongate-swingtrade';
    const IRON_GATE_SCAN_TIMES = ['08:31', '08:45', '09:00', '09:10', '09:20', '09:35', '09:50', '10:15', '10:45', '12:10', '13:30', '14:15', '14:50'];
    const firedRef = new Set<string>();

    const getCSTHHMM = () => {
      const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      return cst.toTimeString().slice(0, 5);
    };

    const check = () => {
      if (!isCSTWeekday()) return;
      const hhmm = getCSTHHMM();
      if (IRON_GATE_SCAN_TIMES.includes(hhmm) && !firedRef.has(hhmm)) {
        firedRef.add(hhmm);
        console.log(`[IronGate Global] Firing webhook at ${hhmm} CST`);
        fetch(IRON_GATE_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triggered_by: `scheduled_${hhmm}` }),
          })
          .then(() => console.log(`[IronGate Global] Webhook OK at ${hhmm}`))
          .catch(err => console.error(`[IronGate Global] Webhook failed at ${hhmm}:`, err));
      }
    };

    check();
    const i = setInterval(check, 30000);
    const midnight = setInterval(() => { if (getCSTHHMM() === '00:00') firedRef.clear(); }, 60000);
    return () => { clearInterval(i); clearInterval(midnight); };
  }, []);

  // Filter & Sort Logic
  const processedSignals = useMemo(() => {
    let result = [...signals];

    // Ticker search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter(s => s.symbol.toUpperCase().includes(q));
    }

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
  }, [signals, activeFilter, sortBy, searchQuery]);

  const handleManualRefresh = async () => {
    if (selectedStrategy === 'day_trade') {
      try {
        await fetch('https://prabhupadala01.app.n8n.cloud/webhook/refresh-daytrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_email: user?.email })
        });
        await refresh(); // Reload data from table after webhook completes
      } catch (err) {
        console.error('Day trade refresh failed:', err);
        await refresh(); // Still reload table data even if webhook fails
      }
    } else {
      startScan(refresh);
    }
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
    return <TrialExpiredPage onSignOut={signOut} userEmail={verificationData.email || user?.email || undefined} userId={user?.id} fullName={user?.user_metadata?.full_name} />;
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0a0712] transition-colors font-sans text-slate-900 dark:text-white">
      <Navigation activeView={currentView} onNavigate={setCurrentView} user={user} onSignOut={signOut} role={role} accessLevel={accessLevel} trialDaysLeft={trialDaysLeft} isTrialUser={isTrialUser} />

      {currentView === 'chat' ? (
        <div className="flex-1 ml-64 h-screen">
          <GroupChat />
        </div>
      ) : (
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
            isAdmin={role === 'admin'}
          />

          {currentView === 'signals' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* ── Sub-tab bar ── */}
              <div className="flex items-center gap-1 px-8 pt-5 pb-0 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-transparent">
                {([
                  { id: 'iron-gate', label: 'Iron Gate', icon: 'lock' },
                  { id: 'iron-gate-day', label: 'Iron Gate Day', icon: 'bolt' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === tab.id
                        ? 'border-rh-green text-rh-green'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
                {strategies.filter(s => !['iron_gate', 'iron_gate_day'].includes(s.strategy)).map(strategy => (
                  <button
                    key={strategy.strategy}
                    onClick={() => setActiveTab(strategy.strategy)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === strategy.strategy
                        ? 'border-rh-green text-rh-green'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">{strategy.icon}</span>
                    {strategy.display_name}
                  </button>
                ))}
              </div>

              {/* ── Tab content ── */}
              {!['iron-gate', 'iron-gate-day'].includes(activeTab) && (
                <main className="flex-1 p-8 overflow-y-auto">
                  {/* Data Delay Banner */}
                  <DataDelayBanner onRefresh={refresh} loading={loading} isAdmin={role === 'admin'} />

                  {/* Scan Times + Webhook Trigger */}
                  <ScanTimesBar activeTab={activeTab} />

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
                    <div className="flex-1 md:flex-none">
                      <OptionSignalFilters
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                      />
                    </div>
                  </div>

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

                  {loading && signals.length === 0 && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-4xl text-rh-green animate-spin-slow">refresh</span>
                        <p className="text-slate-400 mt-4 font-medium animate-pulse">Syncing OptionChain Data...</p>
                      </div>
                    </div>
                  )}

                  {!loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {processedSignals.map((signal) => (
                        <StockSignalCard
                          key={signal.id || signal.symbol}
                          signal={signal}
                          onViewAnalysis={handleViewAnalysis}
                          onExecute={handleExecute}
                          onQuickTrade={setQuickTradeSignal}
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
              )}

              {activeTab === 'iron-gate' && (
                <div className="flex-1 overflow-y-auto">
                  <IronGateTracker onExecute={setExecutingSignal} />
                </div>
              )}

              {activeTab === 'iron-gate-day' && (
                <div className="flex-1 overflow-y-auto">
                  <IronGateDayTracker onExecute={setExecutingSignal} />
                </div>
              )}

            </div>
          ) : currentView === 'portfolio' ? (
            <div className="flex-1 overflow-y-auto">
              <Portfolio />
            </div>
          ) : currentView === 'ai-hub' ? (
            <div className="flex-1 overflow-hidden relative flex flex-col">
              <AIHub />
            </div>
          ) : currentView === 'smart-feed' ? (
            <StockFeedView onExecute={setExecutingSignal} />
          ) : currentView === 'quick-trade' ? (
            <div className="flex-1 overflow-hidden">
              <QuickTradePage />
            </div>
          ) : currentView === 'auto-trade' ? (
            <AutoTradeSettings />
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
      )}

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

      {/* Quick Trade Modal */}
      <QuickTradeModal
        isOpen={!!quickTradeSignal}
        signal={quickTradeSignal}
        onClose={() => setQuickTradeSignal(null)}
        onSuccess={() => {
          setQuickTradeSignal(null);
          refresh();
        }}
        onNavigate={(view) => { setQuickTradeSignal(null); setCurrentView(view as View); }}
      />
    </div>
  );
};

export default App;
