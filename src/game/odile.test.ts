import { describe, expect, it } from 'vitest';
import { distanceLy, systemAt } from '../galaxy/generate';
import { CROSSED_FOR, LOST_FOR, STOP_MS, VENN_STOPS, freshMemory, legCargo, vennAt, vennAtStation, vennAway, vennHail, vennPrices, vennRoute, vennSightings, vennStanding, vennVisits, vennVoyages } from './odile';
import { voyages } from './traffic';

const T = Date.UTC(2026, 10, 2, 9, 0);
const DAY = 86_400_000;

describe('Odile Venn on her run (character-odile-venn.md, step 1)', () => {
  it('flies Lave, Leesti and Diso, and Riedquat once a day, each leg within a tank', () => {
    const day = vennVisits(T, T + DAY - 1);
    expect(day.filter((v) => v.system === 46).length).toBeGreaterThanOrEqual(1);
    for (const v of day) {
      expect(VENN_STOPS).toContain(v.system);
      expect(distanceLy(systemAt(0, v.from), systemAt(0, v.system))).toBeLessThanOrEqual(7);
      expect(v.docks).toBeLessThan(v.launches);
    }
    // Each stop follows from the last: where she goes next is where she arrives.
    for (let i = 1; i < day.length; i++) expect(day[i].from).toBe(day[i - 1].system);
  });

  it('is in one place at a time, the same on every phone', () => {
    const a = vennAt(T + 1234);
    const b = vennAt(T + 1234);
    expect(a).toEqual(b);
    expect(T + 1234).toBeGreaterThanOrEqual(a.n * STOP_MS);
    expect(T + 1234).toBeLessThan((a.n + 1) * STOP_MS);
  });

  it('calls at each of her systems every few hours', () => {
    for (const i of [7, 55, 147]) {
      const next = vennAtStation(systemAt(0, i), T)!;
      expect(next.visit.docks - T).toBeLessThan(4 * 3600_000);
    }
    expect(vennAtStation(systemAt(0, 0), T)).toBeNull(); // not hers
    expect(vennAtStation(systemAt(1, 7), T)).toBeNull(); // another galaxy
  });

  it('is in the traffic: in to dock and out again, carrying no more than her 35 t', () => {
    const lave = systemAt(0, 7);
    const mine = vennVoyages(lave, T, T + DAY / 2);
    expect(mine.some((v) => v.leg === 'in')).toBe(true);
    expect(mine.some((v) => v.leg === 'out')).toBe(true);
    for (const v of mine) {
      expect(v.character).toBe('venn');
      expect(v.cargo.reduce((t, c) => t + c.qty, 0)).toBeLessThanOrEqual(35);
    }
    expect(voyages(lave, T, T + DAY / 2).filter((v) => v.character === 'venn')).toEqual(mine);
    expect(legCargo(7, 55, T).map((c) => c.id)).toEqual(['food', 'textiles']);
    expect(legCargo(147, 46, T).map((c) => c.id)).toEqual(['food']);
  });

  it('answers a hail in her own words', () => {
    const [v] = vennVoyages(systemAt(0, 55), T, T + DAY).filter((x) => x.leg === 'in' && x.cargo.length);
    expect(vennHail(v, 'Leesti', 'Lave', 'food and textiles')).toBe("Venn, Second Wind, Mutual. Food and textiles for Leesti, if you're asking, and you are.");
  });

  it('tells you honest prices from where she has come from', () => {
    const here = systemAt(0, 55);
    const due = vennAtStation(here, T)!;
    const p = vennPrices(here, due.visit, due.visit.docks + 60_000)!;
    expect(p.from).toBe(due.visit.from);
    expect(p.there).toBeGreaterThan(0);
    expect(p.here).toBeGreaterThan(0);
  });
});

describe('her memory of you (step 2)', () => {
  const now = T;
  it('knows you after two drinks or a hail, trusts you after a call answered or a leg flown', () => {
    expect(vennStanding(undefined, now)).toBe('stranger');
    expect(vennStanding({ ...freshMemory(), drinks: 1 }, now)).toBe('stranger');
    expect(vennStanding({ ...freshMemory(), drinks: 2 }, now)).toBe('known');
    expect(vennStanding({ ...freshMemory(), hails: 1 }, now)).toBe('known');
    expect(vennStanding({ ...freshMemory(), saved: 1 }, now)).toBe('trusted');
    expect(vennStanding({ ...freshMemory(), legs: 1, drinks: 9 }, now)).toBe('trusted');
  });

  it('won’t have you for a week once crossed, then thaws; forgets nothing else', () => {
    const m = { ...freshMemory(), saved: 1, crossedAt: now - DAY };
    expect(vennStanding(m, now)).toBe('crossed');
    expect(vennStanding(m, now + CROSSED_FOR)).toBe('trusted');
  });

  it('is away a day after Second Wind is lost', () => {
    const m = { ...freshMemory(), lostAt: now };
    expect(vennAway(m, now + 3600_000)).toBe(true);
    expect(vennAway(m, now + LOST_FOR + 1)).toBe(false);
    expect(vennAway(undefined, now)).toBe(false);
  });

  it('shares two honest prices, best first, and a route from the ledgers that really pays', () => {
    const here = systemAt(0, 55);
    const due = vennAtStation(here, now)!;
    const seen = vennSightings(here, due.visit, now);
    expect(seen.length).toBeGreaterThan(2);
    expect(seen[0].here / seen[0].there).toBeGreaterThanOrEqual(seen[1].here / seen[1].there);
    const route = vennRoute(here, now)!;
    expect(route.sell).toBeGreaterThan(route.buy);
    expect(distanceLy(here, systemAt(0, route.to))).toBeLessThanOrEqual(7);
  });
});
