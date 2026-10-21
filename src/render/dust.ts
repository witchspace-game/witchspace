import * as THREE from 'three';
import { registerParts, RETRO_DOT } from './wire';

const COUNT = 220;
const HALF = 450; // particles live in a cube this far either side of the camera
const STREAK = 0.06; // seconds of motion each neo streak represents

/**
 * Space dust streaming past the cockpit, as in the original. It is fixed in
 * space and wraps around the camera, so speed and turning become visible.
 * Neo-vector draws motion streaks; 1984 mode draws single pixels.
 */
export class SpaceDust {
  readonly group = new THREE.Group();
  private readonly points = new Float32Array(COUNT * 3);
  private readonly streaks: THREE.LineSegments;
  private readonly dots: THREE.Points;

  constructor() {
    for (let i = 0; i < this.points.length; i++) this.points[i] = (Math.random() * 2 - 1) * HALF;

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
    const colors = new Float32Array(COUNT * 6);
    for (let i = 0; i < COUNT; i++) {
      // Head bright, tail dark, so the streak fades behind the particle.
      colors.set([0.3, 0.5, 0.45, 0, 0.02, 0.02], i * 6);
    }
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.streaks = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.streaks.frustumCulled = false;

    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(this.points, 3));
    dotGeo.setDrawRange(0, 80);
    this.dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0xffffff, size: RETRO_DOT, sizeAttenuation: false }));
    this.dots.frustumCulled = false;

    this.group.add(this.streaks, this.dots);
    registerParts({ neo: [this.streaks], retro: [this.dots] });
  }

  update(camera: THREE.Vector3, velocity: THREE.Vector3) {
    const p = this.points;
    for (let i = 0; i < COUNT; i++) {
      for (let a = 0; a < 3; a++) {
        const c = a === 0 ? camera.x : a === 1 ? camera.y : camera.z;
        let d = p[i * 3 + a] - c;
        if (d > HALF) d -= HALF * 2;
        else if (d < -HALF) d += HALF * 2;
        p[i * 3 + a] = c + d;
      }
    }
    const line = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = line.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const x = p[i * 3];
      const y = p[i * 3 + 1];
      const z = p[i * 3 + 2];
      arr[i * 6] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      // Tail trails where the particle appears to have come from.
      arr[i * 6 + 3] = x + velocity.x * STREAK;
      arr[i * 6 + 4] = y + velocity.y * STREAK;
      arr[i * 6 + 5] = z + velocity.z * STREAK;
    }
    line.needsUpdate = true;
    (this.dots.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
