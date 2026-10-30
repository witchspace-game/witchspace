import { describe, expect, it } from 'vitest';
import { costOf, JOIN_SHARE, PRICE, refusal, ROOMS_PER_HOUR, SPACE_BUDGET, stopAll } from './spaceBudget';

const day = { off: false, budget: SPACE_BUDGET, cost: 0 };
const few = { account: 1, network: 1 };

describe('shared space budget', () => {
  it('prices a busy room by the hour, about half a cent', () => {
    expect(costOf(3600, 0)).toBeCloseTo(0.0056, 4);
    expect(costOf(0, 20e6)).toBeCloseTo(0.15, 6);
    expect(PRICE.perSecond).toBeGreaterThan(0);
  });

  it('lets ships in on an ordinary day', () => {
    expect(refusal(day, few)).toBeNull();
    expect(stopAll(day)).toBe(false);
  });

  it('stops new ships near the budget, and everyone at it', () => {
    expect(refusal({ ...day, cost: SPACE_BUDGET * JOIN_SHARE }, few)).toBe('Shared space is busy today');
    expect(stopAll({ ...day, cost: SPACE_BUDGET * JOIN_SHARE })).toBe(false);
    expect(stopAll({ ...day, cost: SPACE_BUDGET })).toBe(true);
  });

  it('a raised budget lets them back in', () => {
    expect(refusal({ ...day, budget: 20, cost: 5 }, few)).toBeNull();
  });

  it('the off switch stops everything', () => {
    expect(refusal({ ...day, off: true }, few)).toBe('Shared space is resting for now');
    expect(stopAll({ ...day, off: true })).toBe(true);
  });

  it('limits how many systems one account or network joins an hour', () => {
    expect(refusal(day, { account: ROOMS_PER_HOUR.account, network: 0 })).toMatch(/a lot of systems/);
    expect(refusal(day, { account: 0, network: ROOMS_PER_HOUR.network })).toMatch(/a lot of systems/);
    expect(refusal(day, { account: ROOMS_PER_HOUR.account - 1, network: 0 })).toBeNull();
  });

  it('caps the worst month at about the daily budget times 31, plus the $5', () => {
    expect(SPACE_BUDGET * 31 + 5).toBeLessThan(100);
  });
});
