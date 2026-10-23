import type { ShipDef, Vec3 } from '../content/types';
import { deriveEdges } from '../content/geometry';
import { distanceLy, galaxy, systemAt, type StarSystem } from '../galaxy/generate';
import { hash } from '../economy/seed';
import { worldOf } from './explore';
import { wyWorks } from './contracts';

// Wexley-Yorozu yards (docs/design/companies-and-contracts.md, 4b): the
// Titanoboa constructor parked by a moon, building a station from it. Which
// worlds have a yard, and how far each build has got, come from the galaxy's
// seed and the clock, so every commander sees the same yard at the same stage
// with no server. When a build finishes, the constructor moves on to another
// site and starts again, so yards come and go.
//
// Modern rules only; Classic stays as it was in 1984.

/** Yards at work in each galaxy at once: one per constructor. */
export const YARDS_PER_GALAXY = 5;

const DAY = 86_400_000;

export type YardStage = 'refining' | 'spine' | 'frame' | 'plating' | 'spin-up' | 'finished';

/**
 * A build, in order. The constructor refines first (no station yet), then the
 * spine goes up, the frame around it, the plating, and the slow spin-up; the
 * finished station turns beside it for a day before the Titanoboa leaves.
 */
export const STAGES: { stage: YardStage; name: string; days: number; news: string }[] = [
  { stage: 'refining', name: 'not begun', days: 1, news: 'the Titanoboa has arrived and lit its smelters' },
  { stage: 'spine', name: 'bare spine', days: 2, news: 'the spine of a new station is going up' },
  { stage: 'frame', name: 'frame', days: 3, news: 'the frame of a new station is rising by the moon' },
  { stage: 'plating', name: 'half-plated', days: 4, news: 'a new station is being plated, section by section' },
  { stage: 'spin-up', name: 'spinning up', days: 2, news: 'a new station is spinning up' },
  { stage: 'finished', name: 'finished', days: 1, news: 'a new station is finished; the Titanoboa leaves soon' },
];

/** How long a build takes, and the constructor's passage to the next site. */
export const BUILD_TIME = STAGES.reduce((t, s) => t + s.days, 0) * DAY;
export const TRANSIT_TIME = 2 * DAY;
const CYCLE = BUILD_TIME + TRANSIT_TIME;

/** Where the clock starts counting builds. Any fixed moment will do. */
const EPOCH = Date.UTC(2026, 9, 1);

export interface Yard {
  galaxy: number;
  system: number;
  /** Which of the world's moons it's quarrying. */
  moon: number;
  /** Which constructor (0..YARDS_PER_GALAXY-1), and which of its builds. */
  slot: number;
  build: number;
  start: number;
  end: number;
  stage: YardStage;
  /** How far through the current stage, 0..1. */
  progress: number;
}

// The sites, dealt out between the constructors so two never pick the same world.
const sitesCache = new Map<number, StarSystem[][]>();
function sites(g: number): StarSystem[][] {
  const hit = sitesCache.get(g);
  if (hit) return hit;
  const out: StarSystem[][] = Array.from({ length: YARDS_PER_GALAXY }, () => []);
  for (const s of galaxy(g)) if (wyWorks(s) && worldOf(s).moons.length) out[Math.floor(hash(s, 900, 0) * YARDS_PER_GALAXY)].push(s);
  sitesCache.set(g, out);
  return out;
}

/** Every world a yard can go to: Wexley-Yorozu worlds with a moon to quarry. */
export const yardSites = (g: number): StarSystem[] => sites(g).flat();

/** Each constructor starts its builds at its own point in the cycle, staggered so they don't all finish together. */
function offset(g: number, slot: number): number {
  return ((slot + hash(systemAt(g, 0), 901, slot) * 0.8) / YARDS_PER_GALAXY) * CYCLE;
}

/** Where a constructor's nth build is: never the world it just left. */
function siteOf(g: number, slot: number, build: number): StarSystem | null {
  const list = sites(g)[slot];
  if (!list.length) return null;
  const seed = systemAt(g, 0);
  const at = (n: number) => Math.floor(hash(seed, 902 + slot, n) * list.length);
  let i = at(build);
  if (list.length > 1 && i === at(build - 1)) i = (i + 1) % list.length;
  return list[i];
}

/** A constructor's build under way at time `t`, or null while it's in transit. */
function buildAt(g: number, slot: number, t: number): Yard | null {
  const since = t - EPOCH - offset(g, slot);
  const build = Math.floor(since / CYCLE);
  const into = since - build * CYCLE;
  if (into >= BUILD_TIME) return null;
  const s = siteOf(g, slot, build);
  if (!s) return null;
  let left = into;
  let stage = STAGES[0];
  for (stage of STAGES) {
    if (left < stage.days * DAY) break;
    left -= stage.days * DAY;
  }
  const start = EPOCH + offset(g, slot) + build * CYCLE;
  const moons = worldOf(s).moons.length;
  return {
    galaxy: g,
    system: s.index,
    moon: Math.floor(hash(s, 903, build & 0xffff) * moons) % moons,
    slot,
    build,
    start,
    end: start + BUILD_TIME,
    stage: stage.stage,
    progress: Math.min(1, left / (stage.days * DAY)),
  };
}

/** The yards at work in a galaxy at time `t`. */
export function yardsOf(g: number, t: number): Yard[] {
  const out: Yard[] = [];
  for (let slot = 0; slot < YARDS_PER_GALAXY; slot++) {
    const y = buildAt(g, slot, t);
    if (y) out.push(y);
  }
  return out;
}

/** The yard at a system at time `t`, if there is one. */
export const yardAt = (s: StarSystem, t: number): Yard | null => yardsOf(s.galaxy, t).find((y) => y.system === s.index) ?? null;

export const stageInfo = (stage: YardStage) => STAGES.find((s) => s.stage === stage)!;

/** For the HUD: "Station: frame". */
export const stageLabel = (y: Yard) => `Station: ${stageInfo(y.stage).name}`;

/** Yards within news range of a system, nearest first. */
export function yardsNear(here: StarSystem, t: number, range = 25): { yard: Yard; where: StarSystem; distance: number }[] {
  return yardsOf(here.galaxy, t)
    .map((yard) => {
      const where = systemAt(here.galaxy, yard.system);
      return { yard, where, distance: distanceLy(here, where) };
    })
    .filter((n) => n.distance <= range)
    .sort((a, b) => a.distance - b.distance);
}

/** How fast the station turns: still until spin-up, then easing up to its working spin. */
export function stationSpin(y: Yard, full: number): number {
  if (y.stage === 'finished') return full;
  if (y.stage !== 'spin-up') return 0;
  return full * y.progress;
}

// --- The station in its stages --------------------------------------------------------

/** The docking axis: the station's backbone, and the first thing built. */
const SPINE: { vertices: Vec3[]; faces: number[][] } = (() => {
  const box = (x: number, y: number, z0: number, z1: number, base: number) => ({
    vertices: [[x, y, z0], [-x, y, z0], [-x, -y, z0], [x, -y, z0], [x, y, z1], [-x, y, z1], [-x, -y, z1], [x, -y, z1]] as Vec3[],
    faces: [[3, 2, 1, 0], [4, 5, 6, 7], [1, 5, 4, 0], [2, 6, 5, 1], [3, 7, 6, 2], [0, 4, 7, 3]].map((f) => f.map((i) => i + base)),
  });
  // The axis itself, and the collar that will frame the slot.
  const axis = box(12, 12, -84, 72, 0);
  const collar = box(50, 18, 72, 80, 8);
  return { vertices: [...axis.vertices, ...collar.vertices], faces: [...axis.faces, ...collar.faces] };
})();

/** Bare girders, pale steel, so the station's own plates stand out as they go on. */
const SCAFFOLD_COLOUR = '#bfe3ff';

/**
 * The order the hull goes on, faces of the Coriolis by index: the back first,
 * then the sides, then the front around the slot, so a half-built station is
 * closed behind and open in front, and you can see in to the spine.
 */
const PLATING_ORDER = [5, 10, 11, 12, 13, 0, 1, 2, 3, 6, 7, 8, 9];

/**
 * The station as it stands at a stage, made from the finished station's own
 * geometry: the spine alone, then its scaffold (the hull's edges and four
 * spokes in to the spine, in bare steel), then plated a face at a
 * time as the stage goes on, then the whole hull for spin-up. Null before anything is built.
 */
export function stationAtStage(station: ShipDef, stage: YardStage, progress = 0.5): ShipDef | null {
  if (stage === 'refining') return null;
  if (stage === 'spin-up' || stage === 'finished') return station;
  const { vertices, faces } = station.geometry;
  const n = SPINE.vertices.length;
  const count = stage === 'plating' ? Math.max(1, Math.min(PLATING_ORDER.length - 1, Math.ceil(progress * (PLATING_ORDER.length - 1)))) : 0;
  const platedFaces = PLATING_ORDER.slice(0, count).map((i) => faces[i]);
  // The scaffold, in bare steel: every edge of the hull not yet
  // plated over, and four spokes in to the spine like a wheel's.
  const covered = new Set(deriveEdges(platedFaces).map(([a, b]) => `${a}-${b}`));
  const scaffold: { vertices: Vec3[]; lines: [number, number][] } = {
    vertices: [...vertices],
    lines: deriveEdges(faces).filter(([a, b]) => !covered.has(`${a}-${b}`)),
  };
  if (stage !== 'spine') {
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const at = scaffold.vertices.length;
      scaffold.vertices.push([x * 80, y * 80, 0], [x * 12, y * 12, 0]);
      scaffold.lines.push([at, at + 1]);
    }
  }
  return {
    ...station,
    id: `${station.id}-${stage}`,
    geometry: {
      vertices: [...SPINE.vertices, ...vertices],
      faces: [...SPINE.faces, ...platedFaces.map((f) => f.map((k) => k + n))],
    },
    insignia: stage === 'spine' ? undefined : { color: SCAFFOLD_COLOUR, ...scaffold },
  };
}
