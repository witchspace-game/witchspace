import { describe, expect, it } from 'vitest';
import { newCommander } from '../game/commander';
import { systemAt } from '../galaxy/generate';
import { buy, maxBuyable, quotes, sell, type TradeContext } from './trade';

const ctx = (difficulty: 'modern' | 'classic', credits = 1000): TradeContext => {
  const commander = newCommander(difficulty);
  commander.credits = credits;
  return { commander, system: systemAt(0, 7), capacity: 20, now: 0 };
};

describe('trading', () => {
  it('new commanders start with 100 credits, as in 1984', () => {
    expect(newCommander('modern').credits).toBe(100);
  });

  it('buys goods into the hold and takes the money', () => {
    const t = ctx('modern');
    const r = buy(t, 'food', 5);
    expect(r.ok).toBe(true);
    expect(t.commander.cargo.food).toBe(5);
    expect(t.commander.credits).toBeLessThan(1000);
  });

  it('refuses when you can\'t afford it', () => {
    const t = ctx('modern', 5);
    expect(buy(t, 'computers', 1).ok).toBe(false);
    expect(t.commander.cargo.computers).toBeUndefined();
  });

  it('refuses when the hold is full', () => {
    const t = ctx('modern', 100000);
    t.capacity = 3;
    expect(buy(t, 'food', 4).ok).toBe(false);
    expect(buy(t, 'food', 3).ok).toBe(true);
  });

  it('works out the most you can buy', () => {
    const t = ctx('modern', 50);
    const n = maxBuyable(t, 'food');
    expect(buy(t, 'food', n).ok).toBe(true);
    expect(buy(t, 'food', 1).ok).toBe(false);
  });

  it('buying and selling straight back never makes money', () => {
    for (const id of ['food', 'computers', 'gold']) {
      const t = ctx('modern', 100000);
      buy(t, id, 15);
      sell(t, id, 15);
      expect(t.commander.credits).toBeLessThanOrEqual(100000);
      expect(t.commander.cargo[id]).toBeUndefined();
    }
  });

  it('buying drains this station\'s stock and raises its price', () => {
    const t = ctx('modern', 100000);
    const food = () => quotes(t).find((q) => q.commodity.id === 'food')!;
    const before = food();
    buy(t, 'food', 15);
    expect(food().stock).toBe(before.stock - 15);
    expect(food().price).toBeGreaterThan(before.price);
  });

  it('classic prices hold steady within a visit', () => {
    const t = ctx('classic');
    const before = quotes(t).find((q) => q.commodity.id === 'food')!.price;
    buy(t, 'food', 5);
    expect(quotes(t).find((q) => q.commodity.id === 'food')!.price).toBe(before);
  });
});

describe('the law at the market', () => {
  it('trades goods openly only where they are legal (Modern)', () => {
    const lawful = { commander: newCommander('modern'), system: systemAt(0, 147), capacity: 20, now: 0 }; // Diso, a democracy
    lawful.commander.credits = 1000;
    expect(buy(lawful, 'narcotics', 1).ok).toBe(false);
    expect(maxBuyable(lawful, 'narcotics')).toBe(0);
    const lave = { commander: newCommander('modern'), system: systemAt(0, 7), capacity: 20, now: 0 }; // a dictatorship: narcotics banned
    lave.commander.credits = 1000;
    expect(buy(lave, 'narcotics', 1).ok).toBe(false);
    const anarchy = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.government === 0)!;
    const free = { commander: newCommander('modern'), system: anarchy, capacity: 20, now: 0 };
    free.commander.credits = 1000;
    expect(buy(free, 'narcotics', 1).ok).toBe(true);
  });

  it('needs a weapons licence for firearms where they are licensed', () => {
    const lave = { commander: newCommander('modern'), system: systemAt(0, 7), capacity: 20, now: 0 }; // dictatorship: licensed
    lave.commander.credits = 1000;
    expect(buy(lave, 'firearms', 1).ok).toBe(false);
    lave.commander.equipment.push('weapons-licence');
    expect(buy(lave, 'firearms', 1).ok).toBe(true);
  });

  it('keeps the 1984 rule under Classic: only lawful stations refuse illegal goods', () => {
    const lave = { commander: newCommander('classic'), system: systemAt(0, 7), capacity: 20, now: 0 };
    lave.commander.credits = 1000;
    expect(buy(lave, 'narcotics', 1).ok).toBe(true);
  });

  it('classic keeps gold, platinum and gems in the safe, 200 of each at most', () => {
    const t = ctx('classic', 1_000_000);
    t.commander.cargo = { food: t.capacity };
    expect(maxBuyable(t, 'food')).toBe(0);
    const gold = maxBuyable(t, 'gold');
    expect(gold).toBeGreaterThan(0);
    expect(gold).toBeLessThanOrEqual(200);
    t.commander.cargo.gold = 200;
    expect(maxBuyable(t, 'gold')).toBe(0);
  });
});

