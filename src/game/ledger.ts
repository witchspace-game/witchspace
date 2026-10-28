// The ledger: how a commander's money was made, chained by hash, so the server
// can check it against the universe itself. Everything in Witchspace comes from
// seeds, as it did for Bell and Braben: the price of gold at Lave at a given
// minute is a number anyone can work out again. So a sale that couldn't have
// happened, or precious goods sold that were never had, show up when the
// server replays the ledger (server/src/ledger.ts). Money the server can't
// recompute (bounties, contracts) is kept as "other" and held to a plausible rate.
//
// Explicit entries cover the trades that matter: market sales and purchases,
// limit-order fills, the back room, Bitcoin and salvage scooped. Anything else
// that moves the balance is noticed when the game saves (reconcile).

import type { Commander } from './commander';

export type EntryKind = 'sell' | 'buy' | 'fill' | 'back' | 'scoop' | 'btc' | 'yard' | 'fx' | 'other';

export interface Entry {
  /** When (ms). */
  t: number;
  k: EntryKind;
  /** Credits in (+) or out (−). */
  d: number;
  /** The good, and how many of its units (sats for Bitcoin; negative for goods or sats that left). */
  g?: string;
  q?: number;
  /** Where: galaxy and system index. */
  s?: [number, number];
  /** This entry chained to the one before. */
  h: string;
}

export interface Ledger {
  entries: Entry[];
  /** The balance after the last entry. */
  balance: number;
  /** The hash the first kept entry chains from: 'start', or the last entry dropped off the front. */
  head: string;
}

const MAX_ENTRIES = 1000;

/** FNV-1a, twice with different seeds, as 16 hex digits. Not a secret: a chain anyone can check. */
export function fnv(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 ^ 0x2c1b3c6d) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

const body = (e: Omit<Entry, 'h'>) => JSON.stringify([e.t, e.k, e.d, e.g ?? null, e.q ?? null, e.s ?? null]);
export const chain = (prev: string, e: Omit<Entry, 'h'>) => fnv(prev + body(e));

const round1 = (n: number) => Math.round(n * 10) / 10;

export function ledgerOf(c: Commander): Ledger {
  return (c.ledger ??= { entries: [], balance: c.credits, head: 'start' });
}

function push(l: Ledger, e: Omit<Entry, 'h'>) {
  const prev = l.entries.length ? l.entries[l.entries.length - 1].h : l.head;
  l.entries.push({ ...e, d: round1(e.d), h: chain(prev, { ...e, d: round1(e.d) }) });
  l.balance = round1(l.balance + e.d);
  while (l.entries.length > MAX_ENTRIES) l.head = l.entries.shift()!.h;
}

/** Whatever moved the balance since the last entry, as "other". */
export function reconcile(c: Commander, now = Date.now()) {
  const l = ledgerOf(c);
  const gap = round1(c.credits - l.balance);
  if (Math.abs(gap) >= 0.1) push(l, { t: now, k: 'other', d: gap });
}

/** Record a trade, after it has changed the credits (and the hold). */
export function record(c: Commander, e: Omit<Entry, 'h' | 't'> & { t?: number }) {
  const l = ledgerOf(c);
  const now = e.t ?? Date.now();
  // Anything unexplained before this trade is "other"; then the trade itself.
  const gap = round1(c.credits - e.d - l.balance);
  if (Math.abs(gap) >= 0.1) push(l, { t: now, k: 'other', d: gap });
  push(l, { ...e, t: now });
}
