import { describe, expect, it } from 'vitest';
import { systemAt } from '../../src/galaxy/generate';
import { courierSystem, poisOf, trailsOf, worldOf } from '../../src/game/explore';
import { allowance, isClaim, isRealClaim, PACE } from './firsts';

describe('first-discovery claims', () => {
  it('accept the bodies the game has', () => {
    for (const body of ['planet', 'star', 'moon0', 'moon2', 'poi1', 'courier', 'trail:0.15:4']) expect(isClaim({ galaxy: 3, system: 255, body })).toBe(true);
  });
  it('turn away anything else', () => {
    expect(isClaim({ galaxy: 8, system: 1, body: 'planet' })).toBe(false);
    expect(isClaim({ galaxy: 0, system: 256, body: 'planet' })).toBe(false);
    expect(isClaim({ galaxy: 0, system: 1.5, body: 'planet' })).toBe(false);
    expect(isClaim({ galaxy: 0, system: 1, body: 'moon9' })).toBe(false);
    expect(isClaim({ galaxy: 0, system: 1, body: '<script>' })).toBe(false);
    expect(isClaim(null)).toBe(false);
  });

  it('only for what the galaxy really has, where it has it', () => {
    // Lave has one moon: a second can't be claimed.
    const moons = worldOf(systemAt(0, 7)).moons.length;
    expect(isRealClaim({ galaxy: 0, system: 7, body: 'planet' })).toBe(true);
    expect(isRealClaim({ galaxy: 0, system: 7, body: `moon${moons - 1}` })).toBe(moons > 0);
    expect(isRealClaim({ galaxy: 0, system: 7, body: `moon${moons}` })).toBe(false);
    // A signal only where there is one.
    const withSignal = [...Array(256).keys()].find((i) => poisOf(systemAt(0, i)).length > 0)!;
    const without = [...Array(256).keys()].find((i) => poisOf(systemAt(0, i)).length === 0)!;
    expect(isRealClaim({ galaxy: 0, system: withSignal, body: 'poi0' })).toBe(true);
    expect(isRealClaim({ galaxy: 0, system: without, body: 'poi0' })).toBe(false);
    // The courier in its one system; a trail step in its own system and galaxy.
    const courier = courierSystem(2).index;
    expect(isRealClaim({ galaxy: 2, system: courier, body: 'courier' })).toBe(true);
    expect(isRealClaim({ galaxy: 2, system: (courier + 1) % 256, body: 'courier' })).toBe(false);
    const t = trailsOf(1)[0];
    expect(isRealClaim({ galaxy: 1, system: t.systems[1], body: `trail:${t.id}:1` })).toBe(true);
    expect(isRealClaim({ galaxy: 1, system: t.systems[0], body: `trail:${t.id}:1` })).toBe(false);
    expect(isRealClaim({ galaxy: 0, system: t.systems[1], body: `trail:${t.id}:1` })).toBe(false);
  });
  it('at a human pace', () => {
    expect(allowance(0, 0)).toBe(PACE.hour);
    expect(allowance(PACE.hour, PACE.hour)).toBe(0);
    expect(allowance(10, PACE.day - 5)).toBe(5);
    expect(allowance(PACE.hour + 5, 0)).toBe(0);
  });
});
