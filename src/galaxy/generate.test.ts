import { describe, expect, it } from 'vitest';
import { distanceLy, ECONOMIES, galaxy, GOVERNMENTS, HOME, nearestTo, systemAt, systemsWithin } from './generate';

// Facts every Elite player knows. If these hold, the generator is faithful.
describe('the first galaxy', () => {
  const g = galaxy(0);

  it('has 256 systems', () => {
    expect(g).toHaveLength(256);
  });

  it('starts with Tibedied', () => {
    expect(g[0].name).toBe('Tibedied');
  });

  it('puts Lave where commanders start', () => {
    const lave = systemAt(HOME.galaxy, HOME.index);
    expect(lave.name).toBe('Lave');
    expect([lave.x, lave.y]).toEqual([20, 173]);
    expect(ECONOMIES[lave.economy]).toBe('Rich Agricultural');
    expect(GOVERNMENTS[lave.government]).toBe('Dictatorship');
    expect(lave.techLevel).toBe(5);
    expect(lave.population).toBe(2.5);
    expect(lave.productivity).toBe(7000);
    expect(lave.radius).toBe(4116);
  });

  it('has Lave\'s famous neighbours nearby', () => {
    const near = systemsWithin(systemAt(0, 7), 7).map((s) => s.name);
    for (const name of ['Diso', 'Leesti', 'Zaonce', 'Reorte', 'Riedquat']) expect(near).toContain(name);
  });

  it('measures distance as the original did', () => {
    const lave = systemAt(0, 7);
    const diso = g.find((s) => s.name === 'Diso')!;
    expect(distanceLy(lave, diso)).toBeCloseTo(3.6, 1);
  });
});

describe('every galaxy', () => {
  it('generates 8 galaxies of valid systems', () => {
    for (let n = 0; n < 8; n++) {
      const systems = galaxy(n);
      expect(systems).toHaveLength(256);
      for (const s of systems) {
        expect(s.name).toMatch(/^[A-Z][a-z]{1,7}$/);
        expect(s.techLevel).toBeGreaterThanOrEqual(1);
        expect(s.techLevel).toBeLessThanOrEqual(15);
        expect(s.government).toBeLessThanOrEqual(7);
        expect(s.economy).toBeLessThanOrEqual(7);
        if (s.government <= 1) expect(s.economy & 2).toBe(2); // anarchies and feudal worlds are never rich
      }
    }
  });

  it('gives each galaxy a different map', () => {
    expect(galaxy(1)[0].name).not.toBe(galaxy(0)[0].name);
  });

  it('is stable: the same every time', () => {
    expect(galaxy(3).map((s) => s.name)).toEqual(galaxy(3).map((s) => s.name));
  });
});

describe('as the original reckons it', () => {
  const g = galaxy(0);
  const named = (n: string) => g.find((s) => s.name === n)!;
  const lave = named('Lave');

  it('measures distances in steps of 0.4 LY (TT111)', () => {
    expect(distanceLy(lave, named('Tibedied'))).toBe(17.6); // the deep dive's worked example
    expect(distanceLy(lave, named('Leesti'))).toBe(3.6);
    expect(distanceLy(lave, named('Zaonce'))).toBe(5.6);
    expect(distanceLy(lave, named('Riedquat'))).toBe(6.8);
  });

  it('lands a galactic jump at the system nearest the middle of the chart', () => {
    const s = nearestTo(1, 96, 96);
    for (const o of galaxy(1)) expect((Math.abs(o.x - 96) >> 1) + (Math.abs(o.y - 96) >> 1)).toBeGreaterThanOrEqual((Math.abs(s.x - 96) >> 1) + (Math.abs(s.y - 96) >> 1));
  });

  it('knows who lives there', () => {
    expect(lave.species).toBe('Human Colonials');
    expect(named('Diso').species).toBe('Black Furry Felines');
    // The original can't make slimy humanoids or furry frogs.
    const all = Array.from({ length: 8 }, (_, i) => galaxy(i)).flat().map((s) => s.species);
    expect(all.some((x) => /Slimy Humanoids|Furry Frogs/.test(x))).toBe(false);
    expect(all.some((x) => x !== 'Human Colonials')).toBe(true);
  });
});
