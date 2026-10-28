import { describe, expect, it } from 'vitest';
import { newCommander } from '../../src/game/commander';
import { ledgerOf, record, reconcile } from '../../src/game/ledger';
import { priceBounds } from '../../src/economy/market';
import { systemAt } from '../../src/galaxy/generate';
import { firstAnchor, verify } from './ledger';

const lave = systemAt(0, 7);
const T = 1_800_000_000_000;

describe('checking a ledger', () => {
  it('passes honest trading, and keeps count of precious goods', () => {
    const c = newCommander('modern');
    ledgerOf(c);
    const a0 = firstAnchor(c);
    const { hi } = priceBounds(lave, 'gold', T);
    c.credits -= 100 * hi * 0.6;
    record(c, { t: T, k: 'buy', d: -100 * hi * 0.6, g: 'gold', q: 100, s: [0, 7] });
    c.credits += 50 * hi * 0.7;
    record(c, { t: T + 1, k: 'sell', d: 50 * hi * 0.7, g: 'gold', q: -50, s: [0, 7] });
    const a1 = verify(a0, c);
    expect(a1.flags).toEqual([]);
    expect(a1.precious.gold).toBe(50);
  });

  it('flags a sale at a price the market never gave, and gems sold that were never had', () => {
    const c = newCommander('modern');
    ledgerOf(c);
    const a0 = firstAnchor(c);
    const { hi } = priceBounds(lave, 'gems', T);
    c.credits += 1000 * hi * 3;
    record(c, { t: T, k: 'sell', d: 1000 * hi * 3, g: 'gems', q: -1000, s: [0, 7] });
    const flags = verify(a0, c).flags.join(' | ');
    expect(flags).toMatch(/more than it ever fetched/);
    expect(flags).toMatch(/never had/);
  });

  it('flags money from nowhere at an impossible rate, and an edited history', () => {
    const c = newCommander('modern');
    ledgerOf(c);
    const a0 = firstAnchor(c);
    c.credits += 5_000_000;
    reconcile(c, T);
    expect(verify(a0, c).flags.join()).toMatch(/other income/);
    const d = newCommander('modern');
    ledgerOf(d);
    const b0 = firstAnchor(d);
    d.credits += 10;
    reconcile(d, T);
    d.ledger!.entries[0].d = 9_999; // rewritten afterwards
    expect(verify(b0, d).flags.join()).toMatch(/altered/);
  });

  it('takes what a commander already has when it first sees them (a hoard from before the ledger)', () => {
    const c = newCommander('modern');
    ledgerOf(c);
    c.cargo = { gems: 1_000_000 };
    const a0 = firstAnchor(c);
    const { hi } = priceBounds(lave, 'gems', T);
    c.credits += 3000 * hi * 0.8;
    record(c, { t: T, k: 'sell', d: 3000 * hi * 0.8, g: 'gems', q: -3000, s: [0, 7] });
    expect(verify(a0, c).flags).toEqual([]);
  });

  it('checks money changed: only what you had, at what it was worth', async () => {
    const { buyLocal, sellLocal } = await import('../../src/economy/money');
    const { galaxy } = await import('../../src/galaxy/generate');
    const dem = galaxy(0).find((s) => s.government === 6)!;
    const c = newCommander('modern');
    ledgerOf(c);
    c.credits = 10_000;
    const a0 = firstAnchor(c);
    buyLocal(c, dem, 5000, T, T);
    sellLocal(c, dem, 1e9, T + 1000, T);
    expect(verify(a0, c).flags).toEqual([]);
    // Money from nowhere, then cashed: flagged.
    const d = newCommander('modern');
    ledgerOf(d);
    const b0 = firstAnchor(d);
    d.wallet = { [`0:${dem.index}`]: 1e7 };
    sellLocal(d, dem, 1e7, T, T);
    expect(verify(b0, d).flags.join()).toMatch(/never had/);
  });
});
