import { describe, expect, it } from 'vitest';
import { newCommander, repaint, REPAINTED, type Paint } from './commander';
import { VENN } from './odile';
import { PALETTE } from './shipyard';

const paint = (colour: string): Paint => ({ colour, glow: 'standard', trim: null, name: 'Rosie', luxuries: [] });

describe('a paint the yard has changed', () => {
  it('moves the ship you fly, those in hangars, and one on order', () => {
    const c = { ...newCommander('modern'), paint: paint('#FF6FAE') };
    c.fleet = [{ id: 'f1', ship: 'cobra-mk3', paint: paint('#ff6fae'), equipment: [], lasers: {}, missiles: 0, damaged: [], at: { galaxy: 0, system: 7 } }];
    c.order = { ship: 'cobra-mk3', colour: '#ff6fae', name: 'Rosie', laser: 'pulse', upgrades: [] } as unknown as typeof c.order;
    repaint(c);
    expect(c.paint!.colour).toBe('#ff2e88');
    expect(c.fleet[0].paint!.colour).toBe('#ff2e88');
    expect(c.order!.colour).toBe('#ff2e88');
  });

  it('leaves every other colour alone', () => {
    const c = { ...newCommander('modern'), paint: paint('#3dffb0') };
    expect(repaint(c).paint!.colour).toBe('#3dffb0');
  });

  it("goes to a colour the yard sells, and nobody's sells Odile Venn's", () => {
    for (const to of Object.values(REPAINTED)) expect(PALETTE.some((p) => p.colour === to)).toBe(true);
    expect(PALETTE.some((p) => p.colour.toLowerCase() === VENN.colour)).toBe(false);
    expect(PALETTE.some((p) => /rose/i.test(p.name))).toBe(false);
  });
});
