// The scene's lasting things (moved from main.ts): space itself, the station at the origin with its
// slot facing the planet, as in the original, the sun, the player's ship and every computer-controlled
// ship. Made once; everything else about a system is rebuilt on arrival (main.ts buildSystemScene).

import * as THREE from 'three';
import { shipById } from './content/ships';
import { DockingComputer } from './game/dockingComputer';
import type { Body } from './game/explore';
import type { NpcShip } from './game/npc';
import { PlayerShip } from './game/playerShip';
import { Station } from './game/station';
import { buildSun } from './render/bodies';
import { SpaceDust } from './render/dust';
import { makeSpace } from './render/renderer';
import type { YardScene } from './render/yard';

export const space = makeSpace();
export const planetPos = new THREE.Vector3(0, 0, 14000);
export const SUN_POS = new THREE.Vector3(-60000, 22000, -40000);
export const SUN_RADIUS = 4000;
space.sun.position.copy(SUN_POS);
export const station = new Station(shipById('coriolis')!);
space.scene.add(station.root);
export const sun = buildSun(SUN_RADIUS);
sun.position.copy(SUN_POS);
space.scene.add(sun);
export const dust = new SpaceDust();
space.scene.add(dust.group);
export const player = new PlayerShip(shipById('cobra-mk3')!);
space.scene.add(player.obj);
export const dockingComputer = new DockingComputer();
/** Every computer-controlled ship in the system: police, traders and pirates. */
export const npcs: NpcShip[] = [];

export interface SceneBody {
  body: Body;
  centre: THREE.Vector3;
  radius: number;
  /** How low you need to be over its surface to survey it, in metres. */
  range: number;
}

/** How the flight in this system stands: shared by the parts of the game that fly it. */
export const flight = {
  /** Seconds since the game started (the main loop's clock). */
  elapsed: 0,
  /** Rebuilt on arrival. */
  planetRadius: 5000,
  autopilot: false,
  sceneBodies: [] as SceneBody[],
  /** A Wexley-Yorozu yard by one of the moons (Modern), if there's one here now. */
  yardScene: null as YardScene | null,
  /** The player's missile lock. */
  locked: null as NpcShip | null,
  /** A Viper detailed to fly with you, and until when. */
  escort: null as { npc: NpcShip; until: number } | null,
};
