import * as THREE from 'three';
import type { ShipDef, Vec3 } from '../content/types';
import { neoLines, retroLines } from './wire';

// Liveries the law wears. Police: alternating blue/red light strips at the
// wingtips and a white band around the hull. Co-operative Marshals: a gold
// band and white lights that flash together. They're applied by the game to
// ships in those roles and can't be declared in a ship file, so nobody can
// paint themselves as the law.

const BLUE = new THREE.Color(0.9, 1.6, 6);
const RED = new THREE.Color(4, 0.5, 0.6);
const WHITE = new THREE.Color(1.1, 1.1, 1.25);

export type Livery = 'police' | 'marshal';

const LIVERIES: Record<Livery, { band: THREE.Color; bands: number; lights: [THREE.Color, THREE.Color]; bandWidth: number; width: number; rate: number; together: boolean }> = {
  police: { band: new THREE.Color(1.6, 1.6, 1.8), bands: 1, lights: [BLUE, RED], bandWidth: 1.8, width: 3.4, rate: 2.2, together: false },
  // Subdued: Marshal ships are big and seen from far off, where bright lines bloom into a blob.
  marshal: { band: new THREE.Color(1.5, 1.05, 0.25), bands: 2, lights: [WHITE, WHITE], bandWidth: 1.3, width: 2, rate: 1.1, together: true },
};

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

/**
 * Short strips along every hull edge that meets vertex `tip`, from just
 * inboard of the tip to about a third of the way along, pushed slightly
 * outward so the hull fill doesn't hide them.
 */
function lightStrip(def: ShipDef, tip: number, inflate: number): number[] {
  const { vertices, faces } = def.geometry;
  const neighbours = new Set<number>();
  for (const f of faces) {
    f.forEach((k, j) => {
      if (k !== tip) return;
      neighbours.add(f[(j + 1) % f.length]);
      neighbours.add(f[(j + f.length - 1) % f.length]);
    });
  }
  const at = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const out: number[] = [];
  const a = vertices[tip];
  for (const n of neighbours) {
    for (const p of [at(a, vertices[n], 0.04), at(a, vertices[n], 0.34)]) out.push(p[0] * inflate, p[1] * inflate, p[2]);
  }
  return out;
}

/**
 * Adds the livery to `root` and returns its neo/retro parts for the ship to
 * register. Set `root.userData.lights` (0..1) to dim it, as when a ship is
 * still coming through a witchspace rift.
 */
export function applyLivery(def: ShipDef, root: THREE.Group, kind: Livery): { neo: THREE.Object3D[]; retro: THREE.Object3D[] } {
  const look = LIVERIES[kind];
  const zs = def.geometry.vertices.map((v) => v[2]);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const mid = zMin + (zMax - zMin) * 0.42;
  const width = (zMax - zMin) * 0.05;
  const band: number[] = [];
  for (let k = 0; k < look.bands; k++) {
    const at = mid - k * width * 2.2;
    band.push(...hullBand(def, at, 1.03), ...hullBand(def, at + width, 1.03));
  }
  const neoStripe = neoLines(band, look.band, look.bandWidth);
  const retroStripe = retroLines(band);
  const level = () => (root.userData.lights as number | undefined) ?? 1;
  Object.assign(neoStripe.material, { transparent: true });
  neoStripe.onBeforeRender = () => (neoStripe.material.opacity = level());

  // Light strips set into the hull along the edges that meet at each
  // wingtip, flashing blue and red in turn: part of the ship, not bulbs on it.
  const verts = def.geometry.vertices;
  const tipIndex = (side: 1 | -1) => verts.reduce((best, v, k) => (v[0] * side > verts[best][0] * side ? k : best), 0);
  const beacons = ([1, -1] as const).map((side, i) => {
    const t = tipIndex(side);
    const strip = lightStrip(def, t, 1.03);
    const neo = neoLines(strip, look.lights[i], look.width);
    const retro = retroLines(strip);
    // Alternate the two sides, blinking by wall-clock time wherever the ship is drawn.
    const blink = (obj: THREE.Object3D, set: (on: boolean) => void) => {
      obj.onBeforeRender = () => {
        const phase = (performance.now() / 1000) * look.rate + (look.together ? 0 : i * 0.5);
        set(phase % 1 < 0.45);
      };
    };
    // Off means not drawn at all, so the hull edge underneath shows as normal.
    const mats = [neo.material, retro.material as THREE.LineBasicMaterial];
    for (const m of mats) Object.assign(m, { transparent: true, depthWrite: false });
    blink(neo, (on) => (mats[0].opacity = on ? level() : 0));
    blink(retro, (on) => (mats[1].opacity = on && level() > 0.5 ? 1 : 0));
    return { neo, retro };
  });

  root.add(neoStripe, retroStripe, ...beacons.flatMap((b) => [b.neo, b.retro]));
  return { neo: [neoStripe, ...beacons.map((b) => b.neo)], retro: [retroStripe, ...beacons.map((b) => b.retro)] };
}

