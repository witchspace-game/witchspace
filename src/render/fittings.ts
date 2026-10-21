import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

// What the commander has bought, drawn onto the ship in the hangar: laser
// barrels on each mount, missiles on their rails and the larger pieces of
// equipment. Positions come from the hull's bounding box, so they sit
// sensibly on any ship, though they're laid out with the Cobra in mind.

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

/** The twelve edges of a box between two corners. */
function box(out: number[], [x0, y0, z0]: V, [x1, y1, z1]: V) {
  const c = (i: number): V => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
    out.push(...c(a), ...c(b));
  }
}

/** A square tube along one axis: a laser barrel, missile body or similar. */
function tube(out: number[], from: V, axis: 0 | 1 | 2, length: number, half: number) {
  const to: V = [...from];
  to[axis] += length;
  const lo: V = [from[0] - half, from[1] - half, from[2] - half];
  const hi: V = [to[0] + half, to[1] + half, to[2] + half];
  lo[axis] = Math.min(from[axis], to[axis]);
  hi[axis] = Math.max(from[axis], to[axis]);
  box(out, lo, hi);
}

/** A ring of `n` points around the z axis, joined up. */
function ring(out: number[], centre: V, radius: number, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    out.push(centre[0] + Math.cos(a) * radius, centre[1] + Math.sin(a) * radius, centre[2]);
    out.push(centre[0] + Math.cos(b) * radius, centre[1] + Math.sin(b) * radius, centre[2]);
  }
}

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

export function buildFittings(def: ShipDef, loadout: Loadout): Fittings {
  const b = bounds(def);
  const u = b.length / 50; // the Cobra is 50 m long; everything scales from that
  const top = (x: number, z: number) => surface(def, x, z, 1) ?? b.yMax;
  const under = (x: number, z: number) => surface(def, x, z, -1) ?? b.yMin;
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

  // Lasers: twin barrels front and rear, a single pod on each side. Bigger
  // lasers have longer barrels, and military ones a cooling collar.
  for (const [mount, laser] of Object.entries(loadout.lasers) as [MountName, { color: string; size: number }][]) {
    const pts: number[] = [];
    const len = (6 + laser.size * 4) * u;
    const half = (0.7 + laser.size * 0.15) * u;
    if (mount === 'front' || mount === 'rear') {
      // Front barrels slung under the nose, rear ones out of the stern.
      const dir = mount === 'front' ? 1 : -1;
      const z = mount === 'front' ? b.zMax * 0.35 : b.zMin;
      for (const x of [-6 * u, 6 * u]) {
        const y = mount === 'front' ? under(x, z) - half : b.yMin * 0.4;
        tube(pts, [x, y, z], 2, dir * len, half);
        if (laser.size >= 3) tube(pts, [x, y, z + dir * len * 0.55], 2, dir * 2 * u, half * 1.8);
      }
    } else {
      // +x is the ship's left.
      const side = mount === 'left' ? 1 : -1;
      const x = side * b.x * 0.55;
      const z = b.zMin * 0.55;
      const y = under(x, z) - half;
      tube(pts, [x, y, z], 0, side * len * 0.7, half);
      if (laser.size >= 3) tube(pts, [x + side * len * 0.4, y, z], 0, side * 2 * u, half * 1.8);
    }
    add(pts, new THREE.Color(laser.color).multiplyScalar(1.1), 1.6);
  }

  // Missiles hang under the wings, alternating sides from the middle out.
  const missiles: number[] = [];
  for (let i = 0; i < Math.min(loadout.missiles, 4); i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (14 + Math.floor(i / 2) * 6) * u;
    const z = b.zMin * 0.6;
    const wing = under(x, z + 7 * u);
    const y = wing - 3 * u;
    tube(missiles, [x, y, z], 2, 14 * u, 0.9 * u);
    // Fins at the tail, and the pylon up to the wing.
    missiles.push(x - 2 * u, y, z, x + 2 * u, y, z, x, y - 2 * u, z, x, y + 2 * u, z);
    missiles.push(x, y + 0.9 * u, z + 7 * u, x, wing, z + 7 * u);
  }
  add(missiles, new THREE.Color(1.3, 0.3, 0.35), 1.3);

  const kit: number[] = [];
  const has = (id: string) => loadout.equipment.includes(id);
  if (has('fuel-scoops')) {
    // A wide intake lip under the forward hull, behind the front lasers.
    const z = b.zMax * 0.25;
    const y = under(0, z) - 0.5 * u;
    kit.push(-8 * u, y, z, 8 * u, y, z, -8 * u, y, z, -10 * u, y - 2 * u, z - 6 * u, 8 * u, y, z, 10 * u, y - 2 * u, z - 6 * u);
    kit.push(-10 * u, y - 2 * u, z - 6 * u, 10 * u, y - 2 * u, z - 6 * u);
  }
  if (has('ecm')) {
    // An aerial mast with a crossbar on the spine.
    const z = b.zMin * 0.7;
    const y = top(0, z);
    kit.push(0, y, z, 0, y + 6 * u, z, -2.5 * u, y + 4.5 * u, z, 2.5 * u, y + 4.5 * u, z);
  }
  if (has('docking-computer')) {
    // A small sensor diamond ahead of the canopy.
    const z = b.zMax * 0.75;
    const y = top(0, z) + 0.5 * u;
    const s = 1.6 * u;
    kit.push(-s, y, z, 0, y + s, z, 0, y + s, z, s, y, z, s, y, z, 0, y, z + s * 1.5, 0, y, z + s * 1.5, -s, y, z);
  }
  if (has('large-cargo-bay')) {
    const y = under(0, b.zMin * 0.5);
    box(kit, [-7 * u, y - 3 * u, b.zMin + 2 * u], [7 * u, y, b.zMin * 0.1]);
  }
  if (has('extra-energy')) {
    // Energy cells on the upper wings.
    for (const x of [-18 * u, 18 * u]) {
      const z = b.zMin + 3 * u;
      tube(kit, [x, top(x, z + 4 * u) + 1.4 * u, z], 2, 8 * u, 1.4 * u);
    }
  }
  if (has('galactic-hyperdrive')) ring(kit, [0, 0, b.zMin - 2 * u], 9 * u);
  if (has('energy-bomb')) {
    const y = top(0, b.zMin * 0.2);
    box(kit, [-2.5 * u, y, b.zMin * 0.35], [2.5 * u, y + 2.5 * u, b.zMin * 0.1]);
  }
  add(kit, new THREE.Color(1.25, 0.85, 0.32), 1.3);

  const parts = { neo, retro };
  registerParts(parts);
  return { group, parts };
}

export function disposeFittings(f: Fittings) {
  unregisterParts(f.parts);
  disposeObject(f.group);
}
