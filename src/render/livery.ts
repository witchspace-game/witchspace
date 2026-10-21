import * as THREE from 'three';
import type { ShipDef, Vec3 } from '../content/types';
import { neoLines, RETRO_DOT, retroLines } from './wire';

// Police livery: alternating blue/red beacons on the wingtips and a band
// around the hull. It is applied by the game to ships in the police role and
// can't be declared in a ship file, so nobody can paint themselves as police.

const BEACON_RATE = 2.2; // flashes per second
const BLUE = new THREE.Color(0.6, 1.2, 4);
const RED = new THREE.Color(4, 0.5, 0.6);

/** Line segments where the hull meets the plane z = z0: a band around the ship. */
function hullBand(def: ShipDef, z0: number, inflate: number): number[] {
  const { vertices, faces } = def.geometry;
  const out: number[] = [];
  for (const f of faces) {
    const hits: Vec3[] = [];
    for (let i = 0; i < f.length; i++) {
      const a = vertices[f[i]];
      const b = vertices[f[(i + 1) % f.length]];
      if ((a[2] - z0) * (b[2] - z0) > 0 || a[2] === b[2]) continue;
      const t = (z0 - a[2]) / (b[2] - a[2]);
      hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z0]);
    }
    if (hits.length >= 2) {
      // Push the band slightly outward so the hull fill doesn't hide it.
      for (const h of hits.slice(0, 2)) out.push(h[0] * inflate, h[1] * inflate, h[2]);
    }
  }
  return out;
}

/** Adds the livery to `root` and returns its neo/retro parts for the ship to register. */
export function applyPoliceLivery(def: ShipDef, root: THREE.Group): { neo: THREE.Object3D[]; retro: THREE.Object3D[] } {
  const zs = def.geometry.vertices.map((v) => v[2]);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const mid = zMin + (zMax - zMin) * 0.42;
  const width = (zMax - zMin) * 0.05;
  const band = [...hullBand(def, mid, 1.03), ...hullBand(def, mid + width, 1.03)];
  const stripeColor = new THREE.Color(1.6, 1.6, 1.8);
  const neoStripe = neoLines(band, stripeColor, 1.8);
  const retroStripe = retroLines(band);

  // Beacons on the widest points of the hull (wingtips).
  const verts = def.geometry.vertices;
  const tip = (side: 1 | -1) => verts.reduce((best, v) => (v[0] * side > best[0] * side ? v : best));
  const beacons = ([1, -1] as const).map((side, i) => {
    const p = tip(side);
    const neo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 6), new THREE.MeshBasicMaterial({ color: i ? RED : BLUE }));
    neo.position.set(p[0] * 1.04, p[1] + 1, p[2]);
    const retro = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([p[0], p[1] + 1, p[2]], 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 2 * RETRO_DOT, sizeAttenuation: false }),
    );
    // Alternate the two sides, blinking by wall-clock time wherever the ship is drawn.
    const blink = (obj: THREE.Object3D) => {
      obj.onBeforeRender = () => {
        const phase = (performance.now() / 1000) * BEACON_RATE + i * 0.5;
        const on = phase % 1 < 0.45;
        if (obj instanceof THREE.Mesh) (obj.material as THREE.MeshBasicMaterial).color.copy(on ? (i ? RED : BLUE) : new THREE.Color(0.05, 0.05, 0.08));
        else (obj as THREE.Points).material = on ? retroOn : retroOff;
      };
    };
    blink(neo);
    blink(retro);
    return { neo, retro };
  });

  root.add(neoStripe, retroStripe, ...beacons.flatMap((b) => [b.neo, b.retro]));
  return { neo: [neoStripe, ...beacons.map((b) => b.neo)], retro: [retroStripe, ...beacons.map((b) => b.retro)] };
}

const retroOn = new THREE.PointsMaterial({ color: 0xffffff, size: 2 * RETRO_DOT, sizeAttenuation: false });
const retroOff = new THREE.PointsMaterial({ color: 0x000000, size: 2 * RETRO_DOT, sizeAttenuation: false });
