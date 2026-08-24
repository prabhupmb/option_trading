import React from 'react';
import { StructureRail } from './StructureRail';
import type { EnrichedTrade } from './types';

const fmt = (n: number | null | undefined, d = 2) => (n != null ? `$${Number(n).toFixed(d)}` : '—');

const ago = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
};

const CLOSE_LABELS: [string, string, string][] = [
  ['tp_filled', 'Take-profit filled', 'text-emerald-400'],
  ['t2_reached', 'T2 target reached', 'text-emerald-400'],
  ['structure_break_underlying', 'Structure broke — stopped out', 'text-red-400'],
  ['lifecycle_dip_failed', 'Dip invalidated by scanner', 'text-red-400'],
  ['theta_floor', 'Closed on time decay floor', 'text-amber-400'],
  ['not_held_at_broker', 'Reconciled — not held at broker', 'text-zinc-400'],
];

function closeLabel(raw: string | null): { label: string; color: string } {
  if (!raw) return { label: '—', color: 'text-zinc-500' };
  for (const [prefix, label, color] of CLOSE_LABELS) {
    if (raw.startsWith(prefix)) return { label, color };
  }
  return { label: raw, color: 'text-zinc-400' };
}

function isStalePrice(priceAsOf: string | null, dataStale: boolean): boolean {
  if (dataStale) return true;
  if (!priceAsOf) return true;
  return Date.now() - new Date(priceAsOf).getTime() > 15 * 60 * 1000;
}

const Chip: React.FC<{ label: string; amber?: boolean }> = ({ label, amber }) => (
  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
    amber ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
  }`}>
    {label}
  </span>
);

const StatCell: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2.5 text-center">
    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{label}</div>
    <div className="text-sm font-black font-mono text-zinc-100">{value}</div>
    {sub && <div className="text-[10px] font-mono text-zinc-500">{sub}</div>}
  </div>
);

interface Props {
  trade: EnrichedTrade;
}

export const OptionDipCard: React.FC<Props> = ({ trade: t }) => {
  const isClosed = t.status != null && t.status !== 'OPEN';
  const isWin = t.status === 'WIN';
  const isLoss = t.status === 'LOSS';
  const stale = isStalePrice(t.price_as_of, t.data_stale);
  const displayPrice = isClosed ? t.exit_underlying : t.live_price;
  const priceDelta = displayPrice != null && t.underlying_entry != null
    ? displayPrice - t.underlying_entry
    : null;

  const accentBorder = isClosed
    ? isWin ? 'border-l-emerald-500' : isLoss ? 'border-l-red-500' : 'border-l-zinc-600'
    : 'border-l-emerald-500';

  const cl = closeLabel(t.close_reason);

  return (
    <div className={`rounded-xl bg-zinc-900/70 border border-l-4 ${accentBorder} border-zinc-800 p-4 transition-all ${
      isClosed ? 'opacity-60' : ''
    }`}>
      {/* Row 1: Symbol + badges + price */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold tracking-tight font-mono text-zinc-100">{t.symbol}</span>
          {/* Status badge */}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
            !isClosed ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
            : isWin ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
            : isLoss ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
            : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
          }`}>
            {t.status ?? 'OPEN'}
          </span>
          {/* DTE badge */}
          {t.live_dte != null && (
            <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
              t.live_dte <= 5 ? 'bg-red-500/15 text-red-400 border-red-500/40'
              : t.live_dte <= 14 ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
              : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
            }`}>
              {t.live_dte}d
            </span>
          )}
          {t.order_status === 'dry_run' && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/40">DRY RUN</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            {!isClosed && stale && <span title="Price may be stale">&#129482;</span>}
            <span className={`text-lg font-mono font-bold ${
              isClosed ? 'text-zinc-500' : stale ? 'text-zinc-500' : 'text-zinc-100'
            }`}>
              {fmt(displayPrice)}
            </span>
          </div>
          {priceDelta != null && (
            <span className={`text-[11px] font-mono ${priceDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)} vs entry
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Contract line */}
      {t.contract_symbol && (
        <div className="mt-1.5 text-[11px] font-mono text-zinc-500">
          {t.contract_symbol}
          {t.strike != null && <> · ${t.strike.toFixed(2)} C</>}
          {t.expiry && <> · {t.expiry}</>}
          {t.delta != null && <> · &#916;{t.delta.toFixed(2)}</>}
        </div>
      )}

      {/* Closed outcome line */}
      {isClosed && (
        <div className={`mt-2 text-sm font-bold ${cl.color}`} title={t.close_reason || undefined}>
          {cl.label}
        </div>
      )}

      {/* Row 3: Structure rail */}
      <StructureRail
        swingLow={t.swing_low}
        swingHigh={t.swing_high}
        dipStop={t.dip_stop}
        entry={t.underlying_entry}
        livePrice={displayPrice}
        t1={t.t1_target}
        t2={t.t2_target}
        isClosed={isClosed}
        isStale={stale}
      />

      {/* Row 4: Stat cells */}
      <div className="flex gap-2 mt-3">
        <StatCell
          label="Cost"
          value={fmt(t.total_cost)}
          sub={t.quantity != null && t.limit_price != null ? `${t.quantity} x ${fmt(t.limit_price)}` : undefined}
        />
        <StatCell
          label="TP"
          value={fmt(t.tp_option_price)}
          sub="on option"
        />
        <StatCell
          label="R:R"
          value={t.rr_t1 != null ? `${t.rr_t1.toFixed(1)}:1` : '—'}
          sub="at entry"
        />
      </div>

      {/* Row 5: Quality chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.confluence != null && <Chip label={`Confluence ${t.confluence}x`} />}
        {(t.contract_iv != null || t.hv20 != null) && (
          <Chip
            label={`IV ${t.contract_iv != null ? t.contract_iv.toFixed(0) : '—'}% / HV ${t.hv20 != null ? t.hv20.toFixed(0) : '—'}%`}
            amber={t.iv_hv_ratio != null && t.iv_hv_ratio > 1.5}
          />
        )}
        {t.spread_pct != null && <Chip label={`Spread ${t.spread_pct.toFixed(1)}%`} />}
        {t.open_interest != null && <Chip label={`OI ${t.open_interest.toLocaleString()}`} />}
        {t.retrace_pct != null && <Chip label={`Retrace ${(t.retrace_pct * 100).toFixed(0)}%`} />}
      </div>

      {/* Row 6: Footer */}
      <div className="mt-3 flex justify-between text-[10px] text-zinc-500">
        <span>Signaled {ago(t.buy_signaled_at)}</span>
        <span>
          {!isClosed && t.price_as_of && (
            <>Price {ago(t.price_as_of)}</>
          )}
          {isClosed && t.closed_at && (
            <>Closed {ago(t.closed_at)}</>
          )}
        </span>
      </div>
    </div>
  );
};
