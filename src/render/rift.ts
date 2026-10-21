import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { circleSegments, disposeObject, neoLines, RETRO_DOT, registerParts, retroLines, unregisterParts } from './wire';

// A witchspace rift: where a ship too big to arrive quietly tears its way in
// (or out). It opens slowly, from a far-off flicker into spinning rings
// around a dark throat, so a commander who's paying attention gets some
// warning. The caller sets `open` (0 shut, 1 fully open) and calls flash()
// when a ship breaks through. Ships come out along the rift's +z.

const VIOLET = new THREE.Color(0.9, 0.4, 2);
const TEAL = new THREE.Color(0.25, 1.3, 1.5);
const DEEP = new THREE.Color(0.5, 0.25, 1.1);
const WHITE_HOT = new THREE.Color(2.2, 2, 2.6);

const FLASH_TIME = 1.1; // seconds

interface Ring {
  obj: THREE.Object3D;
  spin: number;
  material?: LineMaterial;
}

/** A wobbly circle of radius `r`, so the rings look torn rather than drawn with compasses. */
function wobbly(r: number, lobes: number, depth: number, phase: number): number[] {
  return circleSegments((a) => {
    const k = r * (1 + depth * Math.sin(lobes * a + phase) + depth * 0.5 * Math.sin((lobes + 3) * a - phase * 2));
    return new THREE.Vector3(Math.cos(a) * k, Math.sin(a) * k, 0);
  }, 120);
}

/** Spiral arms from the rim down into the throat. */
function throat(r: number, depth: number, arms: number): number[] {
  const out: number[] = [];
  const steps = 16;
  for (let arm = 0; arm < arms; arm++) {
    for (let s = 0; s < steps; s++) {
      const at = (i: number) => {
        const t = i / steps;
        const a = (arm / arms) * Math.PI * 2 + t * 2.4;
        const k = r * (1 - t) ** 1.5;
        return [Math.cos(a) * k, Math.sin(a) * k, -depth * t];
      };
      out.push(...at(s), ...at(s + 1));
    }
  }
  return out;
}

/** Jagged arcs of light leaping across the opening. */
function arcs(r: number, count: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < count; n++) {
    let a = Math.random() * Math.PI * 2;
    let k = r * (0.4 + Math.random() * 0.6);
    let p = [Math.cos(a) * k, Math.sin(a) * k, 0];
    for (let s = 0; s < 7; s++) {
      a += (Math.random() - 0.3) * 0.5;
      k = THREE.MathUtils.clamp(k + (Math.random() - 0.5) * r * 0.25, r * 0.2, r * 1.1);
      const q = [Math.cos(a) * k, Math.sin(a) * k, (Math.random() - 0.5) * r * 0.1];
      out.push(...p, ...q);
      p = q;
    }
  }
  return out;
}

export class Rift {
  readonly group = new THREE.Group();
  /** 0 = shut, 1 = fully open. */
  open = 0;
  private age = 0;
  private flashAge = Infinity;
  private flicker = 1;
  private flickerTimer = 0;
  private readonly spinner = new THREE.Group();
  private readonly rings: Ring[] = [];
  private readonly arcs: THREE.Object3D;
  private readonly arcMaterial: LineMaterial;
  private readonly glow: THREE.Mesh;
  private readonly beacon: { neo: THREE.Points; retro: THREE.Points };
  private readonly burst: THREE.Mesh;
  private readonly parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };

  constructor(at: THREE.Vector3, facing: THREE.Quaternion, readonly radius: number) {
    this.group.position.copy(at);
    this.group.quaternion.copy(facing);
    this.group.add(this.spinner);
    const neo: THREE.Object3D[] = [];
    const retro: THREE.Object3D[] = [];

    const ring = (positions: number[], color: THREE.Color, width: number, spin: number, tilt: number) => {
      const line = neoLines(positions, color.clone(), width);
      line.material.transparent = true;
      line.material.depthWrite = false;
      line.rotation.set(tilt, -tilt * 0.6, 0);
      this.spinner.add(line);
      this.rings.push({ obj: line, spin, material: line.material });
      neo.push(line);
    };
    ring(wobbly(radius * 1.15, 5, 0.05, 0), VIOLET, 2, 0.25, 0.04);
    ring(wobbly(radius, 7, 0.04, 1), TEAL, 1.5, -0.45, -0.05);
        ring(wobbly(radius * 0.7, 6, 0.07, 3), TEAL, 1.1, -1.1, -0.1);
        ring(throat(radius * 0.95, radius * 2.6, 10), DEEP, 1, 0.5, 0);

    const arcLines = neoLines(arcs(radius, 4), WHITE_HOT.clone().multiplyScalar(0.6), 1.2);
    arcLines.material.transparent = true;
    arcLines.material.depthWrite = false;
    this.arcs = arcLines;
    this.arcMaterial = arcLines.material;
    this.spinner.add(arcLines);
    neo.push(arcLines);

    // The opening is a hole in space: it blots out the stars behind it.
    // And a dot that shows from far away.
    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.97, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0, 0.03), transparent: true, side: THREE.DoubleSide }),
    );
    this.glow.position.z = -radius * 0.3;
    this.group.add(this.glow);
    neo.push(this.glow);

    const dot = new THREE.BufferGeometry();
    dot.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const beaconNeo = new THREE.Points(dot, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, color: VIOLET.clone().multiplyScalar(0.6), transparent: true, depthWrite: false }));
    const beaconRetro = new THREE.Points(dot.clone(), new THREE.PointsMaterial({ size: RETRO_DOT * 2, sizeAttenuation: false, color: 0xffffff }));
    this.beacon = { neo: beaconNeo, retro: beaconRetro };
    this.group.add(beaconNeo, beaconRetro);
    neo.push(beaconNeo);
    retro.push(beaconRetro);

    // 1984 mode: plain white rings and the throat, turning.
    const retroRings = new THREE.Group();
    retroRings.add(
      retroLines(wobbly(radius * 1.15, 5, 0.05, 0)),
      retroLines(wobbly(radius * 0.75, 6, 0.06, 2)),
      retroLines(wobbly(radius * 0.4, 3, 0.08, 4)),
      retroLines(throat(radius * 0.95, radius * 2.6, 8)),
    );
    this.spinner.add(retroRings);
    this.rings.push({ obj: retroRings, spin: 0.4 });
    retro.push(retroRings);

    this.burst = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 12),
      new THREE.MeshBasicMaterial({ color: WHITE_HOT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.burst.visible = false;
    this.group.add(this.burst);
    neo.push(this.burst);

    this.parts = { neo, retro };
    registerParts(this.parts);
    this.update(0);
  }

  /** The white flash as a ship breaks through. */
  flash() {
    this.flashAge = 0;
  }

  update(dt: number) {
    this.age += dt;
    const open = THREE.MathUtils.clamp(this.open, 0, 1);
    // It flickers like a failing light while it's still forming, then steadies.
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      this.flickerTimer = 0.05 + Math.random() * 0.12;
      const unsteady = 1 - Math.min(1, open * 1.6);
      this.flicker = 1 - unsteady * Math.random() * 0.9;
    }
    const shown = Math.min(1, open * 4) * this.flicker;
    const scale = Math.max(0.02, open);
    this.spinner.scale.set(scale, scale, Math.max(0.02, open * open));
    for (const r of this.rings) {
      r.obj.rotation.z += r.spin * (0.3 + open * 1.4) * dt;
      if (r.material) r.material.opacity = shown;
      // Neo rings have a line material; the 1984 group doesn't.
      r.obj.visible = open > 0.005 && (r.material ? !this.retroShown() : this.retroShown());
    }
    // Arcs jump about as the rift strains.
    if (Math.random() < dt * 14) this.arcs.rotation.z = Math.random() * Math.PI * 2;
    this.arcMaterial.opacity = shown * (0.3 + Math.random() * 0.7) * (open > 0.15 ? 1 : 0.4);

    this.glow.scale.setScalar(scale);
    (this.glow.material as THREE.MeshBasicMaterial).opacity = Math.min(1, open * 1.5);
    // The beacon gives way to the rings once they're big enough to see.
    (this.beacon.neo.material as THREE.PointsMaterial).opacity = open > 0 ? (0.5 + 0.5 * this.flicker) * Math.max(0, 1 - open * 2) : 0;
    (this.beacon.neo.material as THREE.PointsMaterial).size = 4 + 3 * Math.sin(this.age * 5) ** 2;
    this.beacon.retro.geometry.setDrawRange(0, open > 0 && this.flicker > 0.5 ? 1 : 0);

    this.flashAge += dt;
    const f = this.flashAge / FLASH_TIME;
    this.burst.visible = f < 1 && !this.retroShown();
    if (f < 1) {
      this.burst.scale.setScalar(0.3 + f * 1.2);
      (this.burst.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - f) ** 3;
    }
  }

  /** Whether 1984 mode is showing (the beacon's retro dot is the one drawn). */
  private retroShown() {
    return this.beacon.retro.visible;
  }

  dispose() {
    unregisterParts(this.parts);
    disposeObject(this.group);
  }
}
