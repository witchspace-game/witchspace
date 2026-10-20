import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { ShipDef } from '../content/types';
import { disposeObject, neoLines, registerParts, unregisterParts } from './wire';

const DURATION = 4.5; // seconds

interface Fragment {
  obj: THREE.Object3D;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  spinRate: number;
  material: LineMaterial;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A ship breaking apart. In neo-vector mode every face of the hull becomes a
 * tumbling, white-hot fragment that cools to the ship's colour as it fades,
 * with sparks and a flash. In 1984 mode it is the original's expanding cloud
 * of particles.
 */
export class Explosion {
  readonly group = new THREE.Group();
  private age = 0;
  private readonly fragments: Fragment[] = [];
  private readonly sparks: { neo: THREE.Points; retro: THREE.Points; velocities: Float32Array };
  private readonly flash: THREE.Mesh;
  private readonly parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };
  private readonly hot: THREE.Color;
  private readonly cool: THREE.Color;
  private readonly drift: THREE.Vector3;

  constructor(def: ShipDef, at: THREE.Object3D, inheritVelocity: THREE.Vector3) {
    this.group.position.copy(at.getWorldPosition(new THREE.Vector3()));
    this.group.quaternion.copy(at.getWorldQuaternion(new THREE.Quaternion()));
    this.drift = inheritVelocity.clone().multiplyScalar(0.6);
    this.cool = new THREE.Color(def.style.lineColor).multiplyScalar(1.4);
    this.hot = new THREE.Color(5, 4.2, 3);

    const { vertices, faces } = def.geometry;
    let radius = 1;
    for (const v of vertices) radius = Math.max(radius, Math.hypot(...v));

    for (const f of faces) {
      const c = new THREE.Vector3();
      for (const i of f) c.add(new THREE.Vector3(...vertices[i]));
      c.divideScalar(f.length);
      const pos: number[] = [];
      for (let k = 0; k < f.length; k++) {
        const a = new THREE.Vector3(...vertices[f[k]]).sub(c);
        const b = new THREE.Vector3(...vertices[f[(k + 1) % f.length]]).sub(c);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const line = neoLines(pos, this.hot.clone(), 2);
      const material = line.material;
      material.transparent = true;
      line.position.copy(c);
      this.group.add(line);
      const outward = c.lengthSq() > 0.01 ? c.clone().normalize() : new THREE.Vector3().randomDirection();
      this.fragments.push({
        obj: line,
        velocity: outward.multiplyScalar(rand(15, 45)).add(new THREE.Vector3().randomDirection().multiplyScalar(rand(5, 20))),
        axis: new THREE.Vector3().randomDirection(),
        spinRate: rand(1, 5),
        material,
      });
    }

    this.sparks = this.makeSparks(radius);
    this.group.add(this.sparks.neo, this.sparks.retro);

    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.5, 1.5), transparent: true, depthWrite: false }),
    );
    this.group.add(this.flash);

    this.parts = { neo: [...this.fragments.map((f) => f.obj), this.sparks.neo, this.flash], retro: [this.sparks.retro] };
    registerParts(this.parts);
  }

  private makeSparks(radius: number) {
    const count = 360;
    const velocities = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.toArray(positions, i * 3);
      positions[i * 3] *= radius * 0.3;
      positions[i * 3 + 1] *= radius * 0.3;
      positions[i * 3 + 2] *= radius * 0.3;
      v.multiplyScalar(rand(20, 140)).toArray(velocities, i * 3);
      c.setHSL(rand(0.04, 0.14), 1, rand(0.5, 0.9)).multiplyScalar(2.5).toArray(colors, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const neo = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 2.5, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }),
    );
    // The 1984 cloud: fewer, plain white pixels, sharing the same motion.
    const retroGeo = new THREE.BufferGeometry();
    retroGeo.setAttribute('position', geo.getAttribute('position'));
    retroGeo.setDrawRange(0, 120);
    const retro = new THREE.Points(retroGeo, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, color: 0xffffff }));
    return { neo, retro, velocities };
  }

  /** Returns false once the explosion has finished and been cleaned up. */
  update(dt: number): boolean {
    this.age += dt;
    const t = this.age / DURATION;
    if (t >= 1) {
      this.dispose();
      return false;
    }
    this.group.position.addScaledVector(this.drift, dt);

    const fade = 1 - t * t;
    const heat = Math.max(0, 1 - this.age / 1.2);
    for (const f of this.fragments) {
      f.obj.position.addScaledVector(f.velocity, dt);
      f.obj.rotateOnAxis(f.axis, f.spinRate * dt);
      f.material.color.copy(this.cool).lerp(this.hot, heat);
      f.material.opacity = fade;
    }

    const pos = this.sparks.neo.geometry.getAttribute('position') as THREE.BufferAttribute;
    const drag = Math.exp(-dt * 0.8);
    for (let i = 0; i < pos.count * 3; i++) {
      pos.array[i] += this.sparks.velocities[i] * dt;
      this.sparks.velocities[i] *= drag;
    }
    pos.needsUpdate = true;
    (this.sparks.neo.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t * 1.4);
    // The 1984 cloud thins out as it spreads.
    this.sparks.retro.geometry.setDrawRange(0, Math.floor(120 * (1 - t)));

    const flashT = Math.min(1, this.age / 0.35);
    this.flash.scale.setScalar(0.5 + flashT * 2.5);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = 1 - flashT;
    this.flash.visible = flashT < 1 && !this.sparks.retro.visible;

    return true;
  }

  dispose() {
    unregisterParts(this.parts);
    // The retro cloud shares its position buffer with the neo sparks.
    disposeObject(this.group);
  }
}
