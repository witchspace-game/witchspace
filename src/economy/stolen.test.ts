import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { cleanQty, markStolen, newCommander, stolenQty } from '../game/commander';
import { carriesContraband, settle } from '../game/law';
import { fenceQuotes, fenceSell } from './blackmarket';
import { freshMarket } from './market';
import { sell } from './trade';

const NOW = 1_800_000_000_000;
const lave = systemAt(0, 7); // a dictatorship
const anarchy = galaxy(0).find((s) => s.government === 0)!;

const loaded = () => {
  const c = newCommander('modern');
  c.cargo = { furs: 5 };
  markStolen(c, 'furs', 2); // 3 bought honestly, 2 taken from a trader
  return c;
};

describe('stolen goods', () => {
  it('are counted as part of the hold', () => {
    const c = loaded();
    expect(stolenQty(c, 'furs')).toBe(2);
    expect(cleanQty(c, 'furs')).toBe(3);
  });

  it("can't be sold openly where there's a law", () => {
    const c = loaded();
    const ctx = { commander: c, system: lave, capacity: 20, now: NOW };
    expect(sell(ctx, 'furs', 5).ok).toBe(false);
    expect(sell(ctx, 'furs', 3).ok).toBe(true);
    expect(c.cargo.furs).toBe(2);
    expect(stolenQty(c, 'furs')).toBe(2);
  });

  it('sell anywhere in an anarchy, where nobody asks', () => {
    const c = loaded();
    const ctx = { commander: c, system: anarchy, capacity: 20, now: NOW };
    expect(sell(ctx, 'furs', 5).ok).toBe(true);
    expect(c.cargo.furs).toBeUndefined();
    expect(c.stolen?.furs).toBeUndefined();
  });

  it('count as contraband for the police, and only the stolen part is taken', () => {
    const c = loaded();
    c.location = { galaxy: 0, system: 7 };
    expect(carriesContraband(c)).toBe(true);
    settle(c);
    expect(c.cargo.furs).toBe(3);
    expect(stolenQty(c, 'furs')).toBe(0);
  });

  it('go to a fence for less than the open price', () => {
    const c = loaded();
    const state = freshMarket(lave, NOW);
    const [q] = fenceQuotes(c, lave, state, NOW);
    expect(q).toMatchObject({ id: 'furs', qty: 2 });
    const before = c.credits;
    expect(fenceSell(c, lave, state, 'furs', 2, NOW, () => 0.99)).toMatchObject({ ok: true, caught: false });
    expect(c.credits).toBeCloseTo(before + q.bid * 2, 1);
    expect(c.cargo.furs).toBe(3);
    expect(stolenQty(c, 'furs')).toBe(0);
  });
});
