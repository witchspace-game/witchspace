// Generates the Titanoboa's core modules (content/modules/*.json) and the
// Standard line-up as one ship (content/ships/titanoboa.json).
//
//   npx tsx tools/titanoboa.ts
//
// Each module is one shape with one job, built to the coupling standard in
// src/content/modules.ts: the body runs between its necks, and each coupled
// end is a flat face covering the 140 m square. The game adds the necks.
// See docs/design/ship-the-titanoboa.md for why each module looks as it does
// and why they sit in this order.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fixWinding } from '../src/content/geometry';
import { assemble, bodyEnds, checkModule, COUPLING } from '../src/content/modules';
import type { ModuleDef, ModuleZone, Vec3 } from '../src/content/types';
import { STANDARD_LINE_UP } from '../src/game/yards';

const root = resolve(import.meta.dirname, '..');
/** JSON with each point, face and line on one line, as the other content files are. */
const fmt = (o: unknown) => JSON.stringify(o, null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, items: string) => `[${items.split(/,\s*/).join(', ')}]`) + '\n';
const HEX = Math.PI / 6;
type Ring = [z: number, w: number, h: number];

class Hull {
  v: Vec3[] = [];
  f: number[][] = [];
  at(x: number, y: number, z: number) {
    return this.v.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]) - 1;
  }
  ring(sides: number, w: number, h: number, z: number, cx = 0, cy = 0, turn = sides === 6 ? HEX : Math.PI / sides) {
    return Array.from({ length: sides }, (_, i) => {
      const a = turn + (i / sides) * Math.PI * 2;
      return this.at(cx + Math.cos(a) * w, cy + Math.sin(a) * h, z);
    });
  }
  loft(a: number[], b: number[]) {
    a.forEach((_, i) => {
      const j = (i + 1) % a.length;
      this.f.push([a[i], a[j], b[j], b[i]]);
    });
  }
  /** A closed solid through rings, fore to aft. */
  solid(sides: number, rings: Ring[], cx = 0, cy = 0) {
    const rs = rings.map(([z, w, h]) => this.ring(sides, w, h, z, cx, cy));
    this.f.push([...rs[0]]);
    for (let i = 0; i < rs.length - 1; i++) this.loft(rs[i], rs[i + 1]);
    this.f.push([...rs[rs.length - 1]].reverse());
  }
  /** A section of the spine: the coupling's own square. */
  spine(z0: number, z1: number) {
    const r = (COUPLING / 2) * Math.SQRT2;
    this.solid(4, [[z0, r, r], [z1, r, r]]);
  }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    const c: Vec3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const [a, b, cc, d, e, f, g, k] = c.map((p) => this.at(...p));
    this.f.push([a, b, cc, d], [e, f, g, k], [a, b, f, e], [b, cc, g, f], [cc, d, k, g], [d, a, e, k]);
  }
  /** A flat panel standing out from the axis at `angle`, from radius r0 to r1, between z0 and z1: four lines. */
  vane(angle: number, r0: number, r1: number, z0: number, z1: number) {
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
    this.f.push([this.at(dx * r0, dy * r0, z0), this.at(dx * r1, dy * r1, z0), this.at(dx * r1, dy * r1, z1), this.at(dx * r0, dy * r0, z1)]);
  }
  /** A flat six-sided ring (a wheel), between z0 and z1, flat on top. */
  wheel(outer: number, inner: number, z0: number, z1: number) {
    const [of, ob, inf, inb] = [this.ring(6, outer, outer, z0, 0, 0, 0), this.ring(6, outer, outer, z1, 0, 0, 0), this.ring(6, inner, inner, z0, 0, 0, 0), this.ring(6, inner, inner, z1, 0, 0, 0)];
    this.loft(of, ob);
    this.loft(inb, inf);
    of.forEach((_, i) => {
      const j = (i + 1) % 6;
      this.f.push([inf[i], of[i], of[j], inf[j]], [ob[i], inb[i], inb[j], ob[j]]);
    });
  }
}

interface Spec {
  name: string;
  zone: ModuleZone;
  length: number;
  couples: { fore: boolean; aft: boolean };
  description: string;
  body: (h: Hull, top: number, bottom: number) => void;
  insignia?: (top: number, bottom: number) => ModuleDef['insignia'];
}

/** The habitat's spokes, an inverted Y. */
const SPOKES = [(3 * Math.PI) / 2, Math.PI / 6, (5 * Math.PI) / 6];
/** The science masts, a Y: one find to a pod, held up and out at arm's length. */
const MASTS = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6];
const HUB = 130;
const WHEEL = 340; // the habitat wheel's outer radius
const WHEEL_DEPTH = 35; // half its depth along the ship

const SPECS: Record<string, Spec> = {
  maw: {
    name: 'Maw',
    zone: 'intake',
    length: 300,
    couples: { fore: false, aft: true },
    description: 'The intake. A wide mouth that takes in a moon a little at a time, from haulers that never have to land.',
    body: (h, top, bottom) => {
      // Every ring the same proportions, so each face is flat.
      const rim = h.ring(6, 250, 190, top);
      const throat = h.ring(6, 120, 91, top - 130);
      const back = h.ring(6, 140, 106, bottom);
      h.loft(rim, throat);
      h.f.push([...throat]);
      h.loft(rim, back);
      h.f.push([...back].reverse());
    },
  },
  furnace: {
    name: 'Furnace',
    zone: 'industry',
    length: 300,
    couples: { fore: true, aft: true },
    description: 'A crucible for smelting, refining and the exotic materials. Wexley-Yorozu recommends you do not stand near it.',
    body: (h, top, bottom) => h.solid(6, [[top, 116, 116], [(top + bottom) / 2, 240, 240], [bottom, 116, 116]]),
  },
  hold: {
    name: 'Hold',
    zone: 'logistics',
    length: 320,
    couples: { fore: true, aft: true },
    description: 'Four cells for refined metal and imported goods around the spine, and a pad on each side for three tugs.',
    body: (h, top, bottom) => {
      h.spine(top, bottom);
      // The cells in the four corners, leaving a cross of space where the spine runs through.
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        const [x0, x1] = sx > 0 ? [80, 220] : [-220, -80];
        const [y0, y1] = sy > 0 ? [80, 220] : [-220, -80];
        h.box(x0, x1, y0, y1, bottom + 20, top - 20);
      }
      // The pads, level with the spine: a Bullsnake is 70 m, so each takes three.
      for (const sx of [1, -1]) h.f.push([h.at(sx * 80, 0, top - 30), h.at(sx * 400, 0, top - 30), h.at(sx * 400, 0, bottom + 30), h.at(sx * 80, 0, bottom + 30)]);
    },
  },
  habitat: {
    name: 'Habitat',
    zone: 'crew',
    length: 160,
    couples: { fore: true, aft: true },
    description: 'A wheel on three spokes, turning for gravity. A few thousand workers live here, under the company mark.',
    body: (h, top, bottom) => {
      h.spine(top, bottom);
      const mid = (top + bottom) / 2;
      h.wheel(WHEEL, 275, mid + WHEEL_DEPTH, mid - WHEEL_DEPTH);
      for (const a of SPOKES) h.vane(a, COUPLING / 2, 280, mid + 12, mid - 12);
    },
    // Wexley-Yorozu's W over its arc, on the flat top of the wheel, where everyone flying past sees it.
    insignia: () => {
      const y = WHEEL * Math.sin(Math.PI / 3) + 1;
      const s = 0.48;
      const p = (x: number, z: number): Vec3 => [+(x * s).toFixed(1), y, +((z - 793) * s).toFixed(1)];
      const vertices: Vec3[] = [];
      const lines: [number, number][] = [];
      const poly = (pts: Vec3[]) => {
        for (let i = 0; i < pts.length - 1; i++) lines.push([vertices.push(pts[i]) - 1, vertices.push(pts[i + 1]) - 1]);
      };
      poly([p(-48, 860), p(-24, 770), p(0, 830), p(24, 770), p(48, 860)]);
      poly([p(-60, 745), p(-55.4, 738), p(-42.4, 732), p(-23, 728), p(0, 727), p(23, 728), p(42.4, 732), p(55.4, 738), p(60, 745)]);
      poly([p(-7, 798), p(0, 786), p(7, 798)]);
      poly([p(0, 786), p(0, 774)]);
      return { color: '#f4f1e4', vertices, lines };
    },
  },
  fabricator: {
    name: 'Fabricator',
    zone: 'fabrication',
    length: 520,
    couples: { fore: true, aft: true },
    description: 'An open cradle where station sections are made. They leave by the sides, and so, occasionally, does the crew.',
    body: (h, top, bottom) => {
      h.spine(top, bottom);
      for (const y of [-240, 240]) h.box(-18, 18, y - 18, y + 18, bottom + 30, top - 30); // the rails
      for (const z of [top, bottom + 30]) h.box(-14, 14, -258, 258, z - 30, z); // the gantries
    },
  },
  science: {
    name: 'Science',
    zone: 'add-on',
    length: 220,
    couples: { fore: true, aft: true },
    description: "A sealed pod on a mast, at arm's length from everyone, for whatever the explorers found living here. Ejectable.",
    body: (h, top, bottom) => {
      h.solid(6, [[top, HUB, HUB], [bottom, HUB, HUB]]);
      const mid = (top + bottom) / 2;
      const face = HUB * Math.cos(Math.PI / 6);
      // One mast and pod; more come with stage 4.
      const a = MASTS[0];
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      const t = 14;
      const [nx, ny] = [-dy * t, dx * t];
      const p = (r: number, s: number, z: number): Vec3 => [dx * r + nx * s, dy * r + ny * s, z];
      const c = [p(face, -1, mid + 20), p(300, -1, mid + 20), p(300, 1, mid + 20), p(face, 1, mid + 20), p(face, -1, mid - 20), p(300, -1, mid - 20), p(300, 1, mid - 20), p(face, 1, mid - 20)].map((q) => h.at(...q));
      h.f.push([c[0], c[1], c[2], c[3]], [c[4], c[5], c[6], c[7]], [c[0], c[1], c[5], c[4]], [c[1], c[2], c[6], c[5]], [c[2], c[3], c[7], c[6]], [c[3], c[0], c[4], c[7]]);
      h.solid(6, [[mid + 75, 70, 70], [mid, 150, 150], [mid - 75, 70, 70]], dx * 430, dy * 430);
    },
  },
  reactor: {
    name: 'Reactor',
    zone: 'power',
    length: 300,
    couples: { fore: true, aft: true },
    description: 'A compact core behind a shadow shield, so everyone else lives in its shade, and four vanes shedding its heat.',
    body: (h, top, bottom) => {
      h.solid(8, [[top, 230, 230], [top - 20, 230, 230]]); // the shadow shield, facing the crew
      h.solid(8, [[top - 20, 140, 140], [bottom, 140, 140]]);
      for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) h.vane(a, 140, 440, top - 50, bottom + 15);
    },
  },
  drive: {
    name: 'Drive',
    zone: 'power',
    length: 300,
    couples: { fore: true, aft: false },
    description: 'A block and three bells, fitted only when a station has to be moved. She never hurries.',
    body: (h, top, bottom) => {
      const join = bottom + 110;
      h.solid(6, [[top, 150, 115], [join, 190, 145]]);
      for (const [x, y] of [[-95, 45], [95, 45], [0, -75]]) h.solid(6, [[join, 40, 40], [bottom, 72, 72]], x, y);
    },
  },
};

/** The Standard line-up: a station's worth of work. */
export const STANDARD = STANDARD_LINE_UP;

const modules: Record<string, ModuleDef> = {};
let failed = false;
for (const [id, s] of Object.entries(SPECS)) {
  const draft = { length: s.length, couples: s.couples } as ModuleDef;
  const { top, bottom } = bodyEnds(draft);
  const h = new Hull();
  s.body(h, top, bottom);
  const m: ModuleDef = {
    id,
    name: s.name,
    zone: s.zone,
    length: s.length,
    couples: s.couples,
    description: s.description,
    designer: 'Witchspace',
    credits: { authors: ['Witchspace contributors'], license: 'CC-BY-SA-4.0', aiAssisted: true, notes: 'A core module, from Mark\'s modular Titanoboa (25 October 2026).' },
    geometry: { vertices: h.v, faces: fixWinding(h.v, h.f) },
    ...(s.insignia ? { insignia: s.insignia(top, bottom) } : {}),
  };
  const { errors } = checkModule(m);
  console.log(`${errors.length ? '✗' : '✓'} ${id.padEnd(11)} ${String(m.geometry.vertices.length).padStart(3)} vertices  ${s.length} m  ${s.zone}`);
  for (const e of errors) console.log(`    ${e}`);
  failed ||= errors.length > 0;
  modules[id] = m;
  writeFileSync(join(root, `content/modules/${id}.json`), fmt({ $schema: '../../schemas/module.schema.json', ...m }));
}

const line = assemble(STANDARD.map((id) => modules[id]));
const shipFile = join(root, 'content/ships/titanoboa.json');
const old = JSON.parse(readFileSync(shipFile, 'utf8'));
const ship = {
  $schema: '../../schemas/ship.schema.json',
  id: 'titanoboa',
  name: 'Titanoboa',
  manufacturer: 'Wexley-Yorozu',
  role: 'freighter',
  docks: false, // scenery at the yards: far too big for a docking slot, and never docks
  description:
    'A factory in sections on one coupling: a maw that eats a moon, furnaces, a hold, a wheel for the crew, a fabricator and a reactor. Tug teams assemble it where the work is; it leaves a station behind and comes apart to move on. Nobody has ever seen one hurry.',
  credits: {
    authors: ['Witchspace contributors'],
    license: 'CC-BY-SA-4.0',
    aiAssisted: true,
    notes: `Original design, from Mark's modular Titanoboa. The Standard line-up, ${(line.length / 1000).toFixed(1)} km from maw to reactor; the Coriolis is 160 m. Assembled from content/modules by tools/titanoboa.ts. Scenery at Wexley-Yorozu yards, not for sale.`,
  },
  stats: { ...old.stats, maxSpeed: 0 },
  style: { lineColor: '#ffd23d', glow: 1 },
  modules: STANDARD,
  geometry: line.geometry,
  ...(line.insignia ? { insignia: line.insignia } : {}),
};
writeFileSync(shipFile, fmt(ship));
console.log(`titanoboa: ${STANDARD.join(', ')}; ${line.geometry.vertices.length} vertices, ${line.length} m`);
if (failed) process.exit(1);
