import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { buildShip, type ShipModel } from '../render/shipModel';
import { neoLines, registerParts } from '../render/wire';
import type { PlayerShip } from './playerShip';

import { SLOT } from '../content/slot';

export { SLOT };

/** Rough collision radius of the station hull. */
const HULL_RADIUS = 95;

// How precisely you must line up to dock. The station spins, so matching
// its roll is the real test, just as it was in 1984.
const MAX_HEADING_ERROR = THREE.MathUtils.degToRad(20);
export const MAX_ROLL_ERROR = THREE.MathUtils.degToRad(15);
// Classic keeps the 1984 tolerances from the original's ISDK checks: the
// approach within about 26 degrees, and the slot up to 33.6 degrees off level.
const CLASSIC_HEADING_ERROR = THREE.MathUtils.degToRad(26);
const CLASSIC_ROLL_ERROR = THREE.MathUtils.degToRad(33.6);

export type Contact =
  | { kind: 'docked' }
  | { kind: 'scrape'; damage: number }
  | { kind: 'hull'; damage: number };

export class Station {
  readonly model: ShipModel;
  readonly root: THREE.Group;
  readonly spin: number;

  constructor(def: ShipDef) {
    this.model = buildShip(def);
    this.root = this.model.root;
    this.spin = def.stats.rollRate ?? 0.25;
    this.root.add(this.buildGlidePath());
  }

  /** Neo-vector only: a fading corridor of slot-shaped rings to fly down. */
  private buildGlidePath(): THREE.Object3D {
    const g = new THREE.Group();
    for (let k = 1; k <= 8; k++) {
      const z = SLOT.z + k * 90;
      const s = 1 + k * 0.12;
      const w = SLOT.halfW * s;
      const h = SLOT.halfH * s;
      const c = [[-w, h], [w, h], [w, -h], [-w, -h]];
      const pos: number[] = [];
      for (let i = 0; i < 4; i++) pos.push(c[i][0], c[i][1], z, c[(i + 1) % 4][0], c[(i + 1) % 4][1], z);
      const line = neoLines(pos, new THREE.Color('#ffb347').multiplyScalar(0.9 - k * 0.09), 1.2);
      g.add(line);
    }
    registerParts({ neo: [g], retro: [] });
    return g;
  }

  update(dt: number) {
    this.root.rotateZ(this.spin * dt);
  }

  toLocal(world: THREE.Vector3) {
    return this.root.worldToLocal(world.clone());
  }

  toWorld(local: THREE.Vector3) {
    return this.root.localToWorld(local.clone());
  }

  axis(local: 'x' | 'y' | 'z', out = new THREE.Vector3()) {
    out.set(local === 'x' ? 1 : 0, local === 'y' ? 1 : 0, local === 'z' ? 1 : 0);
    return out.applyQuaternion(this.root.quaternion);
  }

  /**
   * Signed angle (radians, -90°..90°) between the ship's wings and the slot.
   * The slot looks the same either way up, so we fold the angle in half.
   */
  rollError(ship: PlayerShip): number {
    const f = ship.forward();
    const slot = this.axis('x');
    slot.addScaledVector(f, -slot.dot(f));
    let a = Math.atan2(slot.dot(ship.up()), slot.dot(ship.right()));
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;
    return a;
  }

  /** Angle between the ship's nose and the straight-in approach. */
  headingError(ship: PlayerShip): number {
    return ship.forward().angleTo(this.axis('z').negate());
  }

  /** Call after moving the ship. `prevLocal` is its station-local position before the move. */
  contact(ship: PlayerShip, prevLocal: THREE.Vector3, classic = false): Contact | null {
    const p = this.toLocal(ship.obj.position);
    const inSlotXY = Math.abs(p.x) < SLOT.halfW && Math.abs(p.y) < SLOT.halfH;

    if (prevLocal.z > SLOT.z && p.z <= SLOT.z && inSlotXY) {
      const heading = classic ? CLASSIC_HEADING_ERROR : MAX_HEADING_ERROR;
      const roll = classic ? CLASSIC_ROLL_ERROR : MAX_ROLL_ERROR;
      if (this.headingError(ship) <= heading && Math.abs(this.rollError(ship)) <= roll) {
        return { kind: 'docked' };
      }
      // Clipped the slot edge. Bounce back out along the approach axis.
      ship.obj.position.copy(this.toWorld(new THREE.Vector3(p.x, p.y, SLOT.z + 30)));
      const damage = 40 + ship.speed * 0.35;
      ship.speed = 0;
      return { kind: 'scrape', damage };
    }

    const inCorridor = p.z > SLOT.z - 20 && inSlotXY;
    if (p.length() < HULL_RADIUS && !inCorridor) {
      const out = p.clone().setLength(HULL_RADIUS + 12);
      ship.obj.position.copy(this.toWorld(out));
      const damage = 20 + ship.speed * 0.45;
      ship.speed *= 0.2;
      return { kind: 'hull', damage };
    }
    return null;
  }

  /** Docking refused: the slot's field holds the ship just outside, stopped. */
  turnAway(ship: PlayerShip) {
    const p = this.toLocal(ship.obj.position);
    ship.obj.position.copy(this.toWorld(new THREE.Vector3(p.x, p.y, SLOT.z + 40)));
    ship.speed = 0;
  }

  /** Where a launching ship appears: just outside the slot, nose out. */
  placeForLaunch(ship: PlayerShip) {
    ship.obj.position.copy(this.toWorld(new THREE.Vector3(0, 0, SLOT.z + 60)));
    const m = new THREE.Matrix4().makeBasis(this.axis('x'), this.axis('y'), this.axis('z'));
    ship.obj.quaternion.setFromRotationMatrix(m);
  }
}
