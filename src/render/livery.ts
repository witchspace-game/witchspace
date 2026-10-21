import * as THREE from 'three';
import type { ShipDef, Vec3 } from '../content/types';
import { neoLines, retroLines } from './wire';

// Police livery: alternating blue/red light strips at the wingtips and a band
// around the hull. It is applied by the game to ships in the police role and
// can't be declared in a ship file, so nobody can paint themselves as police.

const BEACON_RATE = 2.2; // flashes per second
const BLUE = new THREE.Color(0.9, 1.6, 6);
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

  // Light strips set into the hull along the edges that meet at each
  // wingtip, flashing blue and red in turn: part of the ship, not bulbs on it.
  const verts = def.geometry.vertices;
  const tipIndex = (side: 1 | -1) => verts.reduce((best, v, k) => (v[0] * side > verts[best][0] * side ? k : best), 0);
  const beacons = ([1, -1] as const).map((side, i) => {
    const t = tipIndex(side);
    const strip = lightStrip(def, t, 1.03);
    const neo = neoLines(strip, i ? RED : BLUE, 3.4);
    const retro = retroLines(strip);
    // Alternate the two sides, blinking by wall-clock time wherever the ship is drawn.
    const blink = (obj: THREE.Object3D, set: (on: boolean) => void) => {
      obj.onBeforeRender = () => {
        const phase = (performance.now() / 1000) * BEACON_RATE + i * 0.5;
        set(phase % 1 < 0.45);
      };
    };
    // Off means not drawn at all, so the hull edge underneath shows as normal.
    const mats = [neo.material, retro.material as THREE.LineBasicMaterial];
    for (const m of mats) Object.assign(m, { transparent: true, depthWrite: false });
    blink(neo, (on) => (mats[0].opacity = on ? 1 : 0));
    blink(retro, (on) => (mats[1].opacity = on ? 1 : 0));
    return { neo, retro };
  });

  root.add(neoStripe, retroStripe, ...beacons.flatMap((b) => [b.neo, b.retro]));
  return { neo: [neoStripe, ...beacons.map((b) => b.neo)], retro: [retroStripe, ...beacons.map((b) => b.retro)] };
}

