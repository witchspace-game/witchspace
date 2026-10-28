// Checking a commander's ledger (src/game/ledger.ts) against the universe, each
// time their cloud save arrives. Everything in Witchspace comes from seeds, so
// the server can work out again what any good could have fetched at any station
// at any minute, and it keeps its own running account of the precious goods
// (gem-stones, gold, platinum) each commander has had. A sale that couldn't have
// happened, precious goods sold that were never had, or money from nowhere at an
// impossible rate, flags the account. Flags don't stop anyone playing; they
// close the numbered editions until a maintainer looks (tools/editions.ts).

import { chain, type Entry, type Ledger } from '../../src/game/ledger';
import { priceBounds } from '../../src/economy/market';
import { systemAt } from '../../src/galaxy/generate';

/** What the server remembers between saves: where it got to, and what it has counted. */
export interface Anchor {
  /** The hash of the last entry checked. */
  h: string;
  /** Precious goods had (grams or kilograms), by good. */
  precious: Record<string, number>;
  /** Sats had. */
  sats: number;
  /** "Other" money gained, for the rate check: [time, credits] for the last day. */
  other: [number, number][];
  flags: string[];
}

export const PRECIOUS = new Set(['gems', 'gold', 'platinum']);
/** The most of a precious good one scoop can hold: a trail's treasure, the largest find. */
const SCOOP_MAX: Record<string, number> = { gems: 600, gold: 250, platinum: 50 };
/** The back room pays up to this much over the market, in the most lawless places. */
const BACK_ROOM = 3.3;
/** Money from what the server can't recompute (bounties, contracts, assignments): at most this in a day. */
export const OTHER_PER_DAY = 400_000;
const DAY = 86_400_000;
const SLACK = 1.02;

type Held = { orders?: { id: string; side: string; qty: number }[]; storage?: Record<string, number> };
export type Save = { credits?: number; cargo?: Record<string, number>; sats?: number; ledger?: Ledger; markets?: object };

/** Precious goods anywhere they could be: the hold, station storage and open sell orders. */
function preciousHeld(save: Save): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string, q: number) => PRECIOUS.has(id) && q > 0 && (out[id] = (out[id] ?? 0) + q);
  for (const [id, q] of Object.entries(save.cargo ?? {})) add(id, q);
  for (const m of Object.values((save.markets ?? {}) as Record<string, Held>)) {
    for (const [id, q] of Object.entries(m.storage ?? {})) add(id, q);
    for (const o of m.orders ?? []) if (o.side === 'sell') add(o.id, o.qty);
  }
  return out;
}

/** The first time the server sees a ledger: what the commander has then is taken as theirs. */
export function firstAnchor(save: Save): Anchor {
  const l = save.ledger;
  const last = l?.entries.length ? l.entries[l.entries.length - 1].h : (l?.head ?? 'start');
  return { h: last, precious: preciousHeld(save), sats: save.sats ?? 0, other: [], flags: [] };
}

/** Check what's new in the ledger since the anchor. Returns the anchor moved on, with any new flags. */
export function verify(anchor: Anchor, save: Save): Anchor {
  const l = save.ledger;
  const out: Anchor = { ...anchor, precious: { ...anchor.precious }, other: [...anchor.other], flags: [...anchor.flags] };
  const flag = (why: string) => {
    if (!out.flags.includes(why)) out.flags = [...out.flags, why].slice(-12);
  };
  if (!l) return out;
  let from = l.entries.findIndex((e) => e.h === anchor.h);
  if (from < 0 && l.head !== anchor.h) {
    // Either history was rewritten, or more than a ledger's worth happened between saves: start again from here.
    flag('ledger: doesn’t continue from the last one checked');
    return { ...firstAnchor(save), flags: out.flags };
  }
  let prev = from < 0 ? l.head : anchor.h;
  for (const e of l.entries.slice(from + 1)) {
    if (e.h !== chain(prev, e)) flag(`ledger: entry at ${new Date(e.t).toISOString()} altered`);
    prev = e.h;
    check(e, out, flag);
  }
  out.h = prev;
  if (typeof save.credits === 'number' && Math.abs(save.credits - l.balance) > 1) flag(`credits ${save.credits} don’t match the ledger’s ${l.balance}`);
  return out;
}

function check(e: Entry, out: Anchor, flag: (why: string) => void) {
  const where = e.s ? systemAt(e.s[0], e.s[1]) : null;
  const q = e.q ?? 0;
  // A trade of goods for money: the price per unit has to be one the market could have given.
  if (e.g && e.g !== 'btc' && q !== 0 && e.d !== 0 && where && (e.k === 'sell' || e.k === 'buy' || e.k === 'fill' || e.k === 'back')) {
    const unit = Math.abs(e.d) / Math.abs(q);
    const { lo, hi } = priceBounds(where, e.g, e.t);
    const top = (e.k === 'back' ? hi * BACK_ROOM : hi) * SLACK;
    if (e.d > 0 && unit > top + 0.05) flag(`${e.k}: ${e.g} at ${unit.toFixed(2)} Cr in ${where.name}, more than it ever fetched there`);
    if (e.d < 0 && e.k !== 'back' && unit < lo / SLACK - 0.05) flag(`${e.k}: ${e.g} bought at ${unit.toFixed(2)} Cr in ${where.name}, less than it ever cost there`);
  }
  // Precious goods: you can only sell what you've had.
  if (e.g && PRECIOUS.has(e.g)) {
    if (e.k === 'scoop' && q > SCOOP_MAX[e.g]) flag(`scoop: ${q} of ${e.g} in one canister`);
    out.precious[e.g] = (out.precious[e.g] ?? 0) + q;
    if (out.precious[e.g] < -0.5) {
      flag(`sold ${e.g} never had`);
      out.precious[e.g] = 0;
    }
  }
  if (e.g === 'btc') {
    out.sats += q;
    if (out.sats < -1) {
      flag('sold Bitcoin never had');
      out.sats = 0;
    }
  }
  // Money the server can't recompute: held to a plausible rate.
  if (e.k === 'other' && e.d > 0) {
    out.other = [...out.other.filter(([t]) => t > e.t - DAY), [e.t, e.d]];
    const day = out.other.reduce((n, [, d]) => n + d, 0);
    if (day > OTHER_PER_DAY) flag(`other income: ${Math.round(day).toLocaleString()} Cr in a day, more than play earns`);
  }
}
