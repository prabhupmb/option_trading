import { Trade, StatBlock } from '../../types/portfolio';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyFmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const formatMoney = (v: number | null | undefined): string => {
    if (v == null) return '—';
    return moneyFmt.format(v);
};

export const formatMoneyCompact = (v: number | null | undefined): string => {
    if (v == null) return '—';
    if (Math.abs(v) >= 1000) return moneyFmtCompact.format(v);
    return moneyFmt.format(v);
};

export const formatPnl = (v: number | null | undefined): string => {
    if (v == null) return '—';
    const sign = v > 0 ? '+' : '';
    return `${sign}${moneyFmt.format(v)}`;
};

export const formatPnlWithArrow = (v: number | null | undefined): string => {
    if (v == null) return '—';
    const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '';
    const sign = v > 0 ? '+' : '';
    return `${arrow} ${sign}${moneyFmt.format(v)}`;
};

export const formatPct = (v: number | null | undefined): string => {
    if (v == null) return '—';
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}%`;
};

export const formatET = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }) + ' ET';
    } catch {
        return '—';
    }
};

export const formatETDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return '—';
    }
};

export const formatOptionSymbol = (t: { underlying: string; strike: number | null; putCall: 'CALL' | 'PUT' | string | null; expirationDate: string | null }): string => {
    if (!t.strike || !t.putCall || !t.expirationDate) return t.underlying;
    const pc = (t.putCall === 'CALL' || t.putCall === 'C') ? 'C' : 'P';
    let expStr = '';
    try {
        const d = new Date(t.expirationDate + 'T12:00:00');
        expStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    } catch {
        expStr = t.expirationDate;
    }
    return `${t.underlying} ${t.strike}${pc} ${expStr}`;
};

export const formatHold = (minutes: number | null | undefined): string => {
    if (minutes == null) return '—';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

export const pnlColor = (v: number | null | undefined): string => {
    if (v == null || v === 0) return 'text-slate-400';
    return v > 0 ? 'text-emerald-400' : 'text-red-400';
};

export const pnlBg = (v: number | null | undefined): string => {
    if (v == null || v === 0) return '';
    return v > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';
};

export const sourceLabel = (s: string | null | undefined): string => {
    if (!s) return '—';
    if (s === 'stock_gate') return 'Stock Gate';
    if (s === 'option_auto_trade') return 'Options Auto';
    if (s === 'manual') return 'Manual';
    return s;
};

export const closeReasonLabel = (r: string | null | undefined): string => {
    if (!r) return '—';
    switch (r) {
        case 'TAKE_PROFIT': return '🎯 Take Profit';
        case 'STOP_LOSS': return '🛑 Stop Loss';
        case 'MARKET_EXIT': return '⏏ Market Exit';
        case 'LIMIT_EXIT': return 'Limit Exit';
        case 'EXPIRED': return '⌛ Expired';
        default: return r;
    }
};

export const missedReasonLabel = (r: string | null | undefined): string => {
    if (!r) return '—';
    if (r.includes('cannot_afford_one_share')) return "Can't afford 1 share";
    if (r.includes('rr_below_min')) return 'R:R below min';
    if (r.includes('risk_sizing_rounds_to_zero')) return 'Size rounds to 0';
    return r.replace(/_/g, ' ');
};

export const sideChipColor = (instruction: string): string => {
    const u = instruction.toUpperCase();
    if (u.includes('BUY')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (u.includes('SELL')) return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
};

export const computeStatBlock = (trades: Trade[]): StatBlock => {
    const closed = trades.filter(t => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'MANUAL_CLOSE');
    const wins = closed.filter(t => t.status === 'WIN');
    const losses = closed.filter(t => t.status === 'LOSS');
    const totalPnl = closed.reduce((s, t) => s + (t.realizedPL || 0), 0);
    const winPnl = wins.reduce((s, t) => s + (t.realizedPL || 0), 0);
    const lossPnl = losses.reduce((s, t) => s + Math.abs(t.realizedPL || 0), 0);
    const avgWin = wins.length > 0 ? winPnl / wins.length : null;
    const avgLoss = losses.length > 0 ? lossPnl / losses.length : null;
    const rValues = closed.filter(t => t.rMultiple != null).map(t => t.rMultiple!);
    return {
        pnl: totalPnl,
        trades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : null,
        avgWin,
        avgLoss,
        profitFactor: lossPnl > 0 ? winPnl / lossPnl : null,
        expectancy: closed.length > 0 ? totalPnl / closed.length : null,
        avgR: rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null,
    };
};
