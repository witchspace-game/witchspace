// Pure geometry checks shared by the game and the content validator.
// No three.js imports here so it runs in Node too.

import type { Vec3 } from './types';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Newell's method: robust normal for any planar polygon. Length = 2 x area. */
export function faceNormal(verts: Vec3[], face: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = verts[face[i]];
    const b = verts[face[(i + 1) % face.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** Unique undirected edges, as [lo, hi] index pairs. */
export function deriveEdges(faces: number[][]): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}-${hi}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([lo, hi]);
      }
    }
  }
  return edges;
}

/** Signed volume of a closed mesh; positive when faces wind outward. */
export function signedVolume(verts: Vec3[], faces: number[][]): number {
  let v = 0;
  for (const f of faces) {
    for (let i = 1; i < f.length - 1; i++) {
      v += dot(verts[f[0]], cross(verts[f[i]], verts[f[i + 1]])) / 6;
    }
  }
  return v;
}

export interface GeometryReport {
  errors: string[];
  warnings: string[];
}

export function checkGeometry(
  verts: Vec3[],
  faces: number[][],
  details?: { vertices: Vec3[]; lines: [number, number][] },
): GeometryReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  let extent = 0;
  for (const v of verts) extent = Math.max(extent, len(v));
  const planeTol = Math.max(0.05, extent * 0.01);

  faces.forEach((f, fi) => {
    const bad = f.filter((i) => i >= verts.length);
    if (bad.length) {
      errors.push(`face ${fi}: vertex index ${bad.join(', ')} out of range (have ${verts.length} vertices)`);
      return;
    }
    if (new Set(f).size !== f.length) errors.push(`face ${fi}: repeats a vertex`);

    const n = faceNormal(verts, f);
    const nl = len(n);
    if (nl < 1e-9) {
      errors.push(`face ${fi}: has zero area`);
      return;
    }
    const unit: Vec3 = [n[0] / nl, n[1] / nl, n[2] / nl];
    const origin = verts[f[0]];
    for (const i of f) {
      const d = Math.abs(dot(sub(verts[i], origin), unit));
      if (d > planeTol) {
        errors.push(`face ${fi}: not flat (vertex ${i} is ${d.toFixed(2)}m off the plane); split it into triangles`);
        break;
      }
    }
    for (let i = 0; i < f.length; i++) {
      const a = verts[f[i]];
      const b = verts[f[(i + 1) % f.length]];
      const c = verts[f[(i + 2) % f.length]];
      if (dot(cross(sub(b, a), sub(c, b)), unit) < -1e-9) {
        errors.push(`face ${fi}: not convex at vertex ${f[(i + 1) % f.length]}; split it into smaller faces`);
        break;
      }
    }
  });

  // Every vertex should be used by some face.
  const used = new Set(faces.flat());
  verts.forEach((_, i) => {
    if (!used.has(i)) warnings.push(`vertex ${i} is not used by any face`);
  });

  // Closed and consistently wound?
  const directed = new Map<string, number>();
  const undirected = new Map<string, number>();
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      directed.set(`${a}>${b}`, (directed.get(`${a}>${b}`) ?? 0) + 1);
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      undirected.set(key, (undirected.get(key) ?? 0) + 1);
    }
  }
  const open = [...undirected].filter(([, c]) => c !== 2).map(([k]) => k);
  if (open.length) {
    warnings.push(`hull is not closed: edges ${open.slice(0, 6).join(', ')}${open.length > 6 ? '…' : ''} are not shared by exactly two faces`);
  } else {
    const flipped = [...directed].some(([, c]) => c > 1);
    if (flipped || signedVolume(verts, faces) <= 0) {
      errors.push('faces are not all wound counter-clockwise from outside; run `npm run validate -- --fix`');
    }
  }

  if (details) {
    details.lines.forEach(([a, b], li) => {
      if (a >= details.vertices.length || b >= details.vertices.length) {
        errors.push(`details line ${li}: vertex index out of range`);
      }
    });
  }

  return { errors, warnings };
}

/**
 * Re-orients faces so they all wind counter-clockwise from outside.
 * Works on closed hulls (convex or not) by flood-filling orientation
 * across shared edges, then flipping everything if the volume is negative.
 */
export function fixWinding(verts: Vec3[], faces: number[][]): number[][] {
  const out = faces.map((f) => [...f]);
  const edgeFaces = new Map<string, number[]>();
  out.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      edgeFaces.set(key, [...(edgeFaces.get(key) ?? []), fi]);
    }
  });
  const hasDirected = (f: number[], a: number, b: number) =>
    f.some((v, i) => v === a && f[(i + 1) % f.length] === b);

  const done = new Set<number>();
  for (let start = 0; start < out.length; start++) {
    if (done.has(start)) continue;
    done.add(start);
    const queue = [start];
    while (queue.length) {
      const fi = queue.shift()!;
      const f = out[fi];
      for (let i = 0; i < f.length; i++) {
        const a = f[i];
        const b = f[(i + 1) % f.length];
        for (const gi of edgeFaces.get(`${Math.min(a, b)}-${Math.max(a, b)}`) ?? []) {
          if (done.has(gi)) continue;
          // A neighbour wound the same way traverses the shared edge b->a.
          if (hasDirected(out[gi], a, b)) out[gi].reverse();
          done.add(gi);
          queue.push(gi);
        }
      }
    }
  }
  if (signedVolume(verts, out) < 0) out.forEach((f) => f.reverse());
  return out;
}
