// The traffic (docs/design/the-world.md, Modern rules): the ships you see are
// the market's own timetable made visible. The market already works out, from
// each system's seed and the clock, every NPC delivery to the station and every
// purchase from it (economy/market.ts, npcTrades). Here they're gathered into
// voyages: a ship docking with the deliveries of a few minutes, a ship leaving
// with the purchases. Each comes from, or goes to, a real neighbouring system,
// flies for a real company, and has a name, all from the seed, so every
// commander sees the same ship in the same place at the same time.
//
// Where a Titanoboa yard is at work (game/yards.ts), Wexley-Yorozu's freighters
// bring what the build needs, on a timetable of their own, to the Titan herself.
//
// Pure: no scene, no state. The game turns a voyage into a ship on a path.

import { distanceLy, galaxy, type StarSystem } from '../galaxy/generate';
import { npcTrades } from '../economy/market';
import { activeEvent, EVENT_KINDS, type EventType } from '../economy/events';
import { COMMODITIES, UNITS_PER_TONNE } from '../economy/commodities';
import { hash } from '../economy/seed';
import { pickCompany, type CompanyId } from './companies';
import { yardAt, type YardStage } from './yards';

export interface Consignment {
  id: string;
  /** When it reaches the market (in), or left it (out). */
  t: number;
  qty: number;
}

export interface Voyage {
  /** Stable: the same voyage has the same id on every device. */
  id: string;
  /** In to dock, or out to witchspace. */
  leg: 'in' | 'out';
  /** The station, or (in to a yard) the Titan. */
  to: 'station' | 'titan';
  /** Sent because of a world event here: relief for a famine, medicine for a plague. */
  relief?: EventType;
  /** In: when it docks. Out: when it launches. */
  at: number;
  cargo: Consignment[];
  company: CompanyId | null;
  hull: string;
  name: string;
  /** The system it comes from (in) or is bound for (out), by index in this galaxy. */
  other: number;
  /** Company security flying alongside: the Titan's runs, more in dangerous systems, and valuable cargo. */
  escorts: number;
}

/** One ship carries the trades of this long, by government (anarchy 0 .. corporate 7): busier worlds, more ships. */
export const WINDOW_MS = [9, 8, 7, 6, 6, 5, 5, 4].map((m) => m * 60_000);
/** The Titan's freighters: one about this often while a build is on. */
export const TITAN_WINDOW_MS = 8 * 60_000;
/** The chance a Titan run has an escort, by government (anarchy 0 .. corporate 7): more where it's dangerous. */
export const TITAN_ESCORT = [0.9, 0.8, 0.65, 0.5, 0.4, 0.35, 0.3, 0.25];
/** Goods worth guarding: a company run carrying these may have an escort. */
export const VALUABLE = new Set(['luxuries', 'computers', 'platinum', 'gold', 'alien', 'firearms']);
/** What each traffic hull can carry, in tonnes (its ship file's cargo; traffic.test.ts checks they agree). */
export const HOLD: Record<string, number> = { 'cobra-mk3': 20, bullsnake: 60 };
/** The ships of one convoy dock (or launch) this far apart, so they don't fly through each other. */
export const CONVOY_GAP_MS = 25_000;
/** How far back to look for a convoy whose later ships are still to come: longer than any convoy. */
const CONVOY_SPAN_MS = 20 * CONVOY_GAP_MS;
/** Systems a trader would come from or go to: one jump. */
export const LANE_LY = 7;

/** What a yard's build needs most at each stage. */
export const TITAN_NEEDS: Record<YardStage, string[]> = {
  refining: ['machinery', 'food'],
  spine: ['alloys', 'machinery'],
  frame: ['alloys', 'computers'],
  plating: ['alloys', 'minerals'],
  'spin-up': ['computers', 'food'],
  finished: [],
};

/** Ships' names: working names, the kind painted by hand on a freighter's flank. */
export const NAMES = [
  'Patience', 'Fair Exchange', 'Steady Hand', 'Second Chance', 'Long Haul', 'Good Measure', 'Night Shift', 'Honest Weight',
  'Margin Call', 'Small Mercies', 'Dry Dock', 'Last Orders', 'Making Do', 'Slow Burn', 'Fortune’s Wake', 'Still Waters',
  'Better Late', 'Common Cause', 'Kind Regards', 'Open Book', 'Paid in Full', 'Quiet Life', 'Rainy Day', 'Safe Harbour',
  'Tally Ho', 'Upper Hand', 'Wide Berth', 'Yours Truly', 'Brass Neck', 'Cold Comfort', 'Even Keel', 'Free Hand',
  'Grey Area', 'Hard Bargain', 'In Credit', 'Just So', 'Lucky Break', 'Moonlighter', 'Northern Star', 'Odd Job',
];

const neighbours = new Map<string, number[]>();
/** Systems within a jump, nearest first; the nearest few if none are. */
export function lanesFrom(s: StarSystem): number[] {
  const key = `${s.galaxy}:${s.index}`;
  let out = neighbours.get(key);
  if (!out) {
    const by = galaxy(s.galaxy)
      .filter((o) => o.index !== s.index)
      .map((o) => ({ i: o.index, d: distanceLy(s, o) }))
      .sort((a, b) => a.d - b.d);
    const near = by.filter((o) => o.d <= LANE_LY);
    out = (near.length ? near : by.slice(0, 3)).map((o) => o.i);
    neighbours.set(key, out);
  }
  return out;
}

const goodName = (id: string) => COMMODITIES.find((c) => c.id === id)?.name ?? id;

function voyageFor(s: StarSystem, leg: 'in' | 'out', to: 'station' | 'titan', k: number, cargo: Consignment[], company: CompanyId | null): Voyage {
  const salt = leg === 'in' ? 0 : 1;
  const lanes = lanesFrom(s);
  const hull = company === 'wy' && (to === 'titan' || hash(s, 91_300 + salt, k) < 0.5) ? 'bullsnake' : 'cobra-mk3';
  const t = to === 'titan' ? 2 : 0;
  const chance = to === 'titan' ? TITAN_ESCORT[s.government] : company && cargo.some((c) => VALUABLE.has(c.id)) ? 0.35 : 0;
  const escorts = hash(s, 91_700 + salt + t, k) < chance ? (hash(s, 91_800 + salt + t, k) < 0.35 ? 2 : 1) : 0;
  return {
    id: `${s.galaxy}:${s.index}:${to}:${leg}:${k}`,
    leg,
    to,
    at: Math.min(...cargo.map((c) => c.t)),
    cargo,
    company,
    hull,
    name: NAMES[Math.floor(hash(s, 91_100 + salt + (to === 'titan' ? 2 : 0), k) * NAMES.length)],
    other: lanes[Math.floor(hash(s, 91_200 + salt + (to === 'titan' ? 2 : 0), k) * lanes.length)],
    escorts,
  };
}

const tonnesPer = (id: string) => UNITS_PER_TONNE[COMMODITIES.find((c) => c.id === id)?.unit ?? 't'];

/**
 * Pack a voyage's cargo into holds (Mark, 31 October 2026: a Cobra "carrying way too much cargo 22 t
 * of something and another 15 tonnes of something else"). A Cobra holds 20 t: a bigger load is a
 * convoy, each ship full but the last, a delivery split between them where it must be. The market
 * gets the same goods at the same times; a ship lost loses only what she carried.
 */
export function packHolds(cargo: Consignment[], hold: number): Consignment[][] {
  const loads: Consignment[][] = [[]];
  let space = hold;
  for (const c of cargo) {
    const per = tonnesPer(c.id);
    let left = c.qty;
    while (left > 0) {
      if (space <= 1e-9) {
        loads.push([]);
        space = hold;
      }
      const qty = Math.min(left, Math.floor(space * per + 1e-9));
      if (qty <= 0) {
        space = 0;
        continue;
      }
      loads[loads.length - 1].push({ id: c.id, t: c.t, qty });
      left -= qty;
      space -= qty / per;
    }
  }
  return loads.filter((l) => l.length);
}

/** A voyage too big for her hold becomes a convoy: the same company and lane, a ship every CONVOY_GAP_MS. */
function convoy(s: StarSystem, v: Voyage, k: number): Voyage[] {
  const loads = packHolds(v.cargo, HOLD[v.hull] ?? 20);
  if (loads.length <= 1) return [v];
  return loads.map((cargo, i) => ({
    ...v,
    id: i ? `${v.id}:c${i}` : v.id,
    at: v.at + i * CONVOY_GAP_MS,
    cargo,
    name: i ? NAMES[Math.floor(hash(s, 91_600 + i, k) * NAMES.length)] : v.name,
  }));
}

/**
 * The voyages that dock or launch at a system between `from` and `to` (ms).
 * `lost` are deliveries that never arrived (their ship was destroyed): a voyage
 * carrying nothing else doesn't happen.
 */
export function voyages(s: StarSystem, from: number, to: number, lost: { id: string; t: number; qty?: number }[] = []): Voyage[] {
  const window = WINDOW_MS[s.government];
  const phase = hash(s, 91_000, 0) * window;
  // Whole windows, so every load is whole (a convoy's ships depend on all of it), and far enough back for a convoy still arriving.
  const since = phase + Math.floor((from - window - CONVOY_SPAN_MS - phase) / window) * window;
  const until = phase + (Math.floor((to - phase) / window) + 1) * window;
  const groups = new Map<string, Consignment[]>();
  // Tonnes already lost from each delivery: a ship of a convoy, destroyed, takes only her share.
  const gone = new Map<string, number>();
  for (const l of lost) gone.set(`${l.id}:${l.t}`, (gone.get(`${l.id}:${l.t}`) ?? 0) + (l.qty ?? Infinity));
  for (const c of COMMODITIES) {
    // A ship's trades can start a window before `from`: it docks at its first.
    for (const e of npcTrades(s, c.id, since, until)) {
      const leg = e.side === 'sell' ? 'in' : 'out'; // the market buys what an inbound ship sells it
      const qty = leg === 'in' ? e.qty - (gone.get(`${c.id}:${e.t}`) ?? 0) : e.qty;
      if (qty <= 0) continue;
      const k = Math.floor((e.t - phase) / window);
      const key = `${leg}:${k}`;
      groups.set(key, [...(groups.get(key) ?? []), { id: c.id, t: e.t, qty }]);
    }
  }
  const out: Voyage[] = [];
  for (const [key, cargo] of groups) {
    const [leg, k] = key.split(':') as ['in' | 'out', string];
    const kn = Number(k);
    const company = hash(s, 91_400 + (leg === 'in' ? 0 : 1), kn) < 0.8 ? pickCompany(s, hash(s, 91_500 + (leg === 'in' ? 0 : 1), kn)) : null;
    for (const v of convoy(s, voyageFor(s, leg, 'station', kn, cargo.sort((a, b) => a.t - b.t), company), kn)) if (v.at >= from && v.at <= to) out.push(v);
  }
  out.push(...titanVoyages(s, from, to), ...reliefVoyages(s, from, to));
  return out.sort((a, b) => a.at - b.at);
}

/** Wexley-Yorozu's freighters for a yard's build: what the stage needs, in from the nearest worlds. */
export function titanVoyages(s: StarSystem, from: number, to: number): Voyage[] {
  const out: Voyage[] = [];
  const phase = hash(s, 92_000, 0) * TITAN_WINDOW_MS;
  for (let k = Math.floor((from - CONVOY_SPAN_MS - phase) / TITAN_WINDOW_MS); k <= Math.floor((to - phase) / TITAN_WINDOW_MS); k++) {
    const at = phase + k * TITAN_WINDOW_MS + hash(s, 92_100, k) * TITAN_WINDOW_MS * 0.6;
    if (at > to) continue;
    const yard = yardAt(s, at);
    const needs = yard ? TITAN_NEEDS[yard.stage] : [];
    if (!needs.length) continue;
    const id = needs[Math.floor(hash(s, 92_200, k) * needs.length)];
    for (const v of convoy(s, voyageFor(s, 'in', 'titan', k, [{ id, t: at, qty: 20 + Math.floor(hash(s, 92_300, k) * 30) }], 'wy'), k)) if (v.at >= from && v.at <= to) out.push(v);
  }
  return out;
}

/** Relief ships: about this often while an event leaves a world short. */
export const RELIEF_WINDOW_MS = 7 * 60_000;

/** While an event leaves a world short of something (a famine, a plague), ships bring it: often the Mutual, who come when called. */
export function reliefVoyages(s: StarSystem, from: number, to: number): Voyage[] {
  const out: Voyage[] = [];
  const phase = hash(s, 93_000, 0) * RELIEF_WINDOW_MS;
  for (let k = Math.floor((from - CONVOY_SPAN_MS - phase) / RELIEF_WINDOW_MS); k <= Math.floor((to - phase) / RELIEF_WINDOW_MS); k++) {
    const at = phase + k * RELIEF_WINDOW_MS + hash(s, 93_100, k) * RELIEF_WINDOW_MS * 0.6;
    if (at > to) continue;
    const e = activeEvent(s, at);
    const short = e ? Object.entries(EVENT_KINDS[e.type].effects).filter(([id, v]) => v < 0 && COMMODITIES.some((c) => c.id === id)).map(([id]) => id) : [];
    if (!e || !short.length) continue;
    const id = short[Math.floor(hash(s, 93_200, k) * short.length)];
    const company = hash(s, 93_300, k) < 0.5 ? 'mutual' : pickCompany(s, hash(s, 93_400, k));
    const v = voyageFor(s, 'in', 'station', 1_000_000 + k, [{ id, t: at, qty: 15 + Math.floor(hash(s, 93_500, k) * 25) }], company);
    for (const c of convoy(s, v, k)) if (c.at >= from && c.at <= to) out.push({ ...c, id: `${c.id}:relief`, relief: e.type });
  }
  return out;
}

/** "food and machinery", "computers": the biggest three, by weight, and "more" if there's more. */
export function cargoWords(cargo: Consignment[]): string {
  const by = new Map<string, number>();
  for (const c of cargo) by.set(c.id, (by.get(c.id) ?? 0) + c.qty);
  const names = [...by].sort((a, b) => b[1] - a[1]).map(([id]) => goodName(id).toLowerCase());
  const shown = names.length > 3 ? [...names.slice(0, 3), 'more'] : names;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : (shown[0] ?? 'nothing much');
}

/** What a voyage's ship says first when hailed (the radio already shows its company and hull): its name, its cargo, where from or to. */
export function voyageHail(v: Voyage, otherName: string): string {
  const what = cargoWords(v.cargo);
  if (v.to === 'titan') return `${v.name}, in from ${otherName} with ${what} for the Titan.`;
  if (v.relief) return `${v.name}, in from ${otherName} with ${what}. Heard about the ${EVENT_KINDS[v.relief].name.toLowerCase()}.`;
  return v.leg === 'in' ? `${v.name}, in from ${otherName} with ${what}.` : `${v.name}, outbound for ${otherName} with ${what}.`;
}


/**
 * The direction, from this system's station, of the lane to another system:
 * the way it lies on the galaxy chart, tipped a little out of the plane.
 * Ships from Riedquat come in from Riedquat's side of the sky.
 */
export function laneDirection(s: StarSystem, other: number): [number, number, number] {
  const o = galaxy(s.galaxy)[other];
  const dx = o.x - s.x;
  const dz = o.y - s.y;
  const flat = Math.hypot(dx, dz) || 1;
  const tilt = (hash(s, 91_600, other) - 0.5) * 0.6;
  const v: [number, number, number] = [dx / flat, tilt, dz / flat];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
}
