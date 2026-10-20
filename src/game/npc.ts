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

export type NpcRole = 'police' | 'trader' | 'pirate';

/**
 * - patrol: circle the station
 * - travel: fly to `destination` at cruising speed
 * - attack: chase `target` and fire when lined up
 * - breakoff: peel away after a close pass, then come round again
 * - flee: run directly away from `target` at full speed
 */
export type NpcMode = 'patrol' | 'travel' | 'attack' | 'breakoff' | 'flee';

const STEER_GAIN = 3;
const FIRE_CONE = THREE.MathUtils.degToRad(3);
const BREAKOFF_RANGE = 300; // metres: too close, peel away
const BREAKOFF_TIME = 2.6; // seconds before coming round again
const AIM_SPREAD = THREE.MathUtils.degToRad(0.7); // so they don't hit with every shot
const CRUISE = 0.6; // fraction of top speed when travelling

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
  /** Who last shot at us, and how long ago. */
  attacker: PlayerShip | null = null;
  attackedAgo = Infinity;
  /** Cargo carried, by commodity id; spilled if destroyed. */
  cargo: Record<string, number> = {};
  /** Credits paid for destroying this ship (pirates). */
  bounty = 0;
  private cooldown = Math.random();
  private flash = 0;
  private breakTimer = 0;
  private readonly breakDir = new THREE.Vector3();

  constructor(
    readonly def: ShipDef,
    readonly role: NpcRole,
    readonly laser: Laser,
    readonly patrol: Patrol,
  ) {
    this.ship = new PlayerShip(def);
    this.model = buildShip(def);
    this.ship.obj.add(this.model.root);
  }

  get obj() {
    return this.ship.obj;
  }

  get radius() {
    return this.model.radius;
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
  private steerTo(target: THREE.Vector3): Pick<FlightInput, 'pitch' | 'yaw' | 'roll'> {
    const local = target.clone().sub(this.obj.position);
    local.applyQuaternion(this.obj.quaternion.clone().invert());
    const right = Math.atan2(-local.x, local.z);
    const up = Math.atan2(local.y, Math.hypot(local.x, local.z));
    const yaw = THREE.MathUtils.clamp(STEER_GAIN * right, -1, 1);
    const pitch = THREE.MathUtils.clamp(STEER_GAIN * up, -1, 1);
    // Bank into turns, and level out gently otherwise.
    const level = this.obj.localToWorld(new THREE.Vector3(-1, 0, 0)).sub(this.obj.position).y;
    const roll = THREE.MathUtils.clamp(yaw * 0.6 + level * 0.5, -1, 1);
    return { pitch, yaw, roll };
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
