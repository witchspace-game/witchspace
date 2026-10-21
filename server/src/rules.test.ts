import { describe, expect, it } from 'vitest';
import { cleanName, JUMP } from './protocol';
import { canFire, checkMove, closestApproach, collisionDamage, positionAt, recharge, reportHealth, resolveShot, stepMissile, takeHit, type Flight, type Track } from './rules';

const at = (z: number, t: number, jumpedAt = -1e9): Track => ({ p: [0, 0, z], t, jumpedAt });

describe('shared space: what the server accepts', () => {
  it('accepts flying at your ship’s speed, and your first position', () => {
    expect(checkMove('cobra-mk3', null, [0, 0, 5000], 200, 0)).toBe('ok');
    expect(checkMove('cobra-mk3', at(0, 0), [0, 0, 28], 280, 100)).toBe('ok'); // 0.1 s at top speed
  });

  it('refuses speeding and teleporting', () => {
    expect(checkMove('cobra-mk3', null, [0, 0, 0], 600, 0)).toBe('speeding');
    expect(checkMove('cobra-mk3', at(0, 0), [0, 0, 20_000], 280, 100)).toBe('teleport'); // beyond any jump
    expect(checkMove('cobra-mk3', at(0, 0, -500), [0, 0, 3000], 280, 100)).toBe('teleport'); // jumped just now
  });

  it('allows an in-system jump (which can stop short), but not two in quick succession', () => {
    expect(checkMove('cobra-mk3', at(0, 0), [0, 0, 3000], 280, 100)).toBe('jump');
    expect(checkMove('cobra-mk3', at(0, 0), [0, 0, JUMP - 100], 280, 100)).toBe('jump');
    expect(checkMove('cobra-mk3', at(0, 0, -500), [0, 0, JUMP - 100], 280, 100)).toBe('teleport');
  });

  it('refuses positions far outside the system, and ships it doesn’t know', () => {
    expect(checkMove('cobra-mk3', null, [0, 0, 1e7], 100, 0)).toBe('out of bounds');
    expect(checkMove('thargoid', null, [0, 0, 0], 100, 0)).toBe('speeding');
  });

  it('keeps names short and printable', () => {
    expect(cleanName('  Jameson  ')).toBe('Jameson');
    expect(cleanName('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
    expect(cleanName(42)).toBe('Commander');
  });
});

describe('shared space: lasers, refereed by the server', () => {
  const still = () => 0.5; // no scatter

  it('judges a shot where the shooter saw the target, a moment ago', () => {
    const history = [{ t: 0, p: [0, 0, 1000] as [number, number, number] }, { t: 200, p: [200, 0, 1000] as [number, number, number] }];
    expect(positionAt(history, 100)).toEqual([100, 0, 1000]);
    expect(positionAt(history, -50)).toEqual([0, 0, 1000]);
    expect(positionAt(history, 999)).toEqual([200, 0, 1000]);
  });

  it('hits the nearest ship in line, within range, and misses wide shots', () => {
    const targets = [
      { id: 'far', p: [0, 0, 2000] as [number, number, number], radius: 28 },
      { id: 'near', p: [10, 0, 800] as [number, number, number], radius: 28 },
      { id: 'beside', p: [200, 0, 500] as [number, number, number], radius: 28 },
    ];
    expect(resolveShot([0, 0, 0], [0, 0, 1], 3000, targets, still)).toBe('near');
    expect(resolveShot([0, 0, 0], [0, 0, 1], 500, targets, still)).toBeNull(); // out of range
    expect(resolveShot([0, 0, 0], [0, 0, -1], 3000, targets, still)).toBeNull(); // behind
    expect(resolveShot([0, 0, 0], [0, 0, 0], 3000, targets, still)).toBeNull(); // nonsense direction
  });

  it('only allows lasers that are fitted, no faster than they fire', () => {
    expect(canFire('beam', ['beam'], 0, 100)).toBe(true);
    expect(canFire('beam', ['beam'], 0, 50)).toBe(false); // too soon
    expect(canFire('military', ['beam'], 0, 1000)).toBe(false); // not fitted
    expect(canFire('death-ray', ['death-ray'], 0, 1000)).toBe(false); // no such laser
  });

  it('takes damage on the shields first, recharges them, and only believes reports of less health', () => {
    let h = { shields: 100, hull: 150, at: 0 };
    h = takeHit(h, 120).health;
    expect(h).toMatchObject({ shields: 0, hull: 130 });
    expect(takeHit({ shields: 0, hull: 10, at: 0 }, 14).destroyed).toBe(true);
    expect(recharge(h, 100, 5000).shields).toBe(30); // 6 per second
    expect(reportHealth(h, [100, 150], 100, 0)).toMatchObject({ shields: 0, hull: 130 }); // can't heal by saying so
    expect(reportHealth(h, [0, 90], 100, 0)).toMatchObject({ hull: 90 }); // NPC damage counts
  });
});

describe('shared space: collisions', () => {
  it('catches ships passing through each other between updates', () => {
    // 60 m in one update, straight through a ship sitting at the midpoint.
    expect(closestApproach([0, 0, 0], [0, 0, 60], [0, 0, 30])).toBe(0);
    expect(closestApproach([0, 0, 0], [0, 0, 60], [10, 0, 30])).toBeCloseTo(10);
    // Beyond either end, it's the distance from the nearer end.
    expect(closestApproach([0, 0, 0], [0, 0, 60], [0, 0, 100])).toBeCloseTo(40);
    expect(closestApproach([0, 0, 0], [0, 0, 0], [3, 4, 0])).toBeCloseTo(5); // didn't move
  });

  it('hurts more the faster ships meet', () => {
    expect(collisionDamage(0)).toBe(10);
    expect(collisionDamage(150)).toBe(25);
    expect(collisionDamage(560)).toBe(66); // two Cobras head on at full speed
    expect(collisionDamage(-5)).toBe(10);
  });
});

describe('shared space: missiles, flown by the server', () => {
  const fly = (m: Flight, target: [number, number, number] | null, seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      const r = stepMissile(m, target, 0.05);
      if (r !== 'flying') return { r, t };
    }
    return { r: 'flying' as const, t: seconds };
  };

  it('homes in on a ship off to one side', () => {
    const m: Flight = { p: [0, 0, 0], d: [0, 0, 1], s: 120, age: 0 };
    const { r, t } = fly(m, [1500, 0, 1500], 20);
    expect(r).toBe('hit');
    expect(t).toBeLessThan(8);
  });

  it('turns only so fast, so a target right behind takes a while', () => {
    const ahead: Flight = { p: [0, 0, 0], d: [0, 0, 1], s: 120, age: 0 };
    const behind: Flight = { p: [0, 0, 0], d: [0, 0, 1], s: 120, age: 0 };
    expect(fly(behind, [0, 0, -1500], 30).t).toBeGreaterThan(fly(ahead, [0, 0, 1500], 30).t + 1);
  });

  it('flies straight on and burns out without a target', () => {
    const m: Flight = { p: [0, 0, 0], d: [0, 0, 1], s: 120, age: 0 };
    expect(fly(m, null, 40).r).toBe('expired');
    expect(m.p[0]).toBeCloseTo(0);
  });
});
