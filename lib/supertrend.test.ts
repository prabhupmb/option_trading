import { describe, it, expect } from 'vitest';
import { buildHeikinAshi, computeSuperTrend, Bar } from './supertrend';

// ─── Heikin-Ashi Tests ──────────────────────────────────────

describe('buildHeikinAshi', () => {
  it('returns empty for empty input', () => {
    expect(buildHeikinAshi([])).toEqual([]);
  });

  it('computes first HA candle correctly', () => {
    const bars: Bar[] = [
      { time: 1, open: 10, high: 12, low: 9, close: 11 },
    ];
    const ha = buildHeikinAshi(bars);
    expect(ha).toHaveLength(1);
    // haClose = (10+12+9+11)/4 = 10.5
    expect(ha[0].close).toBeCloseTo(10.5);
    // haOpen = (10+11)/2 = 10.5
    expect(ha[0].open).toBeCloseTo(10.5);
    // haHigh = max(12, 10.5, 10.5) = 12
    expect(ha[0].high).toBe(12);
    // haLow = min(9, 10.5, 10.5) = 9
    expect(ha[0].low).toBe(9);
  });

  it('second candle uses previous HA open/close', () => {
    const bars: Bar[] = [
      { time: 1, open: 10, high: 12, low: 9, close: 11 },
      { time: 2, open: 11, high: 14, low: 10, close: 13 },
    ];
    const ha = buildHeikinAshi(bars);
    expect(ha).toHaveLength(2);
    // Second HA open = (prevHaOpen + prevHaClose) / 2 = (10.5 + 10.5) / 2 = 10.5
    expect(ha[1].open).toBeCloseTo(10.5);
    // Second HA close = (11+14+10+13)/4 = 12
    expect(ha[1].close).toBeCloseTo(12);
    // haHigh = max(14, 10.5, 12) = 14
    expect(ha[1].high).toBe(14);
    // haLow = min(10, 10.5, 12) = 10
    expect(ha[1].low).toBe(10);
  });
});

// ─── SuperTrend Tests ───────────────────────────────────────

// Helper: generate deterministic bars
function makeBars(prices: number[]): Bar[] {
  return prices.map((p, i) => ({
    time: 1000 + i * 300,
    open: p - 0.5,
    high: p + 1,
    low: p - 1,
    close: p,
  }));
}

describe('computeSuperTrend', () => {
  it('returns empty when bars < period+1', () => {
    const bars = makeBars([100, 101, 102]);
    const result = computeSuperTrend(bars, 10, 3);
    expect(result.values).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns values starting from bar index = period-1', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const bars = makeBars(prices);
    const result = computeSuperTrend(bars, 10, 3);
    // Should have (30 - 10 + 1) = 21 values
    expect(result.values).toHaveLength(21);
    // First value time should be bar[9].time
    expect(result.values[0].time).toBe(bars[9].time);
  });

  it('detects uptrend for rising prices', () => {
    // Steady uptrend
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const bars = makeBars(prices);
    const result = computeSuperTrend(bars, 10, 3);
    // Last few bars should be bullish
    const last = result.values[result.values.length - 1];
    expect(last.trend).toBe(1);
    // ST should be below the price
    expect(last.st).toBeLessThan(prices[prices.length - 1]);
  });

  it('detects downtrend for falling prices', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    const bars = makeBars(prices);
    const result = computeSuperTrend(bars, 10, 3);
    const last = result.values[result.values.length - 1];
    expect(last.trend).toBe(-1);
    // ST should be above the price
    expect(last.st).toBeGreaterThan(prices[prices.length - 1]);
  });

  it('generates buy/sell signals on trend flips', () => {
    // Up then down then up
    const up = Array.from({ length: 15 }, (_, i) => 100 + i * 3);
    const down = Array.from({ length: 15 }, (_, i) => up[14] - i * 3);
    const up2 = Array.from({ length: 15 }, (_, i) => down[14] + i * 3);
    const bars = makeBars([...up, ...down, ...up2]);
    const result = computeSuperTrend(bars, 10, 3);
    // Should have at least one buy and one sell signal
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    const buys = result.signals.filter(s => s.direction === 'buy');
    const sells = result.signals.filter(s => s.direction === 'sell');
    expect(buys.length).toBeGreaterThanOrEqual(1);
    expect(sells.length).toBeGreaterThanOrEqual(1);
  });

  it('ST value is always positive', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 50 + Math.sin(i / 3) * 10);
    const bars = makeBars(prices);
    const result = computeSuperTrend(bars, 10, 3);
    for (const v of result.values) {
      expect(v.st).toBeGreaterThan(0);
    }
  });

  it('SuperTrend on Heikin-Ashi input differs from regular', () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 4) * 8);
    const bars = makeBars(prices);
    const ha = buildHeikinAshi(bars);

    const stRegular = computeSuperTrend(bars, 10, 3);
    const stHA = computeSuperTrend(ha, 10, 3);

    // Both should produce values
    expect(stRegular.values.length).toBeGreaterThan(0);
    expect(stHA.values.length).toBeGreaterThan(0);

    // The ST values should differ (HA smooths the data)
    const lastReg = stRegular.values[stRegular.values.length - 1].st;
    const lastHA = stHA.values[stHA.values.length - 1].st;
    expect(lastReg).not.toBeCloseTo(lastHA, 1);
  });
});
