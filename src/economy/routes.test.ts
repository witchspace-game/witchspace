import { describe, expect, it } from 'vitest';
import { newCommander } from '../game/commander';
import { distanceLy, systemAt } from '../galaxy/generate';
import { bestOutlets, bestRoutes } from './routes';
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
});
