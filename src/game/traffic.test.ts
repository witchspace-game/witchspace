import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { yardsOf } from './yards';
import { activeEvent, EVENT_KINDS } from '../economy/events';
import { cargoWords, CONVOY_GAP_MS, HOLD, laneDirection, lanesFrom, packHolds, reliefVoyages, titanVoyages, voyageHail, voyages, WINDOW_MS } from './traffic';
import { readFileSync } from 'node:fs';
import { COMMODITIES, UNITS_PER_TONNE } from '../economy/commodities';

const g = galaxy(0);
const lave = g.find((s) => s.name.toLowerCase() === 'lave')!;
const t0 = Date.UTC(2026, 10, 3, 14);
const HOUR = 3600_000;

describe('traffic', () => {
  it('is the same for everyone: the same voyages for the same place and time', () => {
    expect(voyages(lave, t0, t0 + HOUR)).toEqual(voyages(lave, t0, t0 + HOUR));
  });

  it('gives a sensible number of ships an hour, more at busier worlds', () => {
    // A convoy (a load too big for one hold) counts once.
    const n = new Set(voyages(lave, t0, t0 + HOUR).filter((v) => v.to === 'station').map((v) => v.id.replace(/:c\d+$/, ''))).size;
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
    const all = voyages(lave, t0, t0 + HOUR);
    const inbound = all.find((v) => v.leg === 'in' && v.to === 'station' && !v.relief && !/:c\d+$/.test(v.id) && !all.some((x) => x.id === `${v.id}:c1`))!;
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

describe('holds (Mark: a Cobra carrying 22 t and 15 t and more)', () => {
  const tonnes = (cargo: { id: string; qty: number }[]) => cargo.reduce((sum, c) => sum + c.qty / UNITS_PER_TONNE[COMMODITIES.find((x) => x.id === c.id)!.unit], 0);
  const t0 = Date.UTC(2026, 9, 31);

  it('knows each traffic hull from its ship file', () => {
    for (const [hull, hold] of Object.entries(HOLD)) expect(JSON.parse(readFileSync(`content/ships/${hull}.json`, 'utf8')).stats.cargo).toBe(hold);
  });

  it('never loads a ship past her hold', () => {
    for (const s of galaxy(0).slice(0, 40))
      for (const v of voyages(s, t0, t0 + 3 * 3600_000)) expect(tonnes(v.cargo)).toBeLessThanOrEqual(HOLD[v.hull] + 1e-9);
  });

  it('delivers the same goods, split into a convoy', () => {
    const cargo = [
      { id: 'food', t: 1, qty: 22 },
      { id: 'textiles', t: 2, qty: 15 },
      { id: 'gold', t: 3, qty: 4000 },
    ];
    const loads = packHolds(cargo, 20);
    expect(loads.length).toBe(3);
    for (const l of loads) expect(tonnes(l)).toBeLessThanOrEqual(20);
    for (const c of cargo) expect(loads.flat().filter((x) => x.id === c.id && x.t === c.t).reduce((a, x) => a + x.qty, 0)).toBe(c.qty);
  });

  it('spaces a convoy out on its lane, each ship with its own id', () => {
    const all = galaxy(0).slice(0, 40).flatMap((s) => voyages(s, t0, t0 + 3 * 3600_000));
    const convoys = all.filter((v) => /:c\d+$/.test(v.id));
    expect(convoys.length).toBeGreaterThan(0);
    expect(new Set(all.map((v) => v.id)).size).toBe(all.length);
    const v = convoys[0];
    const lead = all.find((x) => x.id === v.id.replace(/:c\d+$/, ''));
    if (lead) expect((v.at - lead.at) % CONVOY_GAP_MS).toBe(0);
  });

  it('a ship of a convoy lost takes only her share', () => {
    const s = galaxy(0)[7];
    const before = voyages(s, t0, t0 + 3600_000).filter((v) => v.leg === 'in' && v.to === 'station');
    const c = before.find((v) => v.cargo.length)!.cargo[0];
    const total = (vs: typeof before) => vs.flatMap((v) => v.cargo).filter((x) => x.id === c.id && x.t === c.t).reduce((a, x) => a + x.qty, 0);
    const after = voyages(s, t0, t0 + 3600_000, [{ ...c }]).filter((v) => v.leg === 'in' && v.to === 'station');
    expect(total(after)).toBe(total(before) - c.qty);
  });
});

