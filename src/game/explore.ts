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
  /** Equipment you take from it (the lost courier's prototype). */
  prize?: 'wisp';
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

// Every trail is somebody's story, told in what they left behind: one person
// at its heart, and a feeling that turns (glad, sad, mad, bad) along the way.
// Middle steps play in order, so the first is the one every trail has.
const STORIES: Record<StoryId, Story> = {
  colony: {
    title: 'The colony that stopped answering',
    steps: {
      first: { kind: 'beacon', name: 'Wexley-Yorozu relay beacon', log: (t) => `Still repeating its last packet: colony ship Ninefold, outbound for ${t.next}. All well. All well. All well. The timestamp is eleven years old. Behind it in the queue, one message never sent: a girl asking her gran whether the yellow flowers came up this year.` },
      middle: [
        { kind: 'derelict', ship: 'sidewinder', name: 'Colony tug “Hold Fast”', log: (t) => `The tow cable is cut clean. Forty bunks rigged in the hold, empty now, and a child’s drawing taped to the console. Pilot Sam Dray’s last entry: “Ninefold called for help at ${t.next}. We were told not to answer. I answered. Mutual hauler picked us up here; the tug stays.”` },
        { kind: 'derelict', ship: 'cobra-mk3', name: 'Survey tender “Patience”', log: (t) => `Powered down neatly. The manifest lists “atmosphere seed, class 4”. The agronomist’s notes: “Third sowing failed. The seed was never tested for this sky; testing was cut to save fourteen months. I have told them. Course for ${t.next}.”` },
        { kind: 'beacon', name: 'Quarantine buoy', log: (t) => `Wexley-Yorozu livery, no registration. “Asset recovery in progress at ${t.next}. Please do not render assistance.” Someone has rewired it to give the course anyway.` },
      ],
      last: { kind: 'derelict', ship: 'cobra-mk3', name: 'Colony ship “Ninefold”', log: () => `A parking orbit nobody uses. Lights on. Air good. Two hundred bunks, made. Nobody aboard. On the bridge, a sealed report for the Science Division, and a note pinned over it in the administrator’s hand: “Read it. Then decide who you give it to. T. Vasse.”` },
    },
    end: { salvage: [{ id: 'medicine', qty: 1 }, { id: 'computers', qty: 1 }], value: 0, report: 'ninefold' },
  },
  home: {
    title: 'The long way home',
    steps: {
      first: { kind: 'beacon', name: 'Nav buoy with a letter', log: (t) => `Tucked into the maintenance hatch, a letter: “Noor. Nine years, and I’m coming home. The ship’s old and the money’s older, but there’s enough. Next stop ${t.next}. Ada.”` },
      middle: [
        { kind: 'derelict', ship: 'sidewinder', name: 'Derelict Sidewinder “Small Hours”', log: (t) => `Ada’s escort, paid to see her home. The escape pod is gone. His last entry: “Drive’s finished. Told her not to wait. She’s gone on to ${t.next}. She cried, which she’ll deny.”` },
        { kind: 'beacon', name: 'Nav buoy with a letter', log: (t) => `Another letter: “I was angry for nine years about why I left. Somewhere back there I stopped. ${t.next} next. Put the kettle on.”` },
        { kind: 'beacon', name: 'Nav buoy with a letter', log: (t) => `A short one, the writing hurried: “Fuel’s tight. If I’m late, I’m not lost, just slow. ${t.next}.”` },
      ],
      last: { kind: 'derelict', ship: 'cobra-mk3', name: 'Derelict Cobra Mk III “Far Horizon”', log: () => `Ada’s ship, out of fuel, one jump short. The escape pod is gone, aimed at home. The last letter is still in the printer: “If you find this before anyone finds me, sell what’s in the hold and send Noor the money. Tell her I was nearly there.”` },
    },
    end: { salvage: [{ id: 'gems', qty: 1 }, { id: 'gold', qty: 1 }, { id: 'platinum', qty: 1 }, { id: 'luxuries', qty: 1 }], value: 250 },
  },
  survey: {
    title: 'The lost survey',
    steps: {
      first: { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `An old survey beacon, signed “O. Fenn, chartmaker” beside a compass rose with one point missing. Its data ends with a single system: ${t.next}.` },
      middle: [
        { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `Her charts, corrected by hand in a small neat script. In the margin: “The doctors give me a year of good sight. Forty systems left. I can do forty.” The missing point aims at ${t.next}.` },
        { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `The writing is bigger here, and shakier. “${t.first} to here, every star where I said it was. I fly by the big dials now. ${t.next}.”` },
        { kind: 'beacon', name: 'Cartographer’s beacon', log: (t) => `No writing, only her voice: “Wexley-Yorozu offered to buy the chart unfinished. I said no. It goes to everyone or no one. ${t.next}.”` },
      ],
      last: { kind: 'beacon', name: 'Cartographer’s last beacon', log: () => `The full chart: every system she visited, every star where she said it was. The compass rose is complete, its last point drawn in big and crooked. Under it: “Done. For anyone who flies.”` },
    },
    end: { salvage: [], value: 400 },
  },
  debt: {
    title: 'A debt unpaid',
    steps: {
      first: { kind: 'beacon', name: 'Painted marker buoy', log: (t) => `A pirate’s marker, painted over twice. Under the paint, a tally scratched in fives: eleven marks, some crossed through. And one name: ${t.next}.` },
      middle: [
        { kind: 'derelict', ship: 'mamba', name: 'Gutted Mamba', log: (t) => `Left here as a warning. Its log shows a convoy’s route sold for 300 Cr. Scratched into the hull: “Paid in full. ${t.next} owes next.”` },
        { kind: 'wrecks', ship: 'sidewinder', name: 'Ambush site', log: (t) => `Three Sidewinders, close together, all shot from behind: the way they took the convoy. Whoever did it went on to ${t.next}, and didn’t hurry.` },
        { kind: 'beacon', name: 'Painted marker buoy', log: (t) => `A message for whoever’s following: “You think I’m a pirate. I was the twelfth hauler in that convoy. Eleven marks, one for each of mine. I’m crossing off the ones who sold us. Bel. ${t.next}.”` },
      ],
      last: { kind: 'derelict', ship: 'mamba', name: 'Bel’s cache', log: () => `Wired to an old mine that failed years ago. Under the guns and narcotics she took off them, eleven envelopes, one for each family, and a note: “If I don’t come back, the envelopes go to the Mutual. Keep the rest. Some of it the police would like to see.”` },
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
  /** Who you gave the Ninefold report to, once you have. */
  ninefold?: 'wy' | 'published';
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

/** The Ninefold report, as you read it before deciding who gets it. */
export const NINEFOLD_REPORT = {
  title: 'Ninefold colony: closing report',
  lines: [
    'SCIENCE DIVISION. Colony: Ninefold. Status: closed. Distribution: Science Division only.',
    'Agronomy (Dr L. Marsh): seed stock class 4 failed on the third sowing. It was never tested for this sky. Testing was deferred to save fourteen months. Dr Marsh has been reassigned.',
    'Colonial Accounts (C. Ashe, Regional Director): the colony’s debt now exceeds its lifetime output. Relief would cost 310,000 Cr; recovery under clause 214, 40,000 Cr. Residents to be relocated to yard work until the balance is cleared. Keep the relay running: the families should not be alarmed.',
    'Bridge log (T. Vasse, Administrator): “They call us assets. I have sealed the bridge. Two hundred people, air for ninety days. Anyone hearing this: please come.”',
    'Recovery: 158 residents taken off for relocation. 41 missing, believed carried off by the unlicensed tug Hold Fast, pilot S. Dray; recommend he is found. Administrator Vasse stayed aboard so the tug could leave, and was recovered last.',
    'Attached, from the relay queue, unsent: “Gran, did the yellow flowers come up? Ours didn’t. Dad says next year. Love, Mira.”',
  ],
} as const;

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
  const reports = sold.filter((d) => d.report).length;
  if (reports) e.ninefold = 'wy';
  return { credits, reports };
}

/** Publish a report anywhere but Wexley-Yorozu: the Mutual's newsletter pays. Returns the credits. */
export function publishReports(c: Commander): number {
  const e = exploreOf(c);
  const reports = e.data.filter((d) => d.report);
  const credits = reports.length * REPORT_PRICE.published;
  c.credits += credits;
  e.earned += credits;
  e.data = e.data.filter((d) => !d.report);
  if (reports.length) e.ninefold = 'published';
  return credits;
}

// --- Explorer's rank ----------------------------------------------------------------

/** Ranks for exploring. Elite is earned in combat only, so it isn't one of them. */
export const EXPLORER_RANKS: [number, string][] = [
  [0, 'Homebody'],
  [5, 'Tourist'],
  [15, 'Wanderer'],
  [40, 'Surveyor'],
  [100, 'Pathfinder'],
  [250, 'Trailblazer'],
  [600, 'Pioneer'],
  [1500, 'Voyager'],
];

export function explorerRank(points: number): string {
  let rank = EXPLORER_RANKS[0][1];
  for (const [min, name] of EXPLORER_RANKS) if (points >= min) rank = name;
  return rank;
}

// --- The explorer's road: what the ranks open (docs/design/exploration.md, stage 1b) --------

/** Explorer points each door needs. */
export const EXPLORER_DOORS = { pathfinder: 100, trailblazer: 250, pioneer: 600, voyager: 1500 } as const;
export const explorerAtLeast = (c: Commander, door: keyof typeof EXPLORER_DOORS) => c.difficulty === 'modern' && exploreOf(c).points >= EXPLORER_DOORS[door];

/** What reaching a rank opens, said when you reach it. */
export const RANK_NEWS: Record<string, string> = {
  Pathfinder: 'The Science Division has special orders for you, and the Survey Autopilot is yours to buy',
  Trailblazer: 'The Station tab now names the nearest trail you haven’t started, and the Science Division’s lost courier is out there to find',
  Pioneer: 'The Route Autopilot is yours to buy',
  Voyager: 'The Legends will find you first, when they come',
};

/** The rank you reached, if these points crossed into one. */
export function rankReached(before: number, after: number): string | null {
  const a = explorerRank(before);
  const b = explorerRank(after);
  return a === b ? null : b;
}

/** Trailblazers hear of the nearest trail they haven't started: its first system. */
export function trailTip(c: Commander, here: StarSystem): { title: string; at: StarSystem; ly: number } | null {
  if (!explorerAtLeast(c, 'trailblazer')) return null;
  let best: { title: string; at: StarSystem; ly: number } | null = null;
  for (const t of trailsOf(here.galaxy)) {
    if (trailProgress(c, t.id) > 0) continue;
    const at = systemAt(t.galaxy, t.systems[0]);
    const ly = distanceLy(here, at);
    if (!best || ly < best.ly) best = { title: t.title, at, ly };
  }
  return best;
}

// The Science Division's lost courier: one a galaxy, carrying a prototype the
// company would rather nobody found. Found only by explorers (Trailblazer and up).

export const COURIER_POINTS = 25;

/**
 * Is this a find the galaxy really has? The planet and star everywhere; a moon,
 * signal, trail step or the courier only where the seed put it. The server
 * checks first-discovery claims with this (server/src/firsts.ts).
 */
export function isRealFind(galaxy: number, system: number, body: string): boolean {
  if (!Number.isInteger(galaxy) || galaxy < 0 || galaxy > 7 || !Number.isInteger(system) || system < 0 || system > 255) return false;
  const sys = systemAt(galaxy, system);
  if (body === 'planet' || body === 'star') return true;
  if (/^moon\d$/.test(body)) return Number(body.slice(4)) < worldOf(sys).moons.length;
  if (/^poi\d$/.test(body)) return poisOf(sys).some((p) => p.id === body);
  if (body === 'courier') return courierSystem(galaxy) === sys;
  const t = body.match(/^trail:(\d)\.(\d{1,2}):(\d)$/);
  if (!t || Number(t[1]) !== galaxy) return false;
  return trailsOf(galaxy).find((x) => x.id === `${t[1]}.${t[2]}`)?.systems[Number(t[3])] === system;
}

/** The system where a galaxy's lost courier drifts. */
export function courierSystem(galaxy: number): StarSystem {
  const seed = systemAt(galaxy, 0);
  return systemAt(galaxy, Math.floor(roll(seed, 70) * 256));
}

/** The courier, as a signal (Modern, Trailblazer and up, until you've taken the prototype). */
export function courierPoiOf(c: Commander, sys: StarSystem): Poi | null {
  if (!explorerAtLeast(c, 'trailblazer') || courierSystem(sys.galaxy) !== sys) return null;
  const lon = roll(sys, 71) * Math.PI * 2;
  const lat = (roll(sys, 72) - 0.5) * 0.6;
  return {
    id: 'courier',
    kind: 'derelict',
    name: 'Science Division courier “Quiet Hand”',
    direction: [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)],
    distance: 3 + roll(sys, 73) * 2,
    ship: 'cobra-mk3',
    salvage: [],
    log: 'No crew, no name on the hull, and a cargo bay sealed from the inside. In the rack, still warm: a prototype stamped WILL-O’-THE-WISP, Science Division issue. It fits your ship. The courier’s last order: “Under no circumstances let this fall into private hands.”',
    dataValue: 300,
    prize: 'wisp',
  };
}

/** Where the courier is, as rumour: within this many light years, Trailblazers hear of it. */
export const COURIER_RUMOUR_LY = 20;

/** Bar talk of the courier, if it's near and you haven't found it. */
export function courierRumour(c: Commander, here: StarSystem): string | null {
  if (!explorerAtLeast(c, 'trailblazer') || c.equipment.includes('wisp')) return null;
  const at = courierSystem(here.galaxy);
  if (isFound(c, at, 'courier')) return null;
  if (at === here) return 'Bar talk: a Science Division courier went dark in this very system. Survey the planet and listen.';
  const ly = distanceLy(here, at);
  return ly <= COURIER_RUMOUR_LY ? `Bar talk: a Science Division courier went dark within ${Math.ceil(ly / 5) * 5} light years of here` : null;
}
