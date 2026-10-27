// The Witchspace MCP server's tools (docs/design/mcp-server.md, stage 1): for
// contributors' AI assistants to validate, preview and balance-check a ship,
// read the designs and help wanted, and look up any system. Pure functions
// over a data bundle, so the Worker (server/src/mcp.ts), the local server
// (tools/mcp.ts) and the tests all use the same code. Read-only.

import { checkGeometry, deriveEdges, signedVolume } from '../content/geometry';
import { NOT_FLOWN, slotProblem } from '../content/slot';
import type { ShipDef, Vec3 } from '../content/types';
import { distanceLy, ECONOMIES, galaxy, GOVERNMENTS, systemsWithin, type StarSystem } from '../galaxy/generate';
import { stationName } from '../galaxy/stationNames';
import { describeWorld, worldOf } from '../game/explore';
import { base64, Raster } from './png';
import { VIEWER_HTML, VIEWER_MIME, VIEWER_URI, type ViewerModel } from './viewer';

/** A design document, as tools/docs.ts reads it (declared here so the Worker needn't load Node's file system). */
export interface Doc {
  slug: string;
  title: string;
  status: string;
  pillar: string;
  summary: string;
  stages: { name: string; status: string }[];
  help: { task: string; skill: string }[];
  body: string;
}

export interface McpData {
  ships: ShipDef[];
  docs: Doc[];
  /** AGENTS.md, CONTRIBUTING.md and the ship schema, for an assistant to read first. */
  texts: { agents: string; contributing: string; schema: string };
  /** The JSON Schema check, compiled ahead of time (Workers can't compile code at run time). */
  checkSchema: (ship: unknown) => string[];
}

export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
export interface ToolResult {
  content: Content[];
  /** For a client's view of the answer (MCP Apps); not shown to the model. */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** MCP Apps: the view a client shows for this tool's answers. */
  _meta?: Record<string, unknown>;
  run: (args: Record<string, unknown>, data: McpData) => ToolResult | Promise<ToolResult>;
}

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });
const json = (v: unknown): ToolResult => text(JSON.stringify(v, null, 2));

/** A ship passed in as an object, or as JSON text (assistants do both). */
function shipArg(args: Record<string, unknown>): { ship?: ShipDef; error?: string } {
  let v = args.ship;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return { error: `The ship isn't valid JSON: ${(e as Error).message}` };
    }
  }
  if (!v || typeof v !== 'object') return { error: 'Pass the ship file as "ship": the JSON object (or its text).' };
  return { ship: v as ShipDef };
}

const SHIP_INPUT = {
  type: 'object',
  properties: { ship: { description: 'The ship file: a JSON object following schemas/ship.schema.json (or the same as text).', oneOf: [{ type: 'object' }, { type: 'string' }] } },
  required: ['ship'],
};

const ROLES_NOT_FLOWN = NOT_FLOWN;

// --- Checking a ship --------------------------------------------------------------

export function validateShip(ship: ShipDef, data: McpData) {
  const errors = data.checkSchema(ship).map((e) => `schema: ${e}`);
  const warnings: string[] = [];
  const g = ship.geometry;
  if (g && Array.isArray(g.vertices) && Array.isArray(g.faces)) {
    const report = checkGeometry(g.vertices, g.faces, g.details);
    errors.push(...report.errors.map((e) => `geometry: ${e}`));
    warnings.push(...report.warnings.map((w) => `geometry: ${w}`));
    // Size: the fleet runs from about 10 m (a Sidewinder's cockpit) to the Titanoboa; flag anything wild.
    const extent = Math.max(...g.vertices.flat().map(Math.abs));
    if (!ROLES_NOT_FLOWN.has(ship.role) && extent > 400) warnings.push(`size: ${Math.round(extent * 2)} m across; a Cobra Mk III is about 68 m. Ships this big need a reason (and big stations).`);
  }
  // A ship that flies must fit the docking slot, unless it never docks (src/content/slot.ts).
  const slot = g && Array.isArray(g.vertices) ? slotProblem(ship) : null;
  if (slot) errors.push(`dock: ${slot}`);
  if (ship.docks === false && !ROLES_NOT_FLOWN.has(ship.role)) warnings.push('docks: false, so no commander can fly it from a station: right for a carrier or a yard hauler, flown by the computer.');
  const existing = data.ships.find((s) => s.id === ship.id);
  if (existing) warnings.push(`id: "${ship.id}" is already ${existing.name} in the fleet. Fine if this is an improvement to it; otherwise pick a new id.`);
  // The written rules (ships-and-classes.md): a ship needs a maker and a reason, and is never a copy.
  if (!ship.manufacturer) warnings.push('maker: no manufacturer. Every hull has a maker with a character (see docs/design/ships-and-classes.md); add one, or propose a new maker.');
  if ((ship.description ?? '').length < 60) warnings.push('description: say what the ship is for and why someone would pick it over the obvious alternative.');
  if (ship.credits && !ship.credits.aiAssisted) warnings.push('credits: if an assistant helped make this, set credits.aiAssisted to true (AGENTS.md).');
  warnings.push('homage: the geometry must be original. Evoke an idea; never trace a ship from a film, a game or anyone\'s drawings.');
  return { ok: errors.length === 0, errors, warnings };
}

// --- Drawing a ship -----------------------------------------------------------------

const rgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  const n = m ? parseInt(m[1], 16) : 0x3dffb0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Rotate a point: yaw about y, then pitch about x. The ship's nose is +z, up is +y. */
function view(v: Vec3, yaw: number, pitch: number): Vec3 {
  const [x, y, z] = v;
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}

/** Four views of the ship (three-quarter, front, side, top), each with a Cobra Mk III's outline at the same scale. */
export async function previewShip(ship: ShipDef, data: McpData): Promise<Uint8Array> {
  const W = 1200;
  const H = 840;
  const r = new Raster(W, H);
  const cobra = data.ships.find((s) => s.id === 'cobra-mk3');
  const views: [string, number, number][] = [
    ['THREE-QUARTER', -0.75, 0.42],
    ['FRONT', Math.PI, 0],
    ['SIDE', -Math.PI / 2, 0],
    ['TOP', 0, Math.PI / 2],
  ];
  const all = [...ship.geometry.vertices, ...(cobra?.geometry.vertices ?? [])];
  const extent = Math.max(1, ...all.map((v) => Math.hypot(...v)));
  const cellW = W / 2;
  const cellH = (H - 40) / 2;
  const scale = (Math.min(cellW, cellH) * 0.42) / extent;
  const color = rgb(ship.style?.lineColor);
  const draw = (def: ShipDef, cx: number, cy: number, yaw: number, pitch: number, c: [number, number, number], ghost: boolean) => {
    const vs = def.geometry.vertices.map((v) => view(v, yaw, pitch));
    const p = (v: Vec3) => [cx + v[0] * scale, cy - v[1] * scale] as const;
    for (const [a, b] of deriveEdges(def.geometry.faces)) {
      if (!vs[a] || !vs[b]) continue;
      const [x0, y0] = p(vs[a]);
      const [x1, y1] = p(vs[b]);
      if (ghost) r.line(x0, y0, x1, y1, c, 1, 0.35);
      else r.glowLine(x0, y0, x1, y1, c);
    }
    const d = def.geometry.details;
    if (d && !ghost) {
      const dv = d.vertices.map((v) => view(v, yaw, pitch));
      for (const [a, b] of d.lines) {
        if (!dv[a] || !dv[b]) continue;
        const [x0, y0] = p(dv[a]);
        const [x1, y1] = p(dv[b]);
        r.line(x0, y0, x1, y1, c, 1.2, 0.7);
      }
    }
  };
  views.forEach(([label, yaw, pitch], i) => {
    const cx = (i % 2) * cellW + cellW / 2;
    const cy = 40 + Math.floor(i / 2) * cellH + cellH / 2;
    if (cobra && cobra.id !== ship.id) draw(cobra, cx, cy, yaw, pitch, [0.6, 0.65, 0.75], true);
    draw(ship, cx, cy, yaw, pitch, color, false);
    r.text(label, (i % 2) * cellW + 16, 48 + Math.floor(i / 2) * cellH, 3, [0.55, 0.6, 0.7]);
  });
  // Grid lines between the views.
  r.line(cellW, 40, cellW, H, [0.2, 0.25, 0.3], 1, 0.6);
  r.line(0, 40 + cellH, W, 40 + cellH, [0.2, 0.25, 0.3], 1, 0.6);
  r.text(`${ship.name ?? ship.id}`.slice(0, 40), 16, 12, 4, color);
  if (cobra && cobra.id !== ship.id) r.text('GREY: COBRA MK III FOR SCALE', W - 16 - 28 * 4 * 2, 16, 2, [0.6, 0.65, 0.75]);
  return r.png();
}

// --- Balance -------------------------------------------------------------------------

const STATS = ['maxSpeed', 'pitchRate', 'rollRate', 'hull', 'shields', 'cargo', 'missiles', 'price'] as const;
const STAT_NAMES: Record<string, string> = { maxSpeed: 'top speed', pitchRate: 'pitch rate', rollRate: 'roll rate', hull: 'hull', shields: 'shields', cargo: 'hold', missiles: 'missiles', price: 'price' };

export function balanceCheck(ship: ShipDef, data: McpData) {
  const fleet = data.ships.filter((s) => s.id !== ship.id && !ROLES_NOT_FLOWN.has(s.role));
  const peers = fleet.filter((s) => s.role === ship.role);
  const cobra = data.ships.find((s) => s.id === 'cobra-mk3');
  const lines: string[] = [];
  const table = STATS.map((k) => {
    const v = ship.stats?.[k];
    if (typeof v !== 'number') return null;
    const vals = fleet.map((s) => s.stats[k]).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
    const rank = vals.filter((x) => x < v).length;
    const pct = vals.length ? Math.round((rank / vals.length) * 100) : 50;
    const c = cobra?.stats[k];
    const vsCobra = typeof c === 'number' && c ? `${Math.round((v / c) * 100)}% of a Cobra's` : '';
    const peerVals = peers.map((s) => s.stats[k]).filter((x): x is number => typeof x === 'number');
    const peerAvg = peerVals.length ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : null;
    if (pct >= 90) lines.push(`${STAT_NAMES[k]} is among the highest in the fleet (${v}).`);
    if (pct <= 10 && k !== 'price') lines.push(`${STAT_NAMES[k]} is among the lowest in the fleet (${v}).`);
    return { stat: STAT_NAMES[k], value: v, fleetPercentile: pct, vsCobra, ...(peerAvg !== null ? { averageForRole: Math.round(peerAvg * 100) / 100 } : {}) };
  }).filter(Boolean);
  // The hold for the hull's size: the fleet carries about 1 to 1.5 t per 1,000 m3, so a dart with a freighter's hold stands out.
  const vol = (s: ShipDef) => (Array.isArray(s.geometry?.vertices) && Array.isArray(s.geometry?.faces) ? signedVolume(s.geometry.vertices, s.geometry.faces) : 0);
  const density = (s: ShipDef) => (s.stats?.cargo ?? 0) / Math.max(1, vol(s) / 1000);
  const holds = fleet.filter((s) => (s.stats?.cargo ?? 0) > 0 && vol(s) > 0).map(density);
  const cargo = ship.stats?.cargo ?? 0;
  if (cargo > 0 && holds.length && vol(ship) > 0 && density(ship) > Math.max(...holds) * 1.5) {
    const most = Math.max(...holds);
    lines.push(`Its hold (${cargo} t) is big for its size: about ${Math.round(vol(ship)).toLocaleString('en-GB')} m³ of hull, where the fleet carries at most about ${Math.round((most * vol(ship)) / 1000)} t. Make the hull bigger or the hold smaller.`);
  }
  // Trade-offs, not tiers: a ship that's better at everything is a problem.
  const strong = table.filter((t) => t && t.stat !== 'price' && t.fleetPercentile >= 75).length;
  const weak = table.filter((t) => t && t.stat !== 'price' && t.fleetPercentile <= 25).length;
  if (strong >= 4 && weak === 0) lines.push('It is better than most of the fleet at almost everything and worse at nothing: give it a real weakness (ships are trade-offs, not tiers).');
  if (weak >= 4 && strong === 0) lines.push('It is worse than most of the fleet at almost everything: what is it best at? Give it a reason to be picked.');
  if (!lines.length) lines.push('Nothing stands out as out of line. Check it against the class it is meant to be (docs/design/ships-and-classes.md, section 1).');
  return {
    comparedWith: `${fleet.length} flyable ships in the fleet; ${peers.length ? `same role (${ship.role}): ${peers.map((p) => p.name).join(', ')}` : `none share its role (${ship.role})`}`,
    notes: lines,
    stats: table,
    classes: 'Classes arrive with ships-and-classes stage 1; until then ships are compared by role. The class table (best at, worst at) is in docs/design/ships-and-classes.md.',
  };
}

// --- The galaxy --------------------------------------------------------------------

function findSystem(args: Record<string, unknown>): StarSystem | string {
  const g = Number(args.galaxy ?? 1) - 1;
  if (!(g >= 0 && g < 8)) return 'galaxy is 1 to 8.';
  const all = galaxy(g);
  if (typeof args.name === 'string' && args.name.trim()) {
    const want = args.name.trim().toLowerCase();
    const s = all.find((x) => x.name.toLowerCase() === want);
    if (s) return s;
    const close = all.filter((x) => x.name.toLowerCase().startsWith(want.slice(0, 3))).map((x) => x.name).slice(0, 8);
    return `No system called "${args.name}" in galaxy ${g + 1}.${close.length ? ` Did you mean: ${close.join(', ')}?` : ''}`;
  }
  if (typeof args.index === 'number' && args.index >= 0 && args.index < 256) return all[args.index];
  return 'Give a system name (e.g. "Lave"), or an index 0 to 255.';
}

export function systemInfo(s: StarSystem) {
  const world = worldOf(s);
  const station = stationName(s);
  return {
    name: s.name,
    galaxy: s.galaxy + 1,
    index: s.index,
    chart: { x: s.x, y: s.y },
    government: GOVERNMENTS[s.government],
    economy: ECONOMIES[s.economy],
    techLevel: s.techLevel,
    population: `${s.population.toFixed(1)} billion`,
    species: s.species,
    productivity: `${s.productivity} million credits`,
    planetRadiusKm: s.radius,
    world: describeWorld(world) || 'A plain world: no rings, no moons',
    station: station.name,
    withinSevenLightYears: systemsWithin(s, 7)
      .filter((n) => n.index !== s.index)
      .map((n) => ({ name: n.name, distanceLy: Math.round(distanceLy(s, n) * 10) / 10, government: GOVERNMENTS[n.government], economy: ECONOMIES[n.economy] }))
      .sort((a, b) => a.distanceLy - b.distanceLy),
  };
}

// --- The tools ---------------------------------------------------------------------

/** What the live viewer draws: the ship, and a Cobra beside it for scale. */
export function viewerModel(ship: ShipDef, data: McpData): ViewerModel {
  const cobra = data.ships.find((s) => s.id === 'cobra-mk3');
  const g = ship.geometry;
  return {
    name: ship.name ?? ship.id,
    color: /^#[0-9a-f]{6}$/i.test(ship.style?.lineColor ?? '') ? ship.style.lineColor : '#3dffb0',
    glow: typeof ship.style?.glow === 'number' ? ship.style.glow : 1,
    vertices: g.vertices,
    faces: g.faces,
    ...(g.details ? { details: g.details } : {}),
    ...(cobra && cobra.id !== ship.id ? { scale: { name: cobra.name, vertices: cobra.geometry.vertices, faces: cobra.geometry.faces } } : {}),
  };
}

export const TOOLS: Tool[] = [
  {
    name: 'validate_ship',
    title: 'Check a ship',
    description: 'Check a Witchspace ship file against the schema, the geometry rules (flat, convex faces; closed hull; winding) and the written rules (a maker, a reason to exist, original geometry). Returns every problem with how to fix it. Run this before showing a design to a person.',
    inputSchema: SHIP_INPUT,
    run: (args, data) => {
      const { ship, error } = shipArg(args);
      if (!ship) return text(error!, true);
      return json(validateShip(ship, data));
    },
  },
  {
    name: 'view_ship',
    title: 'Turn it round',
    description: 'Show a ship turning in 3D inside the chat, in neo glow with a Cobra Mk III beside it for scale: the person can drag it round and zoom. Pass a ship file, or the id of a fleet ship. Clients that can\'t show views get a text summary instead (use preview_ship for a picture). Show it after each change worth seeing.',
    inputSchema: {
      type: 'object',
      properties: {
        ship: SHIP_INPUT.properties.ship,
        id: { type: 'string', description: 'A fleet ship\'s id instead of a file, e.g. "cobra-mk3" (list_ships has them all).' },
      },
    },
    _meta: { ui: { resourceUri: VIEWER_URI } },
    run: (args, data) => {
      let ship: ShipDef | undefined;
      if (typeof args.id === 'string' && !args.ship) {
        ship = data.ships.find((s) => s.id === args.id);
        if (!ship) return text(`No ship "${args.id}" in the fleet: list_ships has them all.`, true);
      } else {
        const got = shipArg(args);
        if (!got.ship) return text(got.error!, true);
        ship = got.ship;
      }
      const g = ship.geometry;
      if (!Array.isArray(g?.vertices) || !Array.isArray(g?.faces) || !g.vertices.length) return text('The ship needs geometry.vertices and geometry.faces to show.', true);
      if (g.vertices.length > 2000) return text('Too many vertices to show (2,000 at most).', true);
      const zs = g.vertices.map((v) => v[2]);
      const xs = g.vertices.map((v) => v[0]);
      return {
        content: [{ type: 'text', text: `Showing ${ship.name ?? ship.id} turning in 3D: ${Math.round(Math.max(...zs) - Math.min(...zs))} m long, ${Math.round(Math.max(...xs) - Math.min(...xs))} m across, ${g.vertices.length} vertices and ${g.faces.length} faces, with a Cobra Mk III beside it for scale. The person can drag it round. (If they can't see it, their client doesn't show views: use preview_ship for a picture.)` }],
        structuredContent: viewerModel(ship, data) as unknown as Record<string, unknown>,
      };
    },
  },
  {
    name: 'preview_ship',
    title: 'Draw a ship',
    description: 'Draw a ship file as glowing wireframe in four views (three-quarter, front, side, top), with a Cobra Mk III in grey at the same scale. Returns a PNG. Use it to see the shape before and after changes.',
    inputSchema: SHIP_INPUT,
    run: async (args, data) => {
      const { ship, error } = shipArg(args);
      if (!ship) return text(error!, true);
      if (!Array.isArray(ship.geometry?.vertices) || !Array.isArray(ship.geometry?.faces)) return text('The ship needs geometry.vertices and geometry.faces to draw.', true);
      if (ship.geometry.vertices.length > 2000) return text('Too many vertices to draw (2,000 at most).', true);
      const png = await previewShip(ship, data);
      return { content: [{ type: 'image', data: base64(png), mimeType: 'image/png' }, { type: 'text', text: `${ship.name ?? ship.id}: ${ship.geometry.vertices.length} vertices, ${ship.geometry.faces.length} faces. Nose points down the page in the top view.` }] };
    },
  },
  {
    name: 'balance_check',
    title: 'Compare a ship with the fleet',
    description: "Compare a ship's stats (speed, turning, hull, shields, hold, missiles, price) with the fleet and with ships of the same role, and flag anything out of line. Ships should be trade-offs, not tiers.",
    inputSchema: SHIP_INPUT,
    run: (args, data) => {
      const { ship, error } = shipArg(args);
      if (!ship) return text(error!, true);
      if (!ship.stats) return text('The ship needs a stats block to compare.', true);
      return json(balanceCheck(ship, data));
    },
  },
  {
    name: 'list_ships',
    title: 'The fleet',
    description: 'Every ship in the game: id, name, maker, role, key stats and a one-line description. Real ships are the best examples to learn the format from.',
    inputSchema: { type: 'object', properties: {} },
    run: (_args, data) =>
      json(data.ships.map((s) => ({ id: s.id, name: s.name, manufacturer: s.manufacturer ?? null, role: s.role, maxSpeed: s.stats.maxSpeed, hull: s.stats.hull, shields: s.stats.shields, cargo: s.stats.cargo, price: s.stats.price, description: s.description }))),
  },
  {
    name: 'get_ship',
    title: 'A ship file',
    description: "A ship's whole file, by id (from list_ships).",
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The ship id, e.g. "cobra-mk3".' } }, required: ['id'] },
    run: (args, data) => {
      const s = data.ships.find((x) => x.id === args.id);
      return s ? json(s) : text(`No ship "${String(args.id)}". Ids: ${data.ships.map((x) => x.id).join(', ')}`, true);
    },
  },
  {
    name: 'designs',
    title: 'The roadmap and designs',
    description: 'Every Witchspace design document: title, status (idea, proposed, designed, building, built), pillar, summary and stages. Filter by status or pillar. Use get_design for the full text.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['idea', 'proposed', 'designed', 'building', 'built', 'guide'] },
        pillar: { type: 'string', enum: ['trade', 'fight', 'explore', 'build'] },
      },
    },
    run: (args, data) =>
      json(
        data.docs
          .filter((d) => (!args.status || d.status === args.status) && (!args.pillar || d.pillar === args.pillar))
          .map((d) => ({ slug: d.slug, title: d.title, status: d.status, pillar: d.pillar, summary: d.summary, stages: d.stages, page: `https://witchspace.org.uk/design/${d.slug}/` })),
      ),
  },
  {
    name: 'get_design',
    title: 'A design document',
    description: 'The full text of a design document, by slug (from designs), e.g. "trading", "ships-and-classes", "worldbuilding".',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    run: (args, data) => {
      const d = data.docs.find((x) => x.slug === args.slug);
      if (!d) return text(`No design "${String(args.slug)}". Slugs: ${data.docs.map((x) => x.slug).join(', ')}`, true);
      return text(`# ${d.title}\n\nStatus: ${d.status} · Pillar: ${d.pillar}\n${d.summary}\n\n${d.body}`);
    },
  },
  {
    name: 'help_wanted',
    title: 'What needs doing',
    description: 'Every open task from every design, with the skill it needs (ships, writing, art, playtest, design, code). Most need no code.',
    inputSchema: { type: 'object', properties: { skill: { type: 'string', enum: ['ships', 'writing', 'art', 'playtest', 'design', 'code'] } } },
    run: (args, data) =>
      json(
        data.docs.flatMap((d) =>
          d.help.filter((h) => !args.skill || h.skill === args.skill).map((h) => ({ task: h.task, skill: h.skill, design: d.title, page: `https://witchspace.org.uk/design/${d.slug}/` })),
        ),
      ),
  },
  {
    name: 'galaxy_system',
    title: 'A star system',
    description: 'Look up a star system by name (or index) in one of the eight galaxies: government, economy, tech level, population, species, its world (rings, moons), its station, and every system within 7 light years. Use it so stories and missions land somewhere real. Lave is in galaxy 1.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The system name, e.g. "Lave".' },
        index: { type: 'number', description: '0 to 255, instead of a name.' },
        galaxy: { type: 'number', description: '1 to 8 (default 1).' },
      },
    },
    run: (args) => {
      const s = findSystem(args);
      return typeof s === 'string' ? text(s, true) : json(systemInfo(s));
    },
  },
];

export const RESOURCES = [
  { uri: 'witchspace://agents', name: 'AGENTS.md', title: 'How AI assistants contribute to Witchspace', mimeType: 'text/markdown', read: (d: McpData) => d.texts.agents },
  { uri: 'witchspace://contributing', name: 'CONTRIBUTING.md', title: 'How to contribute', mimeType: 'text/markdown', read: (d: McpData) => d.texts.contributing },
  { uri: 'witchspace://schema/ship', name: 'ship.schema.json', title: 'The ship file schema', mimeType: 'application/schema+json', read: (d: McpData) => d.texts.schema },
  { uri: 'witchspace://design/worldbuilding', name: 'worldbuilding.md', title: 'The worldbuilding guide: tone, people, companies', mimeType: 'text/markdown', read: (d: McpData) => d.docs.find((x) => x.slug === 'worldbuilding')?.body ?? '' },
  { uri: VIEWER_URI, name: 'viewer.html', title: 'The live viewer: a ship turning in 3D (an MCP App, for view_ship)', mimeType: VIEWER_MIME, read: () => VIEWER_HTML },
  { uri: 'witchspace://lore', name: 'lore.md', title: 'The lore of Witchspace: the canon, by Trade, Fight, Explore and Build', mimeType: 'text/markdown', read: (d: McpData) => d.docs.find((x) => x.slug === 'lore')?.body ?? '' },
];
