import type { ShipDef, Vec3 } from '../content/types';

// The ship editor's geometry: a ship is parts, a part is points, and the faces
// come from each part's convex hull. Every fleet ship is made this way (mirror
// symmetric, one to four convex parts), so a hull always comes out closed, flat,
// convex and wound outward, and nobody has to wire faces by hand. A part whose
// points all lie in one plane is a plate: one face, open by design (a fin).
// No DOM and no three.js, so it can be tested.

/**
 * How a part is mirrored across x = 0: "centre" is one body mirrored onto
 * itself (you edit the right half), "pair" is two bodies, one each side (wings),
 * and "none" is just as drawn.
 */
export type Mirror = 'centre' | 'pair' | 'none';

export interface Part {
  name: string;
  mirror: Mirror;
  /** For "centre", only x >= 0: the left half is their mirror image. */
  points: Vec3[];
}

export interface Hull {
  vertices: Vec3[];
  faces: number[][];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const mirrorX = (p: Vec3): Vec3 => [p[0] === 0 ? 0 : -p[0], p[1], p[2]];

/** Points closer than this are one point; the tolerance for "in the plane". */
const tolerance = (pts: Vec3[]) => Math.max(1e-6, pts.reduce((m, p) => Math.max(m, len(p)), 0) * 1e-6);

function unique(pts: Vec3[]): Vec3[] {
  const tol = tolerance(pts);
  const out: Vec3[] = [];
  for (const p of pts) if (!out.some((q) => len(sub(p, q)) <= tol * 10)) out.push(p);
  return out;
}

/**
 * The strict convex hull of points in a plane, counter-clockwise seen from the
 * side `n` points to: corners only, so a point on an edge (which the face next
 * door wouldn't share) is left out.
 */
function polygon(pts: Vec3[], idx: number[], n: Vec3, tol: number): number[] {
  const u0 = sub(pts[idx[1]], pts[idx[0]]);
  const u = scale(u0, 1 / len(u0));
  const v = cross(n, u); // u × v = n: counter-clockwise in (u, v) is counter-clockwise from outside
  const flat = idx.map((i) => ({ i, x: dot(pts[i], u), y: dot(pts[i], v) })).sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  // Andrew's monotone chain, dropping collinear points (a turn within the tolerance).
  const half = (list: typeof flat) => {
    const h: typeof flat = [];
    for (const p of list) {
      while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], p) <= tol * tol) h.pop();
      h.push(p);
    }
    return h;
  };
  const lower = half(flat);
  const upper = half([...flat].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map((p) => p.i);
}

/**
 * One convex body from its points. Fewer than three points, or all on a line,
 * make nothing; all in a plane make a plate (one face).
 */
export function convexHull(input: Vec3[]): Hull {
  const pts = unique(input);
  const tol = tolerance(pts);
  const faces: number[][] = [];
  const seen = new Set<string>();
  let flatNormal: Vec3 | null = null;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) {
        const raw = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
        const l = len(raw);
        if (l <= tol * tol * 100) continue; // on a line
        let n = scale(raw, 1 / l);
        const d = dot(n, pts[i]);
        let above = false;
        let below = false;
        const on: number[] = [];
        for (let m = 0; m < pts.length; m++) {
          const s = dot(n, pts[m]) - d;
          if (s > tol * 10) above = true;
          else if (s < -tol * 10) below = true;
          else on.push(m);
        }
        if (!above && !below) {
          flatNormal ??= n;
          continue;
        }
        if (above && below) continue; // cuts through the body: not a face
        if (above) n = scale(n, -1); // outward is away from the other points
        const key = on.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        faces.push(polygon(pts, on, n, tol));
      }
  if (!faces.length && flatNormal) {
    const all = pts.map((_, i) => i);
    faces.push(polygon(pts, all, flatNormal, tol));
  }
  // Only the corners are vertices: a point inside the body, or along an edge, isn't one.
  const used = [...new Set(faces.flat())].sort((a, b) => a - b);
  const index = new Map(used.map((old, i) => [old, i]));
  return { vertices: used.map((i) => pts[i]), faces: faces.filter((f) => f.length >= 3).map((f) => f.map((i) => index.get(i)!)) };
}

/** The bodies a part makes: one for "centre" and "none", two for "pair". */
export function partBodies(part: Part): Vec3[][] {
  if (part.mirror === 'centre') return [[...part.points, ...part.points.map(mirrorX)]];
  if (part.mirror === 'pair') return [part.points, part.points.map(mirrorX)];
  return [part.points];
}

/** Every part, as one ship's vertices and faces. */
export function shipGeometry(parts: Part[]): Hull {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (const part of parts)
    for (const body of partBodies(part)) {
      const h = convexHull(body);
      const base = vertices.length;
      vertices.push(...h.vertices.map(round));
      faces.push(...h.faces.map((f) => f.map((i) => i + base)));
    }
  return { vertices, faces };
}

/** Centimetres are plenty for a ship file. */
const round = (p: Vec3): Vec3 => p.map((c) => Math.round(c * 100) / 100 + 0) as Vec3;

/**
 * A ship's geometry as parts, to edit: its connected bodies, each mirrored onto
 * itself, paired with its mirror image, or neither. Every fleet ship's bodies
 * are convex, so their hulls give the ship back.
 */
export function partsOf(geometry: ShipDef['geometry']): Part[] {
  const { vertices: V, faces: F } = geometry;
  const parent = V.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const f of F) for (const i of f) parent[find(i)] = find(f[0]);
  const bodies = new Map<number, Vec3[]>();
  for (const i of new Set(F.flat())) bodies.set(find(i), [...(bodies.get(find(i)) ?? []), V[i]]);
  const list = [...bodies.values()];
  const tol = tolerance(V) * 10;
  const same = (a: Vec3[], b: Vec3[]) => a.length === b.length && a.every((p) => b.some((q) => len(sub(p, q)) <= tol));
  const centre = (b: Vec3[]) => b.reduce((s, p) => s + p[0], 0) / b.length;
  const parts: Part[] = [];
  const used = new Set<number>();
  list.forEach((body, i) => {
    if (used.has(i)) return;
    used.add(i);
    const mirrored = body.map(mirrorX);
    if (same(body, mirrored)) {
      parts.push({ name: '', mirror: 'centre', points: body.filter((p) => p[0] >= -tol) });
      return;
    }
    const twin = list.findIndex((other, j) => !used.has(j) && same(other, mirrored));
    if (twin >= 0) {
      used.add(twin);
      parts.push({ name: '', mirror: 'pair', points: centre(body) >= 0 ? body : list[twin] });
      return;
    }
    parts.push({ name: '', mirror: 'none', points: body });
  });
  parts.forEach((p, i) => (p.name = p.mirror === 'pair' ? `Pair ${i + 1}` : i === 0 ? 'Hull' : `Part ${i + 1}`));
  return parts;
}
