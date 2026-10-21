import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { think, type World } from './ai';
import type { NpcRole, NpcShip } from './npc';
import type { PlayerShip } from './playerShip';
import { combatRating, nextRating } from './rating';

// Just enough of a ship for the decision-making, which only reads positions.
const fakeShip = (x: number) => ({ obj: { position: new THREE.Vector3(x, 0, 0) } }) as unknown as PlayerShip;

function fakeNpc(role: NpcRole, x: number): NpcShip {
  const ship = fakeShip(x);
  return {
    role, ship, obj: ship.obj, mode: 'patrol', hostile: false, target: null, destination: null,
    attacker: null, attackedAgo: Infinity, health: 1,
  } as unknown as NpcShip;
}

const world = (npcs: NpcShip[], player = fakeShip(0), present = true, wanted = false): World => ({
  player, playerPresent: present, playerWanted: wanted, npcs,
});

describe('who fights whom', () => {
  it('police chase a wanted player, otherwise nearby pirates', () => {
    const cop = fakeNpc('police', 0);
    const pirate = fakeNpc('pirate', 3000);
    const w = world([cop, pirate], fakeShip(500), true, true);
    think(cop, w);
    expect(cop.target).toBe(w.player);
    expect(cop.hostile).toBe(true);
    think(cop, { ...w, playerWanted: false });
    expect(cop.target).toBe(pirate.ship);
    expect(cop.hostile).toBe(false);
  });

  it('pirates go out of their way for a rich hold', () => {
    const pirate = fakeNpc('pirate', 0);
    const empty = fakeNpc('trader', 1000);
    const laden = fakeNpc('trader', 2500);
    const w = { ...world([pirate, empty, laden], fakeShip(7000)), cargoValue: (s: PlayerShip) => (s === laden.ship ? 3000 : 0) };
    think(pirate, w);
    expect(pirate.target).toBe(laden.ship);
  });

  it('pirates hunt the nearest prey, the player included', () => {
    const pirate = fakeNpc('pirate', 0);
    const trader = fakeNpc('trader', 4000);
    const w = world([pirate, trader], fakeShip(1000));
    think(pirate, w);
    expect(pirate.target).toBe(w.player);
    expect(pirate.hostile).toBe(true);
    think(pirate, { ...w, playerPresent: false });
    expect(pirate.target).toBe(trader.ship);
  });

  it('pirates ignore prey out of range', () => {
    const pirate = fakeNpc('pirate', 0);
    think(pirate, world([pirate], fakeShip(50000)));
    expect(pirate.target).toBeNull();
    expect(pirate.mode).toBe('patrol');
  });

  it('traders run from whoever shot them, and stop once the threat has gone', () => {
    const trader = fakeNpc('trader', 0);
    const w = world([trader]);
    trader.attacker = w.player;
    trader.attackedAgo = 1;
    think(trader, w);
    expect(trader.mode).toBe('flee');
    think(trader, { ...w, playerPresent: false });
    expect(trader.mode).toBe('patrol');
  });

  it('badly hurt pirates flee their attacker', () => {
    const pirate = fakeNpc('pirate', 0);
    const cop = fakeNpc('police', 800);
    (pirate as { health: number }).health = 0.1;
    pirate.attacker = cop.ship;
    pirate.attackedAgo = 2;
    think(pirate, world([pirate, cop]));
    expect(pirate.mode).toBe('flee');
    expect(pirate.target).toBe(cop.ship);
  });
});

describe('combat rating', () => {
  it('climbs with kills', () => {
    expect(combatRating(0)).toBe('Harmless');
    expect(combatRating(8)).toBe('Mostly Harmless');
    expect(combatRating(6400)).toBe('Elite');
    expect(nextRating(0)).toEqual({ name: 'Mostly Harmless', at: 8 });
    expect(nextRating(7000)).toBeNull();
  });
});
