import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { buildShip, disposeShip, heatShip, type ShipModel } from '../render/shipModel';
import type { FlightInput } from './input';
import { PlayerShip } from './playerShip';
import type { Laser } from './weapons';

// Computer-controlled ships. They fly with exactly the same physics as the
// player (pitch, roll, limited yaw, no drift), so they can't cheat.

export type NpcMode = 'patrol' | 'attack' | 'breakoff';

const STEER_GAIN = 3;
const FIRE_CONE = THREE.MathUtils.degToRad(3);
const BREAKOFF_RANGE = 300; // metres: too close, peel away
const BREAKOFF_TIME = 2.6; // seconds before coming round again
const AIM_SPREAD = THREE.MathUtils.degToRad(0.7); // so they don't hit with every shot

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
  hostile = false;
  private cooldown = Math.random();
  private flash = 0;
  private breakTimer = 0;
  private readonly breakDir = new THREE.Vector3();

  constructor(
    readonly def: ShipDef,
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
  hit(damage: number): boolean {
    this.flash = 0.18;
    return this.ship.damage(damage);
  }

  dispose() {
    disposeShip(this.model);
    this.ship.obj.removeFromParent();
  }

  /** Steer towards a world point with pitch and yaw, banking for looks. */
  private steerTo(target: THREE.Vector3): Pick<FlightInput, 'pitch' | 'yaw' | 'roll'> {
    const local = target.clone().applyQuaternion(new THREE.Quaternion()).sub(this.obj.position);
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
   * fired, so the caller can resolve hits against the player.
   */
  update(dt: number, player: PlayerShip, playerAlive: boolean): THREE.Vector3 | null {
    this.cooldown -= dt;
    if (this.flash > 0) {
      this.flash -= dt;
      heatShip(this.model, Math.max(0, this.flash / 0.18));
    }

    if (this.hostile && playerAlive && this.mode === 'patrol') this.mode = 'attack';
    if (!playerAlive && this.mode !== 'patrol') this.mode = 'patrol';

    const toPlayer = player.obj.position.clone().sub(this.obj.position);
    const dist = toPlayer.length();
    let steer: Pick<FlightInput, 'pitch' | 'yaw' | 'roll'>;
    let speed: number;

    if (this.mode === 'attack') {
      if (dist < BREAKOFF_RANGE) {
        this.mode = 'breakoff';
        this.breakTimer = BREAKOFF_TIME;
        // Peel away sideways from the player's line of fire.
        this.breakDir.copy(this.ship.forward()).add(new THREE.Vector3().randomDirection().multiplyScalar(1.4)).normalize();
      }
      steer = this.steerTo(player.obj.position);
      speed = dist > 900 ? this.ship.maxSpeed : this.ship.maxSpeed * 0.65;
    } else if (this.mode === 'breakoff') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.mode = 'attack';
      steer = this.steerTo(this.obj.position.clone().addScaledVector(this.breakDir, 1000));
      speed = this.ship.maxSpeed;
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

    if (this.mode === 'attack' && dist < this.laser.range && this.cooldown <= 0) {
      const fwd = this.ship.forward();
      if (fwd.angleTo(toPlayer) < FIRE_CONE) {
        this.cooldown = this.laser.interval;
        const spread = new THREE.Vector3().randomDirection().multiplyScalar(Math.tan(AIM_SPREAD) * Math.random());
        return fwd.add(spread).normalize();
      }
    }
    return null;
  }
}
