import * as THREE from 'three';
import { circleSegments, disposeObject, neoLines, RETRO_DOT, registerParts, retroLines, unregisterParts } from './wire';

// A witchspace rift: where a ship too big to arrive quietly tears its way in
// (or out). Kept plain on purpose: a dark hole with a thin, cool rim. The
// drama comes from space bending around it (see lens.ts). It opens slowly
// from a far-off point of light, flickering while it forms, so a commander
// who's paying attention gets some warning. The caller sets `open` (0 shut,
// 1 fully open). Ships come out along the rift's +z.

const RIM = new THREE.Color(1.1, 1.3, 1.7);

/** A slightly uneven circle, so the rim looks torn rather than drawn with compasses. */
function uneven(r: number): number[] {
  return circleSegments((a) => {
    const k = r * (1 + 0.025 * Math.sin(5 * a) + 0.015 * Math.sin(9 * a + 1));
    return new THREE.Vector3(Math.cos(a) * k, Math.sin(a) * k, 0);
  }, 120);
}

export class Rift {
  readonly group = new THREE.Group();
  /** 0 = shut, 1 = fully open. */
  open = 0;
  private flicker = 1;
  private flickerTimer = 0;
  private readonly rim: { neo: ReturnType<typeof neoLines>; retro: THREE.LineSegments };
  private readonly hole: THREE.Mesh;
  private readonly beacon: { neo: THREE.Points; retro: THREE.Points };
  private readonly parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };

  constructor(at: THREE.Vector3, facing: THREE.Quaternion, readonly radius: number) {
    this.group.position.copy(at);
    this.group.quaternion.copy(facing);

    const rim = neoLines(uneven(radius), RIM.clone(), 1.6);
    rim.material.transparent = true;
    rim.material.depthWrite = false;
    this.rim = { neo: rim, retro: retroLines(uneven(radius)) };

    // The opening is a hole in space: it blots out the stars behind it.
    this.hole = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.99, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, side: THREE.DoubleSide }),
    );

    // A point of light that shows from far away before the rim is big enough to see.
    const dot = new THREE.BufferGeometry();
    dot.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    this.beacon = {
      neo: new THREE.Points(dot, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, color: RIM.clone(), transparent: true, depthWrite: false })),
      retro: new THREE.Points(dot.clone(), new THREE.PointsMaterial({ size: RETRO_DOT * 2, sizeAttenuation: false, color: 0xffffff })),
    };

    this.group.add(this.hole, this.rim.neo, this.rim.retro, this.beacon.neo, this.beacon.retro);
    this.parts = { neo: [this.hole, this.rim.neo, this.beacon.neo], retro: [this.rim.retro, this.beacon.retro] };
    registerParts(this.parts);
    this.update(0);
  }

  update(dt: number) {
    const open = THREE.MathUtils.clamp(this.open, 0, 1);
    // It flickers while it's still forming, then steadies.
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      this.flickerTimer = 0.05 + Math.random() * 0.12;
      this.flicker = 1 - (1 - Math.min(1, open * 1.6)) * Math.random() * 0.9;
    }
    const scale = Math.max(0.001, open);
    for (const o of [this.rim.neo, this.rim.retro, this.hole]) o.scale.setScalar(scale);
    this.rim.neo.material.opacity = Math.min(1, open * 4) * this.flicker;
    (this.hole.material as THREE.MeshBasicMaterial).opacity = Math.min(1, open * 1.5);
    // The beacon gives way to the rim once it's big enough to see.
    (this.beacon.neo.material as THREE.PointsMaterial).opacity = open > 0 ? this.flicker * Math.max(0, 1 - open * 2) : 0;
    this.beacon.retro.geometry.setDrawRange(0, open > 0 && open < 0.3 && this.flicker > 0.5 ? 1 : 0);
  }

  dispose() {
    unregisterParts(this.parts);
    disposeObject(this.group);
  }
}
