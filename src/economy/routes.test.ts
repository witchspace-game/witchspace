import { describe, expect, it } from 'vitest';
import { newCommander } from '../game/commander';
import { distanceLy, systemAt } from '../galaxy/generate';
import { bestOutlets, bestRoutes, checkSentOrders, knownAt, knownMarket, marketsInRange } from './routes';
import { BROKER_FEE, sendOrder, type OrderState } from './orders';
import { priceAt } from './market';
import { newsDelay } from './events';
import type { TradeContext } from './trade';

const lave = systemAt(0, 7);
const ctx = (credits = 1000): TradeContext => {
  const commander = newCommander('modern');
  commander.credits = credits;
  return { commander, system: lave, capacity: 20, now: Date.UTC(2026, 9, 22, 12) };
};

describe('the trade computer', () => {
  it('finds profitable runs within a tank of fuel, best first', () => {
    const t = ctx();
    const routes = bestRoutes(t);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(distanceLy(lave, r.dest)).toBeLessThanOrEqual(7);
      expect(r.profit).toBeCloseTo(r.proceeds - r.cost, 1);
      expect(r.profit).toBeGreaterThan(0);
    }
    for (let i = 1; i < routes.length; i++) expect(routes[i - 1].profit).toBeGreaterThanOrEqual(routes[i].profit);
  });

  it('only looks: other markets are left as they were', () => {
    const t = ctx();
    bestRoutes(t);
    expect(Object.keys(t.commander.markets)).toEqual(['0:7']);
  });

  it('knows where your hold would fetch the most', () => {
    const t = ctx();
    t.commander.cargo = { computers: 5 };
    const [o] = bestOutlets(t);
    expect(o.id).toBe('computers');
    expect(o.proceeds).toBeGreaterThanOrEqual(o.here);
  });

  it('knows a far market only as its latest report left it, at the speed of news', () => {
    const t = ctx();
    const far = marketsInRange(lave).sort((a, b) => distanceLy(lave, b) - distanceLy(lave, a))[0];
    const near = marketsInRange(lave).sort((a, b) => distanceLy(lave, a) - distanceLy(lave, b))[0];
    const age = (s: typeof far) => t.now - knownAt(t.commander, lave, s, t.now);
    expect(age(far)).toBeCloseTo(newsDelay(far, lave), -1);
    expect(age(far)).toBeGreaterThan(age(near)); // further away, older news
    expect(age(lave)).toBe(0); // here, it's live
  });

  it('remembers what you saw yourself, if that is fresher than the reports', () => {
    const t = ctx();
    const far = marketsInRange(lave).sort((a, b) => distanceLy(lave, b) - distanceLy(lave, a))[0];
    t.commander.markets[`${far.galaxy}:${far.index}`] = { stock: {}, updated: t.now - 5 * 60_000 };
    expect(t.now - knownAt(t.commander, lave, far, t.now)).toBe(5 * 60_000);
  });

  it('says how old each run is', () => {
    for (const r of bestRoutes(ctx())) expect(r.age).toBeCloseTo(newsDelay(r.dest, lave), -1);
  });

  it('sends an order to another market at the speed of news, and hears of the fill the same way', () => {
    const t = ctx(2000);
    const there = marketsInRange(lave).sort((a, b) => distanceLy(lave, a) - distanceLy(lave, b))[0];
    const delay = newsDelay(there, lave);
    const state = knownMarket(t.commander, lave, there, t.now) as OrderState;
    t.commander.markets[`${there.galaxy}:${there.index}`] = state;
    // A limit above anything it'll trade at: fills as soon as it arrives.
    const limit = priceAt(there, state, 'food', t.now) * 3;
    const r = sendOrder(t.commander, there, state, 'food', 'buy', 10, limit, t.now, delay);
    expect(r.ok).toBe(true);
    const value = Math.round(limit * 100) / 100 * 10;
    expect(t.commander.credits).toBeCloseTo(2000 - value - value * BROKER_FEE, 0);
    // It arrives after `delay`, and news of the fill takes as long again to come back.
    expect(checkSentOrders(t.commander, lave, t.now + 2 * delay - 5 * 60_000)).toHaveLength(0);
    const heard = checkSentOrders(t.commander, lave, t.now + 2 * delay + 5 * 60_000);
    expect(heard).toHaveLength(1);
    expect(heard[0].system).toBe(there);
    expect(state.storage?.food).toBe(10); // waiting there, not in your hold
    expect(t.commander.cargo.food ?? 0).toBe(0);
  });

  it("can't sell remotely what's in your own hold", () => {
    const t = ctx();
    t.commander.cargo = { food: 10 };
    const there = marketsInRange(lave)[0];
    const state = knownMarket(t.commander, lave, there, t.now) as OrderState;
    expect(sendOrder(t.commander, there, state, 'food', 'sell', 5, 99, t.now, newsDelay(there, lave)).ok).toBe(false);
  });
});
