// Renowned pirates' shared record (server/src/renowned.ts): fetched a galaxy at a time, like the
// firsts, so the saloon, the news, the chart and the man himself know what other commanders did.
// Signed in with a callsign, your own results are told to it; signed out, they stay in your save.

import type { SharedRecord } from '../game/renowned';
import { API, currentAccount, sessionToken } from './account';

const CACHE_MS = 5 * 60_000;
const cache = new Map<number, { at: number; bySystem: Map<number, SharedRecord> }>();
const loading = new Map<number, Promise<void>>();

/** Fetch a galaxy's record, if it isn't fresh already. Offline, the game goes on with your own memory. */
export function loadRenowned(galaxy: number): Promise<void> {
  const have = cache.get(galaxy);
  if (have && Date.now() - have.at < CACHE_MS) return Promise.resolve();
  const busy = loading.get(galaxy);
  if (busy) return busy;
  const p = fetch(`${API}/renowned/${galaxy}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ pirates: (SharedRecord & { s: number })[] }>) : { pirates: [] }))
    .then(({ pirates }) => {
      const bySystem = new Map<number, SharedRecord>();
      for (const p of pirates) bySystem.set(p.s, p);
      cache.set(galaxy, { at: Date.now(), bySystem });
    })
    .catch(() => {})
    .finally(() => loading.delete(galaxy));
  loading.set(galaxy, p);
  return p;
}

/** A galaxy's records, by system (from the last fetch). */
export const sharedIn = (galaxy: number): Map<number, SharedRecord> => cache.get(galaxy)?.bySystem ?? new Map();

/** What everyone knows of a system's pirate (from the last fetch), if anything. */
export const sharedRecord = (galaxy: number, system: number): SharedRecord | undefined => cache.get(galaxy)?.bySystem.get(system);

/** How your meeting went: told to the server if you're signed in with a callsign, and to the cache at once. */
export async function tellRenowned(galaxy: number, system: number, how: 'beaten' | 'won' | 'ran', now = Date.now()): Promise<void> {
  const callsign = currentAccount()?.callsign;
  const session = sessionToken();
  if (!session || !callsign) return;
  const g = cache.get(galaxy) ?? { at: 0, bySystem: new Map() };
  cache.set(galaxy, g);
  const r = g.bySystem.get(system) ?? { beaten: 0, won: 0, ran: 0, out: 0, recent: [] };
  r[how]++;
  if (how === 'beaten') r.out = now + 3 * 24 * 3600_000;
  r.recent = [{ c: callsign, how, at: now }, ...r.recent].slice(0, 5);
  g.bySystem.set(system, r);
  await fetch(`${API}/me/renowned`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
    body: JSON.stringify({ galaxy, system, how }),
  }).catch(() => undefined);
}
