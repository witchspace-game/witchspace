import { describe, expect, it } from 'vitest';
import type { Voyage } from '../game/traffic';
import { andList, groupConvoys } from './convoys';

const v = (id: string, name: string, at: number): Voyage => ({ id, leg: 'in', to: 'station', at, cargo: [], company: 'hexon', hull: 'boa', name, other: 1, escorts: 0 }) as Voyage;

describe('groupConvoys', () => {
  it('gathers a convoy into one line, led by its first ship', () => {
    const g = groupConvoys([v('a', 'Free Hand', 0), v('b', 'Solo', 10), v('a:c1', 'Cold Comfort', 25), v('a:c2', 'Even Keel', 50)]);
    expect(g.map((a) => [a.lead.name, a.with.map((w) => w.name), a.rest])).toEqual([
      ['Free Hand', ['Cold Comfort', 'Even Keel'], false],
      ['Solo', [], false],
    ]);
  });

  it('marks the last of a convoy whose lead is already in', () => {
    const g = groupConvoys([v('a:c1', 'Cold Comfort', 0), v('a:c2', 'Even Keel', 25)]);
    expect(g).toHaveLength(1);
    expect(g[0].rest).toBe(true);
    expect(g[0].with[0].name).toBe('Even Keel');
  });

  it('counts lines, not ships, against the limit', () => {
    const g = groupConvoys([v('a', 'A', 0), v('a:c1', 'A2', 1), v('a:c2', 'A3', 2), v('b', 'B', 3), v('c', 'C', 4)], 2);
    expect(g.map((a) => a.lead.name)).toEqual(['A', 'B']);
  });
});

describe('andList', () => {
  it('joins names', () => {
    expect(andList(['A'])).toBe('A');
    expect(andList(['A', 'B'])).toBe('A and B');
    expect(andList(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
