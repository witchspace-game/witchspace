// Odile Venn, the galaxy's first trading character (docs/design/character-odile-venn.md), step 1:
// her run, worked out from the clock like the rest of the traffic, so every commander sees her in
// the same place at the same time. A Carriers' Mutual captain in an old Cobra Mk III, Second Wind,
// in a pale rose nobody else flies (Mark, 2 November 2026), with the large cargo bay and a shielded
// compartment she doesn't talk about.
//
// Her day: the triangle Lave, Leesti, Diso, eight times over, and once a day, after Diso, the detour
// to Riedquat with food she sells at cost. Twenty-five stops a day, a little under an hour each: a
// few minutes in on her lane, most of it in port (in the saloon), a few minutes out.
//
// Pure: no scene, no state. Modern rules, first galaxy.

import { COMMODITIES } from '../economy/commodities';
import { freshMarket, priceAt } from '../economy/market';
import { hash } from '../economy/seed';
import { systemAt, type StarSystem } from '../galaxy/generate';
import type { Consignment, Voyage } from './traffic';

export const VENN = { name: 'Odile Venn', ship: 'Second Wind', hull: 'cobra-mk3', colour: '#ffb3d1', hold: 35 };

const LAVE = 7;
const LEESTI = 55;
const DISO = 147;
const RIEDQUAT = 46;
/** Her systems, in the first galaxy. */
export const VENN_STOPS = [LAVE, LEESTI, DISO, RIEDQUAT];

const DAY = 86_400_000;
const STOPS_A_DAY = 25;
/** One stop: in on her lane, in port, out to her jump point. */
export const STOP_MS = DAY / STOPS_A_DAY;
/** Docked this long after her stop begins (a little drift from the seed, so she's a regular, not a train). */
const DOCKS_AFTER = [3, 7];
/** Launches this long before her stop ends. */
const LAUNCHES_BEFORE = 6 * 60_000;

/** Her stops on a day: the triangle eight times, with Riedquat after one Diso, a different one each day. */
function stopsOn(day: number): number[] {
  const detour = Math.floor(hash(systemAt(0, LAVE), 140_000, day) * 7);
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    out.push(LAVE, LEESTI, DISO);
    if (k === detour) out.push(RIEDQUAT);
  }
  return out;
}

export interface Visit {
  /** Which stop of all her stops: stable, for ids. */
  n: number;
  system: number;
  /** Where she came from and goes next. */
  from: number;
  next: number;
  /** When she docks and launches. */
  docks: number;
  launches: number;
}

function visitAt(day: number, i: number): Visit {
  const stops = stopsOn(day);
  const start = day * DAY + i * STOP_MS;
  const prev = i > 0 ? stops[i - 1] : stopsOn(day - 1)[STOPS_A_DAY - 1];
  const next = i < STOPS_A_DAY - 1 ? stops[i + 1] : stopsOn(day + 1)[0];
  const n = day * STOPS_A_DAY + i;
  const docks = start + (DOCKS_AFTER[0] + hash(systemAt(0, stops[i]), 140_100, n) * (DOCKS_AFTER[1] - DOCKS_AFTER[0])) * 60_000;
  return { n, system: stops[i], from: prev, next, docks, launches: start + STOP_MS - LAUNCHES_BEFORE };
}

/** Her stops that overlap `from` to `to`, anywhere. */
export function vennVisits(from: number, to: number): Visit[] {
  const out: Visit[] = [];
  for (let n = Math.floor(from / STOP_MS) - 1; n <= Math.floor(to / STOP_MS); n++) {
    const day = Math.floor(n / STOPS_A_DAY);
    out.push(visitAt(day, n - day * STOPS_A_DAY));
  }
  return out;
}

/** Where she is at `t`. */
export const vennAt = (t: number): Visit => vennVisits(t, t).find((v) => t >= v.n * STOP_MS && t < (v.n + 1) * STOP_MS)!;

/** In port at `s` now, or the next time she docks there (within a day). Null if she never calls. */
export function vennAtStation(s: StarSystem, now: number): { visit: Visit; inPort: boolean } | null {
  if (s.galaxy !== 0 || !VENN_STOPS.includes(s.index)) return null;
  const visit = vennVisits(now, now + DAY).find((v) => v.system === s.index && v.launches > now);
  return visit ? { visit, inPort: now >= visit.docks } : null;
}

/** What she carries on the leg from one stop to the next: real goods, in her 35 t. */
export function legCargo(from: number, to: number, at: number): Consignment[] {
  const load = (ids: string[]) => ids.map((id, i) => ({ id, t: at, qty: i === 0 ? 20 : 15 }));
  if (to === RIEDQUAT) return load(['food']);
  if (from === RIEDQUAT) return []; // home light, as she always comes back from there
  if (from === LAVE) return load(['food', 'textiles']);
  if (from === LEESTI) return load(['machinery', 'computers']);
  // Diso: whatever it has spare. She's never fussy about the last leg.
  const spare = ['minerals', 'alloys', 'liquor', 'radioactives'];
  return load([spare[Math.floor(hash(systemAt(0, DISO), 140_200, Math.floor(at / STOP_MS)) * spare.length)]]);
}

/** Her ship in the traffic at `s`: in to dock and out again, as voyages like any other. */
export function vennVoyages(s: StarSystem, from: number, to: number): Voyage[] {
  if (s.galaxy !== 0 || !VENN_STOPS.includes(s.index)) return [];
  const out: Voyage[] = [];
  for (const v of vennVisits(from, to)) {
    if (v.system !== s.index) continue;
    const base = { to: 'station' as const, company: 'mutual' as const, hull: VENN.hull, name: VENN.ship, escorts: 0, character: 'venn' as const };
    if (v.docks >= from && v.docks <= to) out.push({ ...base, id: `venn:${v.n}:in`, leg: 'in', at: v.docks, cargo: legCargo(v.from, v.system, v.docks), other: v.from });
    if (v.launches >= from && v.launches <= to) out.push({ ...base, id: `venn:${v.n}:out`, leg: 'out', at: v.launches, cargo: legCargo(v.system, v.next, v.launches), other: v.next });
  }
  return out;
}

/** Her answer to a hail: in her own words, not the timetable's. */
export function vennHail(v: Voyage, here: string, other: string, words: string): string {
  if (v.leg === 'in') return v.cargo.length ? `Venn, Second Wind, Mutual. ${cap(words)} for ${here}, if you're asking, and you are.` : `Venn, Second Wind, Mutual. In light from ${other}, as ever. Don't ask.`;
  return v.cargo.length ? `Venn, Second Wind, Mutual. ${cap(words)} for ${other}. Mind how you go.` : `Venn, Second Wind, Mutual. Out to ${other}, light. Mind how you go.`;
}

/**
 * Honest prices, carried by hand: what she saw where she's just come from, as of when she left, set
 * against here. The good it would have paid most to bring. She's never wrong about what she saw.
 */
export function vennPrices(here: StarSystem, visit: Visit, now: number): { good: string; there: number; here: number; from: number } | null {
  const from = systemAt(0, visit.from);
  const left = visit.docks - 15 * 60_000;
  let best: { good: string; there: number; here: number; from: number; gain: number } | null = null;
  for (const c of COMMODITIES) {
    if (c.legality === 'illegal') continue;
    const there = priceAt(from, freshMarket(from, left), c.id, left);
    const now_ = priceAt(here, freshMarket(here, now), c.id, now);
    const gain = now_ / there;
    if (!best || gain > best.gain) best = { good: c.name, there: Math.round(there * 10) / 10, here: Math.round(now_ * 10) / 10, from: visit.from, gain };
  }
  return best;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
