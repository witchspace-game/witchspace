// Generates content/ships/titanoboa.json and bullsnake.json. Run: node tools/yard-ships.mjs
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

// --- Titanoboa --------------------------------------------------------------------
{
  const m = mesh();
  const d = details();
  const ins = details();
  const W = 120, H = 90;
  const hex = (z, s) => [[W / 2, H, z], [-W / 2, H, z], [-W, 0, z], [-W / 2, -H, z], [W / 2, -H, z], [W, 0, z]].map(([x, y]) => [x * s, y * s, z]);
  // The armoured spine: plate seams at each ring, tapering to a blunt prow.
  const spineRings = [[-1100, 1], [-700, 1], [-250, 1], [200, 1], [650, 1], [1000, 0.85], [1200, 0.42]];
  m.loft(spineRings.map(([z, s]) => hex(z, s)));
  const spineScale = (z) => {
    for (let i = 0; i < spineRings.length - 1; i++) {
      const [z0, s0] = spineRings[i], [z1, s1] = spineRings[i + 1];
      if (z >= z0 && z <= z1) return s0 + ((z - z0) / (z1 - z0)) * (s1 - s0);
    }
    return 1;
  };
  // The drive block, aft.
  m.loft([m.rectZ(-1250, -175, 175, -125, 125), m.rectZ(-1040, -145, 145, -100, 100)]);
  // Refinery bays, four a side, open to space.
  const bays = [[-580, -360], [-300, -80], [-20, 200], [260, 480]];
  const BX = 310, BY = 78;
  for (const sx of [1, -1]) {
    for (const [z0, z1] of bays) {
      m.box(sx > 0 ? 40 : -BX, sx > 0 ? BX : -40, -BY, BY, z0, z1);
      const x = sx * (BX + 3);
      // The bay mouth, and the ribs inside it.
      d.poly([[x, -BY + 14, z0 + 16], [x, BY - 14, z0 + 16], [x, BY - 14, z1 - 16], [x, -BY + 14, z1 - 16]]);
      for (let k = 1; k < 4; k++) {
        const z = z0 + 16 + ((z1 - z0 - 32) * k) / 4;
        d.line([x, -BY + 14, z], [x, BY - 14, z]);
      }
      d.line([x, 0, z0 + 16], [x, 0, z1 - 16]);
    }
    // Truss across the gaps between bays.
    for (let i = 0; i < bays.length - 1; i++) {
      const za = bays[i][1], zb = bays[i + 1][0];
      const x = sx * (BX - 20);
      d.line([x, BY, za], [x, -BY, zb]);
      d.line([x, -BY, za], [x, BY, zb]);
      d.line([x, BY, za], [x, BY, zb]);
      d.line([x, -BY, za], [x, -BY, zb]);
    }
  }
  // Smelters along the back: hexagonal stacks, hot at the mouth.
  const hexY = (y, cx, cz, r) => [...Array(6).keys()].map((i) => [cx + r * Math.cos((i * Math.PI) / 3), y, cz + r * Math.sin((i * Math.PI) / 3)]);
  for (const cz of [-470, -170, 130]) {
    const r = 58;
    m.loft([hexY(40, 0, cz, r), hexY(230, 0, cz, r * 0.8)]);
    d.poly(hexY(233, 0, cz, r * 0.5));
    d.poly(hexY(233, 0, cz, r * 0.25));
    for (const y of [110, 170]) d.poly(hexY(y, 0, cz, r * (1 - (0.2 * (y - 40)) / 190) + 3));
  }
  // The command tower, aft, where the yard's bosses can see it all.
  m.box(-50, 50, 60, 200, -1000, -860);
  d.poly([[-38, 180, -857], [38, 180, -857], [38, 165, -857], [-38, 165, -857]]);
  // The ore intake under the prow: the moon goes in here.
  m.loft([m.rectZ(760, -62, 62, -130, -55), m.rectZ(1130, -96, 96, -178, -40)]);
  d.poly([[-82, -164, 1133], [82, -164, 1133], [82, -54, 1133], [-82, -54, 1133]]);
  // Conveyors from the intake back to the bays.
  for (const x of [-22, 22]) d.line([x, -H - 3, 740], [x, -H - 3, -600]);
  // Drive nozzles.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * 85, cy = sy * 60, h = 34;
    d.poly([[cx - h, cy - h, -1253], [cx + h, cy - h, -1253], [cx + h, cy + h, -1253], [cx - h, cy + h, -1253]]);
  }
  // Armour seams along the top deck.
  for (const x of [-W / 2 + 12, W / 2 - 12]) d.line([x, H + 3, -1095], [x, H + 3, -560]);

  // --- Detail at the scale of people and ships, so it reads as 2.5 km and not 250 m ---
  const inBay = (z) => bays.some(([z0, z1]) => z > z0 - 4 && z < z1 + 4);
  const ring = (z, out) => hex(z, spineScale(z)).map(([x, y]) => [x * (1 + out / 120), y * (1 + out / 90), z]);
  // Plate seams round the spine every 50 m: a rhythm you count as you fly past.
  for (let z = -1050; z <= 1150; z += 50) {
    const r = ring(z, 2);
    if (inBay(z)) {
      d.line(r[0], r[1]);
      d.line(r[3], r[4]);
    } else d.poly(r);
  }
  // Lit windows down both flanks, deck on deck, where a few thousand people live and work.
  // A window is 6 m; a Cobra would cover eight of them.
  const flank = (z, sx, sy, t, out) => {
    const k = spineScale(z);
    const a = [sx * 60 * k, sy * 90 * k], b = [sx * 120 * k, 0];
    const n = [sx * 90, sy * 60], len = Math.hypot(n[0], n[1]);
    return [a[0] + (b[0] - a[0]) * t + (n[0] / len) * out, a[1] + (b[1] - a[1]) * t + (n[1] / len) * out, z];
  };
  for (const [z0, z1] of [[-1030, -620], [520, 960]]) {
    for (const sx of [1, -1]) {
      for (const [sy, rows] of [[1, [0.22, 0.38, 0.54, 0.7]], [-1, [0.35, 0.55]]]) {
        for (const t of rows) {
          for (let z = z0, i = 0; z + 6 <= z1; z += 11, i++) {
            if (i % 9 === 8) continue; // a bulkhead between sections
            d.line(flank(z, sx, sy, t, 1.5), flank(z + 6, sx, sy, t, 1.5));
          }
        }
      }
    }
  }
  // Running lights along the spine's edges, every 100 m.
  const cross = ([x, y, z], r) => {
    d.line([x, y - r, z], [x, y + r, z]);
    d.line([x, y, z - r], [x, y, z + r]);
  };
  for (let z = -1000; z <= 1100; z += 100) {
    for (const sx of [1, -1]) {
      if (!inBay(z)) cross([sx * (120 * spineScale(z) + 3), 0, z], 4);
      cross([sx * 60 * spineScale(z), 90 * spineScale(z) + 3, z], 4);
    }
  }
  // Gantry cranes straddling each bay, lattice booms 70 m up.
  for (const sx of [1, -1]) {
    for (const [z0, z1] of bays) {
      const zc = (z0 + z1) / 2, x0 = sx * 70, x1 = sx * 290, top = 150;
      for (const z of [zc - 30, zc + 30]) {
        d.line([x0, BY, z], [x0, top, z]);
        d.line([x1, BY, z], [x1, top, z]);
        d.line([x0, top, z], [x1, top, z]);
      }
      d.line([x0, top, zc - 30], [x0, top, zc + 30]);
      d.line([x1, top, zc - 30], [x1, top, zc + 30]);
      // Lattice along the boom.
      for (let i = 0; i < 8; i++) {
        const xa = x0 + ((x1 - x0) * i) / 8, xb = x0 + ((x1 - x0) * (i + 1)) / 8;
        d.line([xa, top, i % 2 ? zc - 30 : zc + 30], [xb, top, i % 2 ? zc + 30 : zc - 30]);
      }
      // The trolley and its cable, part way along.
      const xt = x0 + (x1 - x0) * (0.35 + 0.3 * ((z0 / 280) % 1 + 1) % 1);
      d.poly([[xt - 10, top - 4, zc - 12], [xt + 10, top - 4, zc - 12], [xt + 10, top - 4, zc + 12], [xt - 10, top - 4, zc + 12]]);
      d.line([xt, top - 4, zc], [xt, BY + 20, zc]);
    }
  }
  // The command tower: floors of windows on every face.
  for (let y = 104; y <= 146; y += 14) {
    for (let x = -44; x + 4 <= 44; x += 9) {
      if (y > 120) d.line([x, y, -857], [x + 4, y, -857]); // the hangar's below
      d.line([x, y, -1003], [x + 4, y, -1003]);
    }
    for (const sx of [1, -1]) for (let z = -994; z + 4 <= -866; z += 9) d.line([sx * 53, y, z], [sx * 53, y, z + 4]);
  }
  // A mast on the roof.
  d.line([0, 200, -930], [0, 300, -930]);
  for (const [y, w] of [[240, 24], [270, 14]]) d.line([-w, y, -930], [w, y, -930]);
  // A hangar for visiting ships at the foot of the tower, a Cobra's size, with
  // landing lights on the deck leading in.
  d.poly([[-42, H + 2, -857], [42, H + 2, -857], [42, H + 28, -857], [-42, H + 28, -857]]);
  d.poly([[-36, H + 5, -856], [36, H + 5, -856], [36, H + 24, -856], [-36, H + 24, -856]]);
  for (let i = 0; i < 5; i++) {
    const z = -830 + i * 30;
    d.poly([[-30, H + 3, z + 12], [0, H + 3, z], [30, H + 3, z + 12]], false);
  }

  // The W over its horizon, on the deck forward of the stacks.
  const top = (x, z) => [x, H * spineScale(z) + 3, z];
  ins.poly([top(-48, 860), top(-24, 770), top(0, 830), top(24, 770), top(48, 860)], false);
  const arc = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    arc.push(top(-60 * Math.cos(a), 745 - 18 * Math.sin(a)));
  }
  ins.poly(arc, false);
  ins.poly([top(-7, 798), top(0, 786), top(7, 798)], false);
  ins.line(top(0, 786), top(0, 774));

  const ship = {
    $schema: '../../schemas/ship.schema.json',
    id: 'titanoboa',
    name: 'Titanoboa',
    manufacturer: 'Wexley-Yorozu',
    role: 'freighter',
    description:
      'A constructor two and a half kilometres long: refineries, smelters and a few thousand workers on an armoured spine. It parks by a moon, eats it a little at a time, and leaves a station behind. Nobody has ever seen one hurry.',
    credits: { authors: ['Witchspace contributors'], license: 'CC-BY-SA-4.0', aiAssisted: true, notes: 'Original design. 2,500 m from prow to drive block; the Coriolis is 160 m. Scenery at Wexley-Yorozu yards, not for sale.' },
    stats: { maxSpeed: 40, pitchRate: 0.02, rollRate: 0.02, hull: 200000, shields: 100000, cargo: 0, price: 0 },
    style: { lineColor: '#ffd23d', glow: 1 },
    geometry: { vertices: m.verts, faces: m.faces, details: { vertices: d.vertices, lines: d.lines } },
    insignia: { color: '#f4f1e4', vertices: ins.vertices, lines: ins.lines },
  };
  fs.writeFileSync(path.join(root, 'content/ships/titanoboa.json'), fmt(ship) + '\n');
  console.log('titanoboa', m.verts.length, m.faces.length, d.lines.length);
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
    stats: { maxSpeed: 140, pitchRate: 0.6, rollRate: 0.8, hull: 260, shields: 80, cargo: 60, price: 0 },
    style: { lineColor: '#ffd23d', glow: 1 },
    geometry: { vertices: m.verts, faces: m.faces, details: { vertices: d.vertices, lines: d.lines } },
    insignia: { color: '#f4f1e4', vertices: ins.vertices, lines: ins.lines },
  };
  fs.writeFileSync(path.join(root, 'content/ships/bullsnake.json'), fmt(ship) + '\n');
  console.log('bullsnake', m.verts.length, m.faces.length, d.lines.length);
}
