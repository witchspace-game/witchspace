// Every ship has a transponder number (Mark, 10 November 2026: "Why don't we just issue every ship a
// transponder number?"). See docs/design/shared-space.md, step 4a, "Every ship has a transponder number".
//
// - A commander's ship: WS- and a mixed code, WS-7F3K-29, made in the game when the hull first exists.
//   It belongs to the hull, not the commander: a repaint or a rename keeps it, a new hull gets a new one,
//   and an insurers' replacement gets its own number, linked to the old ("replaces WS-7F3K-29").
// - An NPC's: two letters for her home system, then four digits, LA-4471, worked out from a seed so
//   everyone who sees the same ship sees the same number. A commander's is never mistaken for an NPC's.
//
// Until registration (step 1), a commander's number is a label made in the browser: it works everywhere
// but shared space. Registering writes the same number into the server's registry.

import type { Commander, StoredShip } from './commander';

/** No I, O, 0 or 1: a number read over the radio can't be misheard. */
const CODE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

function randomIndex(n: number): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

const pick = (from: string, n: number, next: (n: number) => number) => Array.from({ length: n }, () => from[next(from.length)]).join('');

/** A commander's ship number: WS-7F3K-29. */
export const newShipNumber = (next: (n: number) => number = randomIndex) => `WS-${pick(CODE, 4, next)}-${pick(DIGITS, 2, next)}`;

export const isShipNumber = (s: unknown): s is string => typeof s === 'string' && /^WS-[2-9A-HJ-NP-Z]{4}-\d{2}$/.test(s);

/** FNV-1a, for NPC numbers from a seed. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** The two letters of a home system: Lave LA, Riedquat RI. Never WS, which is a commander's. */
export function regionLetters(system: string): string {
  const letters = system.toUpperCase().replace(/[^A-Z]/g, '');
  const two = (letters + 'XX').slice(0, 2);
  return two === 'WS' ? 'WZ' : two;
}

/** An NPC's number, the same for everyone who sees her: LA-4471. */
export const npcNumber = (home: string, seed: string) => `${regionLetters(home)}-${String(fnv(seed) % 10000).padStart(4, '0')}`;

/** The number of the ship you fly, given one if she hasn't one yet (older saves, a new hull). */
export function shipNumberOf(c: Commander): string {
  if (!isShipNumber(c.shipNumber)) c.shipNumber = newShipNumber();
  return c.shipNumber;
}

/** A new hull under you (bought, or the insurers' replacement): a new number, linked to the old when it replaces her. */
export function newHull(c: Commander, replaces: boolean) {
  const old = c.shipNumber;
  c.shipNumber = newShipNumber();
  if (replaces && isShipNumber(old)) c.replaces = old;
  else delete c.replaces;
}

/** Into the hangar: her number goes with her. */
export const stowNumber = (c: Commander): Pick<StoredShip, 'number' | 'replaces'> => ({ number: shipNumberOf(c), ...(c.replaces ? { replaces: c.replaces } : {}) });

/** Out of the hangar: you fly under her number. */
export function boardNumber(c: Commander, s: StoredShip) {
  c.shipNumber = isShipNumber(s.number) ? s.number : newShipNumber();
  if (s.replaces) c.replaces = s.replaces;
  else delete c.replaces;
}
