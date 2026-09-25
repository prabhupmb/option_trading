/**
 * SuperTrend indicator + Heikin-Ashi candle builder.
 * Pure functions — no React, no side-effects.
 */

export interface Bar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface STResult {
  time: number;
  st: number;        // SuperTrend value
  trend: 1 | -1;     // 1 = bullish (price above ST), -1 = bearish
}

export interface STOutput {
  values: STResult[];
  signals: { time: number; direction: 'buy' | 'sell' }[];
}

// ─── Heikin-Ashi ────────────────────────────────────────────

export function buildHeikinAshi(bars: Bar[]): Bar[] {
  if (bars.length === 0) return [];
  const ha: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0
      ? (b.open + b.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);
    ha.push({ time: b.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: b.volume });
  }
  return ha;
}

// ─── SuperTrend ─────────────────────────────────────────────

// ─── Session VWAP ──────────────────────────────────────────

export interface VWAPPoint {
  time: number;
  value: number;
}

/**
 * Compute session VWAP. Resets at 09:30 NY each day.
 * Uses typical price = (H+L+C)/3 weighted by volume.
 */
export function computeVWAP(bars: Bar[]): VWAPPoint[] {
  if (bars.length === 0) return [];
  const result: VWAPPoint[] = [];
  let cumPV = 0;
  let cumV = 0;
  let lastSessionDay = -1;

  for (const b of bars) {
    // Determine NY day from unix timestamp
    const d = new Date(b.time * 1000);
    const nyStr = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyStr);
    const nyDay = nyDate.getFullYear() * 10000 + (nyDate.getMonth() + 1) * 100 + nyDate.getDate();
    const nyHHMM = nyDate.getHours() * 100 + nyDate.getMinutes();

    // Reset at session start (09:30 NY) or new day
    if (nyDay !== lastSessionDay || nyHHMM <= 930) {
      cumPV = 0;
      cumV = 0;
      lastSessionDay = nyDay;
    }

    const vol = b.volume ?? 0;
    if (vol > 0) {
      const tp = (b.high + b.low + b.close) / 3;
      cumPV += tp * vol;
      cumV += vol;
    }

    result.push({ time: b.time, value: cumV > 0 ? cumPV / cumV : b.close });
  }

  return result;
}

// ─── SuperTrend ─────────────────────────────────────────────

export function computeSuperTrend(
  bars: Bar[],
  period: number = 10,
  multiplier: number = 3,
): STOutput {
  if (bars.length < period + 1) return { values: [], signals: [] };

  // Step 1: True Range
  const tr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      tr.push(bars[i].high - bars[i].low);
    } else {
      const prevClose = bars[i - 1].close;
      tr.push(Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - prevClose),
        Math.abs(bars[i].low - prevClose),
      ));
    }
  }

  // Step 2: Wilder's RMA (same as TradingView's ta.rma / ta.atr)
  const atr: number[] = new Array(bars.length).fill(0);
  // Seed: SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < bars.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  // Step 3: SuperTrend
  const values: STResult[] = [];
  const signals: { time: number; direction: 'buy' | 'sell' }[] = [];

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let prevST = 0;
  let prevTrend: 1 | -1 = 1;

  for (let i = period - 1; i < bars.length; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    let upperBand = hl2 + multiplier * atr[i];
    let lowerBand = hl2 - multiplier * atr[i];

    if (i > period - 1) {
      // Band clamping (same as TradingView)
      if (lowerBand > prevLowerBand || bars[i - 1].close < prevLowerBand) {
        // keep lowerBand as-is
      } else {
        lowerBand = prevLowerBand;
      }

      if (upperBand < prevUpperBand || bars[i - 1].close > prevUpperBand) {
        // keep upperBand as-is
      } else {
        upperBand = prevUpperBand;
      }
    }

    let trend: 1 | -1;
    let st: number;

    if (i === period - 1) {
      // First bar: determine initial trend from close vs bands
      trend = bars[i].close > upperBand ? 1 : -1;
      st = trend === 1 ? lowerBand : upperBand;
    } else {
      if (prevTrend === 1) {
        trend = bars[i].close < prevLowerBand ? -1 : 1;
      } else {
        trend = bars[i].close > prevUpperBand ? 1 : -1;
      }
      st = trend === 1 ? lowerBand : upperBand;

      // Detect flip
      if (trend !== prevTrend) {
        signals.push({
          time: bars[i].time,
          direction: trend === 1 ? 'buy' : 'sell',
        });
      }
    }

    values.push({ time: bars[i].time, st, trend });
    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevST = st;
    prevTrend = trend;
  }

  return { values, signals };
}
