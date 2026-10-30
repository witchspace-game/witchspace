// The scene's lasting things (moved from main.ts): space itself, the station at the origin with its
// slot facing the planet, as in the original, the sun, the player's ship and every computer-controlled
// ship. Made once; everything else about a system is rebuilt on arrival (main.ts buildSystemScene).

import * as THREE from 'three';
import { shipById } from './content/ships';
import { DockingComputer } from './game/dockingComputer';
import type { NpcShip } from './game/npc';
import { PlayerShip } from './game/playerShip';
import { Station } from './game/station';
import { buildSun } from './render/bodies';
import { SpaceDust } from './render/dust';
import { makeSpace } from './render/renderer';

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
