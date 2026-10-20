import * as THREE from 'three';
import type { PlayerShip } from './playerShip';
import { SLOT, type Station } from './station';

const MAX_TURN_RATE = 1.2; // rad/s
const TURN_ACCEL = 2.2; // rad/s², so turns ease in and out instead of snapping
const TURN_GAIN = 2.4; // how hard to turn per radian of error
const FINAL_SPEED = 70; // m/s
const SPEED_ACCEL = 60; // m/s²
const ENTRY_Z = 600; // where the final approach begins, on the slot axis
const LOOKAHEAD = 160; // metres ahead along the axis to aim for (pure pursuit)
const CONE = 0.3; // how far off-axis (radial / distance) the final approach accepts

type Leg = 'around' | 'entry' | 'final';

/**
 * Flies the ship in like a careful pilot rather than a robot:
 *
 * - **around**: if beside or behind the station, swing wide around it.
 * - **entry**: head for a point out on the slot's axis.
 * - **final**: chase a point a little way ahead along the axis, which curves
 *   the ship smoothly onto the centre line, while matching the station's spin.
 *
 * Steering goes through an angular-velocity controller with limited angular
 * acceleration, so every turn eases in and out. No cheating: the ship only
 * ever moves along its nose, exactly as a player's would. Tuned and checked
 * with `npm run sim:docking`.
 */
export class DockingComputer {
  private leg: Leg = 'entry';
  private readonly angVel = new THREE.Vector3(); // ship-local, rad/s
  private readonly aim = new THREE.Object3D();
  private readonly lastAim = new THREE.Quaternion();
  private hasLastAim = false;

  reset() {
    this.leg = 'entry';
    this.angVel.set(0, 0, 0);
    this.hasLastAim = false;
  }

  update(dt: number, ship: PlayerShip, station: Station) {
    const pos = ship.obj.position;
    const local = station.toLocal(pos);
    const radial = Math.hypot(local.x, local.y);
    const inCone = local.z > SLOT.z + 100 && radial < CONE * (local.z - SLOT.z);

    // Legs only move forwards, so the target never flickers back and forth.
    if (this.leg !== 'final' && local.z < 250) this.leg = 'around';
    if (this.leg === 'around' && local.z >= 350) this.leg = 'entry';
    if (this.leg === 'entry' && inCone) this.leg = 'final';

    let target: THREE.Vector3;
    if (this.leg === 'around') {
      const side = new THREE.Vector2(local.x, local.y);
      if (side.lengthSq() < 1) side.set(1, 0);
      side.setLength(Math.max(520, side.length()));
      target = station.toWorld(new THREE.Vector3(side.x, side.y, 500));
    } else if (this.leg === 'entry') {
      target = station.toWorld(new THREE.Vector3(0, 0, Math.max(ENTRY_Z, local.z)));
    } else {
      // Aim a little way ahead along the axis, ending inside the slot.
      target = station.toWorld(new THREE.Vector3(0, 0, Math.max(SLOT.z - 60, local.z - LOOKAHEAD)));
    }

    this.aim.position.copy(pos);
    this.aim.up.copy(station.axis('y'));
    this.aim.lookAt(target);
    this.steer(dt, ship, this.leg === 'final');

    // Speed: slower while pointing the wrong way (tighter turns), easing down for the slot.
    const toTarget = target.clone().sub(pos);
    const facing = ship.forward().dot(toTarget.normalize());
    let targetSpeed: number;
    if (this.leg === 'final') {
      targetSpeed = local.z < SLOT.z + 250 ? FINAL_SPEED * 0.8 : FINAL_SPEED;
    } else {
      targetSpeed = THREE.MathUtils.clamp(target.distanceTo(pos) * 0.35, FINAL_SPEED, ship.maxSpeed * 0.75);
    }
    targetSpeed *= THREE.MathUtils.clamp((facing + 0.3) / 1.3, 0.35, 1);
    ship.speed += THREE.MathUtils.clamp(targetSpeed - ship.speed, -SPEED_ACCEL * dt, SPEED_ACCEL * dt);
  }

  /** Turn towards `this.aim` with eased angular velocity. */
  private steer(dt: number, ship: PlayerShip, matchSpin: boolean) {
    const q = ship.obj.quaternion;
    const err = q.clone().invert().multiply(this.aim.quaternion);
    if (err.w < 0) err.set(-err.x, -err.y, -err.z, -err.w);
    const angle = 2 * Math.acos(Math.min(1, err.w));
    const s = Math.sqrt(Math.max(0, 1 - err.w * err.w));
    const desired = s > 1e-6 ? new THREE.Vector3(err.x / s, err.y / s, err.z / s) : new THREE.Vector3();
    desired.multiplyScalar(Math.min(MAX_TURN_RATE, TURN_GAIN * angle));

    // Feed forward the target's own rotation (the station's spin on final
    // approach), so the roll keeps pace without lagging behind.
    if (matchSpin && this.hasLastAim) {
      const d = this.lastAim.clone().invert().multiply(this.aim.quaternion);
      if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
      const a = 2 * Math.acos(Math.min(1, d.w));
      const ds = Math.sqrt(Math.max(0, 1 - d.w * d.w));
      if (ds > 1e-6 && a / dt < MAX_TURN_RATE) {
        // That rotation is in the aim's frame; bring it into the ship's.
        const ff = new THREE.Vector3(d.x / ds, d.y / ds, d.z / ds).multiplyScalar(a / dt);
        ff.applyQuaternion(this.aim.quaternion).applyQuaternion(q.clone().invert());
        desired.add(ff);
      }
    }
    this.lastAim.copy(this.aim.quaternion);
    this.hasLastAim = true;

    const change = desired.sub(this.angVel);
    const maxChange = TURN_ACCEL * dt;
    if (change.length() > maxChange) change.setLength(maxChange);
    this.angVel.add(change);

    const rate = this.angVel.length();
    if (rate > 1e-6) {
      q.multiply(new THREE.Quaternion().setFromAxisAngle(this.angVel.clone().divideScalar(rate), rate * dt));
    }
    // Let the dashboard gauges show what the computer is doing.
    ship.showRates(-this.angVel.x, this.angVel.z);
  }
}
