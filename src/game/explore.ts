// Exploring: worlds worth visiting, surveys that sell, places worth finding,
// and a record of where you've been. Everything here comes from each system's
// seed, so every commander finds the same rings, moons and derelicts in the
// same places, alone or in shared space. See docs/ideas.md#exploration.
//
// The rules (Modern only, as they pay):
//   - Fly close to a body and hold there: the survey fills, and the data goes
//     in your hold. Planets want a low orbit, moons a close pass, and the star
//     a hot one.
//   - Sell survey data at any station. It's worth more the further you carry
//     it from where it was gathered.
//   - Surveying the planet picks up any signals in the system (derelicts,
//     beacons, wreck fields); fly to one to discover it. Derelicts may still
//     have cargo aboard.
//   - Visits, surveys and discoveries earn explorer points and an explorer's
//     rank, separate from the combat rating.

import { distanceLy, systemAt, type StarSystem } from '../galaxy/generate';
import type { Commander } from './commander';

// --- Seeded numbers ---------------------------------------------------------------

/** A stable number in [0, 1) for a system, a purpose and an index. */
function roll(sys: StarSystem, salt: number, index = 0): number {
  const [a, b, c, d] = sys.extraSeed;
  let h = (sys.galaxy * 0x9e3779b1) ^ (sys.index * 0x85ebca6b) ^ (a << 24) ^ (b << 16) ^ (c << 8) ^ d ^ (salt * 0xc2b2ae35) ^ (index * 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length];

// --- Worlds ----------------------------------------------------------------------

export interface Moon {
  /** As a fraction of the planet's radius. */
  size: number;
  /** Orbit radius, in planet radii from its centre. */
  orbit: number;
  /** Where on its orbit (radians), and the orbit's tilt. */
  angle: number;
  tilt: number;
}

export interface World {
  /** Inner and outer edges in planet radii, and the ring plane's tilt; null for no rings. */
  rings: { inner: number; outer: number; tiltX: number; tiltZ: number } | null;
  moons: Moon[];
}

const MOON_ORDINALS = ['I', 'II', 'III'];

/** What a system's planet looks like: rings for about one in eight, and up to two moons. */
export function worldOf(sys: StarSystem): World {
  const rings =
    roll(sys, 1) < 0.13
      ? { inner: 1.35 + roll(sys, 2) * 0.25, outer: 1.9 + roll(sys, 3) * 0.6, tiltX: (roll(sys, 4) - 0.5) * 0.9, tiltZ: (roll(sys, 5) - 0.5) * 0.9 }
      : null;
  const r = roll(sys, 6);
  const count = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
  const moons: Moon[] = [];
  for (let i = 0; i < count; i++) {
    moons.push({
      size: 0.12 + roll(sys, 7, i) * 0.16,
      // Clear of the rings, and of each other.
      orbit: 3.2 + i * 1.6 + roll(sys, 8, i) * 0.8,
      angle: roll(sys, 9, i) * Math.PI * 2,
      tilt: (roll(sys, 10, i) - 0.5) * 0.6,
    });
  }
  return { rings, moons };
}

/** "Ringed world · two moons", or '' for a plain one. */
export function describeWorld(w: World): string {
  const parts: string[] = [];
  if (w.rings) parts.push('Ringed world');
  if (w.moons.length) parts.push(w.moons.length === 1 ? 'one moon' : 'two moons');
  const s = parts.join(' · ');
  return s && s[0].toUpperCase() + s.slice(1);
}

// --- Bodies and surveys -------------------------------------------------------------

export type BodyKind = 'planet' | 'moon' | 'star';

export interface Body {
  /** 'planet', 'star', 'moon0', 'moon1'. */
  id: string;
  kind: BodyKind;
  name: string;
  /** Credits the data fetches where it was gathered; more elsewhere (see dataValue). */
  value: number;
  /** Seconds in range to complete a survey. */
  time: number;
}

export const SURVEY = {
  planet: { value: 45, time: 18, altitude: 0.6, points: 3 }, // altitude in planet radii
  moon: { value: 30, time: 12, altitude: 2.5, points: 2 }, // in moon radii
  star: { value: 80, time: 15, altitude: 1.6, points: 4 }, // in star radii: the cabin will be warm
} as const;

export function bodiesOf(sys: StarSystem): Body[] {
  const w = worldOf(sys);
  return [
    { id: 'planet', kind: 'planet', name: sys.name, value: SURVEY.planet.value + (w.rings ? 25 : 0), time: SURVEY.planet.time },
    { id: 'star', kind: 'star', name: `${sys.name}’s star`, value: SURVEY.star.value, time: SURVEY.star.time },
    ...w.moons.map((_, i): Body => ({ id: `moon${i}`, kind: 'moon', name: `${sys.name} ${MOON_ORDINALS[i]}`, value: SURVEY.moon.value, time: SURVEY.moon.time })),
  ];
}

// --- Points of interest -----------------------------------------------------------

export type PoiKind = 'derelict' | 'beacon' | 'wrecks';

export interface Poi {
  /** 'poi0', 'poi1'. */
  id: string;
  kind: PoiKind;
  name: string;
  /** Unit direction from the planet's centre, and distance in planet radii. */
  direction: [number, number, number];
  distance: number;
  /** For derelicts and wreck fields: the ship type, as a content id. */
  ship?: string;
  /** What's left aboard, as cargo canisters. */
  salvage: { id: string; qty: number }[];
  /** What you find: a few lines, ours (no original prose). */
  log: string;
}

const HULLS = [
  { id: 'cobra-mk3', name: 'Cobra Mk III' },
  { id: 'sidewinder', name: 'Sidewinder' },
  { id: 'mamba', name: 'Mamba' },
  { id: 'viper', name: 'Viper' },
];
const SHIP_NAMES = ['Long Odds', 'Quiet Margin', 'Second Wind', 'Halcyon', 'Persistence', 'Lucky Strike', 'Mother’s Ruin', 'Far Horizon', 'Brass Neck', 'Last Orders', 'Night Heron', 'Small Hours'];
const SALVAGE = ['food', 'textiles', 'liquor', 'machinery', 'alloys', 'computers', 'luxuries', 'minerals', 'radioactives', 'gold', 'platinum', 'gems', 'medicine'];

interface LogContext {
  ship: string;
  sys: string;
  near: string;
}

const DERELICT_LOGS: ((t: LogContext) => string)[] = [
  (t: LogContext) => `Last entry: “Drive’s dead. Life support on reserve. If anyone finds this, the cargo’s yours, just tell them in ${t.near} we made it this far.”`,
  (t: LogContext) => `The ${t.ship}’s log stops mid-sentence, three days out of ${t.near}. The hold is sealed. The escape pod is gone.`,
  () => `Scorch marks along the hull, and none of them from a pulse laser. Whoever did this to her didn’t bother taking the cargo.`,
  (t: LogContext) => `“Pirates off ${t.sys}. We’ve cut everything and gone dark. If they don’t see us, we run for ${t.near} at first light.” They never did.`,
  () => `No damage you can see. The airlock is open, both doors. The navigation computer has a course laid in for somewhere it can’t name.`,
  () => `A trader, by the fittings. The manifest is in order; the crew list has been scratched out by hand, one name at a time.`,
];
const BEACON_LOGS: ((t: LogContext) => string)[] = [
  (t: LogContext) => `An old survey beacon, still transmitting: a star chart of ${t.sys} from before the station was built, and a warning about the gravity well that is no longer true.`,
  () => `A distress beacon, its battery nearly gone, repeating a call for help in a voice that has been dead for longer than you’ve been flying.`,
  (t: LogContext) => `A nav buoy from a route nobody flies any more: ${t.sys} to ${t.near}, marked SAFE, with the date rubbed out.`,
  () => `A memorial beacon. Forty names, a ship’s crest, and one line: “They held the lane.”`,
  () => `A beacon that answers your hail by name. It shouldn’t know your name.`,
];
const WRECK_LOGS: ((t: LogContext) => string)[] = [
  () => `A convoy, or what’s left of one. The ships went down together, close enough to touch. Some of the cargo is still drifting with them.`,
  () => `A battlefield nobody wrote about. Police hulls among the traders’; whatever they were all fighting left nothing behind.`,
  (t: LogContext) => `A scrapyard that was never finished: hulls tethered for breaking, and the breakers long gone home to ${t.near}.`,
];

/** The signals in a system: none in about half of them, one in most of the rest, two in a few. */
export function poisOf(sys: StarSystem): Poi[] {
  const r = roll(sys, 20);
  const count = r < 0.5 ? 0 : r < 0.9 ? 1 : 2;
  const neighbours = [...Array(256).keys()].map((i) => systemAt(sys.galaxy, i)).filter((s) => s !== sys).sort((a, b) => distanceLy(sys, a) - distanceLy(sys, b));
  const out: Poi[] = [];
  for (let i = 0; i < count; i++) {
    const kr = roll(sys, 21, i);
    const kind: PoiKind = kr < 0.5 ? 'derelict' : kr < 0.8 ? 'beacon' : 'wrecks';
    // Somewhere around the planet, not too far above or below its equator.
    const lon = roll(sys, 22, i) * Math.PI * 2;
    const lat = (roll(sys, 23, i) - 0.5) * 0.8;
    const direction: [number, number, number] = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    const distance = 2.5 + roll(sys, 24, i) * 3;
    const near = pick(neighbours.slice(0, 4), roll(sys, 25, i)).name;
    const hull = pick(HULLS, roll(sys, 26, i));
    const salvage: { id: string; qty: number }[] = [];
    if (kind !== 'beacon') {
      const n = 1 + Math.floor(roll(sys, 27, i) * (kind === 'wrecks' ? 4 : 3));
      for (let k = 0; k < n; k++) salvage.push({ id: pick(SALVAGE, roll(sys, 28, i * 8 + k)), qty: 1 });
    }
    let name: string;
    let log: string;
    if (kind === 'derelict') {
      const shipName = pick(SHIP_NAMES, roll(sys, 29, i));
      name = `Derelict ${hull.name} “${shipName}”`;
      log = pick(DERELICT_LOGS, roll(sys, 30, i))({ ship: `“${shipName}”`, sys: sys.name, near });
    } else if (kind === 'beacon') {
      name = 'Old beacon';
      log = pick(BEACON_LOGS, roll(sys, 30, i))({ ship: '', sys: sys.name, near });
    } else {
      name = 'Wreck field';
      log = pick(WRECK_LOGS, roll(sys, 30, i))({ ship: hull.name, sys: sys.name, near });
    }
    out.push({ id: `poi${i}`, kind, name, direction, distance, ...(kind !== 'beacon' ? { ship: hull.id } : {}), salvage, log });
  }
  return out;
}

// --- The explorer's record ----------------------------------------------------------

export interface SurveyData {
  galaxy: number;
  system: number;
  body: string;
  name: string;
  value: number;
}

export interface ExploreRecord {
  /** Systems visited, "galaxy:index". */
  visited: string[];
  /** Bodies surveyed, "galaxy:index:body". */
  surveyed: string[];
  /** Points of interest discovered, "galaxy:index:poiN". */
  found: string[];
  /** Survey data in the hold, waiting to be sold. */
  data: SurveyData[];
  points: number;
  /** Credits earned from data, for the record. */
  earned: number;
}

export const POINTS = { visit: 1, discovery: 5 } as const;

export function exploreOf(c: Commander): ExploreRecord {
  c.explore ??= { visited: [], surveyed: [], found: [], data: [], points: 0, earned: 0 };
  return c.explore;
}

const sysKey = (s: StarSystem) => `${s.galaxy}:${s.index}`;
export const hasVisited = (c: Commander, s: StarSystem) => exploreOf(c).visited.includes(sysKey(s));
export const isSurveyed = (c: Commander, s: StarSystem, body: string) => exploreOf(c).surveyed.includes(`${sysKey(s)}:${body}`);
export const isFound = (c: Commander, s: StarSystem, poi: string) => exploreOf(c).found.includes(`${sysKey(s)}:${poi}`);

/** Arrive in a system. Returns true if it's your first visit. */
export function recordVisit(c: Commander, s: StarSystem): boolean {
  const e = exploreOf(c);
  if (e.visited.includes(sysKey(s))) return false;
  e.visited.push(sysKey(s));
  e.points += POINTS.visit;
  return true;
}

/** A finished survey: the data goes in the hold. */
export function recordSurvey(c: Commander, s: StarSystem, body: Body) {
  const e = exploreOf(c);
  const key = `${sysKey(s)}:${body.id}`;
  if (e.surveyed.includes(key)) return;
  e.surveyed.push(key);
  e.points += SURVEY[body.kind].points;
  e.data.push({ galaxy: s.galaxy, system: s.index, body: body.id, name: body.name, value: body.value });
}

/** A signal found: its log goes in the hold as data too. */
export function recordDiscovery(c: Commander, s: StarSystem, poi: Poi) {
  const e = exploreOf(c);
  const key = `${sysKey(s)}:${poi.id}`;
  if (e.found.includes(key)) return;
  e.found.push(key);
  e.points += POINTS.discovery;
  e.data.push({ galaxy: s.galaxy, system: s.index, body: poi.id, name: poi.name, value: poi.kind === 'beacon' ? 60 : 50 });
}

/** What a survey fetches at a station: half where it was gathered, rising with distance, up to five times. */
export function dataValue(d: SurveyData, here: StarSystem): number {
  const ly = d.galaxy === here.galaxy ? distanceLy(systemAt(d.galaxy, d.system), here) : 60;
  return Math.round(d.value * Math.min(5, 0.5 + ly / 8));
}

/** Sell all the data in the hold. Returns the credits earned. */
export function sellData(c: Commander, here: StarSystem): number {
  const e = exploreOf(c);
  const total = e.data.reduce((sum, d) => sum + dataValue(d, here), 0);
  c.credits += total;
  e.earned += total;
  e.data = [];
  return total;
}

// --- Explorer's rank ----------------------------------------------------------------

export const EXPLORER_RANKS: [number, string][] = [
  [0, 'Homebody'],
  [5, 'Tourist'],
  [15, 'Wanderer'],
  [40, 'Surveyor'],
  [100, 'Pathfinder'],
  [250, 'Trailblazer'],
  [600, 'Pioneer'],
  [1500, 'Elite'],
];

export function explorerRank(points: number): string {
  let rank = EXPLORER_RANKS[0][1];
  for (const [min, name] of EXPLORER_RANKS) if (points >= min) rank = name;
  return rank;
}
