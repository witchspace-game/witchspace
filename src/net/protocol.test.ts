import { describe, expect, it } from 'vitest';
import { LASERS, SHIPS } from '../../server/src/protocol';
import { shipById } from '../content/ships';
import { PLAYER_LASERS } from '../game/weapons';

// The shared space server keeps its own copy of the numbers it referees with.
// They must match the game's, or fights would feel wrong.
describe('the shared space server agrees with the game', () => {
  it('on lasers', () => {
    for (const [id, l] of Object.entries(PLAYER_LASERS)) expect(LASERS[id]).toEqual({ interval: l.interval, damage: l.damage, range: l.range });
  });

  it('on ships', () => {
    for (const [id, s] of Object.entries(SHIPS)) {
      const def = shipById(id)!;
      expect({ maxSpeed: def.stats.maxSpeed, shields: def.stats.shields, hull: def.stats.hull }).toEqual({ maxSpeed: s.maxSpeed, shields: s.shields, hull: s.hull });
    }
  });
});
