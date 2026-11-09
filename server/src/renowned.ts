// Renowned pirates' shared record (src/game/renowned.ts; Mark: "will his story be available in shared
// space when other users go to the saloon?"): how commanders' meetings with each one went, so every
// commander hears the same story. Signed-in commanders with a callsign only; guests' fights stay in
// their own saves. accounts.ts keeps the rows; this checks them and sums them up.

import { systemAt } from '../../src/galaxy/generate';
import { OUT_OF_ACTION, renownedOf, type SharedRecord } from '../../src/game/renowned';

export type How = 'beaten' | 'won' | 'ran';
const HOWS: How[] = ['beaten', 'won', 'ran'];

/** One result per commander per pirate in this long: nobody can make him look beaten by repeating it. */
export const RESULT_GAP = 24 * 3600_000;
/** The record looks back this far. */
export const RECORD_WINDOW = 60 * 24 * 3600_000;

/** A result that makes sense: a real system, with a renowned pirate in it, and how it ended. */
export function isResult(x: unknown): x is { galaxy: number; system: number; how: How } {
  if (!x || typeof x !== 'object') return false;
  const { galaxy, system, how } = x as Record<string, unknown>;
  if (!Number.isInteger(galaxy) || (galaxy as number) < 0 || (galaxy as number) > 7) return false;
  if (!Number.isInteger(system) || (system as number) < 0 || (system as number) > 255) return false;
  return HOWS.includes(how as How) && renownedOf(systemAt(galaxy as number, system as number)) !== null;
}

/** A galaxy's rows, newest first, summed up per pirate: his tallies, when he's back, and the latest. */
export function summarise(rows: { system: number; how: How; at: number; callsign: string }[], now: number): (SharedRecord & { s: number })[] {
  const by = new Map<number, SharedRecord & { s: number }>();
  for (const r of rows) {
    const p = by.get(r.system) ?? { s: r.system, beaten: 0, won: 0, ran: 0, out: 0, recent: [] };
    p[r.how]++;
    if (r.how === 'beaten') p.out = Math.max(p.out, r.at + OUT_OF_ACTION);
    if (p.recent.length < 5) p.recent.push({ c: r.callsign, how: r.how, at: r.at });
    by.set(r.system, p);
  }
  for (const p of by.values()) if (p.out <= now) p.out = 0;
  return [...by.values()];
}
