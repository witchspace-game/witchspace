import { describe, expect, it } from 'vitest';
import { isClaim } from './firsts';

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
});
