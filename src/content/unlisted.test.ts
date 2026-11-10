import { describe, expect, it } from 'vitest';
import { listedShips, shipById } from './ships';
import { FLYABLE } from './flyable';
import { inYards } from '../game/manual';
import { loadShips } from '../../tools/shipFiles';

describe('an unlisted ship', () => {
  const wisp = shipById('on-loan')!;
  it('is known to the game and flies as herself in shared space', () => {
    expect(wisp.unlisted).toBe(true);
    expect(FLYABLE['on-loan'].maxSpeed).toBe(wisp.stats.maxSpeed);
  });
  it('is kept off the showroom, the site and the shipyards', () => {
    expect(listedShips.some((s) => s.id === wisp.id)).toBe(false);
    expect(loadShips(process.cwd()).some((s) => s.id === wisp.id)).toBe(false);
    expect(inYards(wisp)).toBe(false);
  });
});
