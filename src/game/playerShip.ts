import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import type { FlightInput } from './input';

const ACCELERATION = 140; // m/s²
const CONTROL_RESPONSE = 5; // how quickly turn rates follow the stick

/**
 * The commander's own ship. Like the original, there is no drift: the ship
 * always travels along its nose. Model axes: +Z forward, +Y up, +X port.
 */
export class PlayerShip {
  readonly obj = new THREE.Object3D();
  speed = 0;
  shields: number;
  hull: number;
  private pitchVel = 0;
  private rollVel = 0;
  private yawVel = 0;

  constructor(readonly def: ShipDef) {
    this.shields = def.stats.shields;
    this.hull = def.stats.hull;
  }

  get maxSpeed() {
    return this.def.stats.maxSpeed;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, 1).applyQuaternion(this.obj.quaternion);
  }

  up(out = new THREE.Vector3()) {
    return out.set(0, 1, 0).applyQuaternion(this.obj.quaternion);
  }

  /** Starboard, i.e. the pilot's right hand. */
  right(out = new THREE.Vector3()) {
    return out.set(-1, 0, 0).applyQuaternion(this.obj.quaternion);
  }

  /** Normalised pitch and roll rates, -1..1, for the dashboard gauges. */
  get pitchGauge() {
    return this.pitchVel / (this.def.stats.pitchRate ?? 1.5);
  }
  get rollGauge() {
    return this.rollVel / (this.def.stats.rollRate ?? 2);
  }

  /** Yaw matches pitch unless a ship says otherwise, so mouse aim feels even. */
  get yawRate() {
    return this.def.stats.yawRate ?? this.def.stats.pitchRate ?? 1.5;
  }

  steer(dt: number, input: FlightInput) {
    const k = Math.min(1, dt * CONTROL_RESPONSE);
    this.pitchVel += (input.pitch * (this.def.stats.pitchRate ?? 1.5) - this.pitchVel) * k;
    this.rollVel += (input.roll * (this.def.stats.rollRate ?? 2) - this.rollVel) * k;
    this.yawVel += (input.yaw * this.yawRate - this.yawVel) * k;
    this.obj.rotateX(-this.pitchVel * dt);
    this.obj.rotateZ(this.rollVel * dt);
    this.obj.rotateY(-this.yawVel * dt); // +yaw = nose to starboard
    this.speed += input.throttle * ACCELERATION * dt + input.speedStep * this.maxSpeed;
    this.speed = THREE.MathUtils.clamp(this.speed, 0, this.maxSpeed);
  }

  /** Let go of the stick, e.g. when the docking computer takes over. */
  centreControls() {
    this.pitchVel = 0;
    this.rollVel = 0;
    this.yawVel = 0;
  }

  /**
   * Mirror the docking computer's turn rates on the pitch and roll gauges.
   * The computer rotates the ship itself, so this only affects the dashboard.
   */
  showRates(pitch: number, roll: number) {
    this.pitchVel = pitch;
    this.rollVel = roll;
  }

  move(dt: number) {
    this.obj.position.addScaledVector(this.forward(), this.speed * dt);
  }

  /** Shields soak damage first. Returns true if the ship is destroyed. */
  damage(amount: number): boolean {
    const absorbed = Math.min(this.shields, amount);
    this.shields -= absorbed;
    this.hull -= amount - absorbed;
    return this.hull <= 0;
  }

  recharge(dt: number) {
    this.shields = Math.min(this.def.stats.shields, this.shields + dt * 6);
  }

  repair() {
    this.shields = this.def.stats.shields;
    this.hull = this.def.stats.hull;
    this.speed = 0;
    this.centreControls();
  }
}
