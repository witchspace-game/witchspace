// Generates content/ships/bullsnake.json. Run: node tools/yard-ships.mjs
// (The Titanoboa is built from modules: see tools/titanoboa.ts.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));
const r1 = (n) => Math.round(n * 10) / 10;

function mesh() {
  const verts = [];
  const faces = [];
  // Each component is convex: wind every face outward from the component's centre.
  function add(vs, fs) {
    const base = verts.length;
    const c = vs.reduce((a, v) => [a[0] + v[0] / vs.length, a[1] + v[1] / vs.length, a[2] + v[2] / vs.length], [0, 0, 0]);
    for (const v of vs) verts.push(v.map(r1));
    for (const f of fs) {
      const p = f.map((i) => vs[i]);
      // Newell normal
      const n = [0, 0, 0];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        n[0] += (a[1] - b[1]) * (a[2] + b[2]);
        n[1] += (a[2] - b[2]) * (a[0] + b[0]);
        n[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      const fc = p.reduce((a, v) => [a[0] + v[0] / p.length, a[1] + v[1] / p.length, a[2] + v[2] / p.length], [0, 0, 0]);
      const out = (fc[0] - c[0]) * n[0] + (fc[1] - c[1]) * n[1] + (fc[2] - c[2]) * n[2];
      const g = f.map((i) => i + base);
      faces.push(out >= 0 ? g : g.reverse());
    }
  }
  // A loft through rings of the same convex section (each ring a list of [x, y, z]).
  function loft(rings) {
    const k = rings[0].length;
    const vs = rings.flat();
    const fs = [];
    for (let r = 0; r < rings.length - 1; r++)
      for (let i = 0; i < k; i++) fs.push([r * k + i, r * k + ((i + 1) % k), (r + 1) * k + ((i + 1) % k), (r + 1) * k + i]);
    fs.push([...Array(k).keys()]);
    fs.push([...Array(k).keys()].map((i) => (rings.length - 1) * k + i));
    add(vs, fs);
  }
  const rectZ = (z, x0, x1, y0, y1) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  const box = (x0, x1, y0, y1, z0, z1) => loft([rectZ(z0, x0, x1, y0, y1), rectZ(z1, x0, x1, y0, y1)]);
  return { verts, faces, add, loft, rectZ, box };
}

function details() {
  const vertices = [];
  const lines = [];
  const v = (p) => {
    vertices.push(p.map(r1));
    return vertices.length - 1;
  };
  const line = (a, b) => lines.push([v(a), v(b)]);
  const poly = (ps, closed = true) => {
    for (let i = 0; i < ps.length - (closed ? 0 : 1); i++) line(ps[i], ps[(i + 1) % ps.length]);
  };
  return { vertices, lines, line, poly };
}

function fmt(obj) {
  // JSON with short numeric arrays on one line.
  return JSON.stringify(obj, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)(?:,\s+(-?[\d.]+))?\s+\]/g, (_, a, b, c) => (c === undefined ? `[${a}, ${b}]` : `[${a}, ${b}, ${c}]`)).replace(/\[\s+((?:\d+,\s+)+\d+)\s+\]/g, (_, l) => `[${l.split(/,\s+/).join(', ')}]`);
}

// --- Bullsnake --------------------------------------------------------------------
{
  const m = mesh();
  const d = details();
  const ins = details();
  // A stubby body, widest behind the cab.
  m.loft([m.rectZ(-30, -13, 13, -9, 9), m.rectZ(10, -15, 15, -11, 11), m.rectZ(30, -11, 11, -8, 6)]);
  // The ore hopper slung under its spine.
  m.box(-12, 12, -25, -8, -22, 8);
  // Two engines aft.
  for (const sx of [1, -1]) m.box(sx > 0 ? 5 : -14, sx > 0 ? 14 : -5, -7, 5, -40, -26);
  // Cab windows on the blunt nose.
  d.poly([[-8, 1, 30.4], [8, 1, 30.4], [8, 4, 30.4], [-8, 4, 30.4]]);
  // Tractor booms where the guns would be.
  for (const sx of [1, -1]) {
    d.line([sx * 12, -9, 22], [sx * 14, -20, 40]);
    d.line([sx * 14, -20, 40], [sx * 9, -24, 46]);
  }
  // Hopper ribs, and the nozzles.
  for (const z of [-12, -2]) d.poly([[12.4, -24, z], [12.4, -11, z]], false), d.poly([[-12.4, -24, z], [-12.4, -11, z]], false);
  d.line([-12, -25.4, -22], [12, -25.4, 8]);
  d.line([12, -25.4, -22], [-12, -25.4, 8]);
  for (const sx of [1, -1]) d.poly([[sx * 7, -5, -40.4], [sx * 12, -5, -40.4], [sx * 12, 3, -40.4], [sx * 7, 3, -40.4]]);
  // The W, small, on the roof.
  ins.poly([[-5, 11.2, 4], [-2.5, 11.4, -2], [0, 11.3, 2], [2.5, 11.4, -2], [5, 11.2, 4]], false);
  const ship = {
    $schema: '../../schemas/ship.schema.json',
    id: 'bullsnake',
    name: 'Bullsnake',
    manufacturer: 'Wexley-Yorozu',
    role: 'miner',
    description:
      "Wexley-Yorozu's workhorse: short, square and slow, with an ore hopper under its belly and tractor booms where the guns should be. At a yard they run between the moon and the constructor all day, every day, and don't stop to chat.",
    credits: { authors: ['Witchspace contributors'], license: 'CC-BY-SA-4.0', aiAssisted: true, notes: 'Original design, 70 m. Scenery at Wexley-Yorozu yards, not for sale.' },
    stats: { maxSpeed: 140, pitchRate: 0.6, rollRate: 0.8, hull: 260, shields: 80, cargo: 60, price: 0, ratingValue: 0.5 },
    style: { lineColor: '#ffd23d', glow: 1 },
    geometry: { vertices: m.verts, faces: m.faces, details: { vertices: d.vertices, lines: d.lines } },
    insignia: { color: '#f4f1e4', vertices: ins.vertices, lines: ins.lines },
  };
  fs.writeFileSync(path.join(root, 'content/ships/bullsnake.json'), fmt(ship) + '\n');
  console.log('bullsnake', m.verts.length, m.faces.length, d.lines.length);
}
