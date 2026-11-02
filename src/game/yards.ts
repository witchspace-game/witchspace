import type { ShipDef, Vec3 } from '../content/types';
import { deriveEdges } from '../content/geometry';
import { distanceLy, galaxy, systemAt, type StarSystem } from '../galaxy/generate';
import { hash } from '../economy/seed';
import { worldOf } from './explore';
import { wyWorks } from './contracts';

// Wexley-Yorozu yards (docs/design/companies-and-contracts.md, 4b): the
// Titanoboa constructor, assembled from modules by a moon, building a station
// from it (docs/design/ship-the-titanoboa.md). Which
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
 * finished station turns beside it for a day before the Titanoboa comes apart
 * and its modules are towed to the next site.
 */
export const STAGES: { stage: YardStage; name: string; days: number; news: string }[] = [
  { stage: 'refining', name: 'not begun', days: 1, news: 'the Titan has been assembled by the moon and lit its furnaces' },
  { stage: 'spine', name: 'bare spine', days: 2, news: 'the spine of a new station is going up' },
  { stage: 'frame', name: 'frame', days: 3, news: 'the frame of a new station is rising by the moon' },
  { stage: 'plating', name: 'half-plated', days: 4, news: 'a new station is being plated, section by section' },
  { stage: 'spin-up', name: 'spinning up', days: 2, news: 'a new station is spinning up' },
  { stage: 'finished', name: 'finished', days: 1, news: 'a new station is finished; the Titan is coming apart' },
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
  const { stage, progress } = stageAt(into);
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
    stage,
    progress,
  };
}

/** Where a build stands `into` ms after it started. */
function stageAt(into: number): { stage: YardStage; progress: number } {
  let left = Math.max(0, into);
  let stage = STAGES[0];
  for (stage of STAGES) {
    if (left < stage.days * DAY) break;
    left -= stage.days * DAY;
  }
  return { stage: stage.stage, progress: Math.min(1, left / (stage.days * DAY)) };
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

// --- Falling behind (docs/design/the-world.md, step 5) ---------------------------------
//
// A Wexley-Yorozu trader bound for the Titan, lost on the way, puts the stage
// she was supplying behind. Solo, the losses are kept in your save, so only your
// view of the yard falls behind; everyone else's stays on the clock.

/** A Titan supply ship that never arrived. */
export interface YardLoss {
  galaxy: number;
  system: number;
  /** Which build she was supplying. */
  build: number;
  /** When she was lost. */
  at: number;
  tonnes: number;
  ship: string;
  /** Her voyage, so she doesn't fly again. */
  voyage: string;
}

/** Time lost per tonne that never arrived: a Cobra's 20 t is about two hours. */
export const BEHIND_PER_TONNE = 6 * 60_000;
/** Below this a yard isn't worth calling behind. */
const BEHIND_SHOWN = 30 * 60_000;

/**
 * A build as it stands with its losses: each loss sets back the stage it was
 * supplying, no stage by more than its own length (a build can stall, never
 * stop), and the whole build by no more than the constructor's passage to the
 * next site, so the next build still starts on time.
 */
export function withLosses(y: Yard, losses: readonly YardLoss[], t: number): Yard & { behind: number } {
  let behind = 0;
  const per = new Map<YardStage, number>();
  for (const l of losses.filter((l) => l.galaxy === y.galaxy && l.system === y.system && l.build === y.build && l.at <= t).sort((a, b) => a.at - b.at)) {
    const { stage } = stageAt(l.at - y.start - behind);
    const room = stageInfo(stage).days * DAY - (per.get(stage) ?? 0);
    const add = Math.max(0, Math.min(l.tonnes * BEHIND_PER_TONNE, room, TRANSIT_TIME - behind));
    per.set(stage, (per.get(stage) ?? 0) + add);
    behind += add;
  }
  return behind ? { ...y, ...stageAt(t - y.start - behind), end: y.end + behind, behind } : { ...y, behind };
}

/** The yard at a system at `t` with your losses: behind, and perhaps still at work after the clock's build has ended. */
export function yardSeen(s: StarSystem, t: number, losses: readonly YardLoss[] = []): (Yard & { behind: number }) | null {
  const y = yardAt(s, t);
  if (y) return withLosses(y, losses, t);
  const last = losses.filter((l) => l.galaxy === s.galaxy && l.system === s.index).sort((a, b) => b.at - a.at)[0];
  const then = last && yardAt(s, last.at);
  if (!then || then.build !== last.build) return null;
  const late = withLosses(then, losses, t);
  return t < late.end ? late : null;
}

/** "6 h behind", or nothing while it's near enough on time. */
export function behindLabel(behind: number): string {
  if (behind < BEHIND_SHOWN) return '';
  const h = Math.round(behind / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h behind` : `${Math.max(1, h)} h behind`;
}

const WORK: Record<YardStage, string> = { refining: 'the refining', spine: 'the spine', frame: 'the frame', plating: 'the plating', 'spin-up': 'the spin-up', finished: 'the handover' };
const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The yard in the news: on schedule, or behind and why. */
export function yardNews(y: Yard & { behind?: number }, losses: readonly YardLoss[] = [], now: number): string {
  if (!behindLabel(y.behind ?? 0)) return stageInfo(y.stage).news;
  const n = losses.filter((l) => l.galaxy === y.galaxy && l.system === y.system && l.build === y.build && l.at > now - 7 * DAY).length;
  if (!n) return `${WORK[y.stage]} is ${behindLabel(y.behind ?? 0)}`;
  return `${WORK[y.stage]} has fallen behind, ${COUNT[n] ?? n} supply ship${n === 1 ? '' : 's'} lost this week`;
}

/** How far through the whole build, and how much of it was lost: shares of the build, for a bar. */
export function buildBar(y: Yard & { behind?: number }, t: number): { done: number; lost: number } {
  const done = Math.max(0, Math.min(1, (t - y.start - (y.behind ?? 0)) / BUILD_TIME));
  return { done, lost: Math.min(1 - done, (y.behind ?? 0) / BUILD_TIME) };
}

/** Losses worth keeping: any whose build could still be running. */
export const keepLosses = (losses: readonly YardLoss[], now: number): YardLoss[] => losses.filter((l) => l.at > now - CYCLE);

/** The Titanoboa's modules, fore to aft: a station's worth of work. */
export const STANDARD_LINE_UP = ['maw', 'furnace', 'furnace', 'hold', 'habitat', 'fabricator', 'reactor'];
/** With a science module between the fabricator and the reactor, for whatever was found living there. */
export const SCIENCE_LINE_UP = ['maw', 'furnace', 'furnace', 'hold', 'habitat', 'fabricator', 'science', 'reactor'];

/**
 * A module from the community in service (game/commissions.ts): from `from` (ms),
 * a share of new builds carry it, in place of the module it `replaces` or, if it
 * replaces nothing, added at its zone's place in the line-up.
 */
export interface InService {
  id: string;
  zone: string;
  from: number;
  replaces?: string;
  share: number;
}

/** Zones, prow to stern (src/content/modules.ts has the same list). */
const ZONE_ORDER = ['intake', 'industry', 'logistics', 'crew', 'fabrication', 'add-on', 'power'];
/** The zone of each core module, for placing an added module after the ones before it. */
const CORE_ZONES: Record<string, string> = { maw: 'intake', furnace: 'industry', hold: 'logistics', habitat: 'crew', fabricator: 'fabrication', science: 'add-on', reactor: 'power' };

/**
 * Which line-up a build uses: about one in three carries a science module, and
 * community modules in service when it began take their share. Same for everyone.
 */
export function lineUpOf(y: Yard, extras: readonly InService[] = []): string[] {
  const seed = systemAt(y.galaxy, y.system);
  const line = [...(hash(seed, 905, y.build & 0xffff) < 1 / 3 ? SCIENCE_LINE_UP : STANDARD_LINE_UP)];
  const zones = new Map(Object.entries(CORE_ZONES));
  for (const m of extras) {
    if (y.start < m.from || hash(seed, 906 + saltOf(m.id), y.build & 0xffff) >= m.share) continue;
    zones.set(m.id, m.zone);
    if (m.replaces) {
      const i = line.indexOf(m.replaces);
      if (i >= 0) line[i] = m.id;
      continue;
    }
    // Added: after the last module of its zone or an earlier one.
    const rank = (id: string) => ZONE_ORDER.indexOf(zones.get(id) ?? 'add-on');
    let at = 0;
    line.forEach((id, i) => {
      if (rank(id) <= rank(m.id)) at = i + 1;
    });
    line.splice(at, 0, m.id);
  }
  return line;
}

/** A small number from a module's id, so each community module rolls its own dice. */
const saltOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);

/**
 * The next `limit` builds of each of a galaxy's constructors that start at or
 * after `t`, in order of starting: for finding when a module was first fitted.
 */
export function buildsFrom(g: number, t: number, limit: number): Yard[] {
  const out: Yard[] = [];
  for (let slot = 0; slot < YARDS_PER_GALAXY; slot++) {
    const first = Math.max(0, Math.ceil((t - EPOCH - offset(g, slot)) / CYCLE));
    for (let build = first; build < first + limit; build++) {
      const y = buildAt(g, slot, EPOCH + offset(g, slot) + build * CYCLE + 1); // a moment in, clear of rounding
      if (y) out.push(y);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export const stageInfo = (stage: YardStage) => STAGES.find((s) => s.stage === stage)!;

/** For the HUD: "Station: frame". */
export const stageLabel = (y: Yard & { behind?: number }) => [`Station: ${stageInfo(y.stage).name}`, behindLabel(y.behind ?? 0)].filter(Boolean).join(' · ');

/** Yards within news range of a system, nearest first. */
export function yardsNear(here: StarSystem, t: number, range = 25, losses: readonly YardLoss[] = []): { yard: Yard & { behind?: number }; where: StarSystem; distance: number }[] {
  const yards: (Yard & { behind?: number })[] = yardsOf(here.galaxy, t).map((y) => withLosses(y, losses, t));
  // A build your losses kept going past the clock's end.
  for (const i of new Set(losses.filter((l) => l.galaxy === here.galaxy).map((l) => l.system))) {
    if (yards.some((y) => y.system === i)) continue;
    const late = yardSeen(systemAt(here.galaxy, i), t, losses);
    if (late) yards.push(late);
  }
  return yards
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
