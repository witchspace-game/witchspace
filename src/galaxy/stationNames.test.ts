import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from './generate';
import { stationName } from './stationNames';

describe('station names', () => {
  it('names every station in every galaxy, the same every time', () => {
    for (let g = 0; g < 8; g++) for (const s of galaxy(g)) {
      expect(stationName(s).name.length).toBeGreaterThan(3);
      expect(stationName(s)).toEqual(stationName(s));
    }
  });
  it('gives Lave its tribute', () => {
    expect(stationName(systemAt(0, 7)).name).toBe('Cambridge Orbital');
  });
  it('uses plenty of different names', () => {
    expect(new Set(galaxy(0).map((s) => stationName(s).name)).size).toBeGreaterThan(150);
  });
});
