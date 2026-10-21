import { distanceLy, galaxy, type StarSystem } from '../galaxy/generate';
import { hash } from './seed';

// World events: famines, booms, strikes, wars and worse, as set out in
// docs/design/markets-and-trade.md (section 2). They come from each system's
// seed and the clock, so the galaxy has the same events for everyone and any
// moment can be worked out. An event shifts a world's stock of the goods it
// touches (as a share of the usual level), which moves prices, posts station
// orders and spreads down supply chains. News of it travels at the speed of
// ships: the further away you are, the later you hear.

export type EventType = 'famine' | 'drought' | 'plague' | 'boom' | 'strike' | 'war' | 'blockade' | 'incursion' | 'crackdown';

interface EventKind {
  name: string;
  headline: (system: string) => string;
  /** What traders should take there. */
  wanted: string;
  /** Stock shift by good, as a share of the usual level; `imports` means every good the world imports. */
  effects: Record<string, number>;
  /** How likely this kind is at a world, relative to the others. */
  weight: (s: StarSystem) => number;
}

const INDUSTRIAL = (s: StarSystem) => s.economy <= 3;
const LAWLESS = (s: StarSystem) => s.government <= 3; // anarchy, feudal, multi-government, dictatorship

export const EVENT_KINDS: Record<EventType, EventKind> = {
  famine: {
    name: 'Famine',
    headline: (s) => `Famine grips ${s}: food stores run dry`,
    wanted: 'Food, Water',
    effects: { food: -0.7, water: -0.2 },
    weight: () => 1,
  },
  drought: {
    name: 'Drought',
    headline: (s) => `Drought on ${s}: water rationing begins`,
    wanted: 'Water, Food',
    effects: { water: -0.7, food: -0.3, hydrogen: -0.2 },
    weight: () => 0.8,
  },
  plague: {
    name: 'Plague',
    headline: (s) => `Plague outbreak on ${s}: medicine urgently needed`,
    wanted: 'Medicine',
    effects: { medicine: -0.8, luxuries: 0.3, liquor: 0.3 },
    weight: (s) => 0.5 + (15 - s.techLevel) / 15,
  },
  boom: {
    name: 'Boom',
    headline: (s) => `Boom times on ${s}: buyers out in force`,
    wanted: 'Luxuries, Liquor/Wines, Computers',
    effects: { luxuries: -0.5, liquor: -0.4, computers: -0.3, furs: -0.3 },
    weight: (s) => (s.economy === 0 || s.economy === 5 ? 1.4 : 0.6),
  },
  strike: {
    name: 'Mining strike',
    headline: (s) => `Miners down tools on ${s}: ore shipments halted`,
    wanted: 'Minerals, Gold, Platinum',
    effects: { minerals: -0.8, gold: -0.5, platinum: -0.5 },
    weight: (s) => (INDUSTRIAL(s) ? 1.2 : 0.4),
  },
  war: {
    name: 'Civil war',
    headline: (s) => `Civil war on ${s}: arms and medicine in demand`,
    wanted: 'Firearms, Medicine, Food',
    effects: { firearms: -0.8, medicine: -0.6, food: -0.3, machinery: -0.3 },
    weight: (s) => (LAWLESS(s) ? 1.2 : 0.15),
  },
  blockade: {
    name: 'Pirate blockade',
    headline: (s) => `Pirates blockade ${s}: imports dry up`,
    wanted: 'Anything it imports',
    effects: { imports: -0.5 },
    weight: (s) => (s.government <= 1 ? 0.9 : 0.25),
  },
  incursion: {
    name: 'Thargoid incursion',
    headline: (s) => `Thargoids sighted near ${s}: traffic flees`,
    wanted: 'Alloys, Firearms, Medicine',
    effects: { alloys: -0.6, firearms: -0.6, medicine: -0.4, imports: -0.3 },
    weight: () => 0.15,
  },
  crackdown: {
    name: 'Police crackdown',
    headline: (s) => `Police crackdown on ${s}: contraband scarce`,
    wanted: 'Contraband, at a risk',
    effects: { narcotics: -0.8, slaves: -0.7, firearms: -0.4 },
    weight: (s) => (s.government >= 1 && s.government <= 4 ? 0.8 : 0),
  },
};

const TYPES = Object.keys(EVENT_KINDS) as EventType[];

export interface WorldEvent {
  type: EventType;
  galaxy: number;
  system: number;
  start: number; // ms
  end: number;
}

const SLOT = 6 * 3600_000; // at most one event starts per system in each slot
const CHANCE = 0.12; // chance of an event in a slot (to tune)
const MIN_HOURS = 2;
const MAX_HOURS = 8;
const RAMP = 30 * 60_000; // stock shifts over the first and last half hour

/** Events at a system overlapping `from`..`to`, oldest first. */
export function eventsAt(s: StarSystem, from: number, to: number): WorldEvent[] {
  const out: WorldEvent[] = [];
  const M = 1_000_003;
  for (let k = Math.floor((from - MAX_HOURS * 3600_000) / SLOT); k <= Math.floor(to / SLOT); k++) {
    const slot = k % M;
    if (hash(s, 60_000 + slot, 0) >= CHANCE) continue;
    const weights = TYPES.map((t) => EVENT_KINDS[t].weight(s));
    let pick = hash(s, 61_000 + slot, 0) * weights.reduce((a, b) => a + b, 0);
    let type = TYPES[0];
    for (let n = 0; n < TYPES.length; n++) {
      if ((pick -= weights[n]) < 0) {
        type = TYPES[n];
        break;
      }
    }
    const start = k * SLOT + hash(s, 62_000 + slot, 0) * SLOT;
    const end = start + (MIN_HOURS + hash(s, 63_000 + slot, 0) * (MAX_HOURS - MIN_HOURS)) * 3600_000;
    if (end >= from && start <= to) out.push({ type, galaxy: s.galaxy, system: s.index, start, end });
  }
  return out;
}

/** The event happening at a system at time `t`, if any. */
export function activeEvent(s: StarSystem, t: number): WorldEvent | null {
  return eventsAt(s, t, t).find((e) => e.start <= t && t <= e.end) ?? null;
}

/** How strongly an event is felt at time `t`: building up, in full, then easing. */
function strength(e: WorldEvent, t: number): number {
  if (t < e.start || t > e.end) return 0;
  return Math.min(1, (t - e.start) / RAMP, (e.end - t) / RAMP);
}

/**
 * The shift events make to a good's stock at `t`, as a share of its usual
 * level: the events here, plus an echo of news from nearby. Once news of a
 * shortage reaches a world, its traders start buying up what's wanted to
 * ship there, so prices rise a little. A fast ship that brings the news
 * first buys before they do.
 */
export function eventShare(s: StarSystem, id: string, t: number, imported: boolean): number {
  let share = 0;
  for (const e of eventsAt(s, t, t)) {
    const effects = EVENT_KINDS[e.type].effects;
    share += ((effects[id] ?? 0) + (imported ? (effects.imports ?? 0) : 0)) * strength(e, t);
  }
  for (const { event, distance, heard } of nearbyEvents(s, t)) {
    const want = EVENT_KINDS[event.type].effects[id] ?? 0;
    if (want >= 0 || t < heard || t > event.end) continue;
    const reacting = Math.min(1, (t - heard) / RAMP, (event.end - t) / RAMP);
    share += want * ECHO * (1 - distance / NEWS_RANGE) * reacting;
  }
  return share;
}

const ECHO = 0.2; // how much of a shortage nearby traders' buying echoes, at zero distance

// Events at other systems within news range, cached by the hour: they're asked for constantly.
const neighbourCache = new Map<string, { s: StarSystem; d: number }[]>();
const nearbyCache = new Map<string, { event: WorldEvent; distance: number; heard: number }[]>();
function nearbyEvents(here: StarSystem, t: number) {
  const key = `${here.galaxy}:${here.index}`;
  let near = neighbourCache.get(key);
  if (!near) {
    near = galaxy(here.galaxy)
      .filter((s) => s !== here)
      .map((s) => ({ s, d: distanceLy(here, s) }))
      .filter((n) => n.d <= NEWS_RANGE);
    neighbourCache.set(key, near);
  }
  const hour = Math.floor(t / 3600_000);
  const hk = `${key}:${hour}`;
  let list = nearbyCache.get(hk);
  if (!list) {
    list = [];
    const from = hour * 3600_000 - MAX_HOURS * 3600_000 - NEWS_BASE - NEWS_RANGE * NEWS_PER_LY;
    for (const { s, d } of near) {
      for (const event of eventsAt(s, from, (hour + 1) * 3600_000)) list.push({ event, distance: d, heard: newsArrives(s, here, event.start) });
    }
    if (nearbyCache.size > 2000) nearbyCache.clear();
    nearbyCache.set(hk, list);
  }
  return list;
}

// --- News --------------------------------------------------------------------------

const NEWS_BASE = 10 * 60_000; // ms before even the nearest system hears
const NEWS_PER_LY = 12 * 60_000; // ms more for every light year
const NEWS_RANGE = 25; // light years: further away isn't news here
const NEWS_KEEP = 90 * 60_000; // ms: old news is dropped this long after an event ends

export interface NewsItem {
  event: WorldEvent;
  where: StarSystem;
  distance: number; // light years
  heard: number; // when the news reached here (ms)
}

/** When news of an event at `where` reaches `here`. */
export const newsArrives = (where: StarSystem, here: StarSystem, start: number) =>
  where === here ? start : start + NEWS_BASE + distanceLy(where, here) * NEWS_PER_LY;

/** The news that has reached `here` by `now`, most recent first. */
export function newsAt(here: StarSystem, now: number): NewsItem[] {
  const out: NewsItem[] = [];
  for (const s of galaxy(here.galaxy)) {
    const distance = distanceLy(here, s);
    if (distance > NEWS_RANGE) continue;
    for (const event of eventsAt(s, now - MAX_HOURS * 3600_000 - NEWS_KEEP - NEWS_BASE - NEWS_RANGE * NEWS_PER_LY, now)) {
      const heard = newsArrives(s, here, event.start);
      if (heard <= now && now - event.end < NEWS_KEEP + (heard - event.start)) out.push({ event, where: s, distance, heard });
    }
  }
  return out.sort((a, b) => b.heard - a.heard);
}

/** The latest news of a system that has reached `here` by `now`, if any. */
export function newsOf(where: StarSystem, here: StarSystem, now: number): NewsItem | null {
  const distance = distanceLy(here, where);
  if (distance > NEWS_RANGE) return null;
  const known = eventsAt(where, now - MAX_HOURS * 3600_000 - NEWS_KEEP - NEWS_BASE - distance * NEWS_PER_LY, now)
    .map((event) => ({ event, where, distance, heard: newsArrives(where, here, event.start) }))
    .filter((n) => n.heard <= now && now - n.event.end < NEWS_KEEP + (n.heard - n.event.start));
  return known[known.length - 1] ?? null;
}
