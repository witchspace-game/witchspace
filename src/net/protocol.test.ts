import { describe, expect, it } from 'vitest';
import { LASERS, MISSILE as SERVER_MISSILE, RANKS, SHIPS } from '../../server/src/protocol';
import { MISSILE } from '../game/missile';
import { RANK_NAMES } from '../game/rating';
import { shipById, ships } from '../content/ships';
import { EDITIONS } from '../content/editions';
import { PLAYER_LASERS } from '../game/weapons';

// The shared space server keeps its own copy of the numbers it referees with.
// They must match the game's, or fights would feel wrong.
describe('the shared space server agrees with the game', () => {
  it('on lasers', () => {
    for (const [id, l] of Object.entries(PLAYER_LASERS)) expect(LASERS[id]).toEqual({ interval: l.interval, damage: l.damage, range: l.range });
  });

  it('on missiles', () => {
    expect(SERVER_MISSILE).toEqual(MISSILE);
  });

  it('on ranks', () => {
    expect(RANKS).toEqual(RANK_NAMES);
  });

  it('on ships', () => {
    for (const [id, s] of Object.entries(SHIPS)) {
      const def = shipById(id)!;
      expect({ maxSpeed: def.stats.maxSpeed, shields: def.stats.shields, hull: def.stats.hull, missiles: def.stats.missiles }).toEqual({ maxSpeed: s.maxSpeed, shields: s.shields, hull: s.hull, missiles: s.missiles });
    }
  });

  it('knows every hull a commander can own, so none flies into shared space as a Cobra', () => {
    const ownable = ['cobra-mk3', ...ships.filter((d) => d.concept).map((d) => d.id)];
    for (const id of ownable) expect(Object.keys(SHIPS)).toContain(id);
    for (const e of EDITIONS) expect(Object.keys(SHIPS)).toContain(e.ship);
  });

  it('sizes each hull for hits: the Cobra 28 m, as she always was, and bigger ships bigger', () => {
    expect(SHIPS['cobra-mk3'].radius).toBe(28);
    expect(SHIPS['fer-de-lance'].radius).toBeGreaterThan(SHIPS['cobra-mk3'].radius);
  });
});
