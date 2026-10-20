import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { buildShip, disposeShip, type ShipModel } from '../render/shipModel';
import type { PlayerShip } from './playerShip';

// A homing missile. It accelerates off the rail, turns towards its target at
// a limited rate (so a hard break at the right moment can still shake it) and
// explodes when it gets close. If its target disappears it flies on straight
// until its motor burns out.

export const MISSILE = {
  launchSpeed: 120, // m/s, on top of the launcher's speed
  maxSpeed: 650,
  acceleration: 260, // m/s²
  turnRate: 1.5, // rad/s
  fuse: 40, // metres: proximity fuse
  lifetime: 30, // seconds
  damage: 140,
};

const FORWARD = new THREE.Vector3(0, 0, 1);

export class Missile {
  readonly model: ShipModel;
  readonly dir: THREE.Vector3;
  speed: number;
  age = 0;

  constructor(
    def: ShipDef,
    readonly owner: PlayerShip,
    public target: PlayerShip | null,
  ) {
    this.model = buildShip(def);
    this.dir = owner.forward();
    // Drop clear of the launcher's belly before the motor lights.
    this.model.root.position.copy(owner.obj.position).addScaledVector(owner.up(), -8).addScaledVector(this.dir, 10);
    this.model.root.quaternion.setFromUnitVectors(FORWARD, this.dir);
    this.speed = owner.speed + MISSILE.launchSpeed;
  }

  get position() {
    return this.model.root.position;
  }

  /** Fly for one frame. Returns 'hit' when the fuse triggers on the target, 'expired' when the motor burns out. */
  update(dt: number): 'flying' | 'hit' | 'expired' {
    this.age += dt;
    if (this.age > MISSILE.lifetime) return 'expired';
    this.speed = Math.min(MISSILE.maxSpeed, this.speed + MISSILE.acceleration * dt);

    if (this.target) {
      const want = this.target.obj.position.clone().sub(this.position);
      if (want.length() < MISSILE.fuse) return 'hit';
      want.normalize();
      const angle = this.dir.angleTo(want);
      if (angle > 1e-4) {
        const axis = new THREE.Vector3().crossVectors(this.dir, want);
        if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0); // directly behind: pick any turn
        this.dir.applyAxisAngle(axis.normalize(), Math.min(angle, MISSILE.turnRate * dt)).normalize();
      }
    }
    this.position.addScaledVector(this.dir, this.speed * dt);
    this.model.root.quaternion.setFromUnitVectors(FORWARD, this.dir);
    return 'flying';
  }

  dispose() {
    disposeShip(this.model);
    this.model.root.removeFromParent();
  }
}
