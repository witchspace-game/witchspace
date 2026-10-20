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
