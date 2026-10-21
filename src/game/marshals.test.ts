import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { newCommander } from './commander';
import { ARRIVAL, ARRIVAL_WARNINGS, marshalsDelay, riftOpenness, WARNING } from './marshals';

const LAVE = systemAt(0, 7);
const ANARCHY = galaxy(0).find((s) => s.government === 0)!;

describe('the Co-operative Marshals', () => {
  it('only come for a warrant, under Modern rules, where there is a government', () => {
    const c = newCommander('modern');
    expect(marshalsDelay(c, LAVE)).toBeNull();
    c.warrant = true;
    expect(marshalsDelay(c, LAVE)).not.toBeNull();
    expect(marshalsDelay(c, ANARCHY)).toBeNull();
    const classic = { ...newCommander('classic'), warrant: true };
    expect(marshalsDelay(classic, LAVE)).toBeNull();
  });

  it('come sooner for a commander who has destroyed a Bastion', () => {
    const c = { ...newCommander('modern'), warrant: true };
    const first = marshalsDelay(c, LAVE, () => 0.5)!;
    c.bastionsDestroyed = 2;
    expect(marshalsDelay(c, LAVE, () => 0.5)!).toBeLessThan(first / 1.9);
  });

  it('give fair warning: the rift opens slowly, and the carrier only appears once it is fully open', () => {
    expect(riftOpenness(0)).toBe(0);
    expect(riftOpenness(ARRIVAL.disturbance / 2)).toBeLessThan(0.1);
    expect(riftOpenness(ARRIVAL.disturbance + ARRIVAL.opening / 2)).toBeGreaterThan(0.3);
    expect(riftOpenness(WARNING)).toBeCloseTo(1);
    for (let t = 0; t < WARNING; t += 0.5) expect(riftOpenness(t + 0.5)).toBeGreaterThanOrEqual(riftOpenness(t));
    // Long enough to notice, then jump out (a 10 s countdown).
    expect(WARNING).toBeGreaterThan(25);
    expect(ARRIVAL_WARNINGS[0].at).toBe(0);
    expect(ARRIVAL_WARNINGS.at(-1)!.at).toBeLessThanOrEqual(WARNING - 5);
  });
});
