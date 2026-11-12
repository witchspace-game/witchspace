// The arrivals board shows a convoy as one line (Mark): the lead, "with" her sisters,
// and how many ships. A follower's voyage id is the lead's plus ":c1", ":c2"…
// (game/traffic.ts convoy()), on the same company, lane and leg.

import type { Voyage } from '../game/traffic';

export interface Arrival {
  /** The first ship of the group due in: her time is the line's time. */
  lead: Voyage;
  /** The rest of the convoy still to come, in order. */
  with: Voyage[];
  /** True when the convoy's lead has already docked, so these are the last of it. */
  rest: boolean;
}

/** A voyage's convoy: the lead's id. */
export const convoyOf = (v: Voyage) => v.id.replace(/:c\d+$/, '');

/** Voyages (in time order) gathered into one line per convoy, at most `max` lines. */
export function groupConvoys(due: Voyage[], max = Infinity): Arrival[] {
  const out: Arrival[] = [];
  const by = new Map<string, Arrival>();
  for (const v of due) {
    const key = `${v.leg}|${convoyOf(v)}`;
    const group = by.get(key);
    if (group) group.with.push(v);
    else {
      const a: Arrival = { lead: v, with: [], rest: v.id !== convoyOf(v) };
      by.set(key, a);
      out.push(a);
    }
  }
  return out.slice(0, max);
}

/** "Cold Comfort and Even Keel", "A, B and C". */
export function andList(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}
