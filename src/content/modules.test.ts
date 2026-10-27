import { describe, expect, it } from 'vitest';
import { lineUpOf, SCIENCE_LINE_UP, STANDARD_LINE_UP, yardsOf } from '../game/yards';
import { moduleById, shipModules, withLineUp } from './moduleFiles';
import { checkGeometry } from './geometry';
import { assemble, canCouple, centresOf, checkModule, MAX_VERTICES } from './modules';
import { shipById } from './ships';
import type { ModuleDef } from './types';

const mod = (id: string) => moduleById(id)!;

describe('the core modules', () => {
  it('all pass the standard', () => {
    // The core eight are Witchspace's; community modules join them (docs/design/submissions.md) and must pass too.
    expect(shipModules.filter((m) => m.designer === 'Witchspace').map((m) => m.id).sort()).toEqual(['drive', 'fabricator', 'furnace', 'habitat', 'hold', 'maw', 'reactor', 'science']);
    for (const m of shipModules) {
      expect(checkModule(m).errors, m.id).toEqual([]);
      expect(m.geometry.vertices.length).toBeLessThanOrEqual(MAX_VERTICES);
    }
  });

  it('raise no warnings: their radiators and vanes are fins, open by design', () => {
    for (const m of shipModules) expect(checkModule(m).warnings, m.id).toEqual([]);
  });

  it('a real hole still warns, and a fin on a closed hull does not', () => {
    const cube: [number, number, number][] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]];
    expect(checkGeometry(cube, faces).warnings).toEqual([]);
    expect(checkGeometry(cube, faces.slice(1)).warnings.join()).toMatch(/not closed/);
    const fin: [number, number, number][] = [...cube, [1, 0, -0.5], [3, 0, -0.5], [3, 0, 0.5], [1, 0, 0.5]];
    const report = checkGeometry(fin, [...faces, [8, 9, 10, 11]]);
    expect(report.warnings).toEqual([]);
    expect(report.errors).toEqual([]);
  });

  it('the maw has nothing ahead of it, the drive nothing behind', () => {
    expect(mod('maw').couples).toEqual({ fore: false, aft: true });
    expect(mod('drive').couples).toEqual({ fore: true, aft: false });
  });

  it('only the habitat carries the company mark', () => {
    expect(shipModules.filter((m) => m.insignia).map((m) => m.id)).toEqual(['habitat']);
  });
});

describe('the coupling standard', () => {
  it('a body too small at a coupled end fails', () => {
    const furnace = mod('furnace');
    const shrunk: ModuleDef = { ...furnace, geometry: { ...furnace.geometry, vertices: furnace.geometry.vertices.map(([x, y, z]) => [x * 0.5, y * 0.5, z]) } };
    expect(checkModule(shrunk).errors.some((e) => e.includes('coupling square'))).toBe(true);
  });

  it('a body that runs into the necks fails', () => {
    const furnace = mod('furnace');
    const long: ModuleDef = { ...furnace, length: 200 };
    expect(checkModule(long).errors.some((e) => e.includes('room for the necks'))).toBe(true);
  });

  it('zones run prow to stern, and free ends never couple', () => {
    expect(canCouple(mod('maw'), mod('furnace'))).toBe(true);
    expect(canCouple(mod('furnace'), mod('maw'))).toBe(false);
    expect(canCouple(mod('reactor'), mod('habitat'))).toBe(false);
    expect(canCouple(mod('drive'), mod('reactor'))).toBe(false);
    expect(() => assemble([mod('habitat'), mod('maw')])).toThrow();
  });
});

describe('line-ups', () => {
  it('the Standard is 2.2 km, maw to reactor, with a neck at every join', () => {
    const line = assemble(STANDARD_LINE_UP.map(mod));
    expect(line.length).toBe(2200);
    const zs = line.geometry.vertices.map((v) => v[2]);
    expect(Math.max(...zs)).toBe(1100);
    expect(Math.min(...zs)).toBe(-1100 + 35); // the reactor couples aft, but nothing is behind it: a clean face, no neck
    const bodies = STANDARD_LINE_UP.reduce((n, id) => n + mod(id).geometry.vertices.length, 0);
    expect(line.geometry.vertices.length).toBe(bodies + (STANDARD_LINE_UP.length - 1) * 2 * 8);
  });

  it('the ship file is the Standard line-up', () => {
    const ship = shipById('titanoboa')!;
    expect(ship.modules).toEqual(STANDARD_LINE_UP);
    expect(withLineUp(ship, STANDARD_LINE_UP)).toBe(ship);
    expect(ship.geometry).toEqual(assemble(STANDARD_LINE_UP.map(mod)).geometry);
  });

  it('a science yard carries the pod between the fabricator and the reactor', () => {
    const ship = withLineUp(shipById('titanoboa')!, SCIENCE_LINE_UP);
    const centres = centresOf(SCIENCE_LINE_UP.map(mod));
    expect(ship.geometry.vertices.length).toBeGreaterThan(shipById('titanoboa')!.geometry.vertices.length);
    expect(centres.map((c) => c.id).slice(-3)).toEqual(['fabricator', 'science', 'reactor']);
  });

  it('some yards carry science, most do not, the same for everyone', () => {
    const now = Date.UTC(2026, 9, 25);
    const lineUps = Array.from({ length: 60 }, (_, d) => yardsOf(0, now + d * 86_400_000 * 3)).flat().map((y) => lineUpOf(y));
    const science = lineUps.filter((l) => l.join() === SCIENCE_LINE_UP.join()).length;
    expect(science).toBeGreaterThan(0);
    expect(science).toBeLessThan(lineUps.length / 2);
    const y = yardsOf(0, now)[0];
    expect(lineUpOf(y)).toEqual(lineUpOf({ ...y }));
  });
});
