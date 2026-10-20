import * as THREE from 'three';
import type { NpcShip } from './npc';
import type { PlayerShip } from './playerShip';

// Who fights whom. Each NPC is given a mode and a target a few times a second;
// npc.ts does the flying.
//
// - Police patrol the station, chase the player if wanted here, and attack
//   pirates in range. Pirates are always fair game.
// - Traders fly their route. Shot at, they run from whoever fired.
// - Pirates hunt the nearest trader or the player, fight back when shot at,
//   and run when badly hurt.

export interface World {
  player: PlayerShip;
  /** False while the player is docked, dead or between systems. */
  playerPresent: boolean;
  /** Whether the local police want the player. */
  playerWanted: boolean;
  npcs: NpcShip[];
}

export const POLICE_RANGE = 6000; // metres: police respond to pirates this close
export const PIRATE_RANGE = 8000; // pirates spot prey this close
const FLEE_MEMORY = 12; // seconds a ship remembers being shot at
const PIRATE_FLEE_HEALTH = 0.2;

function nearest(from: THREE.Vector3, ships: PlayerShip[], range: number): PlayerShip | null {
  let best: PlayerShip | null = null;
  let bestD = range;
  for (const s of ships) {
    const d = s.obj.position.distanceTo(from);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function think(npc: NpcShip, world: World) {
  const { player } = world;
  const at = npc.obj.position;
  const others = world.npcs.filter((n) => n !== npc);
  // A ship is worth reacting to if it's still in space.
  const valid = (s: PlayerShip | null): s is PlayerShip =>
    s !== null && (s === player ? world.playerPresent : others.some((n) => n.ship === s));
  const recentAttacker = npc.attackedAgo < FLEE_MEMORY && valid(npc.attacker) ? npc.attacker : null;

  const attack = (target: PlayerShip) => {
    // Don't interrupt a break-off pass against the same target.
    if (npc.target !== target || npc.mode !== 'breakoff') npc.mode = 'attack';
    npc.target = target;
    npc.hostile = target === player;
  };
  const cruise = () => {
    npc.target = null;
    npc.hostile = false;
    npc.mode = npc.destination ? 'travel' : 'patrol';
  };

  switch (npc.role) {
    case 'police': {
      if (world.playerWanted && world.playerPresent) return attack(player);
      const pirate = nearest(at, others.filter((n) => n.role === 'pirate').map((n) => n.ship), POLICE_RANGE);
      return pirate ? attack(pirate) : cruise();
    }
    case 'trader': {
      if (recentAttacker) {
        npc.target = recentAttacker;
        npc.mode = 'flee';
        npc.hostile = false;
        return;
      }
      return cruise();
    }
    case 'pirate': {
      if (npc.health < PIRATE_FLEE_HEALTH && recentAttacker) {
        npc.target = recentAttacker;
        npc.mode = 'flee';
        npc.hostile = false;
        return;
      }
      // Fight back against whoever is shooting, police included.
      if (recentAttacker) return attack(recentAttacker);
      // Keep after the current prey while it's still about.
      const current = npc.target;
      if ((npc.mode === 'attack' || npc.mode === 'breakoff') && valid(current) && current.obj.position.distanceTo(at) < PIRATE_RANGE * 1.5) {
        return attack(current);
      }
      const prey = others.filter((n) => n.role === 'trader').map((n) => n.ship);
      if (world.playerPresent) prey.push(player);
      const target = nearest(at, prey, PIRATE_RANGE);
      return target ? attack(target) : cruise();
    }
  }
}
