import * as THREE from 'three';
import type { PlayerShip } from './playerShip';

// Mouse aim: the mouse places an aiming point out in space and the ship turns
// to put its nose on it, then stops. It's the easiest way to point a ship
// precisely, which is what combat needs.

const SENSITIVITY = 0.0025; // radians of aim per pixel of mouse movement
const MAX_LEAD = THREE.MathUtils.degToRad(22); // how far the aim may lead the nose (stays on screen)
const GAIN = 4; // turn command per radian of error; saturates beyond ~14°

export class MouseAim {
  /** World-space direction the pilot wants to point. */
  readonly dir = new THREE.Vector3(0, 0, 1);

  /** Put the aim back on the nose (on launch, after the docking computer). */
  reset(ship: PlayerShip) {
    ship.forward(this.dir);
  }

  /** Move the aim by mouse movement, relative to the pilot's view. */
  move(ship: PlayerShip, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    this.dir.applyAxisAngle(ship.up(), -dx * SENSITIVITY);
    this.dir.applyAxisAngle(ship.right(), -dy * SENSITIVITY);
    this.dir.normalize();
    this.clamp(ship);
  }

  /** Keep the aim within reach of the nose so it stays on screen. */
  clamp(ship: PlayerShip) {
    const fwd = ship.forward();
    const angle = fwd.angleTo(this.dir);
    if (angle > MAX_LEAD) {
      const axis = new THREE.Vector3().crossVectors(fwd, this.dir).normalize();
      this.dir.copy(fwd).applyAxisAngle(axis, MAX_LEAD);
    }
  }

  /** Pitch and yaw commands (-1..1) that bring the nose onto the aim. */
  steer(ship: PlayerShip): { pitch: number; yaw: number } {
    const local = this.dir.clone().applyQuaternion(ship.obj.quaternion.clone().invert());
    // Ship axes: +Z nose, +Y up, +X port (left).
    const right = Math.atan2(-local.x, local.z);
    const up = Math.atan2(local.y, local.z);
    return {
      pitch: THREE.MathUtils.clamp(GAIN * up, -1, 1),
      yaw: THREE.MathUtils.clamp(GAIN * right, -1, 1),
    };
  }
}
