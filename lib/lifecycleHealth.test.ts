import { describe, it, expect } from 'vitest';
import { deriveHealth, type HealthInput } from './lifecycleHealth';

const base: HealthInput = {
  last_price: 100,
  buy_zone: null,
  support_levels: [],
};

describe('deriveHealth', () => {
  it('returns HEALTHY for null buy_zone and empty support_levels', () => {
    const r = deriveHealth(base);
    expect(r.health).toBe('HEALTHY');
    expect(r.reclaimLevel).toBeNull();
    expect(r.nearestHold).toBeNull();
  });

  it('returns HEALTHY when support_levels is null', () => {
    const r = deriveHealth({ ...base, support_levels: null });
    expect(r.health).toBe('HEALTHY');
  });

  it('returns BROKEN when buy_zone is INVALIDATED with supports_broken', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: { lo: 90, hi: 95, status: 'INVALIDATED', reason: 'supports_broken', reclaim_level: 105 },
      support_levels: [
        { price: 110, status: 'broken' },
        { price: 95, status: 'broken' },
      ],
    });
    expect(r.health).toBe('BROKEN');
    expect(r.reclaimLevel).toBe(105);
  });

  it('returns BROKEN with null reclaim_level', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: { lo: 90, hi: 95, status: 'INVALIDATED', reason: 'supports_broken' },
      support_levels: [],
    });
    expect(r.health).toBe('BROKEN');
    expect(r.reclaimLevel).toBeNull();
  });

  it('returns CAUTION when a broken support is above last_price', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: null,
      support_levels: [
        { price: 110, status: 'broken' },
        { price: 90, status: 'holding' },
      ],
    });
    expect(r.health).toBe('CAUTION');
    expect(r.nearestHold).toBe(90);
  });

  it('returns HEALTHY when broken support is below last_price', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: null,
      support_levels: [
        { price: 80, status: 'broken' },
        { price: 95, status: 'holding' },
      ],
    });
    expect(r.health).toBe('HEALTHY');
    expect(r.nearestHold).toBe(95);
  });

  it('returns HEALTHY when all supports are holding', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: { lo: 90, hi: 95, status: 'IN_ZONE' },
      support_levels: [
        { price: 95, status: 'holding' },
        { price: 88, status: 'holding' },
      ],
    });
    expect(r.health).toBe('HEALTHY');
    expect(r.nearestHold).toBe(95);
  });

  it('BROKEN takes priority over CAUTION', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: { lo: 90, hi: 95, status: 'INVALIDATED', reason: 'supports_broken', reclaim_level: 112 },
      support_levels: [
        { price: 110, status: 'broken' },
      ],
    });
    expect(r.health).toBe('BROKEN');
  });

  it('INVALIDATED with reason no_uptrend is not BROKEN', () => {
    const r = deriveHealth({
      last_price: 100,
      buy_zone: { lo: 90, hi: 95, status: 'INVALIDATED', reason: 'no_uptrend' },
      support_levels: [{ price: 95, status: 'holding' }],
    });
    expect(r.health).toBe('HEALTHY');
  });
});
