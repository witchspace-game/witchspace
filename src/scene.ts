// The scene's lasting things (moved from main.ts): space itself, the station at the origin with its
// slot facing the planet, as in the original, the sun, the player's ship and every computer-controlled
// ship. Made once; everything else about a system is rebuilt on arrival (main.ts buildSystemScene).

import * as THREE from 'three';
import type { ShipVoice } from './audio/spatial';
import { shipById } from './content/ships';
import { DockingComputer } from './game/dockingComputer';
import type { CombatPilot } from './game/combatPilot';
import type { Body, Poi } from './game/explore';
import { MouseAim } from './game/mouseAim';
import type { SurveyPilot } from './game/surveyPilot';
import type { Missile } from './game/missile';
import { Beams } from './game/weapons';
import { SharedSpace, type Remote, type SpaceEvent } from './net/space';
import type { Explosion } from './render/explosion';
import type { NpcRole, NpcShip } from './game/npc';
import { PlayerShip } from './game/playerShip';
import { Station } from './game/station';
import { ATMOSPHERE_SCALE, buildSun } from './render/bodies';
import { SpaceDust } from './render/dust';
import { makeSpace } from './render/renderer';
import type { ShipModel } from './render/shipModel';
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
/** Mouse (or thumb) aim: where the sights point, ahead of the nose. */
export const aim = new MouseAim();
/** Where the gimballed laser's ring points, in the ship's own frame. */
export const gimbalHold = new THREE.Vector3(0, 0, 1);
/** Every computer-controlled ship in the system: police, traders and pirates. */
export const npcs: NpcShip[] = [];
export const ofRole = (role: NpcRole) => npcs.filter((n) => n.role === role && !n.guard); // company security isn't the police
/** Each ship's engine, heard in space. */
export const voices = new Map<NpcShip, ShipVoice>();
export const missiles: Missile[] = [];
export const explosions: Explosion[] = [];
export const beams = new Beams(space.scene);
/** Metres: close enough to read a hull registration, dark or not. */
export const HULL_READ = 2000;

/** Other commanders in this system (shared space). main.ts hears what they do (hearSpace). */
let spaceEvents: (e: SpaceEvent) => void = () => {};
export const sharedSpace = new SharedSpace((e) => spaceEvents(e));
export const hearSpace = (fn: (e: SpaceEvent) => void) => (spaceEvents = fn);

/** What an armed missile can lock on to: a ship, or another commander. */
export type SeekTarget = NpcShip | Remote;

export interface SceneBody {
  body: Body;
  centre: THREE.Vector3;
  radius: number;
  /** How low you need to be over its surface to survey it, in metres. */
  range: number;
}

export interface ScenePoi {
  poi: Poi;
  position: THREE.Vector3;
  /** Shown on the HUD: after surveying the planet, or on flying near. */
  revealed: boolean;
  models: ShipModel[];
  beacon: THREE.Group | null;
}

/** How the flight in this system stands: shared by the parts of the game that fly it. */
export const flight = {
  /** Seconds since the game started (the main loop's clock). */
  elapsed: 0,
  /** Rebuilt on arrival. */
  planetRadius: 5000,
  autopilot: false,
  /** The top of the planet's atmosphere, in metres from its centre. */
  atmosphere: 5000 * ATMOSPHERE_SCALE,
  /** The planet's pull on debris; see updateDrifters. */
  planetGM: 0.05 * 14000 ** 2,
  sceneBodies: [] as SceneBody[],
  scenePois: [] as ScenePoi[],
  /** A Wexley-Yorozu yard by one of the moons (Modern), if there's one here now. */
  yardScene: null as YardScene | null,
  /** The player's missile lock. */
  locked: null as NpcShip | null,
  /** How hard the camera shakes (a hit, a tremor); it dies away. */
  shake: 0,
  /** When you last fired (everyone can see you for a moment after). */
  lastShotAt: -Infinity,
  /** Seconds until fitted equipment can be lost again. */
  equipmentHitCooldown: 0,
  /** A missile lock on another commander (shared space). */
  lockedCommander: null as Remote | null,
  /** Armed and seeking: what's in the sights, and how close to a lock (0..1). */
  seeker: null as { on: SeekTarget | null; progress: number; beep: number } | null,
  /** Holding still for the police: seconds so far. */
  surrenderTimer: null as number | null,
  /** 0..100+, over 100 the hull starts to burn. */
  cabinTemp: 0,
  /** Seconds in the system, for the pirates after a lost case. */
  raidClock: 0,
  /** Running dark (Modern): the transponder switched off. */
  transponderOff: false,
  /** The station has told you you're cleared to dock (or you've just left it). */
  clearanceAnnounced: false,
  /** Seconds until the comms array next listens for offers and news. */
  arrayTimer: 0,
  /** Seconds until the next distress call might come. */
  distressTimer: 90,
  /** Seconds until the lasers can fire again. */
  laserCooldown: 0,
  /** 0..100, the original's "LT" gauge. */
  laserHeat: 0,
  overheated: false,
  /** Waiting for the coast to clear before switching on to dock. */
  switchOnWhenClear: false,
  /** The combat computer flying the ship (Modern), if it's on. */
  combatComputer: null as CombatPilot | null,
  /** The survey autopilot, if it's on. */
  surveyPilot: null as SurveyPilot | null,
  /** When the route autopilot jumps next. */
  routeJumpAt: null as number | null,
  /** The hyperspace countdown, in seconds, while it runs. */
  countdown: null as number | null,
  /** A Viper detailed to fly with you, and until when. */
  escort: null as { npc: NpcShip; until: number } | null,
};
