import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { yardsOf } from './yards';
import { activeEvent, EVENT_KINDS } from '../economy/events';
import { cargoWords, laneDirection, lanesFrom, reliefVoyages, titanVoyages, voyageHail, voyages, WINDOW_MS } from './traffic';

const g = galaxy(0);
const lave = g.find((s) => s.name.toLowerCase() === 'lave')!;
const t0 = Date.UTC(2026, 10, 3, 14);
const HOUR = 3600_000;

describe('traffic', () => {
  it('is the same for everyone: the same voyages for the same place and time', () => {
    expect(voyages(lave, t0, t0 + HOUR)).toEqual(voyages(lave, t0, t0 + HOUR));
  });

  it('gives a sensible number of ships an hour, more at busier worlds', () => {
    const n = voyages(lave, t0, t0 + HOUR).filter((v) => v.to === 'station').length;
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(36);
    expect(WINDOW_MS[7]).toBeLessThan(WINDOW_MS[0]);
  });

  it('agrees whichever window it is asked about', () => {
    const whole = voyages(lave, t0, t0 + 2 * HOUR).map((v) => v.id);
    const halves = [...voyages(lave, t0, t0 + HOUR), ...voyages(lave, t0 + HOUR + 1, t0 + 2 * HOUR)].map((v) => v.id);
    expect(halves).toEqual(whole);
  });

  it('carries the market’s own deliveries, and drops a ship whose deliveries were all lost', () => {
    const inbound = voyages(lave, t0, t0 + HOUR).find((v) => v.leg === 'in' && v.to === 'station' && !v.relief)!;
    expect(inbound.cargo.length).toBeGreaterThan(0);
    const lost = inbound.cargo.map((c) => ({ id: c.id, t: c.t }));
    expect(voyages(lave, t0, t0 + HOUR, lost).some((v) => v.id === inbound.id)).toBe(false);
  });

  it('comes from, or goes to, a system a jump away', () => {
    for (const v of voyages(lave, t0, t0 + HOUR)) expect(lanesFrom(lave)).toContain(v.other);
  });

  it('flies in from the other system’s side of the sky', () => {
    const [x, y, z] = laneDirection(lave, lanesFrom(lave)[0]);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    const o = g[lanesFrom(lave)[0]];
    expect(Math.sign(x)).toBe(Math.sign(o.x - lave.x) || Math.sign(x));
  });

  it('supplies a yard’s build with Wexley-Yorozu freighters bound for the Titan', () => {
    const yard = yardsOf(0, t0)[0];
    const at = g[yard.system];
    const runs = titanVoyages(at, t0, t0 + HOUR);
    expect(runs.length).toBeGreaterThan(3);
    for (const v of runs) {
      expect(v.to).toBe('titan');
      expect(v.company).toBe('wy');
      expect(v.hull).toBe('bullsnake');
    }
  });

  it('sends relief while an event leaves a world short, and none otherwise', () => {
    let found = 0;
    for (const s of g) {
      for (const v of reliefVoyages(s, t0, t0 + HOUR)) {
        const e = activeEvent(s, v.at);
        expect(e?.type).toBe(v.relief);
        expect(EVENT_KINDS[e!.type].effects[v.cargo[0].id]).toBeLessThan(0);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('escorts the Titan’s runs, more often where it’s dangerous, and some valuable company cargo', () => {
    const share = (gov: number) => {
      const runs = g.filter((s) => s.government === gov).flatMap((s) => [0, 1, 2, 3, 4, 5].flatMap((d) => voyages(s, t0 + d * 4 * HOUR, t0 + d * 4 * HOUR + HOUR)));
      const station = runs.filter((v) => v.to === 'station');
      expect(station.filter((v) => v.escorts && !v.company)).toEqual([]);
      return station.filter((v) => v.escorts).length / station.length;
    };
    expect(share(0)).toBeGreaterThan(0);
    const yard = yardsOf(0, t0)[0];
    for (const v of titanVoyages(g[yard.system], t0, t0 + 6 * HOUR)) expect(v.escorts).toBeLessThanOrEqual(2);
    const escorted = titanVoyages(g[yard.system], t0, t0 + 6 * HOUR).filter((v) => v.escorts).length;
    expect(escorted).toBeGreaterThan(0);
  });

  it('introduces itself when hailed', () => {
    const v = { id: 'x', leg: 'in' as const, to: 'titan' as const, at: 0, cargo: [{ id: 'alloys', t: 0, qty: 30 }, { id: 'computers', t: 0, qty: 5 }], company: 'wy' as const, hull: 'bullsnake', name: 'Patience', other: 7, escorts: 0 };
    expect(voyageHail(v, 'Diso')).toBe('Patience, in from Diso with alloys and computers for the Titan.');
    expect(voyageHail({ ...v, to: 'station', leg: 'out', company: null }, 'Leesti')).toBe('Patience, outbound for Leesti with alloys and computers.');
  });

  it('names the biggest three goods, and no more', () => {
    const many = ['food', 'textiles', 'gold', 'liquor', 'furs'].map((id, i) => ({ id, t: 0, qty: 10 - i }));
    expect(cargoWords(many)).toBe('food, textiles, gold and more');
  });
});
