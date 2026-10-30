import * as THREE from 'three';
import type { NpcShip } from './npc';
import type { PlayerShip } from './playerShip';

// Who fights whom. Each NPC is given a mode and a target a few times a second;
// npc.ts does the flying.
//
// - Police patrol the station, chase the player if wanted here, and attack
//   pirates in range. Pirates are always fair game. Marshals' Lancers do the
//   same; their carrier doesn't fight, it launches them.
// - Traders fly their route. Shot at, they run from whoever fired.
// - Pirates hunt traders or the player, fight back when shot at, and run
//   when badly hurt. They scan holds: a rich cargo is worth flying further for.
// - Anyone hunting the player who loses sight of them (hidden in a wreck
//   field) searches where they were last seen, then gives up.

export interface World {
  player: PlayerShip;
  /** False while the player is docked, dead or between systems. */
  playerPresent: boolean;
  /** Whether the local police want the player. */
  playerWanted: boolean;
  npcs: NpcShip[];
  /** What a ship's hold is worth here, in credits, as a pirate's scanner reads it. */
  cargoValue?: (ship: PlayerShip) => number;
  /** Classic rules: inside the station's safe zone, pirates lose their nerve (as in 1984). */
  inSafeZone?: (at: THREE.Vector3) => boolean;
  /** Whether this ship can pick the player out (not hidden in clutter). Default: always. */
  canSee?: (npc: NpcShip) => boolean;
}

export const POLICE_RANGE = 6000; // metres: police respond to pirates this close
export const PIRATE_RANGE = 8000; // pirates spot prey this close
const FLEE_MEMORY = 12; // seconds a ship remembers being shot at
const PIRATE_FLEE_HEALTH = 0.2;
export const SEARCH_TIME = 30; // seconds spent searching where the player was last seen

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

/**
 * The best prey in range: near and rich. A hold worth 500 Cr counts as
 * twice as close as an empty one, so pirates go out of their way for
 * valuable cargo.
 */
function richest(from: THREE.Vector3, ships: PlayerShip[], range: number, value?: (s: PlayerShip) => number): PlayerShip | null {
  if (!value) return nearest(from, ships, range);
  let best: PlayerShip | null = null;
  let bestScore = Infinity;
  for (const s of ships) {
    const d = s.obj.position.distanceTo(from);
    if (d > range) continue;
    const score = d / (1 + value(s) / 500);
    if (score < bestScore) {
      best = s;
      bestScore = score;
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

  const seesPlayer = world.playerPresent && (world.canSee?.(npc) ?? true);

  const attack = (target: PlayerShip) => {
    if (target === player && !seesPlayer) return search();
    if (target === player) npc.lastSeen = (npc.lastSeen ?? new THREE.Vector3()).copy(player.obj.position);
    // Don't interrupt a break-off pass against the same target.
    if (npc.target !== target || npc.mode !== 'breakoff') npc.mode = 'attack';
    npc.target = target;
    npc.hostile = target === player;
  };
  // Lost sight of the player: look where they were, for a while.
  const search = () => {
    if (!npc.lastSeen) return cruise(); // never saw them: no idea where to look
    if (npc.mode !== 'search') npc.searchLeft = SEARCH_TIME;
    if (npc.searchLeft <= 0) {
      npc.lastSeen = null; // given up
      return cruise();
    }
    npc.mode = 'search';
    npc.target = player;
    npc.hostile = true;
  };
  const cruise = () => {
    npc.target = null;
    npc.hostile = false;
    npc.mode = npc.destination ? 'travel' : 'patrol';
  };

  if (npc.fights === false) return cruise();
  switch (npc.role) {
    case 'police':
    case 'marshal': {
      if (npc.guard && recentAttacker) return attack(recentAttacker);
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
      if (npc.errand) return cruise();
      if (world.inSafeZone?.(at)) return cruise();
      // Keep after the current prey while it's still about.
      const current = npc.target;
      if ((npc.mode === 'attack' || npc.mode === 'breakoff' || npc.mode === 'search') && valid(current) && current.obj.position.distanceTo(at) < PIRATE_RANGE * 1.5) {
        return attack(current);
      }
      const prey = others.filter((n) => n.role === 'trader').map((n) => n.ship);
      // A hidden player isn't prey, unless this ship is already after them.
      if (world.playerPresent && (seesPlayer || (npc.target === player && npc.lastSeen))) prey.push(player);
      const target = richest(at, prey, PIRATE_RANGE, world.cargoValue);
      return target ? attack(target) : cruise();
    }
  }
}
