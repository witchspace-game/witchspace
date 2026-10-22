// Exploring: worlds worth visiting, surveys that sell, places worth finding,
// and a record of where you've been. Everything here comes from each system's
// seed, so every commander finds the same rings, moons and derelicts in the
// same places, alone or in shared space. See docs/design/exploration.md.
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
//   - Moons are graded for terraforming; a Candidate's data is worth more.
//   - Trails: a log that points to the next system, and the next, to an end
//     worth the trip.

import { distanceLy, systemAt, systemsWithin, type StarSystem } from '../galaxy/generate';
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

/** What Wexley-Yorozu makes of a moon: worth terraforming, or not. */
export type MoonGrade = 'Barren' | 'Marginal' | 'Candidate';
/** A terraforming Candidate's data is worth this many times a plain moon's. */
export const CANDIDATE_VALUE = 4;

/** Graded from the seed: about one moon in six is a Candidate, bigger moons more often. */
export function moonGrade(sys: StarSystem, i: number, size: number): MoonGrade {
  const bonus = ((size - 0.12) / 0.16) * 0.12;
  const r = roll(sys, 40, i);
  return r < 0.11 + bonus ? 'Candidate' : r < 0.44 + bonus ? 'Marginal' : 'Barren';
}

export interface Body {
  /** 'planet', 'star', 'moon0', 'moon1'. */
  id: string;
  kind: BodyKind;
  name: string;
  /** Credits the data fetches where it was gathered; more elsewhere (see dataValue). */
  value: number;
  /** Seconds in range to complete a survey. */
  time: number;
  /** Moons: the terraforming grade, which the survey reveals. */
  grade?: MoonGrade;
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
    ...w.moons.map((m, i): Body => {
      const grade = moonGrade(sys, i, m.size);
      return { id: `moon${i}`, kind: 'moon', name: `${sys.name} ${MOON_ORDINALS[i]}`, value: SURVEY.moon.value * (grade === 'Candidate' ? CANDIDATE_VALUE : 1), time: SURVEY.moon.time, grade };
    }),
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
  /** A step on a trail: which, and where the clue points next. */
  trail?: { id: string; step: number; last: boolean; next?: number };
  /** What its data fetches where found, if not the usual. */
  dataValue?: number;
  /** A report you choose who to give (the Ninefold report). */
  report?: 'ninefold';
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

// --- Trails ------------------------------------------------------------------------
// Sixteen a galaxy, each three to five systems a jump apart. The first step is
// a signal in its starting system; each later one appears once you've found
// the one before. Finding a step plots your course to the next.

export const TRAILS_PER_GALAXY = 16;
export const TRAIL_END_POINTS = 25;

type StoryId = 'colony' | 'home' | 'survey' | 'debt';

interface Story {
  title: string;
  /** Opening, middle steps (in turn), and the end. Each a kind, a name and a log. */
  steps: { first: Step; middle: Step[]; last: Step };
  end: { salvage: { id: string; qty: number }[]; value: number; report?: 'ninefold' };
}
interface Step {
  kind: PoiKind;
  ship?: string;
  name: string;
  log: (t: { here: string; next: string; first: string }) => string;
}

const STORIES: Record<StoryId, Story> = {
  colony: {
    title: 'The colony that stopped answering',
    steps: {
      first: { kind: 'beacon', name: 'Wexley-Yorozu relay beacon', log: (t) => `Still repeating its last packet: colony ship Ninefold, outbound for ${t.next}. All well. All well. All well. The timestamp is eleven years old.` },
      middle: [
        { kind: 'derelict', ship: 'cobra-mk3', name: 'Survey tender “Patience”', log: (t) => `Powered down neatly, as if the crew meant to come back. Last course laid in: ${t.next}. The manifest lists “atmosphere seed, class 4”, and nothing else.` },
        { kind: 'derelict', ship: 'sidewinder', name: 'Colony tug “Hold Fast”', log: (t) => `The tow cable is cut clean. The pilot’s last entry: “Ninefold called for a tow at ${t.next}. We were told not to answer. I answered.”` },
        { kind: 'beacon', name: 'Quarantine buoy', log: (t) => `Wexley-Yorozu livery, no registration. It warns every ship off ${t.here} in a pleasant voice, then gives the course to ${t.next} anyway.` },
      ],
      last: { kind: 'derelict', ship: 'cobra-mk3', name: 'Colony ship “Ninefold”', log: () => `A parking orbit nobody uses. Lights on. Air good. Nobody aboard. On the bridge, a sealed report addressed to the Science Division, and a hand-written note pinned over it: “Read it. Then decide who you give it to.”` },
    },
    end: { salvage: [{ id: 'medicine', qty: 1 }, { id: 'computers', qty: 1 }], value: 0, report: 'ninefold' },
  },
  home: {
    title: 'The long way home',
    steps: {
      first: { kind: 'derelict', ship: 'cobra-mk3', name: 'Derelict Cobra Mk III “Far Horizon”', log: (t) => `Her captain’s log is a letter home, one entry for every system. The last line you can read: “Tomorrow, ${t.next}. Nearly there, love.”` },
      middle: [
        { kind: 'beacon', name: 'Nav buoy with a letter', log: (t) => `Someone has tucked a letter into the buoy’s maintenance hatch: “Still running. The ship’s old and the money’s older. Next stop ${t.next}.”` },
        { kind: 'derelict', ship: 'sidewinder', name: 'Derelict Sidewinder “Small Hours”', log: (t) => `The Far Horizon’s escort, by the markings. Her pilot gave up the chase here. His last entry: “She’s gone on to ${t.next} without me. Good luck to her.”` },
      ],
      last: { kind: 'derelict', ship: 'cobra-mk3', name: 'Derelict Cobra Mk III “Homeward”', log: (t) => `The Far Horizon’s sister ship, stripped and waiting in the dark off ${t.here}. The hold is sealed with the captain’s mark, and everything she was carrying home is still inside.` },
    },
    end: { salvage: [{ id: 'gems', qty: 1 }, { id: 'gold', qty: 1 }, { id: 'platinum', qty: 1 }, { id: 'luxuries', qty: 1 }], value: 250 },
  },
  survey: {
    title: 'The lost survey',
    steps: {
      first: { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `An old survey beacon, marked with a sign you haven’t seen before: a compass rose with one point missing. Its data ends with a single system: ${t.next}.` },
      middle: [
        { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `Another of hers. The charts are corrected by hand, in a small neat script. The missing point of the compass rose aims at ${t.next}.` },
        { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `The handwriting is shakier here. A note in the margin: “${t.first} to here, every star where I said it was. One more, then ${t.next}.”` },
      ],
      last: { kind: 'beacon', name: 'Cartographer’s last beacon', log: () => `The full chart: every system she visited, corrected by hand, and the compass rose complete at last. The Science Division would pay well for this. So would anyone.` },
    },
    end: { salvage: [], value: 400 },
  },
  debt: {
    title: 'A debt unpaid',
    steps: {
      first: { kind: 'beacon', name: 'Painted marker buoy', log: (t) => `A pirate’s marker, painted over twice. Under the paint: a tally of ships, scratched in fives, and one name: ${t.next}.` },
      middle: [
        { kind: 'derelict', ship: 'mamba', name: 'Gutted Mamba', log: (t) => `Left here as a warning. Scratched into the hull: “Paid in full. ${t.next} owes next.”` },
        { kind: 'wrecks', ship: 'sidewinder', name: 'Ambush site', log: (t) => `Three Sidewinders, close together, all shot from behind. Whoever did it went on to ${t.next}, and didn’t hurry.` },
      ],
      last: { kind: 'derelict', ship: 'mamba', name: 'Hidden cache', log: () => `Wired to an old mine that failed years ago. Whoever left this never came back to collect. Some of what’s inside the police would very much like to see.` },
    },
    end: { salvage: [{ id: 'firearms', qty: 1 }, { id: 'narcotics', qty: 1 }, { id: 'gold', qty: 1 }], value: 250 },
  },
};
const STORY_ORDER: StoryId[] = ['colony', 'home', 'survey', 'debt'];

export interface Trail {
  /** "galaxy.n" */
  id: string;
  story: StoryId;
  title: string;
  galaxy: number;
  /** System indices, first to last. */
  systems: number[];
}

const trailCache = new Map<number, Trail[]>();

/** The trails in a galaxy, from its seed. */
export function trailsOf(galaxy: number): Trail[] {
  const cached = trailCache.get(galaxy);
  if (cached) return cached;
  const used = new Set<number>();
  const trails: Trail[] = [];
  const seedSys = systemAt(galaxy, 0);
  for (let t = 0; trails.length < TRAILS_PER_GALAXY && t < TRAILS_PER_GALAXY * 3; t++) {
    let cur = systemAt(galaxy, Math.floor(roll(seedSys, 50, t) * 256));
    if (used.has(cur.index)) continue;
    const length = 3 + Math.floor(roll(seedSys, 51, t) * 3);
    const systems = [cur.index];
    while (systems.length < length) {
      const options = systemsWithin(cur, 7).filter((s) => !systems.includes(s.index) && !used.has(s.index) && distanceLy(cur, s) > 2);
      if (!options.length) break;
      cur = pick(options, roll(cur, 52, t * 8 + systems.length));
      systems.push(cur.index);
    }
    if (systems.length < 3) continue;
    for (const i of systems) used.add(i);
    const story = STORY_ORDER[trails.length % STORY_ORDER.length];
    trails.push({ id: `${galaxy}.${trails.length}`, story, title: STORIES[story].title, galaxy, systems });
  }
  trailCache.set(galaxy, trails);
  return trails;
}

/** Steps of a trail you've found. */
export const trailProgress = (c: Commander, id: string) => exploreOf(c).trails?.[id] ?? 0;

/** One step of a trail, as a signal in its system. */
function trailPoi(t: Trail, step: number): Poi {
  const story = STORIES[t.story];
  const last = step === t.systems.length - 1;
  const s = last ? story.steps.last : step === 0 ? story.steps.first : story.steps.middle[(step - 1) % story.steps.middle.length];
  const sys = systemAt(t.galaxy, t.systems[step]);
  const salt = 60 + Number(t.id.split('.')[1]);
  const lon = roll(sys, salt, step) * Math.PI * 2;
  const lat = (roll(sys, salt + 100, step) - 0.5) * 0.8;
  const next = last ? undefined : t.systems[step + 1];
  return {
    id: `trail:${t.id}:${step}`,
    kind: s.kind,
    name: s.name,
    direction: [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)],
    distance: 2.5 + roll(sys, salt + 200, step) * 2.5,
    ...(s.ship ? { ship: s.ship } : {}),
    salvage: last ? story.end.salvage : [],
    log: s.log({ here: sys.name, next: next === undefined ? '' : systemAt(t.galaxy, next).name, first: systemAt(t.galaxy, t.systems[0]).name }),
    trail: { id: t.id, step, last, ...(next === undefined ? {} : { next }) },
    ...(last && story.end.value ? { dataValue: story.end.value } : {}),
    ...(last && story.end.report ? { report: story.end.report } : {}),
  };
}

/** The trail signals in a system for this commander: steps reached so far (Modern only). */
export function trailPoisOf(c: Commander, sys: StarSystem): Poi[] {
  if (c.difficulty !== 'modern') return [];
  const out: Poi[] = [];
  for (const t of trailsOf(sys.galaxy)) {
    const step = t.systems.indexOf(sys.index);
    if (step >= 0 && step <= trailProgress(c, t.id)) out.push(trailPoi(t, step));
  }
  return out;
}

/** A trail step found: the next one appears. Returns where the clue points, if anywhere. */
export function advanceTrail(c: Commander, poi: Poi): StarSystem | null {
  if (!poi.trail) return null;
  const e = exploreOf(c);
  const { id, step, last, next } = poi.trail;
  if ((e.trails?.[id] ?? 0) > step) return null; // found before
  e.trails = { ...e.trails, [id]: step + 1 };
  if (last) e.points += TRAIL_END_POINTS;
  const galaxy = Number(id.split('.')[0]);
  return next === undefined ? null : systemAt(galaxy, next);
}

/** Trails under way, for the Station tab. */
export function trailsUnderWay(c: Commander, galaxy: number): { title: string; found: number; of: number; next: string }[] {
  return trailsOf(galaxy)
    .filter((t) => trailProgress(c, t.id) > 0 && trailProgress(c, t.id) < t.systems.length)
    .map((t) => ({ title: t.title, found: trailProgress(c, t.id), of: t.systems.length, next: systemAt(t.galaxy, t.systems[trailProgress(c, t.id)]).name }));
}

// --- The explorer's record ----------------------------------------------------------

export interface SurveyData {
  galaxy: number;
  system: number;
  body: string;
  name: string;
  value: number;
  /** A moon's terraforming grade. */
  grade?: MoonGrade;
  /** A report you choose who to give: it doesn't sell with the rest. */
  report?: 'ninefold';
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
  /** Trails: steps found, by trail id. */
  trails?: Record<string, number>;
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
  e.data.push({ galaxy: s.galaxy, system: s.index, body: body.id, name: body.grade ? `${body.name} (${body.grade.toLowerCase()})` : body.name, value: body.value, ...(body.grade ? { grade: body.grade } : {}) });
}

/** A signal found: its log goes in the hold as data too. */
export function recordDiscovery(c: Commander, s: StarSystem, poi: Poi) {
  const e = exploreOf(c);
  const key = `${sysKey(s)}:${poi.id}`;
  if (e.found.includes(key)) return;
  e.found.push(key);
  e.points += POINTS.discovery;
  e.data.push({
    galaxy: s.galaxy,
    system: s.index,
    body: poi.id,
    name: poi.report ? 'The Ninefold report' : poi.name,
    value: poi.dataValue ?? (poi.kind === 'beacon' ? 60 : 50),
    ...(poi.report ? { report: poi.report } : {}),
  });
}

/** Wexley-Yorozu pays best for data: this much more at any of its stations. */
export const WY_DATA_BONUS = 1.25;
/** The Ninefold report: what the Science Division pays, and what publishing it elsewhere fetches. */
export const REPORT_PRICE = { wy: 1200, published: 300 } as const;

/** What a survey fetches at a station: half where it was gathered, rising with distance, up to five times. */
export function dataValue(d: SurveyData, here: StarSystem, wyHere = false): number {
  if (d.report) return wyHere ? REPORT_PRICE.wy : REPORT_PRICE.published;
  const ly = d.galaxy === here.galaxy ? distanceLy(systemAt(d.galaxy, d.system), here) : 60;
  return Math.round(d.value * Math.min(5, 0.5 + ly / 8) * (wyHere ? WY_DATA_BONUS : 1));
}

/**
 * Sell the data in the hold. A report goes only to Wexley-Yorozu (at one of
 * its stations); elsewhere it stays aboard until you publish it. Returns the
 * credits, and how many reports went to the Science Division.
 */
export function sellData(c: Commander, here: StarSystem, wyHere = false): { credits: number; reports: number } {
  const e = exploreOf(c);
  const sold = e.data.filter((d) => wyHere || !d.report);
  const credits = sold.reduce((sum, d) => sum + dataValue(d, here, wyHere), 0);
  c.credits += credits;
  e.earned += credits;
  e.data = e.data.filter((d) => !sold.includes(d));
  return { credits, reports: sold.filter((d) => d.report).length };
}

/** Publish a report anywhere but Wexley-Yorozu: the Mutual's newsletter pays. Returns the credits. */
export function publishReports(c: Commander): number {
  const e = exploreOf(c);
  const reports = e.data.filter((d) => d.report);
  const credits = reports.length * REPORT_PRICE.published;
  c.credits += credits;
  e.earned += credits;
  e.data = e.data.filter((d) => !d.report);
  return credits;
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
