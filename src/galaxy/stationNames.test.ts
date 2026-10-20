import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from './generate';
import data from '../../content/station-names.json';
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

describe('station name content', () => {
  // Names are shown in the game's UI, so keep them to plain text: letters
  // (including accented ones), digits, spaces and simple punctuation.
  const SAFE = /^[\p{L}\p{N} .,'’-]+$/u;
  it('uses only plain-text characters', () => {
    const names = [
      ...data.names.flatMap((n: { name: string; honours: string }) => [n.name, n.honours]),
      ...data.suffixes,
      ...Object.values(data.special as Record<string, { name: string; honours: string }>).flatMap((n) => [n.name, n.honours]),
    ].filter(Boolean);
    const bad = names.filter((n) => !SAFE.test(n));
    expect(bad).toEqual([]);
  });
});
