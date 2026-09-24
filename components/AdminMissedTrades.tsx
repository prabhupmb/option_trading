import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─── TYPES ───────────────────────────────────────────────────

interface RunRow {
    run_id: string;
    system: string;
    started_at: string;
    et_clock: string | null;
    status: string;
    market_regime: string | null;
    empty_at_stage: string | null;
    empty_reason: string | null;
    notes: string | null;
    selected_count: number | null;
    orders_ok: number | null;
    orders_attempted: number | null;
}

interface CandidateRow {
    run_id: string;
    system: string;
    symbol: string;
    side: string | null;
    tier: string | null;
    stage_reached: string;
    outcome: string;
    reject_reason: string | null;
    reject_details: string | null;
    judge_confidence: number | null;
    judge_reasoning: string | null;
}

// ─── CONSTANTS ───────────────────────────────────────────────

const SYSTEM_LABELS: Record<string, string> = {
    iron_gate_day: 'Iron Gate Day',
    iron_gate: 'Iron Gate',
    stock_gate: 'Stock',
};

const SYSTEM_OPTIONS = [
    { value: '', label: 'All Systems' },
    { value: 'iron_gate_day', label: 'Iron Gate Day' },
    { value: 'iron_gate', label: 'Iron Gate' },
    { value: 'stock_gate', label: 'Stock' },
];

const getSystemLabel = (sys: string) => SYSTEM_LABELS[sys] || sys;

const getTodayET = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, '0')}-${String(et.getDate()).padStart(2, '0')}`;
};

const isToday = (dateStr: string) => dateStr === getTodayET();

// ─── BADGES ──────────────────────────────────────────────────

const ResultBadge: React.FC<{ run: RunRow }> = ({ run }) => {
    if (run.status === 'ROUTED') {
        return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-rh-green/10 text-rh-green">
                Traded ({run.orders_ok ?? 0})
            </span>
        );
    }
    if (run.status === 'ORDER_FAILED') {
        return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-500/10 text-red-400">
                Order failed
            </span>
        );
    }
    if (run.status === 'JUDGED' && (run.selected_count ?? 0) > 0) {
        return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-500/10 text-blue-400">
                Picked
            </span>
        );
    }
    return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-slate-500/10 text-slate-400">
            No trade
        </span>
    );
};

const OutcomeBadge: React.FC<{ outcome: string }> = ({ outcome }) => {
    if (outcome === 'SELECTED') {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rh-green/10 text-rh-green">Selected</span>;
    }
    if (outcome === 'NOT_SELECTED') {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">Not selected</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-400">Rejected</span>;
};

const DataIssueChip: React.FC = () => (
    <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/20">
        Data issue
    </span>
);

const hasDataIssue = (run: RunRow) =>
    (run.empty_reason || '').includes('DATA MISSING') || (run.notes || '').includes('DATA MISSING');

// ─── EXPANDED ROW ────────────────────────────────────────────

const CandidateTable: React.FC<{ runId: string }> = ({ runId }) => {
    const [candidates, setCandidates] = useState<CandidateRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        const fetch = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('v_candidate_why')
                .select('*')
                .eq('run_id', runId);
            if (error) console.error('[MissedTrades] v_candidate_why query error:', error);
            if (!ignore) {
                setCandidates(data ?? []);
                setLoading(false);
            }
        };
        fetch();
        return () => { ignore = true; };
    }, [runId]);

    if (loading) {
        return (
            <div className="p-4 text-center">
                <span className="material-symbols-outlined animate-spin text-lg text-slate-400">sync</span>
            </div>
        );
    }

    if (candidates.length === 0) {
        return <div className="p-4 text-center text-xs text-slate-500">No candidates for this run.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                        <th className="px-4 py-2">Symbol</th>
                        <th className="px-4 py-2">Side</th>
                        <th className="px-4 py-2">Tier</th>
                        <th className="px-4 py-2">Stopped at</th>
                        <th className="px-4 py-2">Outcome</th>
                        <th className="px-4 py-2">Reason</th>
                        <th className="px-4 py-2">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {candidates.map((c, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 font-bold text-white">{c.symbol}</td>
                            <td className="px-4 py-2.5 text-slate-400">{c.side ?? '—'}</td>
                            <td className="px-4 py-2.5 text-slate-400">{c.tier ?? '—'}</td>
                            <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{c.stage_reached}</td>
                            <td className="px-4 py-2.5"><OutcomeBadge outcome={c.outcome} /></td>
                            <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate" title={c.reject_reason ?? ''}>
                                {c.reject_reason ? c.reject_reason.replace(/_/g, ' ') : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 max-w-[250px]">
                                {c.judge_reasoning ? (
                                    <span className="text-[10px] leading-snug block truncate" title={c.judge_reasoning}>
                                        {c.judge_reasoning}
                                    </span>
                                ) : c.reject_details ? (
                                    <span className="text-[10px] leading-snug block truncate" title={c.reject_details}>
                                        {c.reject_details}
                                    </span>
                                ) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

const AdminMissedTrades: React.FC = () => {
    const [date, setDate] = useState(getTodayET);
    const [systemFilter, setSystemFilter] = useState('');
    const [runs, setRuns] = useState<RunRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);

    const fetchRuns = useCallback(async () => {
        setLoading(true);

        // Build ET day boundaries → UTC ISO strings
        // Create a date string that JS will parse in the ET timezone
        const toUTC = (localDatetime: string) => {
            // Intl trick: format the epoch in ET, compare to find offset
            const refDate = new Date(`${localDatetime}`);
            const etStr = refDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
            const etParsed = new Date(etStr);
            const offsetMs = refDate.getTime() - etParsed.getTime();
            // Shift: we want the UTC instant that equals localDatetime in ET
            return new Date(refDate.getTime() + offsetMs).toISOString();
        };

        const start = toUTC(`${date}T00:00:00`);
        const end = toUTC(`${date}T23:59:59.999`);

        let q = supabase
            .from('v_run_why')
            .select('*')
            .gte('started_at', start)
            .lte('started_at', end)
            .order('started_at', { ascending: false });

        if (systemFilter) {
            q = q.eq('system', systemFilter);
        }

        const { data, error } = await q;
        if (error) {
            console.error('[MissedTrades] v_run_why query error:', error);
        }
        // Hide runs where empty_at_stage = 'WINDOW'
        setRuns((data ?? []).filter(r => r.empty_at_stage !== 'WINDOW'));
        setLoading(false);
    }, [date, systemFilter]);

    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    // Auto-refresh every 60s when date is today
    useEffect(() => {
        if (!isToday(date)) return;
        const id = setInterval(fetchRuns, 60_000);
        return () => clearInterval(id);
    }, [date, fetchRuns]);

    const formatTime = (etClock: string | null, startedAt: string) => {
        if (etClock) return etClock;
        try {
            return new Date(startedAt).toLocaleTimeString('en-US', {
                timeZone: 'America/New_York',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
        } catch {
            return '—';
        }
    };

    return (
        <div className="space-y-5">
            {/* ── Filters ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <input
                    type="date"
                    value={date}
                    onChange={e => { setDate(e.target.value); setExpandedRun(null); }}
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rh-green/50 transition-colors"
                />
                <select
                    value={systemFilter}
                    onChange={e => { setSystemFilter(e.target.value); setExpandedRun(null); }}
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rh-green/50 transition-colors"
                >
                    {SYSTEM_OPTIONS.map(o => (
                        <option key={o.value} value={o.value} className="bg-[#1e2124]">{o.label}</option>
                    ))}
                </select>
                {isToday(date) && (
                    <span className="text-[10px] text-rh-green font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rh-green animate-pulse" />
                        Live
                    </span>
                )}
                <span className="text-[10px] text-slate-500 ml-auto">{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Table ── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <span className="material-symbols-outlined animate-spin text-3xl text-rh-green">sync</span>
                </div>
            ) : runs.length === 0 ? (
                <div className="py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-600 mb-3 block">event_busy</span>
                    <p className="text-sm text-slate-500 font-medium">No runs for this date.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1e2124] rounded-2xl border border-white/5 shadow-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                                <th className="p-4 w-8" />
                                <th className="p-4">System</th>
                                <th className="p-4">Time (ET)</th>
                                <th className="p-4">Result</th>
                                <th className="p-4">Regime</th>
                                <th className="p-4">Stopped at</th>
                                <th className="p-4">Why</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {runs.map(run => {
                                const isExpanded = expandedRun === run.run_id;
                                return (
                                    <React.Fragment key={run.run_id}>
                                        <tr
                                            onClick={() => setExpandedRun(isExpanded ? null : run.run_id)}
                                            className={`cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                                        >
                                            <td className="pl-4 pr-1 py-3">
                                                <span className={`material-symbols-outlined text-sm text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                    chevron_right
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-white text-[11px]">
                                                {getSystemLabel(run.system)}
                                            </td>
                                            <td className="p-4 text-slate-300 font-mono text-[11px]">
                                                {formatTime(run.et_clock, run.started_at)}
                                            </td>
                                            <td className="p-4">
                                                <ResultBadge run={run} />
                                            </td>
                                            <td className="p-4 text-slate-400 text-[11px]">
                                                {run.market_regime ?? '—'}
                                            </td>
                                            <td className="p-4 text-slate-400 font-mono text-[10px]">
                                                {run.empty_at_stage ?? '—'}
                                            </td>
                                            <td className="p-4 text-slate-400 text-[11px] max-w-[280px]">
                                                <span className="truncate block" title={run.empty_reason ?? ''}>
                                                    {run.empty_reason ?? '—'}
                                                </span>
                                                {hasDataIssue(run) && <DataIssueChip />}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="bg-black/20 border-t border-white/5 p-0">
                                                    <div className="px-4 py-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-white/5 bg-white/[0.02]">
                                                        Candidates
                                                    </div>
                                                    <CandidateTable runId={run.run_id} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminMissedTrades;
