import { describe, expect, it } from 'vitest';
import { killPoints, pointsNote, ratingProgress, rightOn, threatRank, type Foe } from './rating';

const foe = (f: Partial<Foe>): Foe => ({ value: 0.33, role: 'pirate', bounty: 50, firedFirst: true, laser: 'Pulse laser', missiles: 0, ecm: false, wingmen: 0, ...f });
const sidewinder = foe({});
const cobra = foe({ value: 0.91, laser: 'Beam laser', missiles: 3, ecm: true });

describe('combat rating points (Modern rules)', () => {
  it('weighs a kill by the ship: a Sidewinder pirate is worth well under one', () => {
    expect(killPoints(sidewinder, 0).points).toBeCloseTo(0.33 * 1.3, 2);
  });

  it('pays more for a better-armed foe', () => {
    expect(killPoints(cobra, 0).points).toBeGreaterThan(killPoints(foe({ value: 0.91 }), 0).points);
  });

  it('pays more when you are outnumbered, up to double', () => {
    const alone = killPoints(sidewinder, 0).points;
    expect(killPoints(foe({ wingmen: 2 }), 0).points).toBeCloseTo(alone * 1.5, 1);
    expect(killPoints(foe({ wingmen: 9 }), 0).points).toBeCloseTo(alone * 2, 2);
  });

  it('pays nothing for a crime: a clean trader or a police Viper', () => {
    expect(killPoints(foe({ role: 'trader', bounty: 0, firedFirst: false }), 0)).toEqual({ points: 0, none: 'crime' });
    expect(killPoints(foe({ role: 'police', value: 0.1, bounty: 0, firedFirst: false }), 0).none).toBe('crime');
  });

  it('counts self-defence, whoever fired first', () => {
    expect(killPoints(foe({ role: 'trader', bounty: 0, firedFirst: true, value: 0.91 }), 0).points).toBeCloseTo(0.91, 2);
  });

  it('rates the foes as the design does', () => {
    expect(threatRank(sidewinder)).toBe(2); // Poor
    expect(threatRank(foe({ value: 0.91, laser: 'Beam laser' }))).toBe(5); // Competent
    expect(threatRank(foe({ role: 'alien', bounty: 0, value: 2.66 }))).toBe(6); // Dangerous
  });

  it('wears easy targets thin as you improve', () => {
    const full = killPoints(sidewinder, 0).points; // Harmless
    expect(killPoints(sidewinder, 16).points).toBe(full); // Poor: its own rank
    expect(killPoints(sidewinder, 32).points).toBeCloseTo(full / 2, 1); // Average: one above
    expect(killPoints(sidewinder, 64).points).toBeCloseTo(full / 4, 1); // Above Average: two above
    expect(killPoints(sidewinder, 128)).toEqual({ points: 0, none: 'too easy' }); // Competent: three above
  });

  it('halves a kill the combat computer flew', () => {
    expect(killPoints(sidewinder, 0, true).points).toBeCloseTo(killPoints(sidewinder, 0).points / 2, 1);
  });

  it('makes Average a long way off: about 70 lone Sidewinder pirates from Harmless', () => {
    let points = 0;
    let kills = 0;
    while (points < 32 && kills < 1000) {
      points += killPoints(sidewinder, points).points;
      kills++;
    }
    expect(kills).toBeGreaterThan(60);
  });

  it('says what a kill earned, or why not', () => {
    expect(pointsNote({ points: 0.43 })).toBe('+0.43 rating');
    expect(pointsNote({ points: 1.5 })).toBe('+1.5 rating');
    expect(pointsNote({ points: 0, none: 'crime' })).toBe('No rating · crime');
    expect(pointsNote({ points: 0, none: 'too easy' })).toBe('No rating · too easy for you');
  });

  it('shows the road ahead, and salutes every 256 points', () => {
    expect(ratingProgress(87)).toBe('Above Average · 41 points to Competent');
    expect(ratingProgress(31.6)).toBe('Poor · 0.4 points to Average');
    expect(rightOn(255.8, 256.2)).toBe(true);
    expect(rightOn(250, 255)).toBe(false);
  });
});
