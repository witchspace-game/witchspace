// The Titanoboa's modules: the coupling standard, the checks a module must pass,
// and assembling a line-up into one hull. Pure, so it runs in Node too.
// See docs/design/ship-the-titanoboa.md.

import { checkGeometry, fixWinding } from './geometry';
import type { ModuleDef, ModuleZone, Vec3 } from './types';

/** The coupling: a 140 m square on the axis. */
export const COUPLING = 140;
/** Each coupled end stands a 35 m half-neck of the coupling on its end face; two coupled make a 70 m neck. */
export const HALF_NECK = 35;
export const MAX_VERTICES = 256;
/** Prow to stern: the order a line-up's zones must follow. */
export const ZONES: ModuleZone[] = ['intake', 'industry', 'logistics', 'crew', 'fabrication', 'add-on', 'power'];

/** Where a module's body ends, fore and aft, in its own frame. */
export function bodyEnds(m: ModuleDef): { top: number; bottom: number } {
  return { top: m.length / 2 - (m.couples.fore ? HALF_NECK : 0), bottom: -m.length / 2 + (m.couples.aft ? HALF_NECK : 0) };
}

/** The standard's checks beyond the schema: the hull rules, the size limit, and a face for each coupling. */
export function checkModule(m: ModuleDef): { errors: string[]; warnings: string[] } {
  const { vertices, faces } = m.geometry;
  const report = checkGeometry(vertices, faces);
  const errors = [...report.errors];
  if (vertices.length > MAX_VERTICES) errors.push(`${vertices.length} vertices: a module has at most ${MAX_VERTICES}`);
  const { top, bottom } = bodyEnds(m);
  const zs = vertices.map((v) => v[2]);
  if (Math.max(...zs) > top + 0.5 || Math.min(...zs) < bottom - 0.5) errors.push(`the body must lie between z = ${top} and z = ${bottom}, leaving room for the necks`);
  for (const [end, z] of [['fore', top], ['aft', bottom]] as const) {
    if (m.couples[end] && !faces.some((f) => coversCoupling(vertices, f, z))) errors.push(`the ${end} end needs a flat face at z = ${z} covering the ${COUPLING} m coupling square`);
  }
  return { errors, warnings: report.warnings };
}

/** A real calendar date, YYYY-MM-DD. */
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
/** What the game accepts as a callsign (server/src/protocol.ts, cleanName). */
const isCallsign = (s: string) => /^[\p{L}\p{N} .'_-]{1,24}$/u.test(s) && s.trim() === s;

/** A community module's service and commission details: who gets paid, and where it goes in the line-up. */
export function checkService(m: ModuleDef, all: ReadonlyMap<string, ModuleDef>): string[] {
  const errors: string[] = [];
  const s = m.inService;
  if (s) {
    if (!isDate(s.from)) errors.push(`inService.from "${s.from}" isn't a real date (YYYY-MM-DD)`);
    if (m.designer === 'Witchspace' || !isCallsign(m.designer)) errors.push(`designer "${m.designer}" must be the designer's callsign, so the commission reaches them`);
    if (s.replaces) {
      const old = all.get(s.replaces);
      if (!old) errors.push(`inService.replaces "${s.replaces}": no such module`);
      else if (old.id === m.id) errors.push('a module can\'t replace itself');
      else if (old.zone !== m.zone) errors.push(`it replaces ${old.id}, a ${old.zone} module, so it must be one too (it's ${m.zone})`);
      else if (old.couples.fore !== m.couples.fore || old.couples.aft !== m.couples.aft) errors.push(`it must couple at the same ends as ${old.id}`);
    } else if (!m.couples.fore || !m.couples.aft) errors.push('an added module sits between two others, so it must couple at both ends');
  }
  let last = '';
  for (const r of m.revisions ?? []) {
    if (!isDate(r.from)) errors.push(`revision by ${r.by}: "${r.from}" isn't a real date`);
    if (!isCallsign(r.by)) errors.push(`revision by "${r.by}": that must be the improver's callsign`);
    if (r.from < last) errors.push('revisions go oldest first');
    last = r.from;
  }
  return errors;
}

/** Is this face flat at z, and does it cover the coupling square? (Faces are convex, so the square's corners are enough.) */
function coversCoupling(vertices: Vec3[], face: number[], z: number): boolean {
  const p = face.map((i) => vertices[i]);
  if (p.some((v) => Math.abs(v[2] - z) > 0.5)) return false;
  const h = COUPLING / 2;
  return ([[h, h], [-h, h], [-h, -h], [h, -h]] as const).every(([x, y]) => {
    let sign = 0;
    for (let i = 0; i < p.length; i++) {
      const [a, b] = [p[i], p[(i + 1) % p.length]];
      const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (Math.abs(c) < 1e-6) continue;
      if (sign && Math.sign(c) !== sign) return false;
      sign = Math.sign(c);
    }
    return true;
  });
}

/** Can `b` couple behind `a`? Both ends must take the coupling, and the zones run prow to stern. */
export function canCouple(a: ModuleDef, b: ModuleDef): boolean {
  return a.couples.aft && b.couples.fore && ZONES.indexOf(a.zone) <= ZONES.indexOf(b.zone);
}

/** A half-neck: the coupling's square, from z0 to z1. */
function neck(z0: number, z1: number): { vertices: Vec3[]; faces: number[][] } {
  const h = COUPLING / 2;
  const vertices: Vec3[] = [z0, z1].flatMap((z) => [[h, h, z], [-h, h, z], [-h, -h, z], [h, -h, z]] as Vec3[]);
  const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  return { vertices, faces: fixWinding(vertices, faces) };
}

export interface LineUp {
  geometry: { vertices: Vec3[]; faces: number[][] };
  insignia?: { color: string; vertices: Vec3[]; lines: [number, number][] };
  /** Prow to stern. */
  length: number;
  /** Each module's centre along the hull, fore to aft. */
  centres: { id: string; z: number }[];
}

/** Each module's centre along a line-up, fore to aft, with the whole centred on z = 0. */
export function centresOf(modules: ModuleDef[]): { id: string; z: number; length: number }[] {
  let fore = modules.reduce((n, m) => n + m.length, 0) / 2;
  return modules.map((m) => {
    const c = { id: m.id, z: fore - m.length / 2, length: m.length };
    fore -= m.length;
    return c;
  });
}

/** One hull from modules, fore to aft, centred on z = 0. Necks only where two modules couple; a free end is a clean face. */
export function assemble(modules: ModuleDef[]): LineUp {
  for (let i = 1; i < modules.length; i++) {
    if (!canCouple(modules[i - 1], modules[i])) throw new Error(`${modules[i].id} can't couple behind ${modules[i - 1].id}`);
  }
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const add = (g: { vertices: Vec3[]; faces: number[][] }, dz: number) => {
    const base = vertices.length;
    for (const [x, y, z] of g.vertices) vertices.push([x, y, +(z + dz).toFixed(1)]);
    for (const f of g.faces) faces.push(f.map((i) => i + base));
  };
  let insignia: LineUp['insignia'];
  const length = modules.reduce((n, m) => n + m.length, 0);
  const centres: LineUp['centres'] = [];
  let fore = length / 2;
  modules.forEach((m, i) => {
    const dz = fore - m.length / 2;
    const { top, bottom } = bodyEnds(m);
    add(m.geometry, dz);
    if (i > 0) add(neck(m.length / 2, top), dz);
    if (i < modules.length - 1) add(neck(bottom, -m.length / 2), dz);
    if (m.insignia && !insignia) {
      const base: Vec3[] = m.insignia.vertices.map(([x, y, z]) => [x, y, +(z + dz).toFixed(1)]);
      insignia = { color: m.insignia.color, vertices: base, lines: m.insignia.lines };
    }
    centres.push({ id: m.id, z: dz });
    fore -= m.length;
  });
  return { geometry: { vertices, faces }, insignia, length, centres };
}
