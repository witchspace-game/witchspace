// Trade moments (Mark: "you could fly, trade, explore, build and then post
// straight to twitter"): the flight recorder keeps a trade worth boasting of,
// as it keeps a kill. Two kinds (docs/design/flight-recorder.md):
// - a run: a sale at the station that made a real profit over what the goods
//   cost, the best of the trip;
// - an order filled while you were away: a sell order you left at another
//   station that filled, learned when the news reached you.
// What the goods cost comes from the ledger (game/ledger.ts): the latest buys of
// that good, matched to the units sold. Pure: tested in tradeMoments.test.ts.

import type { Entry } from './ledger';

/** A run worth keeping makes at least this much, and this much over what the goods cost. */
export const RUN_PROFIT = 1000;
export const RUN_MARGIN = 0.3;

export interface Run {
  good: string;
  /** Units sold (tonnes, or kg or g for precious goods). */
  units: number;
  proceeds: number;
  /** What those units cost, from the ledger's buys; null if the ledger doesn't hold them all. */
  cost: number | null;
  /** Where it sold: galaxy and system index. */
  at: [number, number];
  t: number;
}

const sells = (e: Entry) => (e.k === 'sell' || e.k === 'fill') && (e.q ?? 0) < 0 && e.d > 0 && e.g !== undefined && e.s !== undefined;
const buys = (e: Entry, good: string) => (e.k === 'buy' || e.k === 'fill') && e.g === good && (e.q ?? 0) > 0 && e.d < 0;

/**
 * A sale and what it made: its units matched against the latest buys of that good before it
 * (the run they were bought for). Null for an entry that isn't a sale.
 */
export function runOf(entries: Entry[], i: number): Run | null {
  const sale = entries[i];
  if (!sale || !sells(sale)) return null;
  const units = -(sale.q ?? 0);
  let left = units;
  let cost = 0;
  for (let k = i - 1; k >= 0 && left > 0; k--) {
    const b = entries[k];
    if (!buys(b, sale.g!)) continue;
    const n = Math.min(left, b.q!);
    cost += (-b.d * n) / b.q!;
    left -= n;
  }
  return { good: sale.g!, units, proceeds: sale.d, cost: left > 0 ? null : Math.round(cost * 10) / 10, at: sale.s!, t: sale.t };
}

export const profitOf = (r: Run) => (r.cost === null ? null : Math.round((r.proceeds - r.cost) * 10) / 10);

/** A run to boast of: a real profit, and a real margin on what the goods cost. */
export function isRun(r: Run): boolean {
  const p = profitOf(r);
  return p !== null && r.cost !== null && p >= RUN_PROFIT && p >= r.cost * RUN_MARGIN;
}

/** What `seen` is when the ledger was empty at the last look: everything after it is new. */
export const EMPTY = 'empty';

/**
 * Where the new entries start: after the one with hash `seen`; all of them if the ledger was empty
 * then; none on the first look (an old save's history isn't news) or if it was trimmed away.
 */
export function newSince(entries: Entry[], seen: string | undefined): number {
  if (seen === EMPTY) return 0;
  if (!seen) return entries.length;
  const i = entries.findIndex((e) => e.h === seen);
  return i < 0 ? entries.length : i + 1;
}

/** What to remember as seen after a look. */
export const seenNow = (entries: Entry[]) => entries[entries.length - 1]?.h ?? EMPTY;

/** The line for a run: "Ran medicine into the plague" when an event there wants it, else "A good run of medicine". */
export const runLine = (goodName: string, eventName: string | null) =>
  eventName ? `Ran ${goodName.toLowerCase()} into the ${eventName.toLowerCase()}` : `A good run of ${goodName.toLowerCase()}`;

/** The line for an order filled away: "Order filled at Lave while I was at Diso". */
export const filledLine = (at: string, here: string) => (at === here ? `Order filled at ${at}` : `Order filled at ${at} while I was at ${here}`);
