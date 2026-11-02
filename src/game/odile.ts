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
import { distanceLy, galaxy, systemAt, type StarSystem } from '../galaxy/generate';
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
 * against here. The goods it would have paid most to bring, best first. She's never wrong about what she saw.
 */
export function vennSightings(here: StarSystem, visit: Visit, now: number): { good: string; there: number; here: number; from: number }[] {
  const from = systemAt(0, visit.from);
  const left = visit.docks - 15 * 60_000;
  return COMMODITIES.filter((c) => c.legality !== 'illegal')
    .map((c) => {
      const there = priceAt(from, freshMarket(from, left), c.id, left);
      const now_ = priceAt(here, freshMarket(here, now), c.id, now);
      return { good: c.name, there: Math.round(there * 10) / 10, here: Math.round(now_ * 10) / 10, from: visit.from, gain: now_ / there };
    })
    .sort((a, b) => b.gain - a.gain)
    .map(({ gain: _gain, ...p }) => p);
}

/** The one good it would have paid most to bring from her last stop. */
export const vennPrices = (here: StarSystem, visit: Visit, now: number) => vennSightings(here, visit, now)[0] ?? null;

// --- Her memory of you (step 2) -------------------------------------------------------------

/** What she remembers of you: a few counters in your save. */
export interface VennMemory {
  drinks: number;
  hails: number;
  /** Legs flown alongside her, jump-in to dock. */
  legs: number;
  /** Her distress calls you answered. */
  saved: number;
  shots: number;
  /** When you last crossed her (fired on her again, or destroyed her). */
  crossedAt?: number;
  /** When Second Wind was last lost, in your world: she's back a day later. */
  lostAt?: number;
  /** She told you about Meridian, and the ledgers. */
  riedquat?: boolean;
}

export const freshMemory = (): VennMemory => ({ drinks: 0, hails: 0, legs: 0, saved: 0, shots: 0 });

export type VennStanding = 'stranger' | 'known' | 'trusted' | 'crossed';

/** How long she won't drink with you, or the Mutual tender you, after you've crossed her. She forgives most things; she forgets nothing. */
export const CROSSED_FOR = 7 * DAY;
/** How long Second Wind is away after she's lost: repaired, and back on her run. */
export const LOST_FOR = DAY;

export function vennStanding(m: VennMemory | undefined, now: number): VennStanding {
  if (!m) return 'stranger';
  if (m.crossedAt !== undefined && now - m.crossedAt < CROSSED_FOR) return 'crossed';
  if (m.saved > 0 || m.legs > 0) return 'trusted';
  if (m.drinks >= 2 || m.hails > 0) return 'known';
  return 'stranger';
}

/** Away being repaired, in your world: not in the traffic, not in the saloon. */
export const vennAway = (m: VennMemory | undefined, now: number) => m?.lostAt !== undefined && now - m.lostAt < LOST_FOR;

/**
 * Her best route from here, from the ledgers: the legal good that pays most per tonne to buy here
 * and sell at a world within a jump. Worked out from the real markets, so it really is the best, now.
 */
export function vennRoute(here: StarSystem, now: number): { good: string; buy: number; to: number; sell: number } | null {
  let best: { good: string; buy: number; to: number; sell: number; gain: number } | null = null;
  const near = galaxy(here.galaxy).filter((s) => s !== here && distanceLy(here, s) <= 7);
  const hereMarket = freshMarket(here, now);
  for (const c of COMMODITIES) {
    if (c.legality === 'illegal' || c.unit !== 't') continue;
    const buy = priceAt(here, hereMarket, c.id, now);
    for (const s of near) {
      const sell = priceAt(s, freshMarket(s, now), c.id, now);
      if (!best || sell - buy > best.gain) best = { good: c.name, buy: Math.round(buy * 10) / 10, to: s.index, sell: Math.round(sell * 10) / 10, gain: sell - buy };
    }
  }
  return best && best.gain > 0 ? { good: best.good, buy: best.buy, to: best.to, sell: best.sell } : null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
