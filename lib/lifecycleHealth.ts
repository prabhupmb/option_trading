// ─── Lifecycle Health Derivation ────────────────────────────────────────────
// Single source of truth for health status across watchlist, detail panel,
// journey stepper, and price-track tooltips.

export type Health = 'HEALTHY' | 'CAUTION' | 'BROKEN';

export interface SupportLevel {
  price: number;
  status: 'holding' | 'untested' | 'broken';
}

export interface BuyZone {
  lo:             number | null;
  hi:             number | null;
  status?:        'IN_ZONE' | 'ARMED' | 'INVALIDATED';
  reason?:        'supports_broken' | 'no_uptrend' | null;
  reclaim_level?: number | null;
  anchor_ratio?:  number;
}

export interface HealthInput {
  last_price:      number;
  buy_zone:        BuyZone | null;
  support_levels:  SupportLevel[] | null;
}

export interface HealthResult {
  health:       Health;
  reclaimLevel: number | null;
  /** Highest holding support (used for CAUTION banner copy). */
  nearestHold:  number | null;
}

export function deriveHealth(row: HealthInput): HealthResult {
  const bz = row.buy_zone;
  const sl = row.support_levels ?? [];
  const reclaimLevel = bz?.reclaim_level ?? null;

  // BROKEN: buy zone explicitly invalidated due to broken supports
  if (
    bz?.status === 'INVALIDATED' &&
    bz?.reason === 'supports_broken'
  ) {
    return { health: 'BROKEN', reclaimLevel, nearestHold: highestHolding(sl) };
  }

  // CAUTION: any support broken ABOVE the current price
  const hasBrokenAbove = sl.some(
    s => s.status === 'broken' && s.price > row.last_price,
  );
  if (hasBrokenAbove) {
    return { health: 'CAUTION', reclaimLevel, nearestHold: highestHolding(sl) };
  }

  return { health: 'HEALTHY', reclaimLevel, nearestHold: highestHolding(sl) };
}

function highestHolding(sl: SupportLevel[]): number | null {
  let best: number | null = null;
  for (const s of sl) {
    if (s.status === 'holding' && (best === null || s.price > best)) {
      best = s.price;
    }
  }
  return best;
}

/** Copy for the invalidated tooltip on the price-levels chart. */
export function invalidatedTooltip(reclaimLevel: number | null, fmt: (n: number | null) => string): string {
  if (reclaimLevel != null) {
    return `Buy zone invalid — all supports broken. Reclaim ${fmt(reclaimLevel)} first.`;
  }
  return 'Buy zone invalid — all supports broken.';
}
