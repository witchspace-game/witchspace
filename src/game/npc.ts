import type { CompanyId } from './companies';
import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { buildShip, disposeShip, heatShip, type ShipModel } from '../render/shipModel';
import type { FlightInput } from './input';
import { PlayerShip } from './playerShip';
import type { Laser } from './weapons';

// Computer-controlled ships. They fly with exactly the same physics as the
// player (pitch, roll, limited yaw, no drift), so they can't cheat. This
// module only flies the ship; deciding who to fight or flee is done by the
// caller, which sets `mode`, `target` and `destination`.

export type NpcRole = 'police' | 'marshal' | 'trader' | 'pirate';

/** Police and Marshals are on the same side. */
export const LAW: NpcRole[] = ['police', 'marshal'];
export const allies = (a: NpcRole, b: NpcRole) => a === b || (LAW.includes(a) && LAW.includes(b));

/**
 * - patrol: circle the station
 * - travel: fly to `destination` at cruising speed
 * - attack: chase `target` and fire when lined up
 * - breakoff: peel away after a close pass, then come round again
 * - flee: run directly away from `target` at full speed
 * - search: lost sight of `target`; circle where it was last seen (`lastSeen`)
 */
export type NpcMode = 'patrol' | 'travel' | 'attack' | 'breakoff' | 'flee' | 'search';

const STEER_GAIN = 3;
const FIRE_CONE = THREE.MathUtils.degToRad(3);
const BREAKOFF_RANGE = 300; // metres: too close, peel away
const BREAKOFF_TIME = 2.6; // seconds before coming round again
const AIM_SPREAD = THREE.MathUtils.degToRad(0.7); // so they don't hit with every shot
const CRUISE = 0.6; // fraction of top speed when travelling
const SEARCH_RADIUS = 350; // metres: the circle flown round where the target was last seen

/**
 * Pitch, yaw and roll commands that turn a ship towards a world point,
 * banking into turns and levelling out otherwise. Shared by NPCs and the
 * player's combat computer, so both fly the same way.
 */
export function steerTowards(obj: THREE.Object3D, target: THREE.Vector3): Pick<FlightInput, 'pitch' | 'yaw' | 'roll'> {
  const local = target.clone().sub(obj.position);
  local.applyQuaternion(obj.quaternion.clone().invert());
  const right = Math.atan2(-local.x, local.z);
  const up = Math.atan2(local.y, Math.hypot(local.x, local.z));
  const yaw = THREE.MathUtils.clamp(STEER_GAIN * right, -1, 1);
  const pitch = THREE.MathUtils.clamp(STEER_GAIN * up, -1, 1);
  const level = obj.localToWorld(new THREE.Vector3(-1, 0, 0)).sub(obj.position).y;
  const roll = THREE.MathUtils.clamp(yaw * 0.6 + level * 0.5, -1, 1);
  return { pitch, yaw, roll };
}

export interface Patrol {
  centre: THREE.Vector3;
  radius: number;
  height: number;
  /** Radians per second around the circuit; sign sets direction. */
  rate: number;
  angle: number;
}

export class NpcShip {
  readonly ship: PlayerShip;
  readonly model: ShipModel;
  mode: NpcMode = 'patrol';
  /** Whether this ship is out to get the player (for the scanner and mass lock). */
  hostile = false;
  /** The ship being attacked or fled from: the player's ship or another NPC's. */
  target: PlayerShip | null = null;
  destination: THREE.Vector3 | null = null;
  /** Where the target was when this ship last saw it, and how long it will go on searching there. */
  lastSeen: THREE.Vector3 | null = null;
  searchLeft = 0;
  /** Who last shot at us, and how long ago. */
  attacker: PlayerShip | null = null;
  attackedAgo = Infinity;
  /** Cargo carried, by commodity id; spilled if destroyed. */
  cargo: Record<string, number> = {};
  /** On an errand that matters more than prey (pirates after a lost case): fly to the destination, fight only if attacked. */
  errand?: boolean;
  /** Attacked by the player where nobody saw: it will report it if it gets away. */
  unreported?: boolean;
  /** Has called for help (once). */
  maydayCalled?: boolean;
  /** You were running dark when you attacked it: its report can't name you. */
  seenDark?: boolean;
  /** Running dark itself (the Falcon): unidentified until you're close enough to read the hull. */
  dark?: boolean;
  /** Shown as unidentified right now (so the colours only change when that does). */
  shownUnidentified?: boolean;
  /** Has fired at you: whoever it is, it's hostile. */
  firedOnPlayer?: boolean;
  /** A lost company case this ship has taken aboard (contract id). */
  carrying?: string;
  /** The trading company a trader flies for, if any. */
  company?: CompanyId;
  /** Credits paid for destroying this ship (pirates). */
  bounty = 0;
  /** Missiles left, and whether an ECM is fitted to destroy incoming ones. */
  missiles: number;
  ecm = false;
  /** Carriers launch fighters rather than fighting themselves. */
  fights = true;
  /** A pirate you paid off over the radio: it leaves you be, unless you shoot it. */
  paid?: boolean;
  private cooldown = Math.random();
  private flash = 0;
  private breakTimer = 0;
  private readonly breakDir = new THREE.Vector3();
  private readonly box: THREE.Box3;

  constructor(
    readonly def: ShipDef,
    readonly role: NpcRole,
    readonly laser: Laser,
    readonly patrol: Patrol,
  ) {
    this.ship = new PlayerShip(def);
    this.missiles = def.stats.missiles ?? 0;
    this.model = buildShip(def);
    this.box = new THREE.Box3().setFromPoints(def.geometry.vertices.map((v) => new THREE.Vector3(...v)));
    this.ship.obj.add(this.model.root);
  }

  get obj() {
    return this.ship.obj;
  }

  get radius() {
    return this.model.radius;
  }

  /** Whether a world point is within `margin` metres of the hull's bounding box. */
  touches(point: THREE.Vector3, margin: number): boolean {
    const local = this.obj.worldToLocal(point.clone());
    return this.box.distanceToPoint(local) < margin;
  }

  /** Returns true if this hit destroyed the ship. */
  hit(damage: number, from?: PlayerShip): boolean {
    this.flash = 0.18;
    if (from) {
      this.attacker = from;
      this.attackedAgo = 0;
    }
    return this.ship.damage(damage);
  }

  /** Shields and hull left, 0..1. */
  get health() {
    const s = this.def.stats;
    return Math.max(0, (this.ship.shields + this.ship.hull) / (s.shields + s.hull));
  }

  dispose() {
    disposeShip(this.model);
    this.ship.obj.removeFromParent();
  }

  /** Steer towards a world point with pitch and yaw, banking for looks. */
  private steerTo(target: THREE.Vector3) {
    return steerTowards(this.obj, target);
  }

  /**
   * Fly for one frame. Returns the direction of a laser shot if the ship
   * fired, so the caller can resolve what it hit.
   */
  update(dt: number): THREE.Vector3 | null {
    this.cooldown -= dt;
    this.attackedAgo += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      heatShip(this.model, Math.max(0, this.flash / 0.18));
    }
    if ((this.mode === 'attack' || this.mode === 'breakoff' || this.mode === 'flee') && !this.target) this.mode = 'patrol';
    if (this.mode === 'search' && !this.lastSeen) this.mode = 'patrol';
    if (this.mode === 'travel' && !this.destination) this.mode = 'patrol';

    let steer: Pick<FlightInput, 'pitch' | 'yaw' | 'roll'>;
    let speed: number;
    const max = this.ship.maxSpeed;
    const toTarget = this.target ? this.target.obj.position.clone().sub(this.obj.position) : null;
    const dist = toTarget ? toTarget.length() : Infinity;

    if (this.mode === 'attack') {
      if (dist < BREAKOFF_RANGE) {
        this.mode = 'breakoff';
        this.breakTimer = BREAKOFF_TIME;
        // Peel away sideways from the target's line of fire.
        this.breakDir.copy(this.ship.forward()).add(new THREE.Vector3().randomDirection().multiplyScalar(1.4)).normalize();
      }
      steer = this.steerTo(this.target!.obj.position);
      speed = dist > 900 ? max : max * 0.65;
    } else if (this.mode === 'breakoff') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.mode = 'attack';
      steer = this.steerTo(this.obj.position.clone().addScaledVector(this.breakDir, 1000));
      speed = max;
    } else if (this.mode === 'flee') {
      steer = this.steerTo(this.obj.position.clone().sub(toTarget!.setLength(1000)));
      speed = max;
    } else if (this.mode === 'search') {
      // Close in on the spot, then circle it, looking.
      this.searchLeft -= dt;
      const from = this.obj.position.clone().sub(this.lastSeen!);
      from.y *= 0.3;
      if (from.lengthSq() < 1) from.set(1, 0, 0);
      const round = new THREE.Vector3(-from.z, 0, from.x).setLength(SEARCH_RADIUS * 0.8);
      steer = this.steerTo(this.lastSeen!.clone().add(from.setLength(SEARCH_RADIUS)).add(round));
      speed = max * CRUISE;
    } else if (this.mode === 'travel') {
      steer = this.steerTo(this.destination!);
      speed = max * CRUISE;
    } else {
      const p = this.patrol;
      p.angle += p.rate * dt;
      const ahead = p.angle + Math.sign(p.rate) * 0.3;
      const waypoint = new THREE.Vector3(Math.cos(ahead) * p.radius, p.height, Math.sin(ahead) * p.radius).add(p.centre);
      steer = this.steerTo(waypoint);
      speed = Math.abs(p.rate) * p.radius;
    }

    this.ship.steer(dt, { ...steer, throttle: 0, speedStep: 0, aimDx: 0, aimDy: 0, fire: false, active: false });
    this.ship.speed += THREE.MathUtils.clamp(speed - this.ship.speed, -80 * dt, 80 * dt);
    this.ship.move(dt);
    this.ship.recharge(dt);

    if (this.mode === 'attack' && dist < this.laser.range && this.cooldown <= 0) {
      const fwd = this.ship.forward();
      if (fwd.angleTo(toTarget!) < FIRE_CONE) {
        this.cooldown = this.laser.interval;
        const spread = new THREE.Vector3().randomDirection().multiplyScalar(Math.tan(AIM_SPREAD) * Math.random());
        return fwd.add(spread).normalize();
      }
    }
    return null;
  }
}
