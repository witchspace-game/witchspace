import { describe, expect, it } from 'vitest';
import { newCommander } from '../game/commander';
import { distanceLy, systemAt } from '../galaxy/generate';
import { bestOutlets, bestRoutes, knownAt, marketsInRange } from './routes';
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
});
