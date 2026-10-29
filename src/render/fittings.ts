import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

// What the commander has bought, as a careful observer would see it: flush
// details in the hull rather than hardware hanging off it. Only what has to
// reach the outside shows: laser louvres that glow faintly in the laser's
// colour, missile hatches, and the fuel scoops' intake. Everything else is
// fitted inside, so a ship's other upgrades are left to guesswork. The marks
// are projected onto the hull surface, so they sit on any ship, though
// they're laid out with the Cobra in mind.

export type MountName = 'front' | 'rear' | 'left' | 'right';

export interface Loadout {
  /** Per mount: the beam colour, and 1 (pulse) to 3 (military) for the barrel size. */
  lasers: Partial<Record<MountName, { color: string; size: number }>>;
  missiles: number;
  equipment: string[];
}

export interface Fittings {
  group: THREE.Group;
  parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };
}

type V = [number, number, number];

/** The height of the hull's top (dir 1) or underside (dir -1) at (x, z), or null off the hull. */
function surface(def: ShipDef, x: number, z: number, dir: 1 | -1): number | null {
  const { vertices, faces } = def.geometry;
  const ray = new THREE.Ray(new THREE.Vector3(x, dir * 1000, z), new THREE.Vector3(0, -dir, 0));
  const hit = new THREE.Vector3();
  let best: number | null = null;
  for (const f of faces) {
    for (let i = 1; i < f.length - 1; i++) {
      const [a, b, c] = [f[0], f[i], f[i + 1]].map((k) => new THREE.Vector3(...vertices[k]));
      if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
      if (best === null || hit.y * dir > best * dir) best = hit.y;
    }
  }
  return best;
}

function bounds(def: ShipDef) {
  const vs = def.geometry.vertices;
  const axis = (i: number) => [Math.min(...vs.map((v) => v[i])), Math.max(...vs.map((v) => v[i]))];
  const [, x] = axis(0);
  const [yMin, yMax] = axis(1);
  const [zMin, zMax] = axis(2);
  return { x, yMin, yMax, zMin, zMax, length: zMax - zMin };
}

/**
 * The stern face: the rearmost z that several vertices share, not the rearmost point (the
 * Fer-de-lance's barbs reach further back than her engines, and the rear laser drew in mid-air
 * behind her: Mark's hangar screenshot). Its half-width and height span.
 */
function sternFace(def: ShipDef) {
  const vs = def.geometry.vertices;
  const len = Math.max(...vs.map((v) => v[2])) - Math.min(...vs.map((v) => v[2]));
  const near = (a: number, b: number) => Math.abs(a - b) < len * 0.02;
  const zs = [...new Set(vs.map((v) => v[2]))].sort((a, b) => a - b);
  const z = zs.find((zz) => vs.filter((v) => near(v[2], zz)).length >= 3) ?? zs[0];
  const at = vs.filter((v) => near(v[2], z));
  return { z, half: Math.max(...at.map((v) => Math.abs(v[0]))), yMin: Math.min(...at.map((v) => v[1])), yMax: Math.max(...at.map((v) => v[1])) };
}

export function buildFittings(def: ShipDef, loadout: Loadout): Fittings {
  const b = bounds(def);
  const u = b.length / 50; // the Cobra is 50 m long; everything scales from that
  const lift = 0.12 * u; // just proud of the hull, so the fill doesn't hide it
  /** A point on the top (1) or underside (-1) of the hull. */
  const on = (x: number, z: number, dir: 1 | -1): V => {
    // Laid out for a Cobra's width: on a narrower hull, slide in until the mark lands on it.
    for (let k = 0; k < 12; k++, x *= 0.85) {
      const y = surface(def, x, z, dir);
      if (y !== null && y !== undefined) return [x, y + dir * lift, z];
    }
    return [x, (dir > 0 ? b.yMax : b.yMin) + dir * lift, z];
  };
  /** A line drawn on the hull between two (x, z) points. */
  const seam = (out: number[], x0: number, z0: number, x1: number, z1: number, dir: 1 | -1) => out.push(...on(x0, z0, dir), ...on(x1, z1, dir));
  const panel = (out: number[], x0: number, z0: number, x1: number, z1: number, dir: 1 | -1) => {
    seam(out, x0, z0, x1, z0, dir);
    seam(out, x1, z0, x1, z1, dir);
    seam(out, x1, z1, x0, z1, dir);
    seam(out, x0, z1, x0, z0, dir);
  };
  const face = sternFace(def);
  const stern = face.z - lift;

  const group = new THREE.Group();
  group.name = 'fittings';
  const neo: THREE.Object3D[] = [];
  const retro: THREE.Object3D[] = [];
  const add = (positions: number[], color: THREE.Color, width: number) => {
    if (!positions.length) return;
    const n = neoLines(positions, color, width);
    const r = retroLines(positions);
    group.add(n, r);
    neo.push(n);
    retro.push(r);
  };
  const hull = new THREE.Color(def.style.lineColor);

  // Lasers: rows of louvres by each mount. Bigger lasers have more of them,
  // and they glow faintly in the laser's colour, so military lasers give
  // themselves away to anyone who knows what to look for.
  for (const [mount, laser] of Object.entries(loadout.lasers) as [MountName, { color: string; size: number }][]) {
    const pts: number[] = [];
    const slits = 1 + laser.size;
    const step = 1.1 * u;
    for (let i = 0; i < slits; i++) {
      const d = i * step;
      if (mount === 'front') {
        // Under the nose, either side of the centreline.
        for (const side of [-1, 1]) seam(pts, side * 4 * u, 14 * u - d, side * 7 * u, 14 * u - d, -1);
      } else if (mount === 'rear') {
        // Vertical slits on the stern face, outboard of the engines (on a Cobra, 17 m out).
        const gap = Math.min(step, (face.half * 0.4) / slits);
        const mid = (face.yMin + face.yMax) / 2;
        const tall = Math.min(1.6 * u, (face.yMax - face.yMin) * 0.3);
        for (const side of [-1, 1]) {
          const x = side * Math.min(face.half * 0.5 + i * gap, face.half * 0.92);
          pts.push(x, mid - tall, stern, x, mid + tall, stern);
        }
      } else {
        // Under the wing, near the tip; +x is the ship's left.
        const side = mount === 'left' ? 1 : -1;
        const x = side * (b.x * 0.62 + d);
        seam(pts, x, b.zMin * 0.75, x, b.zMin * 0.55, -1);
      }
    }
    add(pts, new THREE.Color(laser.color).lerp(hull, laser.size === 1 ? 0.6 : 0.25).multiplyScalar(0.95), 1.3);
  }

  // Missile hatches on the belly, one per missile carried.
  const hatches: number[] = [];
  for (let i = 0; i < Math.min(loadout.missiles, 4); i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (11 + Math.floor(i / 2) * 5) * u;
    panel(hatches, x - 1.4 * u, -10 * u, x + 1.4 * u, -4 * u, -1);
  }
  add(hatches, hull.clone().multiplyScalar(0.8), 1.1);

  const kit: number[] = [];
  const has = (id: string) => loadout.equipment.includes(id);
  if (has('fuel-scoops')) {
    // A narrow intake slot across the underside of the nose.
    seam(kit, -5 * u, 22 * u, 5 * u, 22 * u, -1);
    seam(kit, -5.6 * u, 21 * u, 5.6 * u, 21 * u, -1);
  }
  add(kit, hull.clone().multiplyScalar(0.8), 1.1);

  const parts = { neo, retro };
  registerParts(parts);
  return { group, parts };
}

export function disposeFittings(f: Fittings) {
  unregisterParts(f.parts);
  disposeObject(f.group);
}
