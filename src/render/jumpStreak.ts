import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { ShipDef } from '../content/types';
import { SHIP } from './look';
import { disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

// A ship going into witchspace, or coming out of it (Mark, 31 October 2026: a Cobra "dissappeared in
// front of me"). Ships used to blink out at their jump point and pop in on their lanes. Now her lines
// stretch into a streak along her heading and she's gone; arriving, the streak runs back into her.
// Lines and glow only, in her own colour, like everything else in the Neo look.

const DURATION = 0.7; // seconds
const LENGTH = 6; // the streak's length, in the ship's lengths
const MOST_LINES = 14;

export class JumpStreak {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly lines: THREE.Object3D;
  private readonly material: LineMaterial;
  private readonly retro: THREE.LineSegments;
  private readonly parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };
  private readonly colour: THREE.Color;
  private readonly size: number;
  private readonly stern: number;

  /** `leaving`: she stretches out and is gone; otherwise the streak runs back into where she now is. */
  constructor(def: ShipDef, at: THREE.Object3D, private readonly leaving: boolean) {
    this.group.position.copy(at.getWorldPosition(new THREE.Vector3()));
    this.group.quaternion.copy(at.getWorldQuaternion(new THREE.Quaternion()));
    const { vertices } = def.geometry;
    // Her outermost corners, so a few lines carry her silhouette.
    const picked = [...vertices].sort((a, b) => Math.hypot(...b) - Math.hypot(...a)).slice(0, MOST_LINES);
    const zs = vertices.map((v) => v[2]);
    this.stern = Math.min(...zs);
    this.size = Math.max(1, Math.max(...zs) - this.stern);
    // Each corner's line runs fore and aft from 0 to 1, and is stretched along her heading as it goes.
    const pos: number[] = [];
    for (const v of picked) pos.push(v[0], v[1], 0, v[0], v[1], 1);
    this.colour = new THREE.Color(def.style.lineColor).multiplyScalar(SHIP.hull.brightness);
    const line = neoLines(pos, this.colour.clone(), 2);
    this.material = line.material;
    this.material.transparent = true;
    this.lines = line;
    this.retro = retroLines(pos);
    this.group.add(line, this.retro);
    this.parts = { neo: [line], retro: [this.retro] };
    registerParts(this.parts);
    this.update(0);
  }

  /** Returns false once it's over and cleaned up. */
  update(dt: number): boolean {
    this.age += dt;
    const t = Math.min(1, this.age / DURATION);
    if (this.age >= DURATION) {
      this.dispose();
      return false;
    }
    // Leaving: the tail stays at her stern while the head races ahead, then the tail follows it out.
    // Arriving: the same, run backwards, ending as a point where she is.
    const k = this.leaving ? t : 1 - t;
    const head = Math.min(1, k * 2.2) * LENGTH * this.size;
    const tail = Math.max(0, k * 2.2 - 1.2) * LENGTH * this.size;
    for (const obj of [this.lines, this.retro]) {
      obj.position.z = this.stern + tail;
      obj.scale.set(1, 1, Math.max(0.01, this.size + head - tail));
    }
    const fade = this.leaving ? 1 - t * t : Math.min(1, t * 3) * (1 - t * 0.6);
    this.material.color.copy(this.colour).multiplyScalar(0.5 + fade * 0.5);
    this.material.opacity = fade;
    return true;
  }

  private disposed = false;

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    unregisterParts(this.parts);
    disposeObject(this.group);
  }
}
