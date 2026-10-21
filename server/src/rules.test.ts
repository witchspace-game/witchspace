import { describe, expect, it } from 'vitest';
import { cleanName, JUMP } from './protocol';
import { checkMove, type Track } from './rules';

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
